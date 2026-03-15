# RAG Eval System — Product Experience

> Clone it. Run one command. See a working RAG evaluation dashboard in 30 seconds.

This document describes the **user-facing product** — what you see, what you can do, and how data flows through the system. For the technical deep-dive (architecture, algorithms, learning concepts), see [README.md](README.md).

---

## Quick Start

```bash
git clone https://github.com/paramjeet/rag-eval-system.git
cd rag-eval-system
docker compose up
```

Open `http://localhost:8501` — the dashboard loads with pre-computed evaluation results. No API key required.

**Want to run live queries?** Add your key to `.env`:
```bash
cp .env.example .env
# Add OPENAI_API_KEY=sk-...
docker compose up
```

---

## Three Ways to Experience This

### 1. Quick Demo (2 minutes)
*"I'm a recruiter/hiring manager. Show me what this does."*

- Open `http://localhost:8501` — the **Dashboard** loads immediately
- See the radar chart comparing two RAG configurations side-by-side
- Glance at the metric cards: Faithfulness 0.92, Answer Relevancy 0.88, etc.
- Click into a failing test case to see *why* it scored low
- **No API key needed** — everything runs from pre-computed seed data

### 2. Explorer (10 minutes)
*"I'm an engineer. I want to poke at it."*

- Start on the Dashboard, then switch to the **Chat** page
- Ask a question against the pre-loaded sample documents
- Watch the response stream in with source citations and cost metadata
- Go to **Documents** — upload your own PDF or Markdown file
- Return to Chat — ask questions against your new document
- Head to **Evaluate** — kick off an eval run with the current config
- Compare your run against the pre-computed baseline on the **Compare** page

### 3. Deep Dive (30+ minutes)
*"I want to understand the eval framework and tune the pipeline."*

- Open the **Settings** panel (sidebar)
- Change chunking strategy from `recursive` to `semantic`
- Adjust `top_k` from 5 to 10, switch the re-ranker on/off
- Run a new evaluation — watch metrics shift
- Compare runs: "semantic chunking + rerank" vs "fixed chunking, no rerank"
- Read the insight cards that map low scores to specific hyperparameters
- Export results as JSON for your own analysis

---

## UI Pages

### Dashboard (`/`)

The landing page. Works instantly from seed data — no setup required.

