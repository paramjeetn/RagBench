# RagBench — Interview Walkthrough (Project Deep Dive)

This document simulates a real technical interview. Interviewer questions are in **bold**. Answers are thorough and honest.

---

## Opening: What is the project?

**"Walk me through RagBench. What does it do and why did you build it?"**

RagBench is a containerized RAG (Retrieval-Augmented Generation) evaluation engine. You upload documents, ask questions against them through a full RAG pipeline, and then systematically measure answer quality using the RAG Triad — five metrics that cover every failure mode in a RAG system.

The core purpose is experimentation. You can swap chunking strategies (fixed, recursive, semantic, document-aware), switch retrieval modes (dense, sparse, hybrid), toggle reranking, change embedding models, and then run the same evaluation suite again to see how those changes move the metrics. It's a benchmarking tool for your own RAG pipeline.

I built it because most RAG tutorials show you how to get an answer — they don't show you how to measure whether the answer is actually good, or how to systematically improve the pipeline when it's not.

---

## Architecture

**"Give me the high-level architecture."**

Five Docker containers, all orchestrated by Docker Compose:

1. **PostgreSQL 16** — relational metadata store. Documents, datasets, test cases, eval runs, eval results. Everything that's structured and needs to persist.
2. **Qdrant** — vector database. Stores chunk embeddings with HNSW indexing for fast approximate nearest-neighbor search.
3. **Backend** — Python 3.12 / FastAPI. The entire RAG pipeline lives here: ingestion, retrieval, generation, evaluation.
4. **Seed** — one-shot container that loads sample documents and pre-computed eval runs on first startup, then exits.
5. **Frontend** — Next.js 16. Dashboard, chat, document management, evaluation UI.

The backend waits for both Postgres and Qdrant to be healthy before it accepts traffic. The seed container waits for the backend.

---

## Ingestion Pipeline

**"A user uploads a PDF. Walk me through exactly what happens."**

The request hits `POST /api/ingest` (or `POST /api/projects/{id}/ingest` if scoped to a project). The route handler reads the uploaded file bytes and filename, then calls `IngestionPipeline.ingest()`.

Step 1 — **Parse**: `parse_document()` detects file type by extension. For PDFs it uses `pypdf` to extract text page by page and records `page_count` in metadata. For Markdown and plain text it reads directly. Output is a `ParsedDocument` with `.text` and `.metadata`.

Step 2 — **Chunk**: `chunk_text()` dispatches to one of four strategies based on the current `PipelineConfig`:
- **Fixed**: pure character-level sliding window. Chunk size 500 chars, overlap 50 chars. Fast, dumb, baseline.
- **Recursive**: tries to split on `\n\n`, then `\n`, then `. `, then ` `, then hard character split. Respects natural language boundaries.
- **Semantic**: splits into sentences, groups them into initial chunks of ~chunk_size chars, then calls the embedder on those groups and merges adjacent chunks whose cosine similarity exceeds 0.8. Produces semantically coherent chunks.
- **Document-aware**: finds Markdown headers, numbered sections, Chapter headings, horizontal rules using regex. Splits on those structure markers first, then recursively chunks each section body. Each chunk's metadata carries the section header.

Step 3 — **Embed**: calls `embedder.embed(list_of_chunk_texts)`. The embedder is one of three providers: OpenAI (`text-embedding-3-small` at 1536 dims, or `text-embedding-3-large` at 3072), Gemini (`gemini-embedding-001` at 768 dims), or FastEmbed local (`BAAI/bge-small-en-v1.5` at 384 dims). Default is FastEmbed because it needs no API key and runs inside the container.

Step 4 — **Store in Qdrant**: `vector_store.upsert()` creates a `PointStruct` per chunk with the embedding vector plus a payload containing `text`, `doc_id`, `source_file`, `page_number`, `chunk_index`, `chunk_strategy`, and optionally `project_id`. Batched at 100 points per upsert call.

Step 5 — **Store in BM25 index**: the same chunks are added to an in-memory `BM25Index` (backed by `rank_bm25.BM25Okapi`). Tokens are simple lowercased whitespace splits. This index is rebuilt lazily when dirty.

