# RAG Eval System — Backend

The engine that powers everything. All RAG logic, document ingestion, evaluation, and comparison lives here. The frontend is a thin wrapper that calls these APIs.

---

## User Flows (What the Frontend Does)

Every API decision starts from what the user actually does. There are 5 user flows:

### Flow 1: Upload & Manage Documents
```
User uploads PDF/MD/TXT → backend parses, chunks, embeds, stores
User sees list of their documents with chunk counts
User clicks a document → sees paginated chunk preview
User deletes a document → vectors + metadata cleaned up
```

### Flow 2: Chat Against Selected Documents
```
User selects which documents to chat against (or "all")
User types a question
Backend retrieves only from selected documents → generates answer
Answer streams in with source citations + cost metadata
User sees: which file, which chunk, how confident
```

### Flow 3: Manage Golden Test Datasets
```
User creates a named test dataset (e.g., "ML Basics QA")
User adds QA pairs — manually or uploads a JSON file
User can link a dataset to specific documents
User browses/edits their datasets
```

### Flow 4: Run Evaluation
```
User picks: which documents + which test dataset + current pipeline config
Backend runs each QA pair through the full pipeline
Backend scores with DeepEval (5 metrics per question)
Results stored with full context: config, documents used, dataset used
User sees: per-question pass/fail, failure reasons, aggregated metrics
```

### Flow 5: Compare Runs
```
User picks two eval runs from history
Backend computes metric deltas + config diff
Backend generates insights ("faithfulness improved because you enabled reranking")
User sees: overlay radar chart, delta table, config diff, insight cards
```

---

## API Contract (Frontend-First)

### Health

```
GET /health
→ 200
```
```json
{
  "status": "ok",
  "database": "connected",
  "qdrant": "connected"
}
```

---

### Documents

**Upload a document**
```
POST /api/documents
Content-Type: multipart/form-data
Body: file (PDF, MD, TXT, HTML)
→ 201
```
```json
{
  "id": "d1a2b3c4-...",
  "filename": "ml_textbook.pdf",
  "file_type": "pdf",
  "chunk_count": 23,
  "chunk_strategy": "recursive",
  "uploaded_at": "2026-03-15T10:00:00Z"
}
```

**List all documents**
```
GET /api/documents
→ 200
```
```json
[
  {
    "id": "d1a2b3c4-...",
    "filename": "ml_textbook.pdf",
    "file_type": "pdf",
    "chunk_count": 23,
    "chunk_strategy": "recursive",
    "uploaded_at": "2026-03-15T10:00:00Z"
  },
  {
    "id": "e5f6a7b8-...",
    "filename": "api_guide.md",
    "file_type": "markdown",
    "chunk_count": 12,
    "chunk_strategy": "recursive",
    "uploaded_at": "2026-03-15T10:00:00Z"
  }
]
```

**Get document details + chunks (paginated)**
```
GET /api/documents/:id?page=1&page_size=10
→ 200
```
```json
{
  "id": "d1a2b3c4-...",
  "filename": "ml_textbook.pdf",
  "file_type": "pdf",
  "chunk_count": 23,
  "chunk_strategy": "recursive",
  "uploaded_at": "2026-03-15T10:00:00Z",
  "chunks": {
    "items": [
      {"index": 0, "text": "Backpropagation is a method used in..."},
      {"index": 1, "text": "The chain rule allows us to compute..."}
    ],
    "total": 23,
    "page": 1,
    "page_size": 10
  }
}
```

**Delete a document**
```
DELETE /api/documents/:id
→ 204
```
Removes document metadata from Postgres, vectors from Qdrant, updates BM25 index.

---

### Chat (Query)

**Ask a question (blocking)**
```
POST /api/query
Content-Type: application/json
```
```json
// Request
{
  "question": "How does backpropagation work?",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."]  // optional — null means all documents
}
```
```json
// Response → 200
{
  "answer": "Backpropagation computes gradients of the loss function...",
  "sources": [
    {
      "text": "Backpropagation is a method used in...",
      "source_file": "ml_textbook.pdf",
      "doc_id": "d1a2b3c4-...",
      "page_number": 3,
      "chunk_index": 14,
      "score": 0.92
    }
  ],
  "metadata": {
    "latency_ms": 1300,
    "tokens_used": 287,
    "estimated_cost": 0.004,
    "retrieval_mode": "hybrid+rerank",
    "chunks_used": 5,
    "total_chunks": 47,
    "model": "gpt-4o-mini"
  }
}
```

