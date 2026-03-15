"""Sparse (BM25) retrieval using an in-memory index."""

from __future__ import annotations

from exceptions import RetrievalError
from retrieval.dense import RetrievalResult


# ---------------------------------------------------------------------------
# BM25 index
# ---------------------------------------------------------------------------

class BM25Index:
    """In-memory BM25 index that supports doc_id filtering."""

    def __init__(self) -> None:
        self._documents: list[dict] = []
        # Each entry: {text, doc_id, source_file, page_number, chunk_index, tokens}
        self._bm25 = None  # rank_bm25.BM25Okapi instance
        self._dirty = True

    # -- mutation -------------------------------------------------------------

    def add_documents(self, chunks: list[dict]) -> None:
        """Add chunks to the index.

        Each chunk dict must contain: text, doc_id, source_file, page_number,
        chunk_index.
        """
        for chunk in chunks:
            tokens = chunk["text"].lower().split()
            self._documents.append({**chunk, "tokens": tokens})
        self._dirty = True

    def remove_by_doc_id(self, doc_id: str) -> None:
        """Remove all entries for a given document."""
        self._documents = [d for d in self._documents if d["doc_id"] != doc_id]
        self._dirty = True

    def clear(self) -> None:
        """Remove all entries from the index."""
        self._documents = []
        self._bm25 = None
        self._dirty = True

    # -- internal rebuild -----------------------------------------------------

    def _rebuild(self) -> None:
        """Rebuild the BM25 model from current documents when dirty."""
        if self._dirty and self._documents:
            from rank_bm25 import BM25Okapi

            self._bm25 = BM25Okapi([d["tokens"] for d in self._documents])
            self._dirty = False

    # -- search ---------------------------------------------------------------

    def search(
        self,
        query: str,
        top_k: int = 10,
        doc_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        """Search BM25 index, optionally filtering by doc_ids."""
        try:
            self._rebuild()

            if not self._bm25 or not self._documents:
                return []

            tokens = query.lower().split()
            scores = self._bm25.get_scores(tokens)

            # Build scored results with optional doc_id filter
            scored: list[tuple[float, dict]] = []
            for i, score in enumerate(scores):
                doc = self._documents[i]
                if doc_ids and doc["doc_id"] not in doc_ids:
                    continue
                if score > 0:
                    scored.append((score, doc))

            scored.sort(key=lambda x: x[0], reverse=True)

            return [
                RetrievalResult(
                    text=doc["text"],
                    score=score,
                    doc_id=doc["doc_id"],
                    source_file=doc["source_file"],
                    page_number=doc.get("page_number", 0),
                    chunk_index=doc.get("chunk_index", 0),
                )
                for score, doc in scored[:top_k]
            ]
        except RetrievalError:
            raise
        except Exception as exc:
            raise RetrievalError(
                message=f"BM25 search failed: {exc}"
            ) from exc
