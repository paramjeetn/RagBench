"""Document management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_ingestion_pipeline, get_vector_store
from api.schemas import (
    ChunkItem,
    DocumentDetailResponse,
    DocumentResponse,
    PaginatedChunks,
)
from database import repository as repo
from database.session import get_db
from exceptions import DocumentNotFoundError
from ingestion_pipeline import IngestionPipeline
from vectorstore.qdrant_store import VectorStoreProtocol

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def _doc_to_response(doc) -> DocumentResponse:
    """Convert a Document ORM object to a response schema."""
    return DocumentResponse(
        id=str(doc.id),
        filename=doc.filename,
        file_type=doc.file_type,
        chunk_count=doc.chunk_count,
        chunk_strategy=doc.chunk_strategy,
        uploaded_at=doc.uploaded_at,
    )


@router.post("/", status_code=201, response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    project_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    """Upload and ingest a document (PDF, MD, TXT, HTML)."""
    from uuid import UUID as _UUID
    file_bytes = await file.read()
    filename = file.filename or "unknown"

    # Create the DB record first to get the canonical id
    # We'll update chunk_count after ingestion
    from ingestion.parser import parse_document

    parsed = parse_document(file_bytes, filename)
    doc = await repo.create_document(
        session,
        filename=filename,
        file_type=parsed.file_type,
        chunk_count=0,
        chunk_strategy="pending",
        file_bytes=file_bytes,
        project_id=_UUID(project_id) if project_id else None,
    )
    db_doc_id = str(doc.id)

    # Run the ingestion pipeline with the DB doc_id so vectors match
    result = await pipeline.ingest(file_bytes, filename, doc_id=db_doc_id, project_id=project_id)

    # Update the document with actual chunk info
    doc.chunk_count = result["chunk_count"]
    doc.chunk_strategy = result["chunk_strategy"]
    await session.flush()

    return _doc_to_response(doc)


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    project_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
):
    """List uploaded documents, optionally filtered by project."""
    from uuid import UUID as _UUID
    docs = await repo.list_documents(session, project_id=_UUID(project_id) if project_id else None)
    return [_doc_to_response(doc) for doc in docs]


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    vector_store: VectorStoreProtocol = Depends(get_vector_store),
):
    """Get document details with paginated chunks from the vector store."""
    doc = await repo.get_document(session, UUID(document_id))
    if doc is None:
        raise DocumentNotFoundError()

    # Use scroll API to fetch chunks for this document (no query vector needed)
    offset = (page - 1) * page_size
    page_chunks = await vector_store.scroll_by_doc_id(
        doc_id=str(doc.id), limit=page_size, offset=offset
    )

    # If current active collection doesn't have the chunks (e.g., config changed),
    # search across available docs_* collections in Qdrant
    if not page_chunks and hasattr(vector_store, "list_collections") and hasattr(vector_store, "_client"):
        try:
            cols = await vector_store.list_collections()
            for col in cols:
                col_name = col["name"]
                if col_name == getattr(vector_store, "_collection", ""):
                    continue
                from qdrant_client.http.models import FieldCondition, Filter, MatchValue
                all_points = []
                next_page_offset = None
                while True:
                    resp = await vector_store._client.scroll(
                        collection_name=col_name,
                        scroll_filter=Filter(
                            must=[FieldCondition(key="doc_id", match=MatchValue(value=str(doc.id)))]
                        ),
                        limit=100,
                        offset=next_page_offset,
                        with_payload=True,
                        with_vectors=False,
                    )
                    points, next_page_offset = resp
                    all_points.extend(points)
                    if next_page_offset is None or not points:
                        break

                if all_points:
                    for point in all_points:
                        payload = point.payload or {}
                        from vectorstore.qdrant_store import VectorSearchResult
                        page_chunks.append(
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
                    page_chunks.sort(key=lambda c: c.chunk_index)
                    page_chunks = page_chunks[offset : offset + page_size]
                    break
        except Exception:
            pass

    page_chunks.sort(key=lambda c: c.chunk_index)

    chunk_items = [ChunkItem(index=c.chunk_index, text=c.text) for c in page_chunks]

    return DocumentDetailResponse(
        id=str(doc.id),
        filename=doc.filename,
        file_type=doc.file_type,
        chunk_count=doc.chunk_count,
        chunk_strategy=doc.chunk_strategy,
        uploaded_at=doc.uploaded_at,
        chunks=PaginatedChunks(
            items=chunk_items,
            total=doc.chunk_count,
            page=page,
            page_size=page_size,
        ),
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    """Delete a document from Postgres, Qdrant, and BM25 index."""
    # Delete from vector store and BM25
    await pipeline.delete(document_id)

    # Delete from Postgres
    deleted = await repo.delete_document(session, UUID(document_id))
    if not deleted:
        raise DocumentNotFoundError()

    return Response(status_code=204)