Step 6 — The document metadata (filename, file type, chunk count, strategy, the raw file bytes) is written to the `documents` table in Postgres via SQLAlchemy async.

**"Why store the raw file bytes in Postgres?"**

Re-indexing. When the user changes chunking strategy or embedding model, the system needs to re-chunk and re-embed all existing documents. Rather than requiring the user to re-upload, we replay from the stored bytes. The `reindex_all()` method wipes the Qdrant collection and BM25 index, then re-ingests every document from its stored bytes using the new config.

**"Why have both Qdrant and BM25? Aren't they redundant?"**

They're complementary. Qdrant does dense vector search — finds semantically similar chunks even if they use different words. BM25 does sparse keyword search — finds exact term matches. Hybrid mode combines both via Reciprocal Rank Fusion, which consistently outperforms either alone. Dense search fails on rare proper nouns and technical jargon. BM25 fails on paraphrased questions. Together they cover each other's blind spots.

---

## Collection Naming

**"You mentioned Qdrant. How do you handle different embedding dimensions when the user switches models?"**

This was a real design problem. If you change from OpenAI (1536 dims) to BAAI/bge-small (384 dims), you can't reuse the same Qdrant collection — vector dimensions are fixed at collection creation time.

The solution is scoped collection names. `get_collection_name()` builds the name from the chunking strategy, chunk size, overlap, embedding provider, and dimension:

```
docs_{strategy}_{chunk_size}_{overlap}_{provider}_{dimension}
e.g. docs_recursive_500_50_local_384
```

Each unique pipeline config gets its own Qdrant collection. When the user changes config, `reindex_all()` creates a new collection with the right dimension and re-ingests everything into it. The old collection is cleaned up separately.

---

## Query Pipeline

**"User types a question. What happens?"**

`POST /api/query` or `POST /api/query/stream`. Hits `QueryPipeline.query()` or `QueryPipeline.query_stream()`.

Step 1 — **Embed the query**: same embedder as ingestion. The question becomes a vector.

Step 2 — **Retrieve**: based on `RetrievalConfig.mode`:
- Dense: `DenseRetriever.retrieve()` — embeds the query, calls `qdrant_store.search()` with `top_k=50`.
- Sparse: `BM25Index.search()` — tokenizes query, scores all docs with BM25Okapi, returns `top_k=50`.
- Hybrid: both dense and sparse with `top_k=50` each, then `reciprocal_rank_fusion()` fuses the lists, returns top 20.

Step 3 — **Rerank**: if `reranker_enabled=True`, `CrossEncoderReranker.rerank()` loads `Xenova/ms-marco-MiniLM-L-6-v2` via FastEmbed's `TextCrossEncoder`, scores each `(query, chunk)` pair, applies sigmoid to get `[0,1]` scores, sorts descending, returns `top_k` (default 5). Model is lazy-loaded and cached on first use. If reranker is disabled, `NoOpReranker` just truncates to `top_k`.

Step 4 — **Build prompt**: `build_query_prompt()` formats the top-k chunks into a context block, each labeled with its source file and chunk index. Combined with the system prompt that strictly instructs the LLM to answer only from context.

Step 5 — **Generate**: `LLM.generate()` sends system + user prompt to whichever provider is configured. Returns `LLMResponse` with `.text`, `.tokens_used`, `.estimated_cost`, `.model`.

Step 6 — **Return**: `QueryResponse` with `answer`, `sources` (list of chunk metadata + score), and `metadata` (latency_ms, tokens, cost, retrieval mode, chunks used).

For streaming (`/api/query/stream`): same pipeline up to generation. Then uses `LLM.generate_stream()` which yields tokens one at a time. Each token is JSON-encoded as `{"type": "token", "content": "..."}`. After all tokens, yields `{"type": "sources", "sources": [...]}`, then `{"type": "metadata", "metadata": {...}}`. Frontend consumes this as Server-Sent Events.