```
┌─────────────────────────────────────────────────────────────────┐
│  RAG Eval System                          [Settings ⚙]  [Docs] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   RADAR CHART                            │   │
│  │                                                          │   │
│  │            Contextual Precision                          │   │
│  │                   1.0                                    │   │
│  │                  ╱   ╲                                   │   │
│  │    Faithfulness ╱     ╲ Contextual Recall                │   │
│  │              0.5       0.5                               │   │
│  │               ╲       ╱                                  │   │
│  │    Answer      ╲     ╱  Contextual                       │   │
│  │    Relevancy    ╲   ╱   Relevancy                        │   │
│  │                  ╲ ╱                                     │   │
│  │                                                          │   │
│  │         ── Run A (baseline)   ── Run B (tuned)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Faithfulness │ │ Answer Rel.  │ │ Ctx Precision│           │
│  │    0.92      │ │    0.88      │ │    0.85      │           │
│  │   ▲ +0.12   │ │   ▲ +0.05   │ │   ▲ +0.15   │           │
│  │  vs baseline │ │  vs baseline │ │  vs baseline │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Ctx Recall   │ │ Ctx Relev.   │ │  Avg Latency │           │
│  │    0.78      │ │    0.81      │ │   1.2s       │           │
│  │   ▼ -0.02   │ │   ▲ +0.08   │ │   340 tokens │           │
│  │  vs baseline │ │  vs baseline │ │  ~$0.004/q   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  INSIGHT CARDS                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚠ Contextual Recall dropped 0.02                        │   │
│  │ → Embedding model may be missing relevant chunks.       │   │
│  │   Try: switch to a higher-dim embedding model,          │   │
│  │   or increase chunk_overlap.                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✓ Faithfulness jumped +0.12 after enabling re-ranker    │   │
│  │ → Cross-encoder filtering removes noisy context,        │   │
│  │   giving the LLM cleaner input to work with.            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What the radar chart communicates at a glance:** One visual that tells the whole story — where this RAG pipeline is strong, where it's weak, and how tuning changed the shape. A recruiter sees "this person thinks about quality systematically." An engineer sees "this person knows which knobs to turn."

### Chat (`/chat`)

Interactive Q&A against ingested documents.

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat                                              [Settings ⚙] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📄 Querying against: 3 documents (47 chunks)            │   │
│  │    ml_textbook.pdf · api_guide.md · research_paper.pdf  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ USER ──────────────────────────────────────────────────┐   │
│  │ How does backpropagation work?                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ ASSISTANT ─────────────────────────────────────────────┐   │
│  │ Backpropagation computes gradients of the loss function │   │
│  │ with respect to each weight by applying the chain rule  │   │
│  │ from the output layer back to the input layer...        │   │
│  │                                                          │   │
│  │ [Source: ml_textbook.pdf, chunk 14]                      │   │
│  │ [Source: ml_textbook.pdf, chunk 15]                      │   │
│  │                                                          │   │
│  │ ┌────────────────────────────────────────────────────┐  │   │
│  │ │ Latency: 1.3s │ Tokens: 287 │ Cost: ~$0.004       │  │   │
│  │ │ Retrieval: hybrid+rerank │ Chunks used: 5 of 47   │  │   │
│  │ └────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ask a question...                              [Send ▶] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Cost transparency on every query.** Each response shows latency, token count, estimated cost, retrieval strategy used, and how many chunks were consumed. This isn't decorative — it's what production AI teams track.

### Documents (`/documents`)

Manage the document corpus.

```
┌─────────────────────────────────────────────────────────────────┐
│  Documents                                         [Settings ⚙] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Choose File]  or drag & drop        [Upload ▲]        │   │
│  │  Supports: PDF, Markdown, TXT, HTML                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INGESTED DOCUMENTS                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📕 ml_textbook.pdf                                      │   │
│  │     Chunks: 23 │ Strategy: recursive │ Uploaded: seed    │   │
│  │                                                          │   │
│  │  📘 api_guide.md                                         │   │
│  │     Chunks: 12 │ Strategy: recursive │ Uploaded: seed    │   │
│  │                                                          │   │
│  │  📗 research_paper.pdf                                   │   │
│  │     Chunks: 12 │ Strategy: recursive │ Uploaded: seed    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CHUNKING PREVIEW                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Select a document to see how it was chunked.           │   │
│  │  Chunk 1/23: "Backpropagation is a method used in..."   │   │
│  │  Chunk 2/23: "The chain rule allows us to compute..."   │   │
│  │  [◀ Prev]                              [Next ▶]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Evaluate (`/evaluate`)

Run evaluation suites and inspect per-question results.

