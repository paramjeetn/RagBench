"""Reranking strategies for post-retrieval result refinement."""

from __future__ import annotations

import asyncio
import math
from typing import Protocol, runtime_checkable

from exceptions import RetrievalError
from retrieval.dense import RetrievalResult


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class RerankerProtocol(Protocol):
    """Interface that all rerankers must satisfy."""

    async def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        ...


# ---------------------------------------------------------------------------
# Cross-encoder reranker
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    """Convert a raw logit to a [0, 1] probability."""
    return 1.0 / (1.0 + math.exp(-x))


class CrossEncoderReranker:
    """Reranks results using a cross-encoder model from fastembed.

    The model is lazily loaded on first use so that the dependency is only
    required when this reranker is actually invoked.
    """

    def __init__(
        self,
        model_name: str = "Xenova/ms-marco-MiniLM-L-6-v2",
    ) -> None:
        self.model_name = model_name
        self._model = None

    def _load_model(self) -> None:
        """Load the TextCrossEncoder model (called once)."""
        if self._model is None:
            from fastembed.rerank.cross_encoder import TextCrossEncoder

            self._model = TextCrossEncoder(model_name=self.model_name)

    async def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """Score each (query, passage) pair with the cross-encoder and re-sort."""
        if not results:
            return []

        try:
            self._load_model()

            documents = [r.text for r in results]
            scores = await asyncio.to_thread(
                lambda: list(self._model.rerank(query, documents))
            )

            scored = sorted(
                zip(scores, results), key=lambda x: x[0], reverse=True,
            )
            return [
                RetrievalResult(
                    text=r.text,
                    score=_sigmoid(float(s)),
                    doc_id=r.doc_id,
                    source_file=r.source_file,
                    page_number=r.page_number,
                    chunk_index=r.chunk_index,
                )
                for s, r in scored[:top_k]
            ]
        except RetrievalError:
            raise
        except Exception as exc:
            raise RetrievalError(
                message=f"Cross-encoder reranking failed: {exc}"
            ) from exc


# ---------------------------------------------------------------------------
# No-op reranker (passthrough)
# ---------------------------------------------------------------------------

class NoOpReranker:
    """Passthrough reranker that simply truncates to top_k without re-scoring."""

    async def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """Return the first *top_k* results unchanged."""
        return results[:top_k]