**"Why emit sources and metadata as SSE events after the tokens instead of before?"**

Because the retrieval happens before generation, but the LLM response is what takes time. If you sent sources first the user would see a flash of JSON before the text starts. Sending tokens first gives the user immediate feedback while the answer streams in, then sources appear at the end when it's natural to cite them.

**"What's the cost estimation based on?"**

Hard-coded per-model price tables in each LLM class. Format is `(input_price_per_1M, output_price_per_1M)`. For example GPT-4o is `(2.50, 10.00)`. Cost = `(input_tokens * input_price + output_tokens * output_price) / 1_000_000`. For streaming we only track token count (rough char-based estimate) so streaming cost is reported as 0.0 — a known limitation.

---

## Evaluation

**"How does evaluation work?"**

User creates a dataset: a name, a set of document IDs to scope retrieval, and a list of `(question, ground_truth)` test cases. Then triggers `POST /api/eval/run` with the dataset ID.

The route creates an `EvalRun` row in Postgres (status: "running") and fires off `asyncio.create_task(eval_runner.run(...))`. The endpoint returns immediately with the run ID. The client polls `GET /api/eval/runs/{id}` to check `progress_done / progress_total`.

The `EvalRunner` iterates through test cases. For each:
1. Calls `query_pipeline.query(question, document_ids)` — gets the generated answer and retrieved chunks.
2. Calls `compute_metrics(question, ground_truth, generated_answer, retrieved_chunks)`.
3. Persists an `EvalResult` row with per-question scores, latency, tokens, pass/fail, and failure reason.
4. Updates `progress_done` in the DB and commits.

After all test cases, aggregates scores (simple average per metric) and updates the `EvalRun` to `status="completed"` with the aggregate metrics JSON.

**"What are the five metrics and what does each measure?"**

All five come from the RAG Triad framework:

| Metric | What it measures | Low score means |
|--------|-----------------|-----------------|
| **Faithfulness** | Is the answer grounded in the retrieved context? Does every claim in the answer appear in the chunks? | LLM hallucinating — generating facts not in the retrieved context |
| **Answer Relevancy** | Does the answer actually address the question asked? | Prompt issues, or the LLM going off-topic |
| **Contextual Precision** | Are the top-ranked chunks actually relevant? Is the retriever returning noise? | Reranker weak, or retrieval returning irrelevant chunks at high rank |
| **Contextual Recall** | Does the retrieved context cover the ground truth? Are relevant chunks being found? | Embedding model missing semantically relevant chunks, or chunk size too small |
| **Contextual Relevancy** | What fraction of retrieved chunks are relevant to the question? Noise ratio. | Top-K too high, chunk size too large, retrieval returning too much noise |

Pass threshold is 0.7 for all metrics. A test case passes only if all five are >= 0.7.

**"You mention DeepEval and heuristic scoring. What's the difference?"**

DeepEval uses an LLM judge — it sends the question, generated answer, ground truth, and retrieved chunks to an LLM (requires OpenAI/Anthropic/Gemini API key) and asks it to score each metric. This is expensive but accurate.

When no API key is available, the system falls back to heuristic scoring:
- **Faithfulness**: word overlap between answer and context — what fraction of answer words appear in the chunks.
- **Answer relevancy**: SequenceMatcher ratio between generated answer and ground truth.
- **Contextual precision/relevancy**: question word overlap with context (excluding stopwords).
- **Contextual recall**: ground truth word overlap with context.

The heuristic scores are also adjusted based on pipeline config — e.g. enabling the reranker adds +0.10 to contextual precision and +0.07 to faithfulness, because those are known real-world effects of reranking. A small deterministic noise term (seeded from MD5 hash of the config) ensures each unique config fingerprints differently.

**"Isn't the config-based adjustment in heuristic mode fake?"**

It's simulated, yes — and I'd say that in an interview without hesitation. The intent is to make the benchmark tool usable as a demo without requiring API keys. In production you'd always want LLM-judged metrics. The heuristic mode exists so you can run the full UI flow and see how metric scores change when you swap strategies, even without any API credentials.

