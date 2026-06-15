# Architecture Diagram Prompt (for Napkin AI)

Paste this into napkin.ai — it will generate a clean startup-style architecture diagram.

---

## Prompt

```
Create a modern, startup-style architecture diagram for a RAG Evaluation Engine called RagBench.

Layout: left-to-right data flow. Use clean boxes, minimal colors (dark background preferred), bold labels, thin connector arrows with labels.

Components and flow:

USER LAYER
- Browser (Next.js 14 frontend, port 3000)
  - Pages: Dashboard, Chat, Documents, Evaluate, Compare

API LAYER
- FastAPI Backend (port 8000)
  - Routes: /ingest, /query, /query/stream, /eval/run, /config
  - Async SQLAlchemy ORM

PIPELINE LAYER (inside backend)
- Ingestion Pipeline
  - Parser (PDF / MD / TXT)
  - Chunker (Fixed / Recursive / Semantic / Doc-Aware)
  - Embedder (OpenAI / Gemini / sentence-transformers)

- Query Pipeline
  - Dense Retriever → Qdrant HNSW
  - Sparse Retriever → BM25
  - RRF Fusion (top 20)
  - Cross-Encoder Reranker (top 5)
  - LLM Generator (OpenAI / Anthropic / Gemini / Ollama)

- Evaluation Pipeline
  - DeepEval (RAG Triad)
  - Metrics: Faithfulness, Answer Relevancy, Contextual Precision, Contextual Recall, Contextual Relevancy

STORAGE LAYER
- Qdrant Vector DB (port 6333) — chunk embeddings, HNSW index
- PostgreSQL 16 (port 5432) — documents metadata, eval run results

INFRA
- Docker Compose (all services containerized)
- One-command startup: make up

Arrows:
- Browser → FastAPI (REST / SSE streaming)
- FastAPI → Ingestion Pipeline → Qdrant + PostgreSQL
- FastAPI → Query Pipeline → Qdrant + LLM Providers
- FastAPI → Evaluation Pipeline → PostgreSQL
- LLM Providers (external cloud): OpenAI, Anthropic, Gemini, Ollama (local)

Style: dark mode, neon accent lines, startup pitch deck aesthetic. Group pipeline components inside a dashed "Backend" boundary box.
```

---

## Tips
- Go to napkin.ai, paste the prompt in the text area, click Generate
- After generating, switch to "diagram" view (not text)
- Export as PNG or SVG for your README and portfolio
- Try regenerating 2-3 times — pick the cleanest layout
