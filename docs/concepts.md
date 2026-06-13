# RAG System with Evaluation Pipeline

A Retrieval-Augmented Generation system that doesn't just answer questions — it measures how well it answers them. Multiple chunking strategies, hybrid search, re-ranking, and a full eval framework.

---

## Why This Project?

Every company building with LLMs needs RAG. But most implementations are "vibe-checked" — someone asks a few questions and says "looks good." This project builds RAG **the engineering way**: with metrics, benchmarks, and systematic evaluation.

**What makes this portfolio-worthy:**
- Not just calling OpenAI — you're building the retrieval infrastructure
- Eval pipeline shows you think about quality systematically
- Directly maps to what AI teams do day-to-day

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE                           │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐ │
│  │ Documents │──▶│  Parser  │──▶│ Chunking │──▶│  Embedding  │ │
│  │ (PDF,MD,  │   │(PyPDF,   │   │ Engine   │   │  Model      │ │
│  │  TXT)     │   │ Unstruct)│   │          │   │(ada-002/    │ │
│  └──────────┘   └──────────┘   └──────────┘   │ sentence-tx)│ │
│                                                 └──────┬──────┘ │
│                                                        ▼        │
│                                                 ┌────────────┐  │
│                                                 │ Vector DB  │  │
│                                                 │ (Qdrant)   │  │
│                                                 └────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      QUERY PIPELINE                              │
│                                                                  │
│  ┌───────┐   ┌─────────┐   ┌──────────┐   ┌────────────────┐  │
│  │ User  │──▶│  Embed  │──▶│ Retrieve │──▶│   Re-Rank      │  │
│  │ Query │   │  Query  │   │ Top-K    │   │ (Cross-Encoder)│  │
│  └───────┘   └─────────┘   │          │   └───────┬────────┘  │
│                             │ Dense +  │           │            │
│                             │ Sparse   │           ▼            │
│                             │ (Hybrid) │   ┌────────────────┐  │
│                             └──────────┘   │  Build Prompt  │  │
│                                            │  + Context     │  │
│                                            └───────┬────────┘  │
│                                                     ▼           │
│                                             ┌──────────────┐   │
│                                             │  LLM (GPT/   │   │
│                                             │  Claude/Local)│   │
│                                             └──────┬───────┘   │
│                                                    ▼            │
│                                             ┌──────────────┐   │
│                                             │  Answer +    │   │
│                                             │  Citations   │   │
│                                             └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EVALUATION PIPELINE                            │
│                                                                  │
│  ┌───────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐ │
│  │ Test Data │──▶│ Run      │──▶│  DeepEval  │──▶│  Report  │ │
│  │ (Manual   │   │ Queries  │   │  RAG Triad │   │  (HTML/  │ │
│  │  or Synth-│   │ Through  │   │  + Custom  │   │   JSON)  │ │
│  │  esizer)  │   │ Pipeline │   │  (GEval)   │   └──────────┘ │
│  └───────────┘   └──────────┘   └────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Why? |
|-----------|-----------|------|
| **Language** | Python | ML/AI ecosystem, all libraries are Python-first |
| **API** | FastAPI | Async, fast, auto-docs, Pydantic validation |
| **Embedding Model** | OpenAI `text-embedding-3-small` or `sentence-transformers` | OpenAI for quality, sentence-transformers for free/local |
| **Vector DB** | Qdrant | Open-source, runs locally via Docker, supports hybrid search natively |
| **LLM** | OpenAI GPT-4 / Anthropic Claude / Ollama (local) | Support multiple providers, compare quality |
| **Document Parsing** | Unstructured, PyPDF2 | Handle PDFs, markdown, HTML |
| **Sparse Search** | BM25 (rank-bm25 library) | Keyword matching that complements dense vectors |
| **Re-Ranking** | Cross-encoder (sentence-transformers) | More accurate than bi-encoder for final ranking |
| **Evaluation** | DeepEval + RAGAS + custom metrics | Industry-standard RAG evaluation with RAG Triad metrics |
| **Synthetic Data** | DeepEval Synthesizer | Auto-generate thousands of test cases from documents |
| **Frontend** | Streamlit | Quick demo UI |
| **Containerization** | Docker Compose | Run Qdrant + app together |