**Ask a question (streaming)**
```
POST /api/query/stream
Content-Type: application/json
Accept: text/event-stream
```
```json
// Request (same shape as /api/query)
{
  "question": "How does backpropagation work?",
  "document_ids": ["d1a2b3c4-..."]
}
```
```
// SSE Response
data: {"type": "token", "content": "Back"}
data: {"type": "token", "content": "propagation"}
data: {"type": "token", "content": " computes"}
...
data: {"type": "sources", "sources": [{"source_file": "ml_textbook.pdf", "doc_id": "d1a2b3c4-...", "chunk_index": 14, "score": 0.92}]}
data: {"type": "metadata", "metadata": {"latency_ms": 1300, "tokens_used": 287, "estimated_cost": 0.004, "retrieval_mode": "hybrid+rerank", "chunks_used": 5, "total_chunks": 47, "model": "gpt-4o-mini"}}
data: [DONE]
```

---

### Test Datasets (Golden QA Pairs)

**Create a test dataset**
```
POST /api/datasets
Content-Type: application/json
```
```json
// Request
{
  "name": "ML Basics QA",
  "description": "20 questions about neural networks and optimization",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],  // which docs these QA pairs are about
  "items": [
    {
      "question": "How does backpropagation work?",
      "ground_truth": "Backpropagation applies the chain rule to compute gradients layer by layer..."
    },
    {
      "question": "Compare SGD and Adam optimizers",
      "ground_truth": "SGD uses a fixed learning rate while Adam adapts per-parameter..."
    }
  ]
}
```
```json
// Response → 201
{
  "id": "ds-a1b2c3d4-...",
  "name": "ML Basics QA",
  "description": "20 questions about neural networks and optimization",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
  "item_count": 20,
  "created_at": "2026-03-15T10:05:00Z"
}
```

**Upload dataset from JSON file**
```
POST /api/datasets/upload
Content-Type: multipart/form-data
Body: file (JSON), name (string), document_ids (JSON string)
→ 201 (same response shape as above)
```
Expected JSON format:
```json
[
  {"question": "...", "ground_truth": "..."},
  {"question": "...", "ground_truth": "..."}
]
```

**List all datasets**
```
GET /api/datasets
→ 200
```
```json
[
  {
    "id": "ds-a1b2c3d4-...",
    "name": "ML Basics QA",
    "description": "20 questions about neural networks and optimization",
    "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
    "item_count": 20,
    "created_at": "2026-03-15T10:05:00Z"
  }
]
```

**Get dataset with all QA pairs**
```
GET /api/datasets/:id
→ 200
```
```json
{
  "id": "ds-a1b2c3d4-...",
  "name": "ML Basics QA",
  "description": "...",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
  "items": [
    {"id": "tc-...", "question": "How does backpropagation work?", "ground_truth": "..."},
    {"id": "tc-...", "question": "Compare SGD and Adam optimizers", "ground_truth": "..."}
  ],
  "created_at": "2026-03-15T10:05:00Z"
}
```

**Delete a dataset**
```
DELETE /api/datasets/:id
→ 204
```

---

### Evaluation

**Run an evaluation**
```
POST /api/eval/run
Content-Type: application/json
```
```json
// Request — user picks exactly what to evaluate
{
  "dataset_id": "ds-a1b2c3d4-...",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."]  // optional — defaults to dataset's document_ids
}
// Pipeline config is read from current server config (GET /api/config)
// This way, user changes config in settings → runs eval → results are tied to that config snapshot
```
```json
// Response → 202 (accepted — eval runs async, may take minutes)
{
  "id": "run-x1y2z3-...",
  "status": "running",
  "dataset_id": "ds-a1b2c3d4-...",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
  "config": {
    "chunking": {"strategy": "recursive", "chunk_size": 500, "overlap": 50},
    "retrieval": {"mode": "hybrid", "top_k": 5, "reranker_enabled": true},
    "generation": {"model": "gpt-4o-mini", "temperature": 0.1}
  },
  "created_at": "2026-03-15T10:30:00Z"
}
```

