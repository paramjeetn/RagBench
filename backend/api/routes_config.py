"""Pipeline configuration endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from api.dependencies import (
    get_ingestion_pipeline,
    get_vector_store,
    reset_embedder,
    reset_query_pipeline,
    reset_vector_store,
)
from api.schemas import (
    ChunkingConfigSchema,
    CollectionInfo,
    ConfigStatusSchema,
    EmbeddingConfigSchema,
    GenerationConfigSchema,
    PipelineConfigResponse,
    PipelineConfigUpdateRequest,
    RetrievalConfigSchema,
)
from config import get_collection_name, get_pipeline_config, update_pipeline_config
from database import repository as repo
from database.session import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["Configuration"])

# Global flags for status
_reindexing = False
_collection_ready = True


async def _reingest_all() -> None:
    """Re-ingest all documents from stored bytes using the current pipeline."""
    global _reindexing, _collection_ready
    _reindexing = True
    _collection_ready = False
    try:
        pipeline = get_ingestion_pipeline()
        async with async_session() as session:
            docs = await repo.list_documents(session)
            for doc in docs:
                await pipeline.ingest(doc.file_bytes, doc.filename, doc_id=str(doc.id))
        logger.info("Re-ingestion complete for %d documents", len(docs))
    except Exception:
        logger.exception("Re-ingestion failed")
    finally:
        _reindexing = False
        _collection_ready = True


def _config_response() -> PipelineConfigResponse:
    """Build a PipelineConfigResponse from the current pipeline config."""
    config = get_pipeline_config()
    active_collection = get_collection_name(config)
    return PipelineConfigResponse(
        chunking=ChunkingConfigSchema(
            strategy=config.chunking.strategy.value,
            chunk_size=config.chunking.chunk_size,
            overlap=config.chunking.overlap,
        ),
        retrieval=RetrievalConfigSchema(
            mode=config.retrieval.mode.value,
            top_k=config.retrieval.top_k,
            reranker_enabled=config.retrieval.reranker_enabled,
        ),
        generation=GenerationConfigSchema(
            model=config.generation.model,
            temperature=config.generation.temperature,
        ),
        embedding=EmbeddingConfigSchema(
            provider=config.embedding.provider.value,
            model=config.embedding.model,
            dimension=config.embedding.dimension,
        ),
        status=ConfigStatusSchema(
            reindexing=_reindexing,
            active_collection=active_collection,
            collection_ready=_collection_ready,
        ),
    )


@router.get("/", response_model=PipelineConfigResponse)
async def get_config():
    """Get the current pipeline configuration."""
    return _config_response()


@router.put("/", response_model=PipelineConfigResponse)
async def update_config(body: PipelineConfigUpdateRequest):
    """Update pipeline configuration. Partial updates supported.

    When chunking or embedding config changes, the system automatically
    switches to (or creates) the matching config-scoped collection.
    If the collection already exists, the switch is instant.
    If not, all documents are re-ingested from stored bytes.
    """
    # Snapshot old config for comparison
    old_config = get_pipeline_config()
    old_chunking = old_config.chunking.model_dump()
    old_embedding = old_config.embedding.model_dump()

    # Build updates dict (only non-None sections)
    updates = {}
    if body.chunking is not None:
        updates["chunking"] = body.chunking
    if body.retrieval is not None:
        updates["retrieval"] = body.retrieval
    if body.generation is not None:
        updates["generation"] = body.generation
    if body.embedding is not None:
        updates["embedding"] = body.embedding

    if updates:
        update_pipeline_config(updates)

    new_config = get_pipeline_config()
    new_chunking = new_config.chunking.model_dump()
    new_embedding = new_config.embedding.model_dump()

    vectors_changed = old_chunking != new_chunking or old_embedding != new_embedding

    if vectors_changed:
        logger.info(
            "Vector-affecting config changed — switching collection"
        )
        # Reset singletons so they rebuild with the new collection name
        if old_embedding != new_embedding:
            reset_embedder()
        reset_vector_store()

        # Get the new vector store (creates singleton with new collection name)
        vs = get_vector_store()
        try:
            already_exists = await vs.collection_exists()
            if already_exists:
                logger.info(
                    "Collection '%s' already exists — instant switch",
                    get_collection_name(new_config),
                )
            else:
                # Create the collection and re-ingest all docs
                await vs.ensure_collection()
                logger.info(
                    "Created new collection '%s' — re-ingesting documents",
                    get_collection_name(new_config),
                )
                await _reingest_all()
        except Exception:
            logger.exception("Failed to switch collection (Qdrant may be unavailable)")

        # Reset downstream pipelines
        reset_query_pipeline()

    # Always reset query pipeline so it picks up retrieval/generation changes
    reset_query_pipeline()

    return _config_response()


# ---------------------------------------------------------------------------
# Collection management
# ---------------------------------------------------------------------------

@router.get("/collections", response_model=list[CollectionInfo])
async def list_collections():
    """List all config-scoped collections in Qdrant."""
    vs = get_vector_store()
    active = get_collection_name()
    try:
        collections = await vs.list_collections()
    except Exception:
        logger.exception("Failed to list collections")
        return []

    return [
        CollectionInfo(
            name=col["name"],
            dimension=col["dimension"],
            vector_count=col["vector_count"],
            is_active=(col["name"] == active),
        )
        for col in collections
    ]


@router.delete("/collections/{collection_name}", status_code=204)
async def delete_collection(collection_name: str):
    """Delete a specific config-scoped collection. Cannot delete the active one."""
    active = get_collection_name()
    if collection_name == active:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the currently active collection.",
        )

    vs = get_vector_store()
    try:
        await vs.delete_collection(collection_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