### Why Qdrant over alternatives?
- **vs Pinecone:** Open-source, runs locally (no API costs during dev)
- **vs Chroma:** Scales better, built-in hybrid search, better filtering
- **vs Weaviate:** Simpler API, lighter weight

---

## Core Concepts You'll Learn

### 1. How Embeddings Work
An embedding converts text into a dense vector that captures semantic meaning. Similar texts have similar vectors.

```
"The cat sat on the mat"    → [0.12, -0.34, 0.56, ..., 0.78]  (1536 dims)
"A kitten rested on a rug"  → [0.11, -0.33, 0.55, ..., 0.77]  (very similar!)
"Stock prices rose today"   → [0.89, 0.23, -0.67, ..., 0.12]  (very different)
```

**Similarity measures:**
- **Cosine similarity** — angle between vectors (most common)
- **Dot product** — faster when vectors are normalized
- **Euclidean distance** — straight-line distance

**Approximate Nearest Neighbors (ANN):** Can't compare against millions of vectors one-by-one. ANN algorithms (HNSW, IVF) build index structures for fast approximate search. Qdrant uses HNSW.

### 2. Chunking Strategies
Documents must be split into chunks before embedding. How you chunk **massively** affects retrieval quality.

**Fixed-size chunking:**
```
Split every 500 characters with 50 char overlap
Simple but may cut mid-sentence
```

**Recursive character splitting:**
```
Try to split on paragraphs → sentences → words → characters
Respects natural boundaries — most commonly used
```

**Semantic chunking:**
```
Embed each sentence → group consecutive similar sentences
Split when similarity drops below threshold
Best quality but slowest
```

**Document-aware chunking:**
```
Use document structure (headers, sections)
Each section = one chunk — preserves context best for structured docs
```

**Key parameters:**
- `chunk_size` — 200-1000 tokens typical
- `chunk_overlap` — 10-20% of chunk_size
- Bigger chunks = more context but less precise retrieval
- Smaller chunks = more precise but may lose context

### 3. Hybrid Search: Dense + Sparse

**Dense retrieval (vector search):** Good at semantic understanding
- "What causes rain?" finds "precipitation occurs when..."

**Sparse retrieval (BM25/keyword):** Good at exact matches
- "Error code 0x80070005" finds exact error code

Combine both with **Reciprocal Rank Fusion (RRF):**
```
dense_results  = vector_search(query, top_k=20)
sparse_results = bm25_search(query, top_k=20)
final_results  = reciprocal_rank_fusion(dense_results, sparse_results)

RRF_score(doc) = Σ 1 / (k + rank_in_list)   where k = 60
```

### 4. Re-Ranking with Cross-Encoders

**Bi-encoder (embedding model):** Encodes query and document separately → fast but approximate.
**Cross-encoder:** Encodes query AND document together → slow but much more accurate.

```
Step 1: Bi-encoder retrieves top 100 candidates (fast)
Step 2: Cross-encoder scores each of the 100 (slow but accurate)
Step 3: Return top 10 from cross-encoder ranking
```

Popular model: `cross-encoder/ms-marco-MiniLM-L-12-v2`

### 5. RAG Evaluation: The RAG Triad (DeepEval)

The evaluation pipeline uses **DeepEval** to evaluate retriever and generator components separately, enabling targeted debugging and hyperparameter tuning.

#### Retriever Metrics
These metrics evaluate whether the right context reaches the LLM:

**ContextualPrecisionMetric:** Does reranking place relevant nodes above irrelevant ones?
```
Retrieved: [chunk_A ✓, chunk_B ✗, chunk_C ✓, chunk_D ✗]
Contextual Precision = 2/4 = 0.5
Targets: reranking strategy, top-K setting
```