**Get eval run status / results**
```
GET /api/eval/runs/:id
→ 200
```
```json
// While running:
{
  "id": "run-x1y2z3-...",
  "status": "running",
  "progress": {"completed": 8, "total": 20},
  "dataset_id": "ds-a1b2c3d4-...",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
  "config": {...},
  "created_at": "2026-03-15T10:30:00Z"
}

// When complete:
{
  "id": "run-x1y2z3-...",
  "status": "completed",
  "dataset_id": "ds-a1b2c3d4-...",
  "dataset_name": "ML Basics QA",
  "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
  "config": {
    "chunking": {"strategy": "recursive", "chunk_size": 500, "overlap": 50},
    "retrieval": {"mode": "hybrid", "top_k": 5, "reranker_enabled": true},
    "generation": {"model": "gpt-4o-mini", "temperature": 0.1}
  },
  "metrics": {
    "faithfulness": 0.92,
    "answer_relevancy": 0.88,
    "contextual_precision": 0.85,
    "contextual_recall": 0.78,
    "contextual_relevancy": 0.81
  },
  "results": [
    {
      "question": "How does backpropagation work?",
      "ground_truth": "Backpropagation applies the chain rule...",
      "generated_answer": "Backpropagation computes gradients...",
      "retrieved_chunks": [
        {"text": "...", "source_file": "ml_textbook.pdf", "chunk_index": 14, "score": 0.92}
      ],
      "metrics": {
        "faithfulness": 0.95,
        "answer_relevancy": 0.91,
        "contextual_precision": 0.90,
        "contextual_recall": 0.85,
        "contextual_relevancy": 0.88
      },
      "latency_ms": 1300,
      "tokens_used": 287,
      "passed": true,
      "failure_reason": null
    },
    {
      "question": "Compare SGD and Adam optimizers",
      "ground_truth": "SGD uses a fixed learning rate...",
      "generated_answer": "...",
      "retrieved_chunks": [...],
      "metrics": {
        "faithfulness": 0.72,
        "answer_relevancy": 0.65,
        "contextual_precision": 0.60,
        "contextual_recall": 0.55,
        "contextual_relevancy": 0.58
      },
      "latency_ms": 1500,
      "tokens_used": 340,
      "passed": false,
      "failure_reason": "Low contextual precision — retrieved chunks didn't cover Adam optimizer."
    }
  ],
  "created_at": "2026-03-15T10:30:00Z"
}
```

**List all eval runs**
```
GET /api/eval/runs
→ 200
```
```json
[
  {
    "id": "run-x1y2z3-...",
    "status": "completed",
    "dataset_id": "ds-a1b2c3d4-...",
    "dataset_name": "ML Basics QA",
    "document_ids": ["d1a2b3c4-...", "e5f6a7b8-..."],
    "config": {...},
    "metrics": {"faithfulness": 0.92, "answer_relevancy": 0.88, ...},
    "question_count": 20,
    "pass_count": 16,
    "created_at": "2026-03-15T10:30:00Z"
  },
  {
    "id": "run-p4q5r6-...",
    "status": "completed",
    "dataset_id": "ds-a1b2c3d4-...",
    "dataset_name": "ML Basics QA",
    "document_ids": ["d1a2b3c4-..."],
    "config": {...},
    "metrics": {"faithfulness": 0.80, "answer_relevancy": 0.83, ...},
    "question_count": 20,
    "pass_count": 12,
    "created_at": "2026-03-15T09:00:00Z"
  }
]
```

---

### Compare Runs