```
┌─────────────────────────────────────────────────────────────────┐
│  Evaluate                                          [Settings ⚙] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CURRENT CONFIG                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Chunking: recursive │ chunk_size: 500 │ overlap: 50    │   │
│  │  Retrieval: hybrid+rerank │ top_k: 5                    │   │
│  │  LLM: gpt-4o-mini │ Temperature: 0.1                   │   │
│  │                                    [Run Evaluation ▶]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  EVAL HISTORY                                                   │
│  ┌───┬───────────────────────┬───────┬───────┬────────────┐   │
│  │ # │ Config                │ Faith.│ Ans.R │ Date       │   │
│  ├───┼───────────────────────┼───────┼───────┼────────────┤   │
│  │ 2 │ recursive+rerank      │ 0.92  │ 0.88  │ seed       │   │
│  │ 1 │ fixed, no rerank      │ 0.80  │ 0.83  │ seed       │   │
│  └───┴───────────────────────┴───────┴───────┴────────────┘   │
│                                                                 │
│  PER-QUESTION RESULTS (Run #2)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Q: "How does backpropagation work?"                     │   │
│  │  Faith: 0.95 │ Ans.Rel: 0.91 │ Ctx.Prec: 0.90          │   │
│  │  Status: ✓ PASS                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Q: "Compare SGD and Adam optimizers"                    │   │
│  │  Faith: 0.72 │ Ans.Rel: 0.65 │ Ctx.Prec: 0.60          │   │
│  │  Status: ✗ FAIL — low contextual precision               │   │
│  │  → Retrieved chunks didn't cover Adam optimizer.         │   │
│  │    Suggestion: increase top_k or try semantic chunking.  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Per-question failure analysis.** Every failing test case shows *which metric* failed, *what went wrong*, and *what to tune*. This is the metric-to-hyperparameter mapping in action.

### Compare (`/compare`)

Side-by-side comparison of two evaluation runs.

```
┌─────────────────────────────────────────────────────────────────┐
│  Compare Runs                                      [Settings ⚙] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐    ┌───────────────────┐                │
│  │ Run A: [Run #1 ▼] │    │ Run B: [Run #2 ▼] │                │
│  └───────────────────┘    └───────────────────┘                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              OVERLAY RADAR CHART                         │   │
│  │     (same as Dashboard — two runs superimposed)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  METRIC DELTAS                                                  │
│  ┌────────────────────┬─────────┬─────────┬────────────────┐   │
│  │ Metric             │  Run A  │  Run B  │  Delta          │   │
│  ├────────────────────┼─────────┼─────────┼────────────────┤   │
│  │ Faithfulness       │  0.80   │  0.92   │  ▲ +0.12       │   │
│  │ Answer Relevancy   │  0.83   │  0.88   │  ▲ +0.05       │   │
│  │ Ctx Precision      │  0.70   │  0.85   │  ▲ +0.15       │   │
│  │ Ctx Recall         │  0.80   │  0.78   │  ▼ -0.02       │   │
│  │ Ctx Relevancy      │  0.73   │  0.81   │  ▲ +0.08       │   │
│  ├────────────────────┼─────────┼─────────┼────────────────┤   │
│  │ Avg Latency        │  0.9s   │  1.2s   │  +0.3s         │   │
│  │ Avg Tokens         │  210    │  340    │  +130           │   │
│  │ Est. Cost/Query    │ $0.002  │ $0.004  │  +$0.002       │   │
│  └────────────────────┴─────────┴─────────┴────────────────┘   │
│                                                                 │
│  CONFIG DIFF                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  - chunking: fixed (500 chars)                          │   │
│  │  + chunking: recursive (500 chars)                      │   │
│  │  - reranker: disabled                                   │   │
│  │  + reranker: cross-encoder/ms-marco-MiniLM-L-12-v2      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INSIGHT                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Enabling the cross-encoder reranker was the dominant   │   │
│  │  factor: +0.15 contextual precision, +0.12 faithfulness.│   │
│  │  Trade-off: +0.3s latency and ~2x token cost per query. │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Settings (Sidebar Panel)

Available from any page via the gear icon.

```
┌────────────────────────┐
│  Settings               │
├────────────────────────┤
│                         │
│  CHUNKING               │
│  Strategy: [recursive▼] │
│  Chunk size:  [500]     │
│  Overlap:     [50]      │
│                         │
│  RETRIEVAL              │
│  Mode: [hybrid ▼]      │
│  Top-K:  [5]            │
│  Re-ranker: [✓ enabled] │
│                         │
│  GENERATION             │
│  LLM: [gpt-4o-mini ▼]  │
│  Temperature: [0.1]     │
│                         │
│  [Apply & Re-index ▶]  │
│                         │
└────────────────────────┘
```

Changing settings and clicking **Apply & Re-index** re-chunks and re-embeds documents with the new config. The next eval run will use these settings, creating a new comparison point.

---

## User Data Flows

### Flow 1: First Launch (Zero-Config Demo)

```
docker compose up
       │
       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   qdrant     │    │  postgres    │    │   backend    │
│  (vector db) │    │ (metadata &  │    │  (FastAPI)   │
│              │    │  eval store) │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                        waits for DBs
                                               │
                                               ▼
                                      ┌──────────────┐
                                      │     seed     │
                                      │  (one-shot)  │
                                      └──────┬───────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                     Load 3 sample    Insert pre-      Write 2 eval
                     docs into        computed          runs + results
                     Qdrant           embeddings        into Postgres
                              │              │              │
                              └──────────────┼──────────────┘
                                             ▼
                                      ┌──────────────┐
                                      │   frontend   │
                                      │  (Streamlit) │
                                      │  port 8501   │
                                      └──────────────┘
                                             │
                                             ▼
                                    Dashboard loads with
                                    radar chart + metrics
                                    from seed eval runs
```

**Key point:** The seed container runs once, loads demo data, then exits. The dashboard is fully populated before the user touches anything.

### Flow 2: Ask a Question (Chat)

```
User types: "How does backpropagation work?"
       │
       ▼
┌──────────────┐         POST /api/query
│   Frontend   │ ──────────────────────────▶ ┌──────────────┐
│  (Streamlit) │                              │   Backend    │
└──────────────┘                              │  (FastAPI)   │
                                              └──────┬───────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    ▼                ▼                │
                             ┌────────────┐   ┌────────────┐         │
                             │ Embed query│   │   BM25     │         │
                             │ (OpenAI /  │   │  sparse    │         │
                             │  local)    │   │  search    │         │
                             └─────┬──────┘   └─────┬──────┘         │
                                   │                │                │
                                   ▼                ▼                │
                             ┌────────────────────────┐              │
                             │  Qdrant vector search  │              │
                             │  (dense, top 50)       │              │
                             └─────────┬──────────────┘              │
                                       │                             │
                                       ▼                             │
                             ┌────────────────────────┐              │
                             │  Reciprocal Rank Fusion│              │
                             │  dense + sparse → 20   │              │
                             └─────────┬──────────────┘              │
                                       │                             │
                                       ▼                             │
                             ┌────────────────────────┐              │
                             │  Cross-encoder rerank  │              │
                             │  20 → top 5            │              │
                             └─────────┬──────────────┘              │
                                       │                             │
                                       ▼                             │
                             ┌────────────────────────┐              │
                             │  Build prompt:         │              │
                             │  system + 5 chunks     │              │
                             │  + user question       │              │
                             └─────────┬──────────────┘              │
                                       │                             │
                                       ▼                             │
                             ┌────────────────────────┐              │
                             │  LLM generates answer  │              │
                             │  (streaming)           │              │
                             └─────────┬──────────────┘              │
                                       │                             │
                                       ▼                             │
                             ┌────────────────────────┐              │
                             │  Return:               │              │
                             │  - answer text         │◀─────────────┘
                             │  - source citations    │
                             │  - latency_ms          │
                             │  - tokens_used         │
                             │  - est_cost            │
                             └────────────────────────┘
```

### Flow 3: Run Evaluation

```
User clicks "Run Evaluation"
       │
       ▼
POST /api/eval/run  { config: current_settings }
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  For each test case (Q&A pair from test dataset):    │
│                                                       │
│    1. Run question through full query pipeline        │
│       → get: actual_output, retrieved_chunks          │
│                                                       │
│    2. Build DeepEval LLMTestCase:                     │
│       input           = question                      │
│       actual_output   = pipeline answer               │
│       retrieval_context = retrieved chunks             │
│       expected_output  = ground truth answer           │
│                                                       │
│    3. Score with RAG Triad + retriever metrics:       │
│       - FaithfulnessMetric                            │
│       - AnswerRelevancyMetric                         │
│       - ContextualRelevancyMetric                     │
│       - ContextualPrecisionMetric                     │
│       - ContextualRecallMetric                        │
│                                                       │
│    4. Store per-question results in Postgres          │
│       (eval_results table)                            │
│                                                       │
└──────────────────────────────────────────────────────┘
       │
       ▼
Aggregate scores → store in eval_runs table
       │
       ▼
Map low scores to hyperparameter suggestions
       │
       ▼
Dashboard updates with new run + insight cards
```

### Flow 4: Upload a Document

```
User drags PDF into upload zone
       │
       ▼
POST /api/ingest  (multipart file upload)
       │
       ▼
┌──────────────────────────────────┐
│  1. Parse file (PyPDF2/Unstruct) │
│     → extract raw text + metadata│
│                                   │
│  2. Chunk text (current strategy)│
│     → N chunks with overlap      │
│                                   │
│  3. Embed each chunk (batch)     │
│     → N vectors (1536-dim)       │
│                                   │
│  4. Upsert into Qdrant          │
│     → vectors + payload metadata │
│                                   │
│  5. Update BM25 index           │
│     → sparse search ready        │
│                                   │
│  6. Insert into Postgres         │
│     → documents table metadata   │
└──────────────────────────────────┘
       │
       ▼
Documents page updates: new file appears in list
Chat page: queries now search across new + existing docs
```

---

## Zero-Friction Demo Strategy

The system ships with pre-computed data so the dashboard tells a complete story on first launch — no API key, no uploads, no waiting.

### What Gets Seeded

| Data | Where | Purpose |
|------|-------|---------|
| 3 sample documents (ML textbook chapter, API guide, research paper) | Qdrant + Postgres | Corpus to query against |
| Pre-computed embeddings for all chunks | Qdrant | Chat works without embedding API calls |
| 20 test Q&A pairs | Postgres (eval ground truth) | Evaluation test dataset |
| Eval Run #1: "fixed chunking, no rerank" | Postgres (eval_runs + eval_results) | Baseline — represents a naive RAG setup |
| Eval Run #2: "recursive chunking + rerank" | Postgres (eval_runs + eval_results) | Tuned — shows improvement from better config |

### Why Two Pre-Computed Runs?

The radar chart needs two runs to show a comparison. The two seed runs are chosen to tell a clear story:

- **Run #1 (baseline):** Fixed 500-char chunking, dense-only retrieval, no reranker. Produces decent but imperfect scores.
- **Run #2 (tuned):** Recursive chunking, hybrid retrieval, cross-encoder reranker. Scores improve on 4 of 5 metrics, with a small trade-off on contextual recall.

This gives every visitor an immediate "before/after" narrative without running anything.

### What Requires an API Key

| Action | Requires Key? |
|--------|:---:|
| View dashboard, radar chart, metrics | No |
| Browse pre-loaded documents | No |
| View eval history and per-question results | No |
| Compare pre-computed runs | No |
| Ask a live question in Chat | Yes |
| Upload a new document | Yes (for embeddings) |
| Run a new evaluation | Yes (for LLM scoring) |

---

## Project File Structure

```
03_RAG_Eval_System/
├── docker-compose.yml              # One command to run everything
├── .env.example                    # Template for API keys
├── README.md                       # Technical deep-dive
├── PRODUCT.md                      # This file
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                     # FastAPI app entry point
│   ├── config.py                   # Pipeline configuration
│   │
│   ├── ingestion/
│   │   ├── parser.py               # PDF, Markdown, TXT, HTML parsing
│   │   └── chunking.py             # Fixed, recursive, semantic, document-aware
│   │
│   ├── embedding/
│   │   └── embedder.py             # OpenAI + sentence-transformers wrappers
│   │
│   ├── vectorstore/
│   │   └── qdrant_client.py        # Collection management, upsert, search
│   │
│   ├── retrieval/
│   │   ├── dense.py                # Qdrant ANN search
│   │   ├── sparse.py               # BM25 keyword search
│   │   ├── hybrid.py               # Reciprocal Rank Fusion
│   │   └── reranker.py             # Cross-encoder reranking
│   │
│   ├── generation/
│   │   ├── prompts.py              # System/user prompt templates
│   │   └── llm.py                  # Multi-provider LLM (OpenAI, Claude, Ollama)
│   │
│   ├── evaluation/
│   │   ├── runner.py               # Eval pipeline orchestrator
│   │   ├── metrics.py              # DeepEval RAG Triad + custom GEval
│   │   └── comparison.py           # Cross-run comparison + insight generation
│   │
│   └── api/
│       ├── routes_ingest.py        # POST /api/ingest, GET /api/documents
│       ├── routes_query.py         # POST /api/query, POST /api/query/stream
│       ├── routes_eval.py          # POST /api/eval/run, GET /api/eval/runs/:id
│       └── routes_config.py        # GET/PUT /api/config
│
├── frontend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py                      # Streamlit entry point + page routing
│   ├── pages/
│   │   ├── dashboard.py            # Radar chart + metric cards + insights
│   │   ├── chat.py                 # Q&A interface with cost metadata
│   │   ├── documents.py            # Upload + browse + chunk preview
│   │   ├── evaluate.py             # Run evals + per-question results
│   │   └── compare.py              # Side-by-side run comparison
│   └── components/
│       ├── radar_chart.py          # Plotly radar chart component
│       ├── metric_card.py          # Score card with delta indicator
│       └── insight_card.py         # Diagnostic suggestion card
│
├── seed/
│   ├── Dockerfile
│   ├── seed.py                     # One-shot data loader
│   ├── sample_docs/
│   │   ├── ml_textbook_ch3.pdf     # ~10 pages on neural networks
│   │   ├── api_guide.md            # REST API best practices
│   │   └── research_paper.pdf      # Short ML paper
│   ├── precomputed/
│   │   ├── embeddings.json         # Pre-computed vectors for all chunks
│   │   ├── eval_run_1.json         # Baseline: fixed chunking, no rerank
│   │   └── eval_run_2.json         # Tuned: recursive chunking + rerank
│   └── test_dataset/
│       └── qa_pairs.json           # 20 Q&A pairs for evaluation
│
└── tests/
    ├── test_chunking.py
    ├── test_retrieval.py
    ├── test_eval_metrics.py
    └── test_api.py
```

---

## Seed Pipeline Design

The `seed` service in `docker-compose.yml` runs once on first launch, then exits.

```yaml
# docker-compose.yml (seed service excerpt)
seed:
  build: ./seed
  depends_on:
    backend:
      condition: service_healthy
  restart: "no"
  environment:
    - BACKEND_URL=http://backend:8000
    - QDRANT_URL=http://qdrant:6333
    - POSTGRES_URL=postgresql://user:pass@postgres:5432/rageval
```

### What `seed.py` Does

```
1. Check if seed data already exists (idempotent)
   → SELECT COUNT(*) FROM documents
   → If > 0, exit early (already seeded)

2. Load sample documents into Qdrant
   → Read sample_docs/*.pdf, *.md
   → Parse text (same parsers as backend)
   → Chunk with recursive strategy
   → Load pre-computed embeddings from embeddings.json
   → Upsert chunks + vectors into Qdrant

3. Register documents in Postgres
   → INSERT into documents table (filename, chunk_count, strategy)

4. Load pre-computed evaluation results
   → INSERT eval_run_1.json → eval_runs + eval_results tables
   → INSERT eval_run_2.json → eval_runs + eval_results tables

5. Load test dataset
   → INSERT qa_pairs.json → test data store

6. Log "Seed complete" and exit
```

The seed is idempotent — running `docker compose up` again won't duplicate data. Clearing everything is as simple as `docker compose down -v` (removes volumes) followed by `docker compose up`.

---

## Docker Compose Services

```
┌─────────────────────────────────────────────────────────┐
│                    docker compose up                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  qdrant  │  │ postgres │  │ backend  │  │frontend│ │
│  │  :6333   │  │  :5432   │  │  :8000   │  │ :8501  │ │
│  │ vectors  │  │ metadata │  │ FastAPI  │  │Streamlit│ │
│  └──────────┘  └──────────┘  └────┬─────┘  └───┬────┘ │
│       ▲              ▲            │             │       │
│       │              │            │             │       │
│       └──────────────┼────────────┘             │       │
│                      │                          │       │
│                      │    ┌──────────┐          │       │
│                      └────│   seed   │          │       │
│                           │(one-shot)│          │       │
│                           └──────────┘          │       │
│                                                  │       │
│  frontend ──── HTTP ──── backend ──── gRPC ──── qdrant  │
│                            │                             │
│                            └──── SQL ──── postgres       │
│                                                          │
└─────────────────────────────────────────────────────────┘

Ports exposed to host:
  - 8501  → Streamlit UI (open in browser)
  - 8000  → FastAPI (Swagger docs at /docs)
  - 6333  → Qdrant dashboard (optional)
```

---

## What Makes This Portfolio-Worthy

1. **It works on clone.** No "install these 5 things first" — one command, working demo.
2. **It tells a story without interaction.** The seed data creates a before/after narrative that communicates engineering thinking at a glance.
3. **It goes deep on request.** Recruiters see the radar chart. Engineers dig into per-question failure analysis and hyperparameter tuning.
4. **It shows production thinking.** Cost tracking, latency monitoring, streaming responses — not just a toy.
5. **It demonstrates systematic evaluation.** The metric-to-hyperparameter mapping shows you don't just build — you measure, diagnose, and improve.
