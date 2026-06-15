<div align="center">

# RagBench

**An open-source RAG evaluation engine. Benchmark your retrieval pipeline before it ships.**

[![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Docs](#architecture) · [Quick Start](#quick-start) · [API Reference](#api)

</div>

---

Most RAG apps ship without knowing why they're failing. RagBench gives you the instrumentation to find out — swap chunking strategies, retrieval modes, and LLM providers, then measure the impact with the RAG Triad: Faithfulness, Contextual Precision, Contextual Recall, Answer Relevancy, and Contextual Relevancy.

One command to run. No config files to write. Seed data included.

---

## Architecture

![RagBench Architecture](docs/diagram/architecture.png)

---

## Quick Start

**Prerequisites:** Docker + Docker Compose, and at least one LLM API key (OpenAI, Gemini, or Anthropic).

```bash
git clone https://github.com/paramjeetn/ragbench.git
cd ragbench
cp .env.example .env
# Edit .env — add OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY
make up
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Qdrant Dashboard | http://localhost:6333/dashboard |

Seed data loads automatically — the dashboard shows real eval results on first launch.

```bash
make logs       # tail all services
make down       # stop
make clean      # stop + wipe volumes (fresh start)
```

---

## What You Can Do

- **Upload documents** — PDF, Markdown, or plain text. The ingestion pipeline parses, chunks, embeds, and indexes into Qdrant automatically.
- **Chat with your documents** — streaming Q&A with source citations and token/cost metadata per response.
- **Run evaluations** — pick a question set, run it against your current pipeline config, get per-question RAG Triad scores.
- **Compare runs side-by-side** — radar charts showing how a config change moved each metric. Know if your change helped or hurt.
- **Tune from the UI** — change chunking strategy, embedding model, retrieval mode, reranker, LLM — all from a settings panel, no restarts.

---

## How the Pipeline Works

```
Documents → Parse → Chunk → Embed → Qdrant
                                       │
Query → Embed → Dense Search ──┐       │
             → BM25 Sparse ────┴─ RRF Fusion (top 20)
                                       │
                              Cross-Encoder Rerank (top 5)
                                       │
                                  LLM Generator
                                       │
                              Answer + Citations
                                       │
                           Evaluate with RAG Triad
```

Every stage is swappable:

| Stage | Options |
|---|---|
| Chunking | Fixed-size · Recursive · Semantic · Document-aware |
| Embedding | OpenAI · Gemini · SentenceTransformers (local) |
| Retrieval | Dense · Sparse (BM25) · Hybrid (RRF) |
| Reranking | Cross-encoder `ms-marco-MiniLM-L-12-v2` · None |
| Generation | OpenAI · Anthropic · Gemini · Ollama (local) |
| Evaluation | DeepEval RAG Triad · GEval |

---

## Evaluation Metrics

RagBench uses the **RAG Triad** framework. Each metric maps to a specific part of the pipeline, so a low score tells you exactly what to fix.

| Metric | What It Measures | Low Score Means |
|---|---|---|
| Contextual Precision | Reranker quality | Irrelevant chunks ranked too high |
| Contextual Recall | Embedding coverage | Missing relevant information |
| Contextual Relevancy | Chunk size / top-K tuning | Too much noise in retrieved context |
| Answer Relevancy | Prompt template quality | Answer doesn't address the question |
| Faithfulness | LLM groundedness | Hallucination — answer goes beyond context |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui |
| Backend | Python 3.12 · FastAPI · SQLAlchemy (async) · Pydantic |
| Vector DB | Qdrant (HNSW indexing, hybrid search) |
| Database | PostgreSQL 16 |
| Embeddings | OpenAI · Gemini · sentence-transformers |
| Reranking | cross-encoder/ms-marco-MiniLM-L-12-v2 |
| Evaluation | DeepEval (RAG Triad + GEval) |
| Infra | Docker Compose · multi-stage builds · Make |

---

## Project Structure

```
ragbench/
├── Makefile                    # make up / down / clean / seed / logs
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── main.py                 # FastAPI entry + lifespan
│   ├── config.py               # Pipeline config schema
│   ├── ingestion/              # Parser + chunking strategies
│   ├── embedding/              # Multi-provider embedder
│   ├── retrieval/              # Dense, sparse, hybrid, reranker
│   ├── generation/             # LLM providers + prompt templates
│   ├── evaluation/             # RAG Triad runner + comparison
│   ├── database/               # SQLAlchemy models + repository
│   ├── vectorstore/            # Qdrant client wrapper
│   ├── seed/                   # Sample docs + idempotent seed loader
│   └── api/                    # REST route handlers
│
└── frontend/src/
    ├── app/                    # Pages: dashboard, chat, documents, evaluate, compare
    ├── components/             # UI components (shadcn/ui)
    ├── context/                # Chat + eval state
    └── lib/                    # API client + types
```

---

## API

```
POST /api/ingest                Upload and process documents
GET  /api/documents             List ingested documents
POST /api/query                 Ask a question (sync)
POST /api/query/stream          Ask a question (SSE streaming)
POST /api/eval/run              Run evaluation suite
GET  /api/eval/runs/{id}        Get results for an eval run
GET  /api/eval/compare          Compare two eval runs
GET  /api/config                Get current pipeline config
PUT  /api/config                Update pipeline config
GET  /health                    Health check
```

Full interactive docs at `http://localhost:8000/docs`.

---

## Makefile Commands

```bash
make up               # Start all services (postgres → qdrant → backend → seed → frontend)
make down             # Stop all services
make build            # Rebuild containers
make logs             # Tail all logs
make logs-backend     # Tail backend logs only
make logs-frontend    # Tail frontend logs only
make seed             # Re-run seed data loader
make clean            # Stop + wipe all volumes
make help             # Show all commands
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in at least one LLM key:

```env
# LLM — at least one required
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Evaluation — required for RAG Triad scoring
OPENAI_API_KEY=        # DeepEval uses OpenAI by default

# Infra — defaults work for local Docker
POSTGRES_URL=postgresql+asyncpg://ragbench:ragbench@postgres:5432/ragbench
QDRANT_HOST=qdrant
QDRANT_PORT=6333
```

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `git commit -m "feat: add X"`
4. Open a PR against `main`

---

## License

MIT © [Paramjeet](https://github.com/paramjeetn)
