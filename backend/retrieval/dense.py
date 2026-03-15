"""Dense retrieval using vector similarity search."""

from __future__ import annotations

from dataclasses import dataclass

from embedding.embedder import EmbedderProtocol
from exceptions import RetrievalError
from vectorstore.qdrant_store import VectorStoreProtocol


# ---------------------------------------------------------------------------
# Data class shared across all retrieval modules
# ---------------------------------------------------------------------------

@dataclass
class RetrievalResult:
    """Single result returned from any retrieval strategy."""

    text: str
    score: float
    doc_id: str
    source_file: str
    page_number: int
    chunk_index: int


# ---------------------------------------------------------------------------
# Dense retriever
# ---------------------------------------------------------------------------

class DenseRetriever:
    """Retrieves documents by embedding the query and searching the vector store."""

    def __init__(
        self,
        embedder: EmbedderProtocol,
        vector_store: VectorStoreProtocol,
    ) -> None:
        self.embedder = embedder
        self.vector_store = vector_store

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        doc_ids: list[str] | None = None,
    ) -> list[RetrievalResult]:
        """Embed query, search vector store filtered by doc_ids."""
        try:
            embeddings = await self.embedder.embed([query])
            results = await self.vector_store.search(
                embeddings[0], top_k=top_k, doc_ids=doc_ids,
            )
            return [
                RetrievalResult(
                    text=r.text,
                    score=r.score,
                    doc_id=r.doc_id,
                    source_file=r.source_file,
                    page_number=r.page_number,
                    chunk_index=r.chunk_index,
                )
                for r in results
            ]
        except RetrievalError:
            raise
        except Exception as exc:
            raise RetrievalError(
                message=f"Dense retrieval failed: {exc}"
            ) from exc
