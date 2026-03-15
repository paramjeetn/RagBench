# RAG Eval System — Testing Report

**Date:** 2026-03-15
**Environment:** Docker Compose (Postgres 16, Qdrant latest, Python 3.12 backend)
**Embedding Provider:** Gemini (`gemini-embedding-001`, 768 dimensions)
**LLM:** `gemini-2.5-flash`

---

## What Was Tested

Full end-to-end pipeline run from a clean slate (`docker compose down -v` → `docker compose up --build`). The system now supports **Config-Scoped Collections + File Byte Storage**: upload documents once, switch pipeline configs freely, and the system auto-creates or reuses Qdrant collections per config — no manual re-upload needed.

### Features Verified

1. **File byte persistence** — Original document bytes stored in Postgres (`LargeBinary` column), enabling automatic re-ingestion when configs change.
2. **Config-scoped collection naming** — Each chunking + embedding combo gets its own Qdrant collection (format: `docs_{strategy}_{size}_{overlap}_{provider}_{dim}`).
3. **Auto re-ingestion** — On config change, the system checks if a matching collection exists. If yes, instant switch. If not, re-ingests all documents from stored bytes.
4. **Collection management API** — `GET /api/config/collections` lists all collections; `DELETE /api/config/collections/{name}` cleans up old ones (active collection is protected).
5. **Automated seed pipeline** — Unattended run: upload → eval A → config switch (with re-ingestion) → eval B → compare.

---

## Files Modified (from baseline)

| File | Change |
|------|--------|
| `database/models.py` | Added `file_bytes: LargeBinary` column to `Document` |
| `database/repository.py` | Added `file_bytes` param to `create_document()` |
| `api/routes_documents.py` | Passes `file_bytes` to repo on upload |
| `config.py` | Added `get_collection_name()` — builds `docs_{strategy}_{size}_{overlap}_{provider}_{dim}` |
| `vectorstore/qdrant_store.py` | Added `collection_name` param to factory; added `collection_exists()`, `list_collections()`, `delete_collection()` methods |
| `api/dependencies.py` | `get_vector_store()` uses `get_collection_name()`; `reset_vector_store()` also resets ingestion pipeline |
| `api/routes_config.py` | Auto re-ingest flow replaces `vectors_invalidated`; collection management endpoints added |
| `api/schemas.py` | Added `CollectionInfo` model; replaced `vectors_invalidated` with `active_collection` + `collection_ready` |
| `seed/load_seed_data.py` | Added `collection_ready` polling after config change; increased poll timeout resilience |
| `evaluation/` | Moved from `generation/evaluation/` to root-level `evaluation/` (independent concern) |
| `docker-compose.yml` | Fixed Qdrant healthcheck (`curl` unavailable in latest image → bash TCP check) |

---

## Pipeline Run Results

### 1. Clean Start

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

All containers started from scratch — fresh Postgres, fresh Qdrant, no leftover data.

### 2. Health Check

```json
{"status": "ok", "database": "connected", "qdrant": "connected"}
```

### 3. Document Upload

The seed service uploaded 3 documents via `POST /api/documents/`:

| File | Type | Chunks | Bytes Stored |
|------|------|--------|-------------|
| `ml_fundamentals.md` | markdown | 26 | 8,788 |
| `python_best_practices.md` | markdown | 16 | 5,873 |
| `api_design_patterns.txt` | txt | 17 | 5,857 |

**Total:** 59 chunks embedded and stored in collection `docs_recursive_500_50_gemini_768`.

**Postgres verification (`file_bytes` stored):**
```
                  id                  |         filename         | bytes_stored | chunk_count
--------------------------------------+--------------------------+--------------+------------
 c823a2bd-...                          | ml_fundamentals.md       |         8788 |          26
 92287f7c-...                          | python_best_practices.md |         5873 |          16
 0ec33a24-...                          | api_design_patterns.txt  |         5857 |          17
```

### 4. Dataset Created

```json
{"name": "ML Basics QA", "item_count": 20, "id": "c195b55c-..."}
```

### 5. Eval Run A — Recursive / Hybrid / Reranker

**Config:** `recursive` chunking, `hybrid` retrieval, reranker enabled
**Collection:** `docs_recursive_500_50_gemini_768` (59 vectors)

```
Progress: 0/20 → 1/20 → 5/20 → 10/20 → 16/20 → 20/20
Status: completed
```

**Metrics:**
| Metric | Score |
|--------|-------|
| Faithfulness | 0.2187 |
| Answer Relevancy | 0.0618 |
| Contextual Precision | 0.2280 |
| Contextual Recall | 0.2423 |
| Contextual Relevancy | 0.1900 |

### 6. Config Switch → Auto Re-Ingestion

```
PUT /api/config/
{"chunking": {"strategy": "fixed"}, "retrieval": {"mode": "dense", "reranker_enabled": false}}
```