**ContextualRecallMetric:** Does the embedding model capture all relevant information?
```
Relevant chunks in DB: [A, B, C, D, E]
Retrieved: [A, B, D]
Contextual Recall = 3/5 = 0.6
Targets: embedding model quality
```

**ContextualRelevancyMetric:** Does the chunk size and top-K retrieve appropriate info density?
```
Targets: chunk_size, chunk_overlap, top-K hyperparameters
```

#### Generator Metrics (The RAG Triad)
Three core metrics form the **RAG Triad** — evaluating the LLM's output quality:

**FaithfulnessMetric (Groundedness):** Does the answer only use info from context? No hallucination.
```
Context: "Python was created by Guido van Rossum in 1991"
Answer: "Python was created in 1991 and is the most popular language"
Faithfulness: LOW — "most popular" not in context
Targets: LLM selection — may need model switch or fine-tuning
```

**AnswerRelevancyMetric:** Does the answer actually address the question?
```
Targets: prompt template — improve in-context examples and instructions
```

**GEval (Custom Criteria):** Define domain-specific evaluation beyond standard metrics — tone, formatting, technical accuracy, etc.

#### DeepEval Implementation
```python
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    GEval
)
from deepeval import evaluate

# Create test case from pipeline output
test_case = LLMTestCase(
    input="How does backpropagation work?",
    actual_output=pipeline_answer,
    retrieval_context=retrieved_chunks,
    expected_output=ground_truth_answer  # for recall metrics
)

# RAG Triad + retriever metrics
metrics = [
    AnswerRelevancyMetric(threshold=0.7),
    FaithfulnessMetric(threshold=0.7),
    ContextualRelevancyMetric(threshold=0.7),
    ContextualPrecisionMetric(threshold=0.7),
    ContextualRecallMetric(threshold=0.7),
]

# Run evaluation
evaluate(test_cases=[test_case], metrics=metrics)
```

#### Metric-to-Hyperparameter Mapping
| Metric | Low Score Means | Tune This |
|--------|----------------|-----------|
| Contextual Precision | Reranker isn't filtering well | Reranking model / strategy |
| Contextual Recall | Embedding misses relevant info | Embedding model |
| Contextual Relevancy | Chunks too big/small or wrong top-K | `chunk_size`, `top_k` |
| Answer Relevancy | Prompt doesn't guide LLM well | Prompt template, in-context examples |
| Faithfulness | LLM hallucinates beyond context | LLM choice, temperature, fine-tuning |

### 6. Synthetic Test Data Generation (DeepEval Synthesizer)

Manually creating evaluation datasets is slow. DeepEval's **Synthesizer** auto-generates thousands of test cases from your documents.

**Pipeline:** Document Loading → Chunking → Context Generation → Golden Generation → Evolution

```python
from deepeval.synthesizer import Synthesizer

synthesizer = Synthesizer()

# Generate from your documents
goldens = synthesizer.generate_goldens_from_docs(
    document_paths=["docs/ml_textbook.pdf", "docs/api_guide.md"],
    chunk_size=1024,        # match your retriever's chunk size
    chunk_overlap=50,       # 50-100 tokens recommended for interconnected content
    max_contexts_per_document=3
)
```

**Evolution types** increase test complexity across 7 dimensions:

| Evolution | Tests For |
|-----------|-----------|
| **Reasoning** | Multi-step logical thinking |
| **Multicontext** | Answers requiring multiple chunks |
| **Concretizing** | Adding specifics to abstract concepts |
| **Constrained** | Operating within restrictions |
| **Comparative** | Comparing options across contexts |
| **Hypothetical** | Scenario-based "what if" responses |
| **In-breadth** | Adjacent topic coverage (horizontal expansion) |

**Quality assurance** is built-in at two stages:
- **Context filtering:** Scores chunks on clarity, depth, structure (threshold: 0.5)
- **Synthetic input filtering:** Validates self-containment and clarity

```python
# Access quality scores
goldens[0].additional_metadata["context_quality"]
goldens[0].additional_metadata["synthetic_input_quality"]
```

