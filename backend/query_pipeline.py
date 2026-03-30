"""Query pipeline for the RAG Eval System.

Orchestrates retrieval (dense / sparse / hybrid), optional reranking,
and LLM generation into a single async call.
"""

import json
import time
from dataclasses import dataclass
from typing import AsyncIterator

from config import RetrievalMode, get_pipeline_config
from generation.llm import LLMProtocol
from generation.prompts import SYSTEM_PROMPT, build_query_prompt
from retrieval.dense import DenseRetriever, RetrievalResult
from retrieval.hybrid import HybridRetriever
from retrieval.reranker import CrossEncoderReranker, NoOpReranker
from retrieval.sparse import BM25Index


@dataclass
class QueryResponse:
    """Complete response from the query pipeline."""

    answer: str
    sources: list[dict]
    metadata: dict


class QueryPipeline:
    """End-to-end query pipeline: retrieve -> rerank -> generate."""

    def __init__(
        self,
        dense_retriever: DenseRetriever,
        bm25_index: BM25Index,
        llm: LLMProtocol,
    ):
        self.dense = dense_retriever
        self.bm25 = bm25_index
        self.llm = llm
        self._reranker = None  # lazy loaded

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_reranker(self, enabled: bool):
        """Return a CrossEncoderReranker (cached) if *enabled*, else NoOp."""
        if enabled:
            if self._reranker is None:
                self._reranker = CrossEncoderReranker()
            return self._reranker
        return NoOpReranker()

    async def _retrieve(
        self, question: str, doc_ids: list[str] | None = None
    ) -> list[RetrievalResult]:
        """Run the configured retrieval strategy and reranker."""
        config = get_pipeline_config()
        mode = config.retrieval.mode
        top_k = config.retrieval.top_k

        if mode == RetrievalMode.dense:
            results = await self.dense.retrieve(question, top_k=50, doc_ids=doc_ids)
        elif mode == RetrievalMode.sparse:
            results = self.bm25.search(question, top_k=50, doc_ids=doc_ids)
        else:  # hybrid
            hybrid = HybridRetriever(self.dense, self.bm25)
            results = await hybrid.retrieve(question, top_k=20, doc_ids=doc_ids)

        # Rerank
        reranker = self._get_reranker(config.retrieval.reranker_enabled)
        results = await reranker.rerank(question, results, top_k=top_k)
        return results

    @staticmethod
    def _format_sources(results: list[RetrievalResult]) -> list[dict]:
        """Convert retrieval results into JSON-serialisable source dicts."""
        return [
            {
                "text": r.text,
                "source_file": r.source_file,
                "doc_id": r.doc_id,
                "page_number": r.page_number,
                "chunk_index": r.chunk_index,
                "score": round(r.score, 4),
            }
            for r in results
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def query(
        self, question: str, doc_ids: list[str] | None = None
    ) -> QueryResponse:
        """Full blocking query pipeline."""
        start = time.time()
        config = get_pipeline_config()

        results = await self._retrieve(question, doc_ids)
        sources = self._format_sources(results)

        chunks_for_prompt = [
            {
                "text": r.text,
                "source_file": r.source_file,
                "chunk_index": r.chunk_index,
            }
            for r in results
        ]
        prompt = build_query_prompt(question, chunks_for_prompt)

        llm_response = await self.llm.generate(SYSTEM_PROMPT, prompt)

        latency_ms = int((time.time() - start) * 1000)

        return QueryResponse(
            answer=llm_response.text,
            sources=sources,
            metadata={
                "latency_ms": latency_ms,
                "tokens_used": llm_response.tokens_used,
                "estimated_cost": llm_response.estimated_cost,
                "retrieval_mode": (
                    f"{config.retrieval.mode.value}"
                    f"{'+ rerank' if config.retrieval.reranker_enabled else ''}"
                ),
                "chunks_used": len(results),
                "total_chunks": len(results),
                "model": llm_response.model,
            },
        )

    async def query_stream(
        self, question: str, doc_ids: list[str] | None = None
    ) -> AsyncIterator[str]:
        """SSE streaming variant. Yields JSON-encoded SSE events."""
        start = time.time()
        config = get_pipeline_config()

        results = await self._retrieve(question, doc_ids)
        sources = self._format_sources(results)

        chunks_for_prompt = [
            {
                "text": r.text,
                "source_file": r.source_file,
                "chunk_index": r.chunk_index,
            }
            for r in results
        ]
        prompt = build_query_prompt(question, chunks_for_prompt)

        full_text = ""
        tokens_estimate = 0

        async for token in self.llm.generate_stream(SYSTEM_PROMPT, prompt):
            full_text += token
            tokens_estimate += 1
            yield json.dumps({"type": "token", "content": token})

        # Send sources after all tokens have been streamed.
        yield json.dumps({"type": "sources", "sources": sources})

        latency_ms = int((time.time() - start) * 1000)
        yield json.dumps(
            {
                "type": "metadata",
                "metadata": {
                    "latency_ms": latency_ms,
                    "tokens_used": tokens_estimate * 4,  # rough char-based estimate
                    "estimated_cost": 0.0,
                    "retrieval_mode": (
                        f"{config.retrieval.mode.value}"
                        f"{'+ rerank' if config.retrieval.reranker_enabled else ''}"
                    ),
                    "chunks_used": len(results),
                    "total_chunks": len(results),
                    "model": config.generation.model,
                },
            }
        )
