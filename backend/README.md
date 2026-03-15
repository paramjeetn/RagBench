# RAG Eval System — Backend

The backend is the entire product. It handles document ingestion, retrieval-augmented generation, systematic evaluation, and run comparison. The frontend is a thin UI wrapper — every capability lives here.

---

## What This System Does

You upload documents. You ask questions against them. The system retrieves relevant chunks, generates answers with citations, and tells you exactly how good those answers are — with five metrics, per-question breakdowns, and the ability to compare different pipeline configurations side by side.

The core idea: instead of "vibe-checking" your RAG pipeline, you run structured evaluations and get numbers. Change the chunking strategy, switch the retrieval mode, toggle reranking — then run the same test dataset again and see exactly what improved and what got worse.

---

## The Three Pipelines

Everything flows through three pipelines that share the same underlying components but serve different purposes.

### Ingestion Pipeline

When a document is uploaded, it passes through four stages. First, the parser extracts raw text — handling PDFs, Markdown, plain text, and HTML differently based on their structure. Then the chunking engine splits that text into smaller pieces. There are four strategies available: fixed-size windows, recursive splitting that respects paragraph and sentence boundaries, semantic chunking that groups sentences by meaning similarity, and document-aware chunking that splits on structural markers like headers and sections.

Each chunk gets embedded into a vector — a dense numerical representation that captures its semantic meaning. These vectors go into Qdrant (the vector database) with metadata attached: which document they came from, which page, their position in the document. The same chunks also get indexed in an in-memory BM25 index for keyword-based search.

The critical detail: every vector carries a `doc_id` in its payload. This is what makes document-scoped operations possible throughout the entire system.

### Query Pipeline

When a user asks a question, the pipeline retrieves relevant context and generates an answer. The retrieval stage supports three modes.

**Dense retrieval** embeds the question using the same model that embedded the chunks, then searches Qdrant for the nearest vectors. It understands meaning — "What causes rain?" finds chunks about "precipitation occurs when..."

**Sparse retrieval** uses BM25 keyword matching. It catches exact terms that semantic search might miss — error codes, specific names, technical identifiers.

**Hybrid retrieval** runs both, then merges results using Reciprocal Rank Fusion. RRF scores each result based on its rank across both lists, producing a combined ranking that captures both semantic and lexical relevance.

After retrieval, an optional cross-encoder reranker rescores the candidates. Unlike the embedding model which encodes query and document separately, the cross-encoder processes them together — slower but significantly more accurate for final ranking.

The top chunks get assembled into a prompt with the user's question. The LLM generates an answer grounded only in the provided context, citing its sources. The response includes the answer, source references with relevance scores, and metadata: latency, token usage, estimated cost, which model was used.

Streaming is supported — tokens stream back as they're generated via Server-Sent Events, with sources and metadata sent at the end.

All of this is scoped to whichever documents the user selected. If they pick two specific documents, retrieval only searches those documents' vectors. If they select nothing, it searches everything.

### Evaluation Pipeline

This is what makes the system more than a chatbot. The evaluation pipeline takes a test dataset (a collection of question-and-ground-truth-answer pairs) and runs every question through the full query pipeline, then scores each answer against five metrics.

**Faithfulness** measures whether the answer stays grounded in the retrieved context — does it hallucinate or stick to what the chunks actually say?

**Answer Relevancy** checks whether the answer actually addresses the question that was asked.

**Contextual Precision** evaluates whether the retriever ranked relevant chunks above irrelevant ones.

**Contextual Recall** measures whether all the relevant information from the knowledge base was actually retrieved.

**Contextual Relevancy** assesses whether the retrieved chunks have appropriate information density — not too broad, not too narrow.

