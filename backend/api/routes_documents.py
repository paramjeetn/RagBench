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
    session: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    """Upload and ingest a document (PDF, MD, TXT, HTML)."""
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
    )
    db_doc_id = str(doc.id)

    # Run the ingestion pipeline with the DB doc_id so vectors match
    result = await pipeline.ingest(file_bytes, filename, doc_id=db_doc_id)

    # Update the document with actual chunk info
    doc.chunk_count = result["chunk_count"]
    doc.chunk_strategy = result["chunk_strategy"]
    await session.flush()

    return _doc_to_response(doc)


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    session: AsyncSession = Depends(get_db),
):
    """List all uploaded documents."""
    docs = await repo.list_documents(session)
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

    # Retrieve all chunks for this document from Qdrant
    # We search with a zero vector to get all chunks, using a large top_k
    from embedding.embedder import create_embedder

    embedder = create_embedder()
    dim = embedder.dimension
    zero_vector = [0.0] * dim

    all_chunks = await vector_store.search(
        query_vector=zero_vector,
        top_k=doc.chunk_count + 100,  # ensure we get all
        doc_ids=[str(doc.id)],
    )

    # Sort by chunk_index
    all_chunks.sort(key=lambda c: c.chunk_index)

    # Paginate
    total = len(all_chunks)
    start = (page - 1) * page_size
    end = start + page_size
    page_chunks = all_chunks[start:end]

    chunk_items = [
        ChunkItem(index=c.chunk_index, text=c.text) for c in page_chunks
    ]

    return DocumentDetailResponse(
        id=str(doc.id),
        filename=doc.filename,
        file_type=doc.file_type,
        chunk_count=doc.chunk_count,
        chunk_strategy=doc.chunk_strategy,
        uploaded_at=doc.uploaded_at,
        chunks=PaginatedChunks(
            items=chunk_items,
            total=total,
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