```
GET /api/eval/compare?run_a=<id>&run_b=<id>
→ 200
```
```json
{
  "run_a": {
    "id": "run-p4q5r6-...",
    "dataset_name": "ML Basics QA",
    "config": {
      "chunking": {"strategy": "fixed", "chunk_size": 500, "overlap": 50},
      "retrieval": {"mode": "dense", "top_k": 5, "reranker_enabled": false},
      "generation": {"model": "gpt-4o-mini", "temperature": 0.1}
    },
    "metrics": {
      "faithfulness": 0.80,
      "answer_relevancy": 0.83,
      "contextual_precision": 0.70,
      "contextual_recall": 0.80,
      "contextual_relevancy": 0.73
    }
  },
  "run_b": {
    "id": "run-x1y2z3-...",
    "dataset_name": "ML Basics QA",
    "config": {
      "chunking": {"strategy": "recursive", "chunk_size": 500, "overlap": 50},
      "retrieval": {"mode": "hybrid", "top_k": 5, "reranker_enabled": true},
      "generation": {"model": "gpt-4o-mini", "temperature": 0.1}
    },
    "metrics": {
      "faithfulness": 0.92,
      "answer_relevancy": 0.88,
      "contextual_precision": 0.85,
      "contextual_recall": 0.78,
      "contextual_relevancy": 0.81
    }
  },
  "deltas": {
    "faithfulness": 0.12,
    "answer_relevancy": 0.05,
    "contextual_precision": 0.15,
    "contextual_recall": -0.02,
    "contextual_relevancy": 0.08
  },
  "config_diff": [
    {"field": "chunking.strategy", "value_a": "fixed", "value_b": "recursive"},
    {"field": "retrieval.mode", "value_a": "dense", "value_b": "hybrid"},
    {"field": "retrieval.reranker_enabled", "value_a": false, "value_b": true}
  ],
  "insights": [
    "Faithfulness jumped +0.12 after enabling the cross-encoder reranker. Cleaner context reduces hallucination.",
    "Contextual Precision improved +0.15 — recursive chunking preserves sentence boundaries better than fixed.",
    "Contextual Recall dropped -0.02. Hybrid retrieval trades marginal recall for much better precision. Acceptable.",
    "Trade-off: expect ~0.3s added latency and ~2x token cost per query from reranking."
  ]
}
```

---

### Pipeline Configuration

**Get current config**
```
GET /api/config
→ 200
```
```json
{
  "chunking": {
    "strategy": "recursive",
    "chunk_size": 500,
    "overlap": 50
  },
  "retrieval": {
    "mode": "hybrid",
    "top_k": 5,
    "reranker_enabled": true
  },
  "generation": {
    "model": "gpt-4o-mini",
    "temperature": 0.1
  },
  "status": {
    "reindexing": false
  }
}
```

**Update config**
```
PUT /api/config
Content-Type: application/json
```
```json
// Request — partial update, only send what changed
{
  "chunking": {"strategy": "semantic", "chunk_size": 400},
  "retrieval": {"top_k": 10}
}
```
```json
// Response → 200 (full config after merge)
// If chunking params changed → reindexing starts in background
// Frontend polls GET /api/config to check status.reindexing
{
  "chunking": {"strategy": "semantic", "chunk_size": 400, "overlap": 50},
  "retrieval": {"mode": "hybrid", "top_k": 10, "reranker_enabled": true},
  "generation": {"model": "gpt-4o-mini", "temperature": 0.1},
  "status": {"reindexing": true}
}
```

---

## What Each Frontend Page Needs from the API

| Page | On Load | User Actions | APIs Used |
|------|---------|-------------|-----------|
| **Dashboard** `/` | Fetch latest 2 eval runs for radar chart + metrics | Click metric/insight for detail | `GET /api/eval/runs` (latest 2), `GET /api/eval/compare` |
| **Chat** `/chat` | Fetch document list for selector | Select docs, type question, see streaming answer | `GET /api/documents`, `POST /api/query/stream` |
| **Documents** `/documents` | Fetch document list | Upload file, browse chunks, delete doc | `GET /api/documents`, `POST /api/documents`, `GET /api/documents/:id`, `DELETE /api/documents/:id` |
| **Evaluate** `/evaluate` | Fetch datasets, eval history | Pick dataset + docs, run eval, see results | `GET /api/datasets`, `GET /api/eval/runs`, `POST /api/eval/run`, `GET /api/eval/runs/:id` |
| **Compare** `/compare` | Fetch eval run list for dropdowns | Pick 2 runs, see comparison | `GET /api/eval/runs`, `GET /api/eval/compare` |
| **Settings** (sidebar) | Fetch current config | Change params, apply | `GET /api/config`, `PUT /api/config` |
| **Datasets** (within Evaluate) | Fetch dataset list | Create/upload dataset, browse QA pairs | `GET /api/datasets`, `POST /api/datasets`, `POST /api/datasets/upload`, `GET /api/datasets/:id`, `DELETE /api/datasets/:id` |

---

## Database Schema

### PostgreSQL