**What happened automatically:**
1. Config updated to fixed chunking + dense retrieval
2. System detected collection `docs_fixed_500_50_gemini_768` does not exist
3. Created new collection in Qdrant
4. Re-ingested all 3 documents from stored bytes → 46 chunks with fixed strategy
5. `collection_ready` became `true`

Seed polling confirmed: `Collection ready after config change.`

### 7. Eval Run B — Fixed / Dense / No Reranker

**Config:** `fixed` chunking, `dense` retrieval, reranker disabled
**Collection:** `docs_fixed_500_50_gemini_768` (46 vectors)

```
Progress: 0/20 → 2/20 → 8/20 → 14/20 → 20/20
Status: completed
```

**Metrics:**
| Metric | Score |
|--------|-------|
| Faithfulness | 0.0831 |
| Answer Relevancy | 0.0212 |
| Contextual Precision | 0.0980 |
| Contextual Recall | 0.0882 |
| Contextual Relevancy | 0.0817 |

### 8. Run Comparison

```
GET /api/eval/compare?run_a=aa775f04-...&run_b=e8351b99-...
```

**Deltas (Run B − Run A):**
| Metric | Run A | Run B | Delta |
|--------|-------|-------|-------|
| Faithfulness | 0.2187 | 0.0831 | **-0.1356** |
| Answer Relevancy | 0.0618 | 0.0212 | **-0.0406** |
| Contextual Precision | 0.2280 | 0.0980 | **-0.1300** |
| Contextual Recall | 0.2423 | 0.0882 | **-0.1541** |
| Contextual Relevancy | 0.1900 | 0.0817 | **-0.1083** |

**Config differences:**
- `chunking.strategy`: recursive → fixed
- `retrieval.mode`: hybrid → dense
- `retrieval.reranker_enabled`: true → false

**System-generated insights:**
- Faithfulness dropped -0.14. Reranker change likely filtered out irrelevant context, reducing hallucination.
- Contextual Precision dropped -0.13. Switching from recursive to fixed chunking affects boundary quality. Reranker helps rank relevant chunks higher.
- Contextual Recall dropped -0.15. Retrieval mode changed from hybrid to dense.
- Contextual Relevancy dropped -0.11.

**Conclusion:** Run A (recursive/hybrid/reranker) significantly outperforms Run B (fixed/dense/no-reranker) across all five metrics. The hybrid retrieval mode combined with reranking provides notably better context selection.

### 9. Final Collection State

```json
[
    {"name": "docs_recursive_500_50_gemini_768", "dimension": 768, "vector_count": 59, "is_active": false},
    {"name": "docs_fixed_500_50_gemini_768", "dimension": 768, "vector_count": 46, "is_active": true}
]
```

Both collections coexist. Switching back to recursive would be instant (no re-ingestion needed).

---

## Seed Pipeline Output

```
============================================================
SEED COMPLETE
  Documents:  3
  Dataset:    ML Basics QA (20 items)
  Eval Run A: aa775f04-84f2-46fe-8c5b-9d5fe450610a (status=completed)
  Eval Run B: e8351b99-4c83-4404-81c6-1b784c356ddc (status=completed)
============================================================
```

---

## Issues Found and Fixed

### 1. Qdrant Healthcheck (Docker)

**Symptom:** Qdrant container marked unhealthy, backend couldn't start.
**Cause:** Latest `qdrant/qdrant` image no longer ships `curl`. The healthcheck used `curl -f`.
**Fix:** Switched to `bash -c 'echo > /dev/tcp/localhost/6333'`.

### 2. Missing `evaluation` Module

**Symptom:** Backend failed to import `from evaluation.runner import EvalRunner`.
**Cause:** The `evaluation` package was nested inside `generation/evaluation/` but all imports referenced it at root level. Previously worked with a stale Docker image cache.
**Fix:** Moved `evaluation/` to root level where it belongs — it's an independent concern, not part of generation.

### 3. Seed Poll Timeout

**Symptom:** Seed script crashed with `httpx.ReadTimeout` while polling eval run progress.
**Cause:** Polling GET used `timeout=10.0` which was too short when the backend was busy processing LLM calls.
**Fix:** Increased to `timeout=30.0` and added try/except to retry on timeout instead of crashing.

---

## Test Summary

| Test | Status |
|------|--------|
| Health endpoint (DB + Qdrant) | PASS |
| Config GET with `active_collection` | PASS |
| File bytes stored in Postgres on upload | PASS |
| Config-scoped collection naming | PASS |
| Auto re-ingestion on config change | PASS |
| Collection management — list | PASS |
| Dataset creation (20 QA pairs) | PASS |
| Eval Run A — recursive/hybrid/reranker (20/20) | PASS |
| Config switch triggers re-ingestion | PASS |
| Eval Run B — fixed/dense/no-reranker (20/20) | PASS |
| Run comparison with deltas and insights | PASS |
| Both collections coexist in Qdrant | PASS |
| Full seed pipeline — unattended end-to-end | PASS |