**Best practice:** Set `chunk_size` and `chunk_overlap` to match your retriever settings — otherwise synthetic test data won't reflect real retrieval behavior.

### 7. Prompt Engineering for RAG

```python
SYSTEM_PROMPT = """You are a helpful assistant. Rules:
1. ONLY use information from the provided context
2. If the context doesn't have the answer, say so
3. Cite sources using [Source: filename, chunk N]
4. Be concise and direct"""

USER_PROMPT = """Context:
{retrieved_chunks}

Question: {user_question}

Answer:"""
```

---

## System Flow

### Ingestion Flow
```
1. Upload document(s) via POST /ingest
2. Parser extracts text (preserves metadata: filename, page, headers)
3. Chunking engine splits text (strategy configurable)
4. Embedding model encodes each chunk (batch processing)
5. Chunks + embeddings stored in Qdrant
6. BM25 index updated for sparse search
```

### Query Flow
```
1. User sends: "How does backpropagation work?"
2. Embed query with same model
3. Hybrid retrieval:
   - Dense: Qdrant ANN search → top 50
   - Sparse: BM25 → top 50
   - Merge via RRF → top 20
4. Re-rank: Cross-encoder scores 20 candidates → top 5
5. Build prompt: system prompt + chunks + question
6. LLM generates answer with citations
7. Return answer + sources + metadata (latency, tokens used)
```

### Evaluation Flow
```
1. Generate test dataset:
   Option A: Manual curation (20-30 Q&A pairs)
   Option B: DeepEval Synthesizer (auto-generate 100s from docs)
2. Run each question through full pipeline
3. Compute DeepEval RAG Triad metrics per question:
   - Retriever: ContextualPrecision, ContextualRecall, ContextualRelevancy
   - Generator: AnswerRelevancy, Faithfulness, GEval (custom)
4. Aggregate scores, identify weak components
5. Map low scores to hyperparameters:
   Low faithfulness → swap LLM or tune temperature
   Low contextual relevancy → adjust chunk_size / top_k
6. Compare configurations:
   "semantic chunking + rerank" vs "fixed chunking, no rerank"
7. Generate HTML report + JSON metrics
8. CI/CD: run eval suite via pytest integration
```

---

## Component Breakdown

| Module | What it does |
|--------|-------------|
| `ingestion/` | File parsers (PDF, MD, TXT, HTML), text cleaning, metadata extraction |
| `chunking/` | Pluggable strategies (fixed, recursive, semantic, document-aware) |
| `embedding/` | OpenAI + sentence-transformers wrappers, batch processing, caching |
| `vectorstore/` | Qdrant client, collection management, search with filters |
| `retrieval/` | Dense search, BM25 sparse search, hybrid fusion, re-ranking |
| `generation/` | Prompt templates, multi-provider LLM support, streaming, citation parsing |
| `evaluation/` | DeepEval RAG Triad metrics, synthetic data generation, comparison framework, CI/CD eval runner |
| `api/` | FastAPI endpoints for ingest, query, eval, config |
| `frontend/` | Streamlit chat UI, document upload, settings panel, eval dashboard |

---

## Storage Schema

### Qdrant Collection
```json
{
  "collection_name": "documents",
  "vectors": { "size": 1536, "distance": "Cosine" },
  "payload": {
    "text": "string",
    "source_file": "string",
    "page_number": "integer",
    "chunk_index": "integer",
    "chunk_strategy": "string"
  }
}
```

