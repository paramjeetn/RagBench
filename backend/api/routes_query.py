"""Query endpoints — blocking and SSE streaming."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from api.dependencies import get_query_pipeline
from api.schemas import QueryMetadata, QueryRequest, QueryResponse, SourceInfo
from query_pipeline import QueryPipeline

router = APIRouter(prefix="/api/query", tags=["Query"])


@router.post("/", response_model=QueryResponse)
async def query(
    body: QueryRequest,
    pipeline: QueryPipeline = Depends(get_query_pipeline),
):
    """Ask a question (blocking). Returns answer with sources and metadata."""
    result = await pipeline.query(body.question, body.document_ids)

    sources = [SourceInfo(**s) for s in result.sources]
    metadata = QueryMetadata(**result.metadata)

    return QueryResponse(
        answer=result.answer,
        sources=sources,
        metadata=metadata,
    )


@router.post("/stream")
async def query_stream(
    body: QueryRequest,
    pipeline: QueryPipeline = Depends(get_query_pipeline),
):
    """Ask a question (SSE streaming). Returns Server-Sent Events."""

    async def event_generator():
        async for event_json in pipeline.query_stream(
            body.question, body.document_ids
        ):
            yield f"data: {event_json}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
