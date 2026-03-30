"""Real auto-seed script for the RAG Eval System.

Uploads actual documents, creates a dataset via the API, and triggers real
eval runs — just like a user would. No fake data inserted into the database.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

BASE_URL = "http://backend:8000"
SEED_DIR = Path(__file__).parent / "documents"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def wait_for_backend(retries: int = 30) -> None:
    """Poll the backend /health endpoint until it responds 200."""
    for i in range(retries):
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{BASE_URL}/health", timeout=5.0)
                if r.status_code == 200:
                    data = r.json()
                    if data.get("database") == "connected" and data.get("qdrant") == "connected":
                        print("Backend is ready!")
                        return
        except Exception:
            pass
        print(f"Waiting for backend... ({i + 1}/{retries})")
        await asyncio.sleep(3)
    print("Backend not ready after retries, seeding anyway...")


async def poll_eval_run(client: httpx.AsyncClient, run_id: str, timeout: int = 600) -> dict:
    """Poll an eval run until it completes or times out."""
    elapsed = 0
    interval = 5
    while elapsed < timeout:
        try:
            r = await client.get(f"{BASE_URL}/api/eval/runs/{run_id}", timeout=30.0)
            r.raise_for_status()
            data = r.json()
        except (httpx.ReadTimeout, httpx.ConnectTimeout):
            print(f"  Poll request timed out, retrying...")
            await asyncio.sleep(interval)
            elapsed += interval
            continue
        status = data.get("status", "")
        if status == "completed":
            print(f"  Eval run {run_id} completed.")
            return data
        if status == "failed":
            print(f"  Eval run {run_id} FAILED.")
            return data
        progress = data.get("progress")
        if progress:
            print(f"  Progress: {progress['completed']}/{progress['total']}")
        await asyncio.sleep(interval)
        elapsed += interval
    print(f"  Eval run {run_id} timed out after {timeout}s.")
    return data


def has_api_key() -> bool:
    """Check if any LLM API key is available."""
    return bool(
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    )


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

async def seed() -> None:
    """Upload documents, create dataset, and run evaluations via the API."""
    await wait_for_backend()

    async with httpx.AsyncClient(timeout=60.0) as client:

        # ----- idempotency check -----
        # Only skip if documents exist AND we have at least 2 completed eval runs
        r = await client.get(f"{BASE_URL}/api/documents/")
        docs_exist = r.status_code == 200 and len(r.json()) > 0

        completed_runs = 0
        if docs_exist:
            r2 = await client.get(f"{BASE_URL}/api/eval/runs")
            if r2.status_code == 200:
                runs = r2.json()
                completed_runs = sum(1 for run in runs if run.get("status") == "completed")

        if docs_exist and completed_runs >= 2:
            print(f"Seed data already present ({completed_runs} completed eval runs). Skipping.")
            return

        if docs_exist and completed_runs < 2:
            print(f"Documents exist but only {completed_runs} completed eval runs. Re-running evals...")
        else:
            print("No documents found. Running full seed...")

        # -----------------------------------------------------------------
        # 1. Upload documents (skip if already present)
        # -----------------------------------------------------------------
        doc_ids: list[str] = []

        if docs_exist:
            # Reuse existing documents
            r = await client.get(f"{BASE_URL}/api/documents/")
            for doc in r.json():
                doc_ids.append(doc["id"])
            print(f"Reusing {len(doc_ids)} existing documents.")
        else:
            doc_files = [
                "ml_fundamentals.md",
                "python_best_practices.md",
                "api_design_patterns.txt",
            ]

            for filename in doc_files:
                filepath = SEED_DIR / filename
                if not filepath.exists():
                    print(f"  WARNING: {filepath} not found, skipping.")
                    continue

                with open(filepath, "rb") as f:
                    r = await client.post(
                        f"{BASE_URL}/api/documents/",
                        files={"file": (filename, f, "application/octet-stream")},
                    )
                if r.status_code == 201:
                    doc = r.json()
                    doc_ids.append(doc["id"])
                    print(f"  Uploaded {filename} -> id={doc['id']}, chunks={doc['chunk_count']}")
                else:
                    print(f"  FAILED to upload {filename}: {r.status_code} {r.text}")

            if not doc_ids:
                print("No documents uploaded, aborting seed.")
                return

            print(f"Uploaded {len(doc_ids)} documents.")

        # -----------------------------------------------------------------
        # 2. Create dataset (skip if already present)
        # -----------------------------------------------------------------
        dataset_id: str | None = None

        r = await client.get(f"{BASE_URL}/api/datasets/")
        if r.status_code == 200 and len(r.json()) > 0:
            dataset_id = r.json()[0]["id"]
            dataset_name = r.json()[0]["name"]
            item_count = r.json()[0]["item_count"]
            print(f"Reusing existing dataset '{dataset_name}' ({item_count} items) -> id={dataset_id}")
        else:
            dataset_path = SEED_DIR / "test_dataset.json"
            if not dataset_path.exists():
                print("test_dataset.json not found, aborting seed.")
                return

            with open(dataset_path, "r") as f:
                qa_pairs = json.load(f)

            dataset_body = {
                "name": "ML Basics QA",
                "description": (
                    "A curated set of question-answer pairs covering ML, Python, "
                    "and API design, suitable for evaluating RAG pipeline accuracy."
                ),
                "document_ids": doc_ids,
                "items": qa_pairs,
            }

            r = await client.post(f"{BASE_URL}/api/datasets/", json=dataset_body)
            if r.status_code != 201:
                print(f"FAILED to create dataset: {r.status_code} {r.text}")
                return

            dataset = r.json()
            dataset_id = dataset["id"]
            item_count = dataset["item_count"]
            print(f"Created dataset '{dataset['name']}' with {item_count} items -> id={dataset_id}")

        # Warn if no API key — evals will use heuristic scoring
        if not has_api_key():
            print("\nWARNING: No LLM API key found. Eval runs will use heuristic scoring (no LLM calls).")
            print("Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY for LLM-based evaluation.\n")

        # -----------------------------------------------------------------
        # 3. Eval Run A — default config (recursive/hybrid/reranker)
        # -----------------------------------------------------------------
        print("\nStarting Eval Run A (default config: recursive/hybrid/reranker)...")

        # Reset to default config first
        await client.put(
            f"{BASE_URL}/api/config/",
            json={
                "chunking": {"strategy": "recursive", "chunk_size": 500, "overlap": 50},
                "retrieval": {"mode": "hybrid", "top_k": 5, "reranker_enabled": True},
            },
        )

        r = await client.post(
            f"{BASE_URL}/api/eval/run",
            json={"dataset_id": dataset_id, "document_ids": doc_ids},
        )
        if r.status_code != 202:
            print(f"FAILED to start eval run A: {r.status_code} {r.text}")
            return

        run_a = r.json()
        run_a_id = run_a["id"]
        print(f"  Eval Run A started -> id={run_a_id}")

        result_a = await poll_eval_run(client, run_a_id)
        if result_a.get("metrics"):
            print(f"  Run A metrics: {result_a['metrics']}")

        # -----------------------------------------------------------------
        # 4. Change config to fixed chunking + dense retrieval (no reranker)
        # -----------------------------------------------------------------
        print("\nSwitching config to fixed/dense/no-reranker...")
        r = await client.put(
            f"{BASE_URL}/api/config/",
            json={
                "chunking": {"strategy": "fixed", "chunk_size": 500, "overlap": 50},
                "retrieval": {"mode": "dense", "top_k": 5, "reranker_enabled": False},
            },
        )
        if r.status_code == 200:
            cfg = r.json()
            print(f"  Config updated: {cfg['chunking']['strategy']}/{cfg['retrieval']['mode']}")
        else:
            print(f"  Config update failed: {r.status_code} {r.text}")

        # Wait for collection_ready after config change
        for _ in range(60):
            r = await client.get(f"{BASE_URL}/api/config/")
            if r.status_code == 200 and r.json().get("status", {}).get("collection_ready", False):
                print("  Collection ready after config change.")
                break
            await asyncio.sleep(2)
        else:
            print("  WARNING: collection_ready never became true, proceeding anyway.")

        # -----------------------------------------------------------------
        # 5. Eval Run B — fixed/dense config
        # -----------------------------------------------------------------
        print("\nStarting Eval Run B (fixed/dense config)...")
        r = await client.post(
            f"{BASE_URL}/api/eval/run",
            json={"dataset_id": dataset_id, "document_ids": doc_ids},
        )
        if r.status_code != 202:
            print(f"FAILED to start eval run B: {r.status_code} {r.text}")
            return

        run_b = r.json()
        run_b_id = run_b["id"]
        print(f"  Eval Run B started -> id={run_b_id}")

        result_b = await poll_eval_run(client, run_b_id)
        if result_b.get("metrics"):
            print(f"  Run B metrics: {result_b['metrics']}")

        # -----------------------------------------------------------------
        # 6. Summary
        # -----------------------------------------------------------------
        print("\n" + "=" * 60)
        print("SEED COMPLETE")
        print(f"  Documents:  {len(doc_ids)}")
        print(f"  Dataset:    {item_count} items")
        print(f"  Eval Run A: {run_a_id} (status={result_a.get('status', '?')})")
        print(f"  Eval Run B: {run_b_id} (status={result_b.get('status', '?')})")
        if not has_api_key():
            print("  NOTE: Metrics computed via heuristics (no API key). Add a key for LLM-based scores.")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
