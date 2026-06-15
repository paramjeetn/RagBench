"""Vector store implementations for the RAG Eval System.

Provides a Qdrant-backed store for production and an in-memory store for testing.
Both satisfy VectorStoreProtocol.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from exceptions import VectorStoreError


# ---------------------------------------------------------------------------
# Data classes & Protocol
# ---------------------------------------------------------------------------

@dataclass
class VectorSearchResult:
    """Single result returned from a vector similarity search."""

    id: str
    text: str
    score: float
    doc_id: str
    source_file: str
    page_number: int
    chunk_index: int
    chunk_strategy: str


@runtime_checkable
class VectorStoreProtocol(Protocol):
    """Minimal interface every vector store must implement."""

    async def upsert(
        self,
        doc_id: str,
        chunks: list[dict],
        vectors: list[list[float]],
        project_id: str | None = None,
    ) -> None:
        """Store chunks with their vectors.

        Each chunk dict has: text, source_file, page_number, chunk_index, chunk_strategy.
        """
        ...

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        doc_ids: list[str] | None = None,
        project_id: str | None = None,
    ) -> list[VectorSearchResult]:
        """Search vectors, optionally filtered by doc_ids or project_id."""
        ...

    async def delete_by_doc_id(self, doc_id: str) -> None:
        """Delete all vectors for a document."""
        ...

    async def delete_all(self) -> None:
        """Delete entire collection."""
        ...

    async def ensure_collection(self) -> None:
        """Create collection if it does not exist."""
        ...

    async def scroll_by_doc_id(
        self, doc_id: str, limit: int = 100, offset: int = 0
    ) -> list[VectorSearchResult]:
        """Fetch chunks for a document using scroll — no query vector needed."""
        ...

    async def health_check(self) -> bool:
        """Return True when the vector store is reachable."""
        ...


# ---------------------------------------------------------------------------
# Qdrant implementation
# ---------------------------------------------------------------------------

_UPSERT_BATCH_SIZE = 100


class QdrantVectorStore:
    """Production vector store backed by Qdrant."""

    def __init__(
        self,
        url: str,
        collection_name: str = "documents",
        dimension: int = 768,
    ) -> None:
        from qdrant_client import AsyncQdrantClient

        self._client = AsyncQdrantClient(url=url)
        self._collection = collection_name
        self._dimension = dimension

    # -- collection management ------------------------------------------------

    async def ensure_collection(self) -> None:
        """Create collection with cosine distance if it does not already exist."""
        from qdrant_client.http.models import Distance, VectorParams

        try:
            exists = await self._client.collection_exists(self._collection)
            if not exists:
                await self._client.create_collection(
                    collection_name=self._collection,
                    vectors_config=VectorParams(
                        size=self._dimension,
                        distance=Distance.COSINE,
                    ),
                )
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to ensure collection '{self._collection}': {exc}"
            ) from exc

    async def collection_exists(self) -> bool:
        """Return True if the collection already exists in Qdrant."""
        try:
            return await self._client.collection_exists(self._collection)
        except Exception:
            return False

    async def list_collections(self) -> list[dict]:
        """List all collections whose names start with 'docs_'."""
        try:
            response = await self._client.get_collections()
            results = []
            for col in response.collections:
                if col.name.startswith("docs_"):
                    try:
                        info = await self._client.get_collection(col.name)
                        results.append({
                            "name": col.name,
                            "dimension": info.config.params.vectors.size,
                            "vector_count": info.points_count or 0,
                        })
                    except Exception:
                        results.append({
                            "name": col.name,
                            "dimension": 0,
                            "vector_count": 0,
                        })
            return results
        except Exception as exc:
            raise VectorStoreError(f"Failed to list collections: {exc}") from exc

    async def delete_collection(self, name: str) -> None:
        """Delete a specific collection by name."""
        try:
            await self._client.delete_collection(name)
        except Exception as exc:
            raise VectorStoreError(f"Failed to delete collection '{name}': {exc}") from exc

    @property
    def collection_name(self) -> str:
        return self._collection

    # -- upsert ---------------------------------------------------------------

    async def upsert(
        self,
        doc_id: str,
        chunks: list[dict],
        vectors: list[list[float]],
        project_id: str | None = None,
    ) -> None:
        from qdrant_client.http.models import PointStruct

        try:
            points: list[PointStruct] = []
            for chunk, vector in zip(chunks, vectors):
                point_id = str(uuid.uuid4())
                payload = {
                    "text": chunk["text"],
                    "doc_id": doc_id,
                    "source_file": chunk["source_file"],
                    "page_number": chunk["page_number"],
                    "chunk_index": chunk["chunk_index"],
                    "chunk_strategy": chunk["chunk_strategy"],
                }
                if project_id is not None:
                    payload["project_id"] = project_id
                points.append(PointStruct(id=point_id, vector=vector, payload=payload))

            # Batch upsert in groups of 100
            for i in range(0, len(points), _UPSERT_BATCH_SIZE):
                batch = points[i : i + _UPSERT_BATCH_SIZE]
                await self._client.upsert(
                    collection_name=self._collection,
                    points=batch,
                )
        except VectorStoreError:
            raise
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to upsert {len(chunks)} chunks for doc '{doc_id}': {exc}"
            ) from exc

    # -- search ---------------------------------------------------------------

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        doc_ids: list[str] | None = None,
        project_id: str | None = None,
    ) -> list[VectorSearchResult]:
        from qdrant_client.http.models import (
            FieldCondition,
            Filter,
            MatchAny,
            MatchValue,
        )

        try:
            must_conditions = []
            if doc_ids:
                must_conditions.append(
                    FieldCondition(key="doc_id", match=MatchAny(any=doc_ids))
                )
            if project_id:
                must_conditions.append(
                    FieldCondition(key="project_id", match=MatchValue(value=project_id))
                )
            query_filter: Filter | None = Filter(must=must_conditions) if must_conditions else None

            response = await self._client.query_points(
                collection_name=self._collection,
                query=query_vector,
                query_filter=query_filter,
                limit=top_k,
                with_payload=True,
            )

            results: list[VectorSearchResult] = []
            for point in response.points:
                payload = point.payload or {}
                results.append(
                    VectorSearchResult(
                        id=str(point.id),
                        text=payload.get("text", ""),
                        score=point.score,
                        doc_id=payload.get("doc_id", ""),
                        source_file=payload.get("source_file", ""),
                        page_number=payload.get("page_number", 0),
                        chunk_index=payload.get("chunk_index", 0),
                        chunk_strategy=payload.get("chunk_strategy", ""),
                    )
                )
            return results
        except VectorStoreError:
            raise
        except Exception as exc:
            raise VectorStoreError(f"Search failed: {exc}") from exc

    async def scroll_by_doc_id(
        self, doc_id: str, limit: int = 100, offset: int = 0
    ) -> list[VectorSearchResult]:
        """Fetch chunks for a document using Qdrant scroll (no query vector)."""
        from qdrant_client.http.models import FieldCondition, Filter, MatchValue

        try:
            response = await self._client.scroll(
                collection_name=self._collection,
                scroll_filter=Filter(
                    must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
                ),
                limit=limit,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            results: list[VectorSearchResult] = []
            for point in response[0]:
                payload = point.payload or {}
                results.append(
                    VectorSearchResult(
                        id=str(point.id),
                        text=payload.get("text", ""),
                        score=1.0,
                        doc_id=payload.get("doc_id", ""),
                        source_file=payload.get("source_file", ""),
                        page_number=payload.get("page_number", 0),
                        chunk_index=payload.get("chunk_index", 0),
                        chunk_strategy=payload.get("chunk_strategy", ""),
                    )
                )
            return results
        except VectorStoreError:
            raise
        except Exception as exc:
            raise VectorStoreError(
                f"Scroll failed for doc '{doc_id}': {exc}"
            ) from exc

    # -- delete ---------------------------------------------------------------

    async def delete_by_doc_id(self, doc_id: str) -> None:
        from qdrant_client.http.models import (
            FieldCondition,
            Filter,
            MatchValue,
        )

        try:
            await self._client.delete(
                collection_name=self._collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="doc_id",
                            match=MatchValue(value=doc_id),
                        )
                    ]
                ),
            )
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to delete vectors for doc '{doc_id}': {exc}"
            ) from exc

    async def delete_all(self) -> None:
        """Delete entire collection and recreate it."""
        try:
            await self._client.delete_collection(self._collection)
            await self.ensure_collection()
        except VectorStoreError:
            raise
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to delete collection '{self._collection}': {exc}"
            ) from exc

    # -- health ---------------------------------------------------------------

    async def health_check(self) -> bool:
        try:
            await self._client.get_collection(self._collection)
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# In-memory implementation (for tests)
# ---------------------------------------------------------------------------

@dataclass
class _StoredVector:
    """Internal record kept by InMemoryVectorStore."""

    id: str
    vector: list[float]
    text: str
    doc_id: str
    source_file: str
    page_number: int
    chunk_index: int
    chunk_strategy: str


class InMemoryVectorStore:
    """Lightweight in-memory vector store for unit tests."""

    def __init__(self) -> None:
        self._store: list[_StoredVector] = []

    async def ensure_collection(self) -> None:  # noqa: D102
        pass  # no-op

    async def upsert(
        self, doc_id: str, chunks: list[dict], vectors: list[list[float]]
    ) -> None:
        for chunk, vector in zip(chunks, vectors):
            self._store.append(
                _StoredVector(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    text=chunk["text"],
                    doc_id=doc_id,
                    source_file=chunk["source_file"],
                    page_number=chunk["page_number"],
                    chunk_index=chunk["chunk_index"],
                    chunk_strategy=chunk["chunk_strategy"],
                )
            )

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        doc_ids: list[str] | None = None,
    ) -> list[VectorSearchResult]:
        candidates = self._store
        if doc_ids:
            candidates = [v for v in candidates if v.doc_id in doc_ids]

        scored: list[tuple[float, _StoredVector]] = []
        for entry in candidates:
            score = self._cosine_similarity(query_vector, entry.vector)
            scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[VectorSearchResult] = []
        for score, entry in scored[:top_k]:
            results.append(
                VectorSearchResult(
                    id=entry.id,
                    text=entry.text,
                    score=score,
                    doc_id=entry.doc_id,
                    source_file=entry.source_file,
                    page_number=entry.page_number,
                    chunk_index=entry.chunk_index,
                    chunk_strategy=entry.chunk_strategy,
                )
            )
        return results

    async def scroll_by_doc_id(
        self, doc_id: str, limit: int = 100, offset: int = 0
    ) -> list[VectorSearchResult]:
        matching = [v for v in self._store if v.doc_id == doc_id]
        matching.sort(key=lambda v: v.chunk_index)
        sliced = matching[offset : offset + limit]
        return [
            VectorSearchResult(
                id=v.id,
                text=v.text,
                score=1.0,
                doc_id=v.doc_id,
                source_file=v.source_file,
                page_number=v.page_number,
                chunk_index=v.chunk_index,
                chunk_strategy=v.chunk_strategy,
            )
            for v in sliced
        ]

    async def delete_by_doc_id(self, doc_id: str) -> None:
        self._store = [v for v in self._store if v.doc_id != doc_id]

    async def delete_all(self) -> None:
        self._store.clear()

    async def health_check(self) -> bool:  # noqa: D102
        return True

    # -- helpers --------------------------------------------------------------

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors using pure math."""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_vector_store(
    settings: "Settings | None" = None,
    dimension: int | None = None,
    collection_name: str | None = None,
) -> VectorStoreProtocol:
    """Create a QdrantVectorStore from application settings.

    *dimension* overrides the setting's ``EMBEDDING_DIM`` when provided
    (e.g. from the dynamic PipelineConfig embedding config).

    *collection_name* overrides the setting's ``COLLECTION_NAME`` when
    provided (e.g. from config-scoped collection naming).
    """
    if settings is None:
        from config import get_settings

        settings = get_settings()

    dim = dimension if dimension is not None else settings.EMBEDDING_DIM
    name = collection_name if collection_name is not None else settings.COLLECTION_NAME

    return QdrantVectorStore(
        url=settings.QDRANT_URL,
        collection_name=name,
        dimension=dim,
    )