```sql
-- Documents uploaded by the user
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        VARCHAR(255) NOT NULL,
    file_type       VARCHAR(20) NOT NULL,     -- pdf, markdown, txt, html
    chunk_count     INT NOT NULL,
    chunk_strategy  VARCHAR(50) NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named collections of QA pairs for evaluation
CREATE TABLE datasets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    document_ids    JSONB NOT NULL DEFAULT '[]',  -- which docs these QA pairs target
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual QA pairs within a dataset
CREATE TABLE test_cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    ground_truth    TEXT NOT NULL
);

-- An evaluation run — snapshot of config + docs + dataset at time of run
CREATE TABLE eval_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          VARCHAR(20) NOT NULL DEFAULT 'running',  -- running, completed, failed
    dataset_id      UUID NOT NULL REFERENCES datasets(id),
    document_ids    JSONB NOT NULL DEFAULT '[]',
    config          JSONB NOT NULL,             -- full pipeline config snapshot
    metrics         JSONB,                      -- aggregated scores (null while running)
    progress_done   INT NOT NULL DEFAULT 0,     -- questions completed so far
    progress_total  INT NOT NULL DEFAULT 0,     -- total questions
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-question results within an eval run
CREATE TABLE eval_results (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id            UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    question          TEXT NOT NULL,
    ground_truth      TEXT NOT NULL,
    generated_answer  TEXT NOT NULL,
    retrieved_chunks  JSONB NOT NULL,
    metrics           JSONB NOT NULL,           -- per-question metric scores
    latency_ms        INT NOT NULL,
    tokens_used       INT NOT NULL,
    passed            BOOLEAN NOT NULL DEFAULT true,
    failure_reason    TEXT
);
```

### Qdrant

```
Collection: "documents"
Vectors:    size=1536, distance=Cosine
Payload:
  - text           (string)  — chunk text content
  - doc_id         (string)  — UUID linking to documents table
  - source_file    (string)  — original filename
  - page_number    (integer) — page in source document
  - chunk_index    (integer) — position within document
  - chunk_strategy (string)  — strategy used to create this chunk
```

Key: `doc_id` in the Qdrant payload is what enables document-scoped queries. When the user selects specific documents to chat against or evaluate, we filter Qdrant search by `doc_id IN [...]`.

---

## Architecture

```
                         ┌─────────────────────────────────┐
                         │           FastAPI (8000)         │
                         │  /api/documents  /api/query  .. │
                         └──────────┬──────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
          ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
          │  Ingestion   │  │    Query     │  │  Evaluation  │
          │  Pipeline    │  │   Pipeline   │  │   Pipeline   │
          └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
                 │                │                  │
    ┌────────────┼────────────────┼──────────────────┘
    ▼            ▼                ▼
┌────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
│ Parser │ │ Chunker  │ │ Embedder   │ │ Retriever │ │   LLM    │
│        │ │ (4 modes)│ │ (OpenAI /  │ │ (dense +  │ │ (OpenAI /│
│ PDF,MD │ │ fixed,   │ │  local)    │ │  sparse + │ │ Claude / │
│ TXT,HTML│ │ recursive│ │            │ │  hybrid + │ │ Ollama)  │
└────────┘ │ semantic │ └─────┬──────┘ │  rerank)  │ └──────────┘
           │ doc-aware│       │        └─────┬─────┘
           └──────────┘       ▼              ▼
                        ┌──────────┐   ┌──────────┐
                        │  Qdrant  │   │ Postgres │
                        │ (vectors)│   │(metadata │
                        │  :6333   │   │ + evals) │
                        └──────────┘   │  :5432   │
                                       └──────────┘
```

---

## Query Pipeline Flow

```
User question + selected document_ids
    │
    ▼
Embed query (same model as chunks)
    │
    ├─── Dense: Qdrant ANN → top 50 (filtered by doc_ids if provided)
    │
    ├─── Sparse: BM25 → top 50 (filtered by doc_ids if provided)
    │
    ▼
Reciprocal Rank Fusion
    RRF_score(doc) = Σ 1/(60 + rank)
    → top 20 merged results
    │
    ▼
Cross-encoder rerank (if enabled)
    ms-marco-MiniLM-L-12-v2
    → top K (default 5)
    │
    ▼
Build prompt
    System: "Answer ONLY from context. Cite sources."
    User: [chunk_1] [chunk_2] ... [chunk_k] + question
    │
    ▼
LLM generates answer (streaming or blocking)
    │
    ▼
Return: answer + sources + metadata (latency, tokens, cost)
```