---

## Database Design

**"Walk me through the database schema."**

Six tables:

- **projects**: `id`, `name`, `description`, `created_at`. Top-level namespace. Documents, datasets, and eval runs can optionally belong to a project.
- **documents**: `id`, `project_id` (nullable FK), `filename`, `file_type`, `chunk_count`, `chunk_strategy`, `file_bytes` (LargeBinary — stores the raw upload), `uploaded_at`.
- **datasets**: `id`, `project_id` (nullable FK), `name`, `description`, `document_ids` (JSON array of doc UUIDs). A dataset defines the retrieval scope.
- **test_cases**: `id`, `dataset_id` (FK + cascade delete), `question`, `ground_truth`. Many test cases per dataset.
- **eval_runs**: `id`, `project_id`, `dataset_id`, `name`, `status`, `config` (JSON snapshot of PipelineConfig at run time), `metrics` (JSON aggregate), `scoring_mode`, `progress_done`, `progress_total`, `created_at`.
- **eval_results**: `id`, `run_id` (FK + cascade delete), `question`, `ground_truth`, `generated_answer`, `retrieved_chunks` (JSON), `metrics` (JSON), `latency_ms`, `tokens_used`, `passed`, `failure_reason`.

**"Why is `config` stored as JSON on `eval_runs`?"**

Reproducibility. If you run an eval today with recursive chunking + hybrid retrieval + reranker, then change the pipeline config, and look at old results a week later, you need to know what config produced those results. The config JSON is a snapshot taken at run creation time. It also feeds into heuristic scoring — the runner passes `run_record.config` to `compute_metrics()` so adjustments match the actual settings used.

**"Why async SQLAlchemy?"**

The backend is fully async (FastAPI + asyncio). Synchronous DB calls would block the event loop, killing throughput. `asyncpg` as the driver + SQLAlchemy 2.0 async allows `await session.execute(...)` without blocking.

---

## Configuration System

**"How does the pipeline config work? Can it be changed at runtime?"**

Yes. `PipelineConfig` is a Pydantic `BaseModel` with nested configs for chunking, retrieval, generation, and embedding. It lives as a module-level singleton `_pipeline_config` in `config.py`.

`GET /api/config` returns the current config. `PUT /api/config` calls `update_pipeline_config(updates)` which deep-merges the update dict into the current config and replaces the singleton. All subsequent requests use the new config immediately.

The frontend exposes this as a settings sheet (sidebar) where you can change any knob. When you change chunking or embedding settings, the frontend prompts to re-index because the Qdrant collection needs to be rebuilt with the new dimensions/strategy.

**"What's the `lru_cache` on `get_settings()`?"**

`Settings` is loaded from the `.env` file using `pydantic-settings`. It never changes at runtime — it's infrastructure config (DB URLs, API keys). So it's safe to cache it indefinitely. `PipelineConfig` is mutable so it's not cached.

---

## Project Scoping

**"What are projects for?"**

Projects are multi-tenancy at the logical level. You create a project (e.g. "Legal Docs", "Product Manuals"), upload documents into it, create datasets scoped to it, and run evaluations within it. Documents and eval runs from one project don't pollute another project's context.

In Qdrant, project scoping is implemented as a payload filter. When you query within a project, a `FieldCondition(key="project_id", match=MatchValue(value=project_id))` is added to the `must` conditions of the Qdrant filter. So all chunks live in the same Qdrant collection but are filtered at query time.

**"Why not separate Qdrant collections per project?"**

Operational simplicity. Qdrant has a limit on the number of collections before performance degrades. Payload filtering is fast (Qdrant indexes payload fields). The tradeoff is that all projects share one HNSW index and filtering is post-HNSW, which means you overfetch slightly. For a project-scale system this is fine. At enterprise scale you'd shard differently.

---

## Frontend

**"Tell me about the frontend architecture."**

Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui components.

