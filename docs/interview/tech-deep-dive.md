# RagBench — Technology Deep Dive

This document covers every technology used in the project in depth — not just what we use, but how it works internally, why we chose it, and where the sharp edges are.

---

## Python 3.12 + FastAPI

### FastAPI

FastAPI is built on top of Starlette (ASGI framework) and Pydantic. It auto-generates OpenAPI docs from type annotations, handles request validation via Pydantic models, and supports async request handlers natively.

**Key FastAPI concepts we use:**

- **Lifespan context manager**: replaces old `@app.on_event("startup")`. We use `@asynccontextmanager async def lifespan(app)` — code before `yield` runs at startup (init DB, ensure Qdrant collection), code after `yield` runs at shutdown. FastAPI 0.93+ requirement.
- **Dependency injection**: `Depends()` — we inject the vector store, embedder, BM25 index, and query pipeline into route handlers without creating new instances per request. All heavy objects are singletons managed by `api/dependencies.py`.
- **Background tasks vs asyncio.create_task**: eval runs use `asyncio.create_task()` directly rather than FastAPI's `BackgroundTasks`. Reason: `BackgroundTasks` runs after the response is sent but within the same request context. `create_task` schedules independently on the event loop — better for long-running jobs that update DB progress.
- **StreamingResponse**: used for `POST /api/query/stream`. Returns an `AsyncGenerator` that yields Server-Sent Event strings. FastAPI wraps it in chunked HTTP transfer encoding.
- **Exception handlers**: `@app.exception_handler(CustomException)` intercepts unhandled exceptions of a specific type anywhere in the call stack and returns structured JSON.

**Pydantic v2:**

Pydantic v2 (complete rewrite in Rust via `pydantic-core`) is ~5-50x faster than v1 for validation. Key changes we encounter:
- `model_config = ConfigDict(...)` replaces inner `class Config`.
- `model_dump()` replaces `.dict()`.
- `model_validate()` replaces `.parse_obj()`.
- `BaseSettings` moved to `pydantic-settings` package.

We use `BaseSettings` for `Settings` (loads from `.env` file via `python-dotenv` interop) and plain `BaseModel` for `PipelineConfig` and its nested configs.

### Python Protocols

Protocols define structural interfaces without inheritance. We use `@runtime_checkable` protocols for `EmbedderProtocol`, `LLMProtocol`, `VectorStoreProtocol`, `RerankerProtocol`. This means:
- Any class that implements the required methods satisfies the protocol — no `implements` keyword.
- `isinstance(obj, EmbedderProtocol)` works at runtime (because `@runtime_checkable`).
- This enables easy swapping of implementations (OpenAI embedder, Gemini embedder, FakeEmbedder) without a class hierarchy.

### Async Python

FastAPI runs on an asyncio event loop. All I/O (DB queries, HTTP calls to LLM APIs, Qdrant calls) must be awaited. CPU-bound work (BM25 scoring, cross-encoder inference, FastEmbed inference) is offloaded with `asyncio.to_thread()`, which runs the callable in a thread pool executor, preventing event loop blocking.

`async with session_factory() as session` — SQLAlchemy's async session manager.

`async for token in llm.generate_stream()` — consuming an async generator from the LLM streaming call.

---

## SQLAlchemy 2.0 (Async)

SQLAlchemy is the Python ORM. Version 2.0 is a major API redesign:

**Declarative models (we use):**
```python
class Document(Base):
    __tablename__ = "documents"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    filename: Mapped[str] = mapped_column(String(255))
```
`Mapped[T]` is a generic alias that carries the Python type for the column. `mapped_column()` replaces `Column()`. This gives full type checker support.

**Async session:**
```python
async_engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
```
`expire_on_commit=False` means objects don't become stale (requiring re-fetch) after commit — important in async contexts where you might access attributes after the session has closed.

**`asyncpg` driver:**
asyncpg is a pure-Python async PostgreSQL driver (no libpq dependency). Faster than psycopg2 for async use cases. Connection string format: `postgresql+asyncpg://user:pass@host:5432/db`.

