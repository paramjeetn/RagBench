# RAGBench

**A containerized RAG evaluation engine for benchmarking chunking, retrieval, and reranking strategies across configurable pipelines.**

RAGBench lets you ingest documents, query them with a full RAG pipeline, and systematically evaluate quality using the RAG Triad metrics. Swap chunking strategies, toggle rerankers, compare LLM providers — then measure what actually improved.

---

## Quick Start

```bash
git clone https://github.com/paramjeet/ragbench.git
cd ragbench

# Add at least one LLM API key
cp .env.example .env
# Edit .env → add GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY

# Launch everything
make up
```

| Service       | URL                          |
|---------------|------------------------------|
| Frontend      | http://localhost:3000         |
| API Docs      | http://localhost:8000/docs    |
| Qdrant Dashboard | http://localhost:6333/dashboard |

```bash
make logs       # tail all services
make down       # stop everything
make clean      # stop + wipe all data (fresh start)
```

---

## What It Does

```
Documents ──▶ Parse ──▶ Chunk ──▶ Embed ──▶ Qdrant
                                               │
User Query ──▶ Embed ──▶ Hybrid Search ──▶ Rerank ──▶ LLM ──▶ Answer
                                                                 │
                                               Evaluate (RAG Triad)
                                                     │
                                              Faithfulness ─── Answer Relevancy
                                              Contextual Precision ─── Recall
```

### Pipeline Components

| Stage | Options |
|-------|---------|
| **Chunking** | Fixed-size, recursive, semantic, document-aware |
| **Embedding** | OpenAI, Gemini, local SentenceTransformer |
| **Retrieval** | Dense (vector), sparse (BM25), hybrid (RRF) |
| **Reranking** | Cross-encoder (`ms-marco-MiniLM-L-12-v2`) or none |
| **Generation** | OpenAI, Anthropic, Gemini, Ollama (local) |
| **Evaluation** | DeepEval RAG Triad + custom GEval criteria |

Every component is swappable via the settings panel or API. Change a config, run an eval, compare results.

---

## Features

- **Chat with documents** — upload PDFs, Markdown, or TXT and ask questions with source citations
- **Configurable pipeline** — swap chunking, retrieval, reranking, and LLM strategies from the UI
- **RAG Triad evaluation** — Faithfulness, Answer Relevancy, Contextual Precision/Recall/Relevancy via DeepEval
- **Run comparison** — side-by-side radar charts showing how config changes affect every metric
- **Metric-to-hyperparameter mapping** — low faithfulness? The system tells you to check your LLM. Low contextual precision? Check your reranker
- **Seed data included** — pre-loaded documents and two eval runs so the dashboard tells a story on first launch

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     docker compose up                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │  Qdrant  │  │ Postgres │  │ Backend  │  │  Frontend  │ │
│  │  :6333   │  │  :5432   │  │  :8000   │  │   :3000    │ │
│  │ vectors  │  │ metadata │  │ FastAPI  │  │  Next.js   │ │
│  └──────────┘  └──────────┘  └────┬─────┘  └─────┬──────┘ │
│       ▲              ▲            │               │        │
│       └──────────────┴────────────┘               │        │
│                      │                            │        │
│                 ┌────┴─────┐                      │        │
│                 │   Seed   │                      │        │
│                 │(one-shot)│                      │        │
│                 └──────────┘                      │        │
│                                                    │        │
│  Frontend ──── HTTP ──── Backend ──── gRPC ──── Qdrant     │
│                            └──────── SQL ──── Postgres     │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy (async), Pydantic |
| **Vector DB** | Qdrant (HNSW indexing, hybrid search) |
| **Database** | PostgreSQL 16 (metadata, eval results) |
| **Embeddings** | OpenAI, Gemini, sentence-transformers (local) |
| **Reranking** | cross-encoder/ms-marco-MiniLM-L-12-v2 |
| **Evaluation** | DeepEval (RAG Triad + GEval) |
| **Infra** | Docker Compose, multi-stage builds, Make |

---

## Project Structure

```
ragbench/
├── Makefile                    # One-command workflows
├── docker-compose.yml          # All services orchestrated
├── .env.example                # API key template
│
├── backend/
│   ├── Dockerfile
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Pipeline configuration
│   ├── ingestion/              # Parsers + chunking strategies
│   ├── embedding/              # Multi-provider embedding
│   ├── retrieval/              # Dense, sparse, hybrid, reranker
│   ├── generation/             # LLM providers + prompt templates
│   ├── evaluation/             # RAG Triad metrics + comparison
│   ├── database/               # Models, repository, session
│   ├── vectorstore/            # Qdrant client
│   ├── seed/                   # Sample docs + seed data loader
│   └── api/                    # REST endpoints
│
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/                # Pages: chat, documents, evaluate, compare
│       ├── components/         # UI components (shadcn/ui based)
│       ├── hooks/              # Chat streaming, polling
│       └── lib/                # API client, types
│
├── CONCEPTS.md                 # Deep-dive: RAG theory, chunking, eval methodology
└── PRODUCT.md                  # Product experience + UI wireframes
```

---

## API

```
POST /api/ingest                Upload and process documents
GET  /api/documents             List ingested documents
POST /api/query                 Ask a question
POST /api/query/stream          Ask a question (streaming)
POST /api/eval/run              Run evaluation suite
GET  /api/eval/runs/{id}        Get eval run results
GET  /api/eval/compare          Compare two eval runs
GET  /api/config                Get pipeline config
PUT  /api/config                Update pipeline config
```

Full interactive docs at `http://localhost:8000/docs` when running.

---

## Makefile Commands

```
make up               Start all services
make down             Stop all services
make build            Rebuild containers
make logs             Tail all logs
make logs-backend     Tail backend logs
make logs-frontend    Tail frontend logs
make seed             Re-run seed data loader
make frontend-dev     Run frontend locally (outside Docker)
make clean            Stop + wipe volumes (fresh start)
make help             Show all commands
```

---

## How Evaluation Works

RAGBench uses the **RAG Triad** framework to evaluate both retrieval and generation quality:

| Metric | Evaluates | Low Score Means |
|--------|-----------|-----------------|
| Contextual Precision | Reranker effectiveness | Irrelevant chunks ranked too high |
| Contextual Recall | Embedding coverage | Missing relevant information |
| Contextual Relevancy | Chunk size + top-K tuning | Too much noise in retrieved context |
| Answer Relevancy | Prompt template quality | Answer doesn't address the question |
| Faithfulness | LLM groundedness | Hallucination — answer goes beyond context |

Each metric maps to a specific hyperparameter, so you know exactly what to tune.

---

## Further Reading

- [docs/architecture.md](docs/architecture.md) — Complete technical architecture: pipelines, schemas, API, config-scoped collections
- [docs/concepts.md](docs/concepts.md) — RAG theory, chunking strategies, hybrid search, evaluation methodology
- [docs/product.md](docs/product.md) — Product experience, UI wireframes, data flow diagrams
- [docs/testing-report.md](docs/testing-report.md) — End-to-end test run results and issues resolved
