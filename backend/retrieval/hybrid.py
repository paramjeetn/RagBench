"""Hybrid retrieval combining dense and sparse strategies with RRF fusion."""

from __future__ import annotations

from exceptions import RetrievalError
from retrieval.dense import DenseRetriever, RetrievalResult
from retrieval.sparse import BM25Index


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def reciprocal_rank_fusion(
    result_lists: list[list[RetrievalResult]],
    k: int = 60,
) -> list[RetrievalResult]:
    """Fuse multiple ranked lists using Reciprocal Rank Fusion.

    score(doc) = sum(1 / (k + rank)) across all lists.
    Deduplicates by (doc_id, chunk_index).
    """
    scores: dict[tuple, float] = {}
    result_map: dict[tuple, RetrievalResult] = {}

    for results in result_lists:
        for rank, result in enumerate(results):
            key = (result.doc_id, result.chunk_index)
            scores[key] = scores.get(key, 0) + 1.0 / (k + rank + 1)
            result_map[key] = result

    sorted_keys = sorted(scores, key=scores.get, reverse=True)

    return [
        RetrievalResult(
            text=result_map[rk].text,
            score=scores[rk],
            doc_id=result_map[rk].doc_id,
            source_file=result_map[rk].source_file,
            page_number=result_map[rk].page_number,
            chunk_index=result_map[rk].chunk_index,
        )
        for rk in sorted_keys
    ]


# ---------------------------------------------------------------------------
# Hybrid retriever
# ---------------------------------------------------------------------------

class HybridRetriever:
    """Combines dense and sparse retrieval, fusing results with RRF."""

    def __init__(self, dense: DenseRetriever, sparse: BM25Index) -> None:
        self.dense = dense
        self.sparse = sparse

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        doc_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        """Run dense + sparse retrieval and fuse with RRF, returning top_k."""
        try:
            dense_results = await self.dense.retrieve(
                query, top_k=50, doc_ids=doc_ids,
            )
            sparse_results = self.sparse.search(
                query, top_k=50, doc_ids=doc_ids,
            )
            fused = reciprocal_rank_fusion([dense_results, sparse_results])
            return fused[:top_k]
        except RetrievalError:
            raise
        except Exception as exc:
            raise RetrievalError(
                message=f"Hybrid retrieval failed: {exc}"
            ) from exc