---

## Evaluation Metrics

Five metrics from the DeepEval RAG Triad framework:

| Metric | What It Measures | Low Score → Tune |
|--------|-----------------|------------------|
| **Faithfulness** | Does the answer stay grounded in context? | LLM choice, temperature |
| **Answer Relevancy** | Does the answer address the question? | Prompt template |
| **Contextual Precision** | Are relevant chunks ranked above irrelevant ones? | Reranking strategy, top-K |
| **Contextual Recall** | Are all relevant chunks retrieved? | Embedding model |
| **Contextual Relevancy** | Is the retrieved info density appropriate? | chunk_size, overlap, top_k |

Threshold: **0.7** — a question "passes" if all 5 metrics exceed this.

---

## Pipeline Config Parameters

### Chunking
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `strategy` | enum | `recursive` | `fixed`, `recursive`, `semantic`, `document_aware` |
| `chunk_size` | int | `500` | 200–1000 |
| `overlap` | int | `50` | 0–200 |

### Retrieval
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `mode` | enum | `hybrid` | `dense`, `sparse`, `hybrid` |
| `top_k` | int | `5` | 1–20 |
| `reranker_enabled` | bool | `true` | on/off |

### Generation
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `model` | string | `gpt-4o-mini` | Any OpenAI / Anthropic / Ollama model |
| `temperature` | float | `0.1` | 0.0–2.0 |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://user:pass@localhost:5432/rageval` | Postgres connection |
| `QDRANT_URL` | Yes | `http://localhost:6333` | Qdrant endpoint |
| `OPENAI_API_KEY` | No* | — | For embeddings + GPT models |
| `ANTHROPIC_API_KEY` | No* | — | For Claude models |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | For local LLM inference |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model name |
| `EMBEDDING_DIM` | No | `1536` | Vector dimension |
| `COLLECTION_NAME` | No | `documents` | Qdrant collection name |

*At least one LLM provider key required for live queries and evaluation. Dashboard works without any key using seed data.

---

## Endpoint Summary

```
GET    /health                              Health check

POST   /api/documents                       Upload a document
GET    /api/documents                       List all documents
GET    /api/documents/:id                   Get document + paginated chunks
DELETE /api/documents/:id                   Delete document + vectors

POST   /api/query                           Ask question (blocking)
POST   /api/query/stream                    Ask question (SSE streaming)

POST   /api/datasets                        Create test dataset with QA pairs
POST   /api/datasets/upload                 Upload test dataset from JSON file
GET    /api/datasets                        List all datasets
GET    /api/datasets/:id                    Get dataset with QA pairs
DELETE /api/datasets/:id                    Delete dataset

POST   /api/eval/run                        Start evaluation run
GET    /api/eval/runs                       List all eval runs
GET    /api/eval/runs/:id                   Get run status/results
GET    /api/eval/compare?run_a=X&run_b=Y    Compare two runs

GET    /api/config                          Get pipeline config
PUT    /api/config                          Update pipeline config
```

---

## Running Locally

### With Docker (recommended)
```bash
cd 03_RAG_Eval_System
cp .env.example .env
# Add OPENAI_API_KEY to .env (optional — seed data works without it)
docker compose up
```

Backend at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### Without Docker (development)
```bash
# Start infra
docker run -d -p 6333:6333 qdrant/qdrant
docker run -d -p 5432:5432 -e POSTGRES_USER=user -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=rageval postgres:16

# Install + run
cd backend
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/rageval"
export QDRANT_URL="http://localhost:6333"
export OPENAI_API_KEY="sk-..."
uvicorn main:app --reload --port 8000
```

---

## Dependencies

```
# Core
fastapi>=0.115
uvicorn[standard]>=0.34
pydantic>=2.0
pydantic-settings>=2.0

# Database
sqlalchemy[asyncio]>=2.0
asyncpg>=0.30

# Vector Store
qdrant-client>=1.12

# Embeddings & Reranking
openai>=1.50
sentence-transformers>=3.0

# LLM Providers
anthropic>=0.40
httpx>=0.27

# Document Parsing
pypdf2>=3.0
unstructured>=0.16
python-multipart>=0.0.17

# Retrieval
rank-bm25>=0.2.2

# Evaluation
deepeval>=2.0
```