Key pages:
- **Dashboard** (`/`): radar chart of RAG Triad metrics from the most recent eval run, metric cards, insight cards that interpret low scores (e.g. "Low contextual precision — consider enabling the reranker").
- **Chat** (`/chat`): text input, streaming response display, source citations, cost/latency metadata per response.
- **Documents** (`/documents`): file upload (drag-and-drop), document list, chunk preview (fetches chunks by scrolling Qdrant).
- **Evaluate** (`/evaluate`): dataset creation, test case entry, eval run trigger, per-question results table with metric scores and pass/fail.
- **Compare** (`/compare`): side-by-side comparison of two eval runs, showing metric deltas.

State is managed via React Context — `ChatContext` and `EvalContext` hold shared state that's needed across components on the same page.

**"How does the streaming chat work on the frontend?"**

The frontend calls `POST /api/query/stream` and reads the response body as a stream using the Fetch API's `ReadableStream`. It reads chunks of bytes, decodes them, splits on newlines, parses each line as JSON. When it sees `{"type": "token"}` it appends to the displayed answer. When it sees `{"type": "sources"}` it renders the source citations. When it sees `{"type": "metadata"}` it updates the cost/latency display.

---

## Deployment & Infrastructure

**"How is everything deployed?"**

Docker Compose. Five services:

```
postgres (port 5432)
  → qdrant (port 6333)
    → backend (port 8000, health-checked)
      → seed (one-shot, exits after seeding)
      + frontend (port 3000)
```

The `Makefile` wraps common operations: `make up`, `make down`, `make clean` (stop + wipe volumes), `make seed` (re-run seed loader).

The backend `lifespan` context manager (FastAPI's recommended startup hook) runs `init_db()` to create all SQLAlchemy tables via `Base.metadata.create_all`, then `ensure_collection()` to create the Qdrant collection if it doesn't exist.

**"How does the seed data work?"**

The seed container runs `load_seed_data.py` after the backend is healthy. It checks the document count first — if documents already exist, it exits immediately (idempotent). Otherwise it uploads three sample markdown/text files (ml_fundamentals.md, python_best_practices.md, api_design_patterns.txt) via the HTTP API, creates a dataset and test cases, and inserts two pre-computed eval run records (baseline vs tuned) directly into Postgres.

---

## Error Handling

**"How do you handle errors?"**

Custom exception hierarchy in `exceptions.py`. Base class `RAGEvalError` carries `message` and `status_code`. Subclasses: `IngestionError` (400), `EmbeddingError` (500), `RetrievalError` (500), `GenerationError` (500), `VectorStoreError` (500), `EvaluationError` (500).

FastAPI's `@app.exception_handler(RAGEvalError)` catches any of these and returns a structured `{"detail": "..."}` JSON response with the appropriate HTTP status code. This means route handlers don't need individual try/except — they just let exceptions propagate and the handler formats them consistently.

Within the ingestion pipeline, non-`IngestionError` exceptions are caught and re-raised as `IngestionError` with context. Same pattern in other pipeline components.

---

## Trade-offs and Limitations

**"What would you do differently if this were a production system?"**

1. **BM25 in-memory**: the BM25 index lives in process memory and is lost on restart. On restart, documents must be re-indexed (the system does this automatically, but it's startup latency). A production system would use Elasticsearch or Qdrant's built-in sparse vectors (sparse HNSW).

2. **Heuristic eval metrics**: word-overlap scoring is not real evaluation. Production would always use LLM-judged metrics, ideally with a fine-tuned evaluator model rather than a general-purpose LLM.

3. **No auth**: all endpoints are public. Production needs JWT/OAuth2, multi-user isolation at the DB level.

4. **Single-instance backend**: the pipeline config is a module-level singleton. Multiple backend instances would have config drift. Production would store pipeline config in Postgres and fetch per-request.

5. **Streaming cost estimate**: streaming mode uses a rough char-count estimate for tokens. Production would use a proper tokenizer (tiktoken for OpenAI models) to count streaming tokens accurately.

6. **File bytes in Postgres**: storing raw file bytes in the relational DB is convenient but doesn't scale. Production would use S3 or blob storage and store only the S3 key in Postgres.