These metrics are computed using DeepEval's LLM-based evaluation when available. When it's not (no API key, or the library isn't set up), the system falls back to heuristic scoring based on text overlap and similarity — less accurate but still useful for development.

A question "passes" if all five metrics exceed 0.7. The pipeline tracks progress as it works through the dataset, so the frontend can poll for updates and show a progress bar.

When a run completes, the system stores aggregated metrics across all questions, plus full per-question detail: the generated answer, which chunks were retrieved, individual metric scores, latency, token count, and whether it passed or failed with a reason why.

---

## Document-Scoped Everything

This is the key architectural decision. Every operation is scoped to user-selected documents.

When you chat, you pick which documents to query against. When you create a test dataset, you link it to specific documents. When you run an evaluation, you choose the documents and the dataset. This means you can upload a new version of a document, run the same evaluation, and see exactly how answers changed.

The scoping works because every vector in Qdrant carries a `doc_id`. Retrieval filters on this field, so searching across two documents out of fifty is fast — Qdrant handles the filtering at the index level, not as a post-processing step.

---

## How Evaluation Comparison Works

The comparison system is where the product story comes together. After running evaluations with two different configurations, the comparison engine computes three things.

**Metric deltas** — the numerical difference in each metric between the two runs. Faithfulness went from 0.80 to 0.92? That's a +0.12 delta.

**Config diff** — a structured comparison of what changed between the two runs. The system walks both configuration snapshots and lists every parameter that differs: chunking strategy changed from fixed to recursive, reranker was enabled, top-k stayed the same.

**Insights** — human-readable explanations connecting config changes to metric movements. If faithfulness improved and reranking was enabled, the system explains that cleaner context from reranking reduces hallucination. If contextual precision improved and the chunking strategy changed, it explains that recursive chunking preserves sentence boundaries better.

These insights are generated algorithmically — the system maps known config changes to their expected metric impacts and produces explanations when the data matches.

---

## Pipeline Configuration

The entire pipeline is parameterized and reconfigurable at runtime through a single configuration object with three sections.

**Chunking** controls how documents are split: which strategy to use, how large each chunk should be, how much overlap between consecutive chunks.

**Retrieval** controls how relevant chunks are found: dense-only, sparse-only, or hybrid mode; how many final chunks to return; whether to use the cross-encoder reranker.

**Generation** controls the LLM: which model to use (any OpenAI, Anthropic, or Ollama model) and the temperature.

When you change the config and run an evaluation, the system snapshots the full configuration at the time of the run. This means you can always trace back exactly what settings produced which results — even if you've changed the config since then.

If chunking parameters change, the system flags that documents need reindexing since chunk boundaries have shifted and the existing vectors no longer match the new strategy.

---

## Multi-Provider LLM Support

The generation layer is provider-agnostic. It routes to OpenAI, Anthropic, or Ollama based on the model name. GPT models go through OpenAI's API. Claude models go through Anthropic's API. Anything else (Llama, Mistral, etc.) goes through Ollama for local inference.

Each provider handles both blocking and streaming generation. Cost estimation is built in — the system tracks token usage and estimates cost based on known per-token pricing for each model.

There's also a fake LLM for development and testing that returns canned responses without calling any API.

---

## Embedding Strategy

Embeddings are handled by a pluggable system. When an OpenAI API key is available, it uses OpenAI's embedding models (text-embedding-3-small by default). Without a key, it falls back to sentence-transformers running locally — slower but free and fully offline.

A fake embedder exists for testing — it generates deterministic random vectors based on the hash of the input text, so the same text always produces the same embedding. This lets you run the full pipeline end-to-end without any API keys or model downloads.

---

## Data Model

The system uses two databases for different purposes.

**PostgreSQL** stores structured metadata and evaluation data: which documents have been uploaded, test datasets with their QA pairs, evaluation runs with their configuration snapshots and aggregated metrics, and per-question evaluation results.

**Qdrant** stores the actual document chunks as vectors with payload metadata. It handles the similarity search that powers retrieval.

The relationship between them: PostgreSQL knows about documents (filename, chunk count, upload time) while Qdrant holds the actual chunk content and vectors. They're linked by document ID. When a document is deleted, both the Postgres record and all Qdrant vectors for that document are cleaned up.

Datasets have a many-to-many relationship with documents through a stored list of document IDs. Evaluation runs snapshot which dataset and which documents were used, along with the full pipeline configuration at the time of the run.

---

## How the API Serves the Frontend

The API is designed frontend-first — every endpoint exists because a specific UI page needs it.

The **dashboard** loads the two most recent evaluation runs and compares them, showing a radar chart of metrics and generated insights.

The **chat page** loads the document list for a selector, then streams answers back as the user asks questions against their selected documents.

The **documents page** handles upload, browsing (with paginated chunk preview), and deletion.

The **evaluate page** lets users pick a dataset and documents, kick off an evaluation run, then poll for progress until results are ready.

The **compare page** lets users pick any two historical runs and see the full comparison: metric deltas, config diffs, and insights.

The **settings panel** reads and writes pipeline configuration — changing parameters that affect how the next query or evaluation behaves.

Evaluation runs are asynchronous. The API accepts the request, creates the run record, launches the evaluation in the background, and returns immediately with a run ID. The frontend polls the run endpoint to check progress and eventually retrieve results.

---

## Startup and Seed Data

On startup, the backend initializes the database schema and ensures the Qdrant collection exists. Docker Compose orchestrates four services: PostgreSQL, Qdrant, the backend, and a one-shot seed container.

The seed container waits for the backend to be healthy, then loads sample data: three documents, a test dataset with twenty QA pairs, and two pre-computed evaluation runs with different configurations and realistic metric scores. This means the dashboard has meaningful data to display immediately — no API keys or manual setup required.

The seed process is idempotent. If the data already exists, it skips the insert.

---

## Running It

With Docker: copy the example environment file, optionally add API keys, and run docker compose up. The backend serves on port 8000 with auto-generated Swagger documentation.

Without Docker: start PostgreSQL and Qdrant separately, install the Python dependencies, set the connection URLs and any API keys as environment variables, and run the server with uvicorn.

API keys are optional for browsing seed data and exploring the UI. They're required for live document ingestion, querying, and evaluation runs.