### PostgreSQL (metadata & eval)
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    filename VARCHAR(255),
    file_type VARCHAR(20),
    chunk_count INT,
    chunk_strategy VARCHAR(50),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eval_runs (
    id UUID PRIMARY KEY,
    config JSONB,        -- chunking strategy, top_k, model, etc.
    metrics JSONB,       -- aggregated scores
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eval_results (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES eval_runs(id),
    question TEXT,
    ground_truth TEXT,
    generated_answer TEXT,
    retrieved_chunks JSONB,
    metrics JSONB,       -- per-question scores
    latency_ms INT,
    tokens_used INT
);
```

---

## API Design

```
POST /api/ingest                — Upload and process documents
GET  /api/documents             — List ingested documents
POST /api/query                 — Ask a question
POST /api/query/stream          — Ask a question (streaming)
POST /api/eval/run              — Run evaluation
GET  /api/eval/runs/:id         — Get eval results
GET  /api/eval/compare?a=X&b=Y — Compare two eval runs
GET  /api/config                — Get pipeline config
PUT  /api/config                — Update config
```

---

## Build Phases

### Phase 1: Naive RAG (Week 1)
- [ ] Project setup, Docker Compose with Qdrant
- [ ] PDF/Markdown parser
- [ ] Fixed-size chunking
- [ ] OpenAI embeddings (or sentence-transformers)
- [ ] Basic vector search
- [ ] Simple prompt → LLM → answer
- [ ] Streamlit chat UI

### Phase 2: Chunking Experiments (Week 2)
- [ ] Implement recursive chunking
- [ ] Implement semantic chunking
- [ ] Build test dataset (20-30 Q&A pairs)
- [ ] Compare strategies on retrieval quality
- [ ] Document findings

### Phase 3: Hybrid Search + Re-Ranking (Week 3)
- [ ] Add BM25 sparse retrieval
- [ ] Implement Reciprocal Rank Fusion
- [ ] Add cross-encoder re-ranking
- [ ] Compare: dense vs hybrid vs hybrid+rerank

### Phase 4: Evaluation Pipeline (Week 4)
- [ ] Integrate DeepEval RAG Triad (Faithfulness, Answer Relevancy, Contextual Relevancy)
- [ ] Add retriever-specific metrics (Contextual Precision, Contextual Recall)
- [ ] Implement GEval for custom domain-specific criteria
- [ ] Generate synthetic test dataset using DeepEval Synthesizer
- [ ] Configure evolution types (reasoning, multicontext, comparative, etc.)
- [ ] Build eval runner with pytest CI/CD integration
- [ ] Generate comparison reports (metric-to-hyperparameter mapping)
- [ ] Per-question failure analysis
- [ ] Try different LLMs, compare faithfulness vs cost

### Phase 5: API & Polish (Week 5)
- [ ] FastAPI with all endpoints
- [ ] Streaming responses
- [ ] Cost/latency tracking
- [ ] Frontend with settings panel
- [ ] Final benchmark report

---

## What You'll Learn (Interview Talking Points)

- **RAG architecture** — retrieval, ranking, generation pipeline design
- **Information retrieval** — embeddings, vector search, BM25, hybrid, ANN
- **Evaluation methodology** — RAG Triad metrics, synthetic test generation, metric-to-hyperparameter debugging
- **LLM engineering** — prompt design, multi-provider, streaming, cost tracking
- **Vector databases** — indexing strategies, filtering, HNSW algorithm
- **Production AI** — caching, latency optimization, chunking as engineering

---

## Resources

- [DeepEval docs](https://docs.confident-ai.com/) — RAG evaluation framework with RAG Triad
- [DeepEval RAG Evaluation Guide](https://deepeval.com/guides/guides-rag-evaluation) — Retriever vs generator evaluation
- [DeepEval RAG Triad Guide](https://deepeval.com/guides/guides-rag-triad) — Faithfulness, relevancy, contextual relevancy
- [DeepEval Synthesizer Guide](https://deepeval.com/guides/guides-using-synthesizer) — Synthetic test data generation
- [RAGAS docs](https://docs.ragas.io/) — Alternative RAG evaluation framework
- [Qdrant docs](https://qdrant.tech/documentation/)
- [Sentence-Transformers](https://www.sbert.net/) — open-source embeddings
- [Chunking strategies (Pinecone)](https://www.pinecone.io/learn/chunking-strategies/)
- [Cross-encoder vs Bi-encoder](https://www.sbert.net/examples/applications/cross-encoder/README.html)
- [RAG original paper](https://arxiv.org/abs/2005.11401)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) — embedding comparisons
