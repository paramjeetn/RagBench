# RagBench — Architecture

A complete technical reference for how every component is designed, how data flows through the system, and why each decision was made.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Docker Services Topology](#docker-services-topology)
3. [Ingestion Pipeline](#ingestion-pipeline)
4. [Query Pipeline](#query-pipeline)
5. [Evaluation Pipeline](#evaluation-pipeline)
6. [Config-Scoped Collections](#config-scoped-collections)
7. [Database Schemas](#database-schemas)
8. [API Reference](#api-reference)
9. [Frontend Architecture](#frontend-architecture)
10. [Tech Stack Decisions](#tech-stack-decisions)

---

## System Overview

```
Documents ──▶ Parse ──▶ Chunk ──▶ Embed ──▶ Qdrant (vectors)
                                                   │
User Query ──▶ Embed ──▶ Hybrid Search ──▶ Rerank ──▶ LLM ──▶ Answer + Citations
                                                                        │
                                                   Evaluate (RAG Triad) ◀
                                                          │
                                                   Postgres (eval runs)
```

Three independent pipelines share the same vector store and LLM layer:

- **Ingestion** — processes and stores documents
- **Query** — retrieves and answers questions
- **Evaluation** — measures pipeline quality systematically

---

## Docker Services Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                      docker compose up                           │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Qdrant  │  │ Postgres │  │ Backend  │  │    Frontend    │  │
│  │  :6333   │  │  :5432   │  │  :8000   │  │    :3000       │  │
│  │ vectors  │  │ metadata │  │ FastAPI  │  │    Next.js     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────────────┘  │
│       │              │             │                             │
│       └──────────────┤             │                             │
│                      │             │                             │
│                 ┌────┴──────┐      │                             │
│                 │   Seed    │◀─────┘  (waits for backend health) │
│                 │ (one-shot)│                                     │
│                 └───────────┘                                     │
│                                                                  │
│  Startup order (via depends_on + healthchecks):                  │
│    1. postgres (pg_isready)                                       │
│    2. qdrant   (TCP port check on :6333)                          │
│    3. backend  (GET /health returns 200)                          │
│    4. seed     (runs python seed/load_seed_data.py, then exits)   │
│    5. frontend (depends on backend, no healthcheck needed)        │
└─────────────────────────────────────────────────────────────────┘
```

### Service Details

| Service | Image / Build | Port | Responsibility |
|---------|--------------|------|----------------|
| `postgres` | `postgres:16-alpine` | 5432 | Document metadata, eval runs, eval results, test datasets |
| `qdrant` | `qdrant/qdrant:latest` | 6333 | Vector storage, HNSW index, hybrid search, per-config collections |
| `backend` | `./backend` (Python 3.12) | 8000 | All business logic — ingestion, query, eval, config API |
| `seed` | same image as backend | — | One-shot data loader; uploads docs + eval runs, then exits (`restart: "no"`) |
| `frontend` | `./frontend` (Node 20) | 3000 | Next.js UI — dashboard, chat, documents, evaluate, compare |

**Volume persistence:**
- `pgdata` — Postgres data directory
- `qdrant_data` — Qdrant storage directory

`docker compose down -v` wipes both volumes for a clean slate.

---

## Ingestion Pipeline

```
POST /api/documents/
        │
        ▼
┌───────────────────┐
│   File Upload     │  multipart/form-data — PDF, MD, TXT
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Parser          │  backend/ingestion/parser.py
│                   │  PDF  → PyPDF2 / Unstructured
│                   │  MD   → markdown-it
│                   │  TXT  → raw text
│                   │  Extracts: raw text + metadata (filename, page, headers)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Chunking Engine │  backend/ingestion/chunking.py
│                   │
│   Strategies:     │
│   ┌────────────┐  │
│   │ fixed      │  │  Split every N chars, no sentence awareness
│   │ recursive  │  │  Try paragraphs → sentences → words → chars (default)
│   │ semantic   │  │  Embed each sentence, split when similarity drops
│   │ doc-aware  │  │  Use document headers/sections as boundaries
│   └────────────┘  │
│                   │
│   Params: chunk_size (default 500), chunk_overlap (default 50)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Embedder        │  backend/embedding/embedder.py
│                   │
│   Providers:      │
│   ┌────────────┐  │
│   │ OpenAI     │  │  text-embedding-3-small (1536-dim)
│   │ Gemini     │  │  gemini-embedding-001 (768-dim)
│   │ local      │  │  sentence-transformers (all-MiniLM-L6-v2, 384-dim)
│   └────────────┘  │
│                   │
│   Batch processing — embeds all chunks in one API call
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Qdrant Upsert   │  backend/vectorstore/qdrant_store.py
│                   │
│   Collection name │  docs_{strategy}_{size}_{overlap}_{provider}_{dim}
│   e.g.            │  docs_recursive_500_50_gemini_768
│                   │
│   Payload per     │
│   vector:         │
│   - text (str)    │
│   - source_file   │
│   - page_number   │
│   - chunk_index   │
│   - chunk_strategy│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Postgres Insert │  backend/database/repository.py
│                   │
│   documents table:│
│   - filename      │
│   - file_type     │
│   - chunk_count   │
│   - chunk_strategy│
│   - file_bytes    │  raw bytes stored for auto re-ingestion on config change
└───────────────────┘
```

### Key Design: File Byte Storage

Original document bytes are stored in Postgres (`LargeBinary` column). This enables **automatic re-ingestion** when the pipeline config changes — the user never needs to re-upload files.

---

## Query Pipeline

```
POST /api/query  or  POST /api/query/stream
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                     query_pipeline.py                      │
│                                                            │
│  1. Embed Query                                            │
│     └─ Same provider as ingestion config                   │
│                                                            │
│  2. Dense Retrieval                backend/retrieval/dense.py
│     └─ Qdrant ANN search           top_k × 10 candidates  │
│        (HNSW, cosine distance)                             │
│                                                            │
│  3. Sparse Retrieval               backend/retrieval/sparse.py
│     └─ BM25 keyword search         rank-bm25 library       │
│        (exact + partial matches)   top_k × 10 candidates  │
│                                                            │
│  4. Hybrid Fusion                  backend/retrieval/hybrid.py
│     └─ Reciprocal Rank Fusion      merges dense + sparse   │
│        RRF_score = Σ 1/(k + rank)  k=60, → top 20         │
│                                                            │
│  5. Reranking (optional)           backend/retrieval/reranker.py
│     └─ Cross-encoder               cross-encoder/ms-marco-MiniLM-L-12-v2
│        scores each of top 20       → top_k (default 5)    │
│                                                            │
│  6. Prompt Assembly                backend/generation/prompts.py
│     └─ system prompt + top_k chunks + user question        │
│                                                            │
│  7. LLM Generation                 backend/generation/llm.py
│     Providers:                                             │
│     ┌──────────┬──────────────────────────────────────┐   │
│     │ OpenAI   │ gpt-4o, gpt-4o-mini                  │   │
│     │ Anthropic│ claude-3-5-sonnet, claude-3-haiku    │   │
│     │ Gemini   │ gemini-2.5-flash, gemini-1.5-pro     │   │
│     │ Ollama   │ any local model                      │   │
│     └──────────┴──────────────────────────────────────┘   │
│     Streaming supported via POST /api/query/stream         │
│                                                            │
│  8. Response                                               │
│     └─ answer text                                         │
│        source citations  [Source: filename, chunk N]       │
│        latency_ms                                          │
│        tokens_used                                         │
│        est_cost                                            │
│        retrieval_strategy                                  │
│        chunks_used / chunks_available                      │
└───────────────────────────────────────────────────────────┘
```

### Retrieval Mode Options

| Mode | Dense | Sparse | Fusion | Reranker |
|------|-------|--------|--------|----------|
| `dense` | ✓ | — | — | optional |
| `sparse` | — | ✓ | — | optional |
| `hybrid` | ✓ | ✓ | RRF | optional |

Default: `hybrid` + reranker enabled.

### Why Hybrid + Reranker?

- **Dense alone** — misses exact keyword matches (e.g., error codes, API names)
- **Sparse alone** — misses semantic similarity ("precipitation" ≠ "rain")
- **Hybrid (RRF)** — best of both; resilient to either method's blind spots
- **Cross-encoder reranker** — bi-encoders embed query and document separately (fast, approximate); cross-encoder jointly attends to both (slow, accurate). Running it on the short candidate list (top 20) keeps latency acceptable

---

## Evaluation Pipeline

```
POST /api/eval/run  { dataset_id, config }
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                     evaluation/runner.py                   │
│                                                            │
│  For each (question, ground_truth) in test dataset:        │
│                                                            │
│  1. Run question through full query pipeline               │
│     └─ actual_output, retrieved_chunks                     │
│                                                            │
│  2. Build DeepEval LLMTestCase                             │
│     input            = question                            │
│     actual_output    = pipeline answer                     │
│     retrieval_context = retrieved chunks                   │
│     expected_output  = ground truth answer                 │
│                                                            │
│  3. Score with RAG Triad + retriever metrics               │
│                                                            │
│     RETRIEVER METRICS                                      │
│     ┌────────────────────────┬──────────────────────────┐ │
│     │ ContextualPrecision    │ Relevant chunks ranked   │ │
│     │                        │ above irrelevant ones?   │ │
│     │                        │ → tune reranker          │ │
│     ├────────────────────────┼──────────────────────────┤ │
│     │ ContextualRecall       │ All relevant chunks      │ │
│     │                        │ retrieved?               │ │
│     │                        │ → tune embedding model   │ │
│     ├────────────────────────┼──────────────────────────┤ │
│     │ ContextualRelevancy    │ Retrieved context dense  │ │
│     │                        │ enough, not noisy?       │ │
│     │                        │ → tune chunk_size, top_k │ │
│     └────────────────────────┴──────────────────────────┘ │
│                                                            │
│     GENERATOR METRICS (RAG Triad)                          │
│     ┌────────────────────────┬──────────────────────────┐ │
│     │ Faithfulness           │ Answer stays within      │ │
│     │                        │ context? No hallucination│ │
│     │                        │ → tune LLM / temperature │ │
│     ├────────────────────────┼──────────────────────────┤ │
│     │ AnswerRelevancy        │ Answer addresses the     │ │
│     │                        │ question?                │ │
│     │                        │ → tune prompt template   │ │
│     └────────────────────────┴──────────────────────────┘ │
│                                                            │
│  4. Store per-question result in Postgres (eval_results)   │
│                                                            │
└───────────────────────────────────────────────────────────┘
        │
        ▼
Aggregate scores → store in eval_runs table
        │
        ▼
Map low scores to hyperparameter suggestions (comparison.py)
        │
        ▼
Dashboard updates: new run visible, insight cards generated
```

### Metric → Hyperparameter Mapping

| Metric | Low Score Root Cause | Tune This |
|--------|---------------------|-----------|
| Contextual Precision | Irrelevant chunks ranked above relevant ones | Reranker model or strategy |
| Contextual Recall | Embedding misses relevant chunks | Embedding model, chunk_overlap |
| Contextual Relevancy | Context too noisy or too sparse | chunk_size, top_k |
| Answer Relevancy | Answer doesn't address the question | Prompt template |
| Faithfulness | LLM adds info not in context (hallucination) | LLM choice, temperature |

### Test Dataset

Stored in Postgres (`datasets` + `dataset_items` tables). Each item:
```json
{
  "question": "How does backpropagation work?",
  "ground_truth": "Backpropagation computes gradients..."
}
```

Seed loads 20 hand-curated Q&A pairs from `backend/seed/documents/test_dataset.json`.

---

## Config-Scoped Collections

Each unique pipeline configuration gets its own Qdrant collection. This is the core mechanism that makes config switching instant.

### Collection Naming

```
docs_{strategy}_{chunk_size}_{chunk_overlap}_{embedding_provider}_{embedding_dim}

Examples:
  docs_recursive_500_50_gemini_768
  docs_fixed_500_50_gemini_768
  docs_semantic_1000_100_openai_1536
```

Built by `config.py::get_collection_name()`.

### Config Change Flow

```
PUT /api/config  { chunking: { strategy: "fixed" }, ... }
        │
        ▼
  Compute new collection name
        │
        ├─── Collection exists? ──▶ YES ──▶ Switch active collection (instant)
        │                                         collection_ready = true
        │
        └─── NO ──▶ Create Qdrant collection
                         │
                         ▼
                   Load all documents from Postgres (file_bytes column)
                         │
                         ▼
                   Re-parse → Re-chunk → Re-embed → Upsert into new collection
                         │
                         ▼
                   collection_ready = true
```

The frontend polls `GET /api/config` checking `collection_ready` before enabling chat/eval.

### Collection Management API

```
GET  /api/config/collections          List all collections with stats
DELETE /api/config/collections/{name} Delete a collection (active protected)
```

Example response:
```json
[
  { "name": "docs_recursive_500_50_gemini_768", "dimension": 768, "vector_count": 59, "is_active": false },
  { "name": "docs_fixed_500_50_gemini_768",     "dimension": 768, "vector_count": 46, "is_active": true  }
]
```

---

## Database Schemas

### PostgreSQL Tables

```sql
-- Ingested documents
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        VARCHAR(255)  NOT NULL,
    file_type       VARCHAR(20)   NOT NULL,   -- pdf, md, txt
    chunk_count     INT           NOT NULL,
    chunk_strategy  VARCHAR(50)   NOT NULL,
    file_bytes      BYTEA,                    -- original file stored for re-ingestion
    uploaded_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- Evaluation runs (one row per "run eval" click)
CREATE TABLE eval_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id  UUID REFERENCES datasets(id),
    config      JSONB NOT NULL,   -- full pipeline config snapshot
    status      VARCHAR(20),      -- pending / running / completed / failed
    metrics     JSONB,            -- aggregated scores across all questions
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Per-question results for each eval run
CREATE TABLE eval_results (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           UUID REFERENCES eval_runs(id),
    question         TEXT    NOT NULL,
    ground_truth     TEXT,
    generated_answer TEXT,
    retrieved_chunks JSONB,   -- array of {text, source, score}
    metrics          JSONB,   -- per-question {faithfulness, answer_relevancy, ...}
    latency_ms       INT,
    tokens_used      INT,
    passed           BOOLEAN
);

-- Test datasets
CREATE TABLE datasets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    item_count  INT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Q&A pairs in a dataset
CREATE TABLE dataset_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id   UUID REFERENCES datasets(id),
    question     TEXT NOT NULL,
    ground_truth TEXT
);
```

### Qdrant Collection Schema

```json
{
  "collection_name": "docs_recursive_500_50_gemini_768",
  "vectors": {
    "size": 768,
    "distance": "Cosine"
  },
  "payload_schema": {
    "text":            "keyword",
    "source_file":     "keyword",
    "page_number":     "integer",
    "chunk_index":     "integer",
    "chunk_strategy":  "keyword",
    "document_id":     "keyword"
  }
}
```

HNSW indexing is used by default (Qdrant's standard). Cosine distance for semantic similarity.

---

## API Reference

All routes are registered in `backend/main.py` and implemented in `backend/api/`.

### Documents

```
POST /api/documents/              Upload + process a document
     Body: multipart/form-data    file (required)
     Returns: { id, filename, chunk_count, chunk_strategy }

GET  /api/documents/              List all ingested documents
     Returns: [{ id, filename, file_type, chunk_count, uploaded_at }]

GET  /api/documents/{id}/chunks   Get chunk preview for a document
     Returns: [{ index, text, source_file, page_number }]
```

### Query

```
POST /api/query                   Ask a question (blocking)
     Body: { question: str, top_k?: int }
     Returns: { answer, sources, latency_ms, tokens_used, est_cost, retrieval_strategy }

POST /api/query/stream            Ask a question (streaming SSE)
     Body: { question: str }
     Returns: text/event-stream — chunks of answer text, then final metadata
```

### Evaluation

```
POST /api/eval/run                Start an evaluation run
     Body: { dataset_id: uuid }
     Returns: { run_id, status: "pending" }

GET  /api/eval/runs/{id}          Poll run status + results
     Returns: { id, status, metrics, results: [...per-question] }

GET  /api/eval/runs               List all runs
     Returns: [{ id, status, metrics, config, created_at }]

GET  /api/eval/compare            Compare two runs
     Query: ?run_a=uuid&run_b=uuid
     Returns: { deltas: {...}, config_diff: {...}, insights: [...] }
```

### Datasets

```
POST /api/datasets/               Create a dataset
     Body: { name: str, items: [{ question, ground_truth }] }
     Returns: { id, name, item_count }

GET  /api/datasets/               List all datasets
GET  /api/datasets/{id}           Get dataset with items
```

### Config

```
GET  /api/config                  Get current pipeline config + active collection
     Returns: { chunking, retrieval, generation, active_collection, collection_ready }

PUT  /api/config                  Update pipeline config
     Body: partial config object
     Returns: { ...new config, active_collection, collection_ready }

GET  /api/config/collections      List all Qdrant collections
DELETE /api/config/collections/{name}  Delete a collection
```

### Health

```
GET  /health                      DB + Qdrant connectivity check
     Returns: { status: "ok", database: "connected", qdrant: "connected" }
```

---

## Frontend Architecture

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui.

```
frontend/src/
├── app/                          Next.js App Router pages
│   ├── page.tsx                  / → Dashboard
│   ├── chat/page.tsx             /chat → Q&A interface
│   ├── documents/page.tsx        /documents → Upload + browse
│   ├── evaluate/page.tsx         /evaluate → Run evals + results
│   ├── compare/page.tsx          /compare → Side-by-side run diff
│   └── layout.tsx                Root layout — AppShell wrapper
│
├── components/
│   ├── dashboard/
│   │   ├── radar-chart.tsx       Recharts radar — overlays two eval runs
│   │   ├── metric-card.tsx       Score + delta indicator (▲/▼)
│   │   └── insight-card.tsx      Diagnostic suggestion from low scores
│   ├── chat/
│   │   ├── message-list.tsx      Scrollable message history
│   │   ├── message-input.tsx     Input + send button
│   │   └── source-card.tsx       Expandable source citation
│   ├── documents/
│   │   ├── upload-zone.tsx       Drag-and-drop file upload
│   │   ├── document-list.tsx     Ingested doc table
│   │   └── chunk-preview.tsx     Paginated chunk viewer
│   ├── evaluate/
│   │   ├── run-history.tsx       Table of past eval runs
│   │   ├── result-detail.tsx     Per-question pass/fail breakdown
│   │   ├── progress-bar.tsx      Live progress (polled)
│   │   └── upload-dataset.tsx    Upload custom Q&A dataset
│   └── layout/
│       ├── app-shell.tsx         Sidebar + main content wrapper
│       ├── sidebar.tsx           Nav links
│       └── settings-sheet.tsx    Slide-out settings panel (chunking, retrieval, LLM)
│
├── context/
│   ├── chat-context.tsx          Message history, streaming state
│   └── eval-context.tsx          Active run, polling interval
│
└── lib/
    ├── api.ts                    Typed API client (fetch wrappers)
    └── types.ts                  Shared TypeScript types
```

### Data Fetching Pattern

- **Dashboard / static pages** — fetch on mount, no polling
- **Eval run progress** — poll `GET /api/eval/runs/{id}` every 2s until `status === "completed"`
- **Config collection_ready** — poll `GET /api/config` every 3s after a config change
- **Chat streaming** — `fetch` with `ReadableStream`, chunked SSE parsing

---

## Tech Stack Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Backend language** | Python 3.12 | ML/AI ecosystem — all relevant libraries are Python-first |
| **API framework** | FastAPI | Async, auto-generated Swagger docs, Pydantic schema validation |
| **ORM** | SQLAlchemy (async) | Type-safe DB access, async-compatible with asyncpg driver |
| **Vector DB** | Qdrant | Open-source, Docker-native, built-in hybrid search, HNSW indexing, no managed service required |
| **Eval framework** | DeepEval | RAG Triad metrics, synthetic data generation, LLMTestCase abstraction |
| **Reranker** | cross-encoder/ms-marco-MiniLM-L-12-v2 | Runs locally (no API cost), well-benchmarked on passage reranking |
| **Frontend** | Next.js 16 (App Router) | SSR-capable, TypeScript-first, Tailwind + shadcn/ui for fast UI |
| **Containerization** | Docker Compose | Single-command startup, service isolation, volume persistence |

### Why Qdrant over alternatives?

| | Qdrant | Pinecone | Chroma | Weaviate |
|---|--------|----------|--------|----------|
| Runs locally | ✓ | ✗ | ✓ | ✓ |
| Built-in hybrid search | ✓ | ✗ | ✗ | ✓ |
| No API costs in dev | ✓ | ✗ | ✓ | ✓ |
| Scales to production | ✓ | ✓ | limited | ✓ |
| Simple gRPC + REST API | ✓ | ✓ | ✗ | partial |

### Why DeepEval over RAGAS?

- DeepEval's RAG Triad maps each metric to a specific pipeline component, making it easier to diagnose *which* component to fix
- RAGAS metrics are useful but harder to map to actionable hyperparameter changes
- DeepEval's `Synthesizer` generates diverse test cases with 7 evolution types (reasoning, multicontext, comparative, etc.)
- Both can be used together; this project uses DeepEval as the primary framework