**`init_db()` creates tables:**
```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
```
`run_sync()` runs a synchronous callable in the async context. `create_all` is sync because it operates on DDL, which is handled synchronously internally.

**Relationships:**
`relationship()` with `back_populates` sets up bidirectional ORM relationships. `cascade="all, delete-orphan"` means deleting a Dataset also deletes its TestCases. `ondelete="CASCADE"` at the DB level enforces this at SQL.

**`server_default=func.now()`** — the DB computes `created_at`, not Python. Avoids timezone issues from the application layer.

---

## PostgreSQL 16

PostgreSQL is the world's most advanced open-source relational DB. We use it for:

- **ACID compliance**: eval runs need atomic updates — progress, results, and final status must be consistent even if the backend crashes mid-run.
- **JSON columns**: `config`, `metrics`, `retrieved_chunks`, `document_ids` are stored as Postgres `JSON` columns. Postgres can index and query into JSON, though we don't use that here.
- **LargeBinary for file bytes**: Postgres `BYTEA` type. Stores raw file bytes up to ~1GB per row. Fine for documents; not fine for large video files.
- **UUID primary keys**: more collision-resistant than auto-increment integers. Postgres handles UUID natively with the `uuid` type. Python's `uuid4()` generates random UUIDs.
- **ForeignKey constraints with `ondelete`**: DB-enforced referential integrity. `ondelete="SET NULL"` on `project_id` means deleting a project sets the FK to NULL on documents/datasets (they don't get deleted). `ondelete="CASCADE"` on `dataset_id` in `test_cases` deletes all test cases when the dataset is deleted.

---

## Qdrant

Qdrant is a purpose-built vector database written in Rust. It stores vectors plus arbitrary JSON payloads and supports fast approximate nearest-neighbor (ANN) search.

### HNSW Index

HNSW (Hierarchical Navigable Small World) is the default ANN algorithm in Qdrant. It builds a multi-layer graph:
- **Bottom layer**: all vectors connected to their nearest neighbors.
- **Higher layers**: progressively fewer nodes, forming a "highway" network.
- **Search**: enter at the top layer, greedily navigate toward the query, descend to lower layers as you get closer. O(log n) expected time.

Tradeoff: build time is O(n log n) and memory-intensive (stores graph edges), but search is very fast even for millions of vectors.

### Collections

A Qdrant collection is a namespace of vectors with a fixed dimension and distance metric. We use `Distance.COSINE` (cosine similarity = dot product of unit vectors). We create a new collection for each unique (chunking_strategy, chunk_size, overlap, embedding_provider, dimension) combination using the naming scheme `docs_{strategy}_{size}_{overlap}_{provider}_{dim}`.

### Points and Payloads

A point = vector + UUID + payload (JSON dict). The payload stores everything needed to reconstruct retrieval results: `text`, `doc_id`, `source_file`, `page_number`, `chunk_index`, `chunk_strategy`, and optionally `project_id`.

### Filtering

Qdrant filters are applied after ANN search (post-filtering by default) or can be used as pre-filters when selectivity is high. We use `Filter(must=[FieldCondition(...)])`. `MatchAny(any=doc_ids)` filters to a list of doc IDs. `MatchValue(value=project_id)` filters to a single project.

For post-filtering to work correctly, you need to overfetch (`top_k=50` when you want 5) because some results will be filtered out.

### Scroll API

`client.scroll()` fetches points by filter without a query vector — used in the chunk preview feature. Pagination via `offset`.

### Async Client

We use `AsyncQdrantClient` from `qdrant_client`. All operations are `await`ed.

---

## Vector Embeddings

### What embeddings are

An embedding model converts text to a dense float vector in a high-dimensional space (384, 768, 1536, 3072 dims). The key property: semantically similar texts land close together in the vector space (high cosine similarity). "Machine learning" and "ML algorithms" will be close. "Machine learning" and "pizza recipe" will be far apart.

Embeddings are produced by transformer models. The final hidden states (or pooled representation) of the transformer become the vector.

### Models we support

**OpenAI `text-embedding-3-small`** (1536 dims):
- Third-generation OpenAI embedding model. Uses Matryoshka Representation Learning (MRL) — you can truncate the vector to fewer dimensions and retain most quality. 1536 dims is the default.
- API-based, ~$0.02 per 1M tokens.

**OpenAI `text-embedding-3-large`** (3072 dims):
- Higher quality, larger dimension. 3x more expensive than small.

**Gemini `gemini-embedding-001`** (768 dims):
- Google's embedding model. API-based. Output dimensionality can be set via `EmbedContentConfig(output_dimensionality=768)`.

**FastEmbed `BAAI/bge-small-en-v1.5`** (384 dims):
- BGE (BAAI General Embedding) — open-source model from Beijing Academy of AI. Runs locally via FastEmbed (Qdrant's Python embedding library, which uses ONNX Runtime). No API key. Ships inside the Docker image.
- FlagEmbedding architecture: BERT-based with bi-encoder training on MS MARCO and other datasets.
- 384 dims is small but high quality for its size. Excellent for self-hosted, zero-cost embedding.

**FastEmbed `sentence-transformers/all-MiniLM-L6-v2`** (384 dims):
- 6-layer MiniLM architecture, distilled from a larger model. Very fast. Slightly lower quality than BGE but extremely lightweight.

### Cosine Similarity

`cosine_similarity(a, b) = dot(a, b) / (|a| * |b|)`

We implement this manually in `chunking.py` for the semantic chunking step (to avoid importing a dependency just for that), and in `InMemoryVectorStore` for tests. Qdrant handles it natively via `Distance.COSINE`.

Range: [-1, 1] for non-normalized vectors. For embedding models, vectors are typically L2-normalized, so range is [0, 1].

---

## BM25 (Sparse Retrieval)

### How BM25 works

BM25 (Best Match 25) is a probabilistic keyword ranking function. It's an evolution of TF-IDF.

**TF-IDF** scores how important a term is to a document:
- TF (term frequency): how often the term appears in the document.
- IDF (inverse document frequency): `log(N / df)` where N is total docs and df is number of docs containing the term. Rare terms get higher IDF.

**BM25 improves on TF-IDF:**
1. **TF saturation**: raw TF grows without bound. BM25 uses `tf / (tf + k1 * (1 - b + b * dl/avgdl))` where k1 (default 1.2) and b (default 0.75) are tuning parameters. dl/avgdl normalizes for document length.
2. **Length normalization**: longer documents naturally have more term occurrences. BM25 normalizes by `dl/avgdl` (document length / average document length in corpus).

`BM25Okapi` from `rank_bm25` is the standard implementation. We tokenize via simple `text.lower().split()` (whitespace tokenization, no stemming). The model is rebuilt lazily (`_dirty` flag) when documents are added or removed.

**BM25 wins when**: query contains rare proper nouns, product codes, technical jargon, or exact phrases. Dense embeddings often miss these because they're trained to generalize.

**BM25 loses when**: query is paraphrased differently from the document, or uses synonyms. Dense embeddings handle this well.

---

## Reciprocal Rank Fusion (RRF)

RRF is a simple, robust method for combining ranked lists from multiple retrieval systems.

**Formula**: `score(doc) = sum(1 / (k + rank_i))` across all ranked lists.

Where `k=60` is a smoothing constant (reduces the impact of very high ranks). Rank is 1-indexed.

**Properties:**
- No score normalization needed — you just need rankings, not the actual scores (which may be incomparable across systems).
- Documents appearing in multiple lists get a boost.
- Robust to outliers — one system ranking a document #1 doesn't overwhelm if the other system ranks it #50.
- Deduplication by `(doc_id, chunk_index)` key.

**Our implementation**: dense top-50 + sparse top-50 → RRF → top-20 → reranker → top-5. The funnel design overfetches at each stage to avoid missing good candidates.

---

## Cross-Encoder Reranking

### Bi-encoder vs Cross-encoder

**Bi-encoder** (embedding model): query and document are encoded separately. Fast — you precompute document embeddings. But quality is limited because query-document interaction isn't captured.

**Cross-encoder**: query and document are concatenated and processed together by the model. The model sees how they interact at every transformer layer. Much higher quality — the model can attend to query terms when reading the document.

**Tradeoff**: cross-encoders can't precompute — you must run the model for every `(query, candidate)` pair at query time. So you use a bi-encoder to get a candidate set (top-20), then a cross-encoder to rerank just those candidates.

### Our reranker

`Xenova/ms-marco-MiniLM-L-6-v2` via FastEmbed's `TextCrossEncoder`:
- MS MARCO is a large-scale passage retrieval dataset from Microsoft (real Bing queries + passage relevance labels). Training on it produces a model tuned for passage ranking.
- MiniLM-L-6 = 6-layer MiniLM (distilled from BERT-large). Fast and small.
- The model outputs raw logits (unbounded). We apply sigmoid to convert to [0, 1] probability: `1 / (1 + exp(-logit))`.

**Lazy loading**: `self._model = None` at init. First call to `rerank()` triggers `_load_model()`. Model is cached on the instance. Since the `QueryPipeline` caches its reranker (`self._reranker`), the model is loaded once per process.

`asyncio.to_thread()` offloads the synchronous `model.rerank()` call to avoid blocking the event loop.

---

## DeepEval

DeepEval is an open-source LLM evaluation framework. It provides metric implementations based on G-Eval (LLM-as-judge):

**How LLM-judged metrics work (G-Eval pattern)**:
1. Construct a prompt that includes the evaluation criteria, the inputs (question, generated answer, ground truth, retrieved context), and asks the LLM to score on a scale.
2. Send to an LLM (GPT-4, Claude, Gemini).
3. Parse the numeric score from the response.

This is more reliable than simple heuristics because the LLM understands natural language nuance — it can tell that "The capital of France is Paris" and "Paris is France's capital" say the same thing, while word-overlap would score them poorly.

**Our usage**:
```python
test_case = LLMTestCase(
    input=question,
    actual_output=generated_answer,
    expected_output=ground_truth,
    retrieval_context=retrieved_chunks,
)
metrics = [FaithfulnessMetric(threshold=0.7), ...]
for metric in metrics:
    await asyncio.to_thread(metric.measure, test_case)
```

Each metric is sync internally (makes its own HTTP call to the LLM API). We offload to thread to not block the event loop.

---

## Chunking Strategies — Deep Technical

### Fixed chunking

Character-level sliding window:
```
chunk_0 = text[0:500]
chunk_1 = text[450:950]   # 50-char overlap
chunk_2 = text[900:1400]
```
Problem: splits mid-sentence, mid-paragraph, mid-code-block. The semantic context of a sentence may be split across two chunks.

### Recursive chunking

Hierarchical split — tries separators in order: `["\n\n", "\n", ". ", " ", ""]`. The idea is to respect document structure first (paragraphs), then sentence structure, then word boundaries, before falling back to raw characters. Reassembles pieces into chunks of up to `chunk_size` chars with overlap carried by taking the tail of the previous chunk.

This is the default in LangChain's `RecursiveCharacterTextSplitter` and is the most commonly used strategy in production RAG.

### Semantic chunking

1. Split to sentences using regex: `re.split(r"(?<=[.!?])\s+|\n", text)`.
2. Group sentences into initial groups of ~chunk_size chars.
3. Embed each group.
4. Merge adjacent groups if `cosine_similarity > 0.8`. The merged group's embedding is the average of the two constituent embeddings.

This produces chunks that are semantically coherent — each chunk covers one topic. The threshold 0.8 is tunable (higher = less merging = more granular chunks).

Downside: requires an embedding call during ingestion, which adds latency and cost.

### Document-aware chunking

Uses regex to find structural markers:
```python
r"^(?P<header>#{1,6}\s+.+|Chapter\s+\d+.*|\d+\.\s+.+|---+|===+|\*\*\*+)$"
```
Splits on Markdown headers, numbered sections, Chapter headings, and horizontal rules. Each section is then recursively chunked. The section header is stored in `chunk.metadata["section_header"]`.

Best for well-structured documents (technical docs, legal documents, textbooks). Fails on unstructured text with no headers.

---

## Streaming (SSE / Server-Sent Events)

Server-Sent Events is a one-directional HTTP streaming protocol. Client opens a connection; server sends events indefinitely. Simpler than WebSockets (no bidirectional protocol).

**Format**: each event is `data: {json}\n\n`. The double newline terminates an event.

**FastAPI streaming**:
```python
return StreamingResponse(
    generator(),
    media_type="text/event-stream"
)
```

**Our event types**:
- `{"type": "token", "content": "word"}` — one per LLM output token
- `{"type": "sources", "sources": [...]}` — after all tokens
- `{"type": "metadata", "metadata": {...}}` — latency, cost, model info

**Frontend consumption** (Fetch API ReadableStream):
```javascript
const reader = response.body.getReader()
const decoder = new TextDecoder()
while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    // parse JSON lines...
}
```

---

## Next.js 16 App Router

Next.js App Router (introduced in Next 13, stable in 14+) uses React Server Components by default. Files in `app/` directory are server components unless they have `"use client"` at the top.

**We use mostly client components** because our pages are interactive (chat input, file upload, real-time eval progress). Server components would be better for static data-fetching pages.

**Key patterns we use:**
- `"use client"` at top of interactive pages
- React Context for shared state (`ChatContext`, `EvalContext`)
- `fetch()` to call the FastAPI backend (all API calls go to `http://localhost:8000`)
- shadcn/ui component library (built on Radix UI primitives + Tailwind)
- Recharts for the radar chart on the dashboard

**shadcn/ui**: not a component library you install as a package — it's a CLI that copies component source code into your project. You own the code. Built on Radix UI (accessible, unstyled primitives) + Tailwind for styling.

---

## Docker & Docker Compose

### Compose networking

All containers share a default bridge network created by Compose. Services communicate by service name (e.g. the backend accesses Postgres at `postgres:5432`). Port mappings expose services to the host machine (`localhost:5432`, `localhost:6333`, `localhost:8000`, `localhost:3000`).

### Health checks

```yaml
healthcheck:
  test: ["CMD", "pg_isready", "-U", "postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```
`depends_on: condition: service_healthy` makes the backend container wait until Postgres and Qdrant pass their health checks before starting. This prevents startup race conditions where the backend tries to connect before the DB is ready.

### Seed container pattern

The seed service has `restart: "no"` and exits after running its script. Compose records it as `exited` (not `running`). Other services don't depend on it, so it doesn't block anything. The `Makefile` has `make seed` to restart it manually if needed.

### Volume mounts

Postgres data (`pgdata`) and Qdrant storage (`qdrantdata`) are named volumes that persist across `docker-compose down`. `make clean` runs `docker-compose down -v` which removes volumes too (full reset).

---

## FastEmbed

FastEmbed is Qdrant's Python library for local text embedding and reranking. It downloads ONNX models from Hugging Face Hub on first use and caches them in `~/.cache/fastembed`.

**ONNX Runtime**: models are in ONNX format (Open Neural Network Exchange). ONNX Runtime is an inference engine that runs ONNX models efficiently on CPU (and GPU with plugins). Much faster than running PyTorch models for inference — no PyTorch overhead, optimized for batch inference.

We use FastEmbed for:
- `TextEmbedding("BAAI/bge-small-en-v1.5")` — local embedder, no API key.
- `TextCrossEncoder("Xenova/ms-marco-MiniLM-L-6-v2")` — local reranker, no API key.

Both are lazy-loaded on first use to avoid slow import times.

---

## rank_bm25

`rank_bm25.BM25Okapi` — simple Python BM25 implementation. Builds an inverted index over a corpus of tokenized documents, then computes BM25 scores for a query.

Our usage: we hold the corpus as `list[list[str]]` (list of tokenized documents). `get_scores(query_tokens)` returns a score per document. We then filter by `doc_id` and sort descending.

**Limitation**: the index is rebuilt from scratch on every `add_documents()` or `remove_by_doc_id()` call (via `_dirty` flag + `_rebuild()`). For large corpora this is slow. Production would use Elasticsearch or a proper inverted index.

---

## LLM Providers

### OpenAI

Uses `openai.AsyncOpenAI`. Supports GPT-4o, GPT-4o-mini, GPT-3.5-turbo. Chat completion API: `client.chat.completions.create(model=..., messages=[...])`. Streaming: `stream=True` returns an async iterable of `ChatCompletionChunk` objects.

### Anthropic

Uses `anthropic.AsyncAnthropic`. Supports Claude Sonnet, Haiku, Opus. Messages API: `client.messages.create(model=..., system=..., messages=[...])`. Streaming: `client.messages.stream(...)` returns an async context manager with `.text_stream` async iterator.

### Gemini

Uses `google.genai.Client`. Gemini doesn't have a native async Python client for `generate_content` — we use `asyncio.to_thread()` to run it in a thread pool. Streaming: `generate_content_stream()` returns a synchronous generator; same thread-pool trick.

### Ollama

Uses `httpx.AsyncClient` to call Ollama's local HTTP API (`/api/chat`). Ollama runs local models (Llama 3, Mistral, Qwen, etc.) and exposes an OpenAI-compatible API. Streaming: `client.stream("POST", "/api/chat", ...)` returns async line iterator; each line is a JSON object with partial content.

### Provider detection

The `create_llm()` factory detects provider by model name prefix:
- `gpt-*`, `o1*`, `o3*` → OpenAI
- `claude-*` → Anthropic
- `gemini-*` → Gemini
- anything else → Ollama (e.g. "llama3", "mistral")

---

## Pydantic Settings

`pydantic-settings.BaseSettings` reads settings from:
1. Environment variables (highest priority)
2. `.env` file (second priority)
3. Field defaults (lowest priority)

In Docker Compose, environment variables are set in `environment:` or `env_file:` of the service definition. The `DATABASE_URL` for the backend points to `postgresql+asyncpg://postgres:password@postgres:5432/rageval` (using the Compose service name `postgres` as hostname).

`@lru_cache` on `get_settings()` ensures the `.env` file is parsed once per process, not on every call.

---

## Cost Tracking

Per-model cost tables in each LLM class map model name to `(input_$/1M, output_$/1M)`:

```python
COST_MAP = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    ...
}
cost = (input_tokens * in_price + output_tokens * out_price) / 1_000_000
```

The OpenAI and Anthropic APIs return exact token counts in the response usage object. Gemini returns `prompt_token_count` and `candidates_token_count` from `usage_metadata`. Streaming only counts characters/tokens approximately.

---

## Key Design Patterns

### Protocol-based abstraction

All swappable components (embedder, LLM, vector store, reranker) are defined as Protocols. This enables:
- Swapping implementations without changing callers.
- FakeLLM / FakeEmbedder / InMemoryVectorStore for testing without external services.
- Runtime type checking (`isinstance(obj, EmbedderProtocol)`).

### Lazy loading

Cross-encoder model, FastEmbed embedder, and BM25 model are all loaded on first use (not at import or construction time). This keeps startup time fast and avoids loading heavy models that might not be needed in a given request.

### Singleton pipeline objects

The vector store, embedder, BM25 index, and query pipeline are created once in `api/dependencies.py` using module-level variables. FastAPI's `Depends()` returns the same instance on every request. This is critical for BM25 — the in-memory index must be shared across requests.

### Config-scoped Qdrant collections

Each unique pipeline config (chunking + embedding) maps to its own Qdrant collection. This avoids dimension mismatch errors when switching embedding models, and lets you compare results from different ingestion configs by querying different collections.

### Idempotent seed

The seed loader checks document count before inserting. If documents exist, it exits without doing anything. This makes `docker-compose up` safe to run multiple times — no duplicate data.
