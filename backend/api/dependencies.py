"""FastAPI dependency injection — singleton management for pipeline components."""

from config import get_collection_name, get_settings, get_pipeline_config
from embedding.embedder import EmbedderProtocol, create_embedder
from generation.llm import create_llm
from evaluation.runner import EvalRunner
from ingestion_pipeline import IngestionPipeline
from query_pipeline import QueryPipeline
from retrieval.dense import DenseRetriever
from retrieval.sparse import BM25Index
from vectorstore.qdrant_store import VectorStoreProtocol, create_vector_store

# ---------------------------------------------------------------------------
# Singletons (created once, reused across requests)
# ---------------------------------------------------------------------------

_bm25_index = BM25Index()
_embedder: EmbedderProtocol | None = None
_vector_store: VectorStoreProtocol | None = None
_query_pipeline: QueryPipeline | None = None
_ingestion_pipeline: IngestionPipeline | None = None
_eval_runner: EvalRunner | None = None


def get_bm25_index() -> BM25Index:
    return _bm25_index


def get_embedder() -> EmbedderProtocol:
    global _embedder
    if _embedder is None:
        config = get_pipeline_config()
        _embedder = create_embedder(embedding_config=config.embedding)
    return _embedder


def get_vector_store() -> VectorStoreProtocol:
    global _vector_store
    if _vector_store is None:
        settings = get_settings()
        config = get_pipeline_config()
        collection = get_collection_name(config)
        _vector_store = create_vector_store(
            settings=settings,
            dimension=config.embedding.dimension,
            collection_name=collection,
        )
    return _vector_store


def get_query_pipeline() -> QueryPipeline:
    global _query_pipeline
    if _query_pipeline is None:
        settings = get_settings()
        config = get_pipeline_config()
        embedder = get_embedder()
        vs = get_vector_store()
        dense = DenseRetriever(embedder, vs)
        llm = create_llm(config.generation.model, settings)
        _query_pipeline = QueryPipeline(dense, _bm25_index, llm)
    return _query_pipeline


def get_ingestion_pipeline() -> IngestionPipeline:
    global _ingestion_pipeline
    if _ingestion_pipeline is None:
        _ingestion_pipeline = IngestionPipeline(
            get_embedder(), get_vector_store(), _bm25_index
        )
    return _ingestion_pipeline


def get_eval_runner() -> EvalRunner:
    global _eval_runner
    if _eval_runner is None:
        _eval_runner = EvalRunner(get_query_pipeline())
    return _eval_runner


def reset_query_pipeline() -> None:
    """Called when config changes to rebuild with new LLM/settings."""
    global _query_pipeline, _eval_runner
    _query_pipeline = None
    _eval_runner = None


def reset_embedder() -> None:
    """Called when embedding config changes. Resets embedder and ingestion pipeline."""
    global _embedder, _ingestion_pipeline
    _embedder = None
    _ingestion_pipeline = None


def reset_vector_store() -> None:
    """Called when collection changes. Resets vector store and ingestion pipeline."""
    global _vector_store, _ingestion_pipeline
    _vector_store = None
    _ingestion_pipeline = None
