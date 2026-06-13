"""Configuration for the RAG Eval System."""

from enum import Enum
from functools import lru_cache

from pydantic import BaseModel
from pydantic_settings import BaseSettings


# ---------------------------------------------------------------------------
# Application settings (loaded from .env)
# ---------------------------------------------------------------------------

class Settings(BaseSettings):
    """Environment-driven application settings."""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/rageval"
    QDRANT_URL: str = "http://localhost:6333"
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    COLLECTION_NAME: str = "documents"


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ChunkStrategy(str, Enum):
    fixed = "fixed"
    recursive = "recursive"
    semantic = "semantic"
    document_aware = "document_aware"


class RetrievalMode(str, Enum):
    dense = "dense"
    sparse = "sparse"
    hybrid = "hybrid"


class LLMProvider(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    gemini = "gemini"
    ollama = "ollama"


class EmbeddingProvider(str, Enum):
    openai = "openai"
    gemini = "gemini"
    local = "local"


# ---------------------------------------------------------------------------
# Pipeline configuration (mutable, nested)
# ---------------------------------------------------------------------------

class ChunkingConfig(BaseModel):
    strategy: ChunkStrategy = ChunkStrategy.recursive
    chunk_size: int = 500
    overlap: int = 50


class RetrievalConfig(BaseModel):
    mode: RetrievalMode = RetrievalMode.hybrid
    top_k: int = 5
    reranker_enabled: bool = True


class GenerationConfig(BaseModel):
    model: str = "gemini-2.0-flash"


# Maps (provider, model) → embedding dimension. Used to auto-set dimension
# when embedding config changes so the user never has to set it manually.
EMBEDDING_MODEL_DEFAULTS: dict[tuple[str, str], int] = {
    ("openai", "text-embedding-3-small"): 1536,
    ("openai", "text-embedding-3-large"): 3072,
    ("gemini", "gemini-embedding-001"): 768,
    ("local", "BAAI/bge-small-en-v1.5"): 384,
    ("local", "all-MiniLM-L6-v2"): 384,
}


class EmbeddingConfig(BaseModel):
    # Default to local fastembed model — no API key required, pre-downloaded in Docker image.
    provider: EmbeddingProvider = EmbeddingProvider.local
    model: str = "BAAI/bge-small-en-v1.5"
    dimension: int = 384


class PipelineConfig(BaseModel):
    chunking: ChunkingConfig = ChunkingConfig()
    retrieval: RetrievalConfig = RetrievalConfig()
    generation: GenerationConfig = GenerationConfig()
    embedding: EmbeddingConfig = EmbeddingConfig()


# ---------------------------------------------------------------------------
# Singletons / accessors
# ---------------------------------------------------------------------------

@lru_cache
def get_settings() -> Settings:
    return Settings()


# Mutable pipeline config (not cached)
_pipeline_config = PipelineConfig()


def get_pipeline_config() -> PipelineConfig:
    return _pipeline_config


def get_collection_name(config: PipelineConfig | None = None) -> str:
    """Build a Qdrant collection name scoped to chunking + embedding config."""
    if config is None:
        config = _pipeline_config
    c = config.chunking
    e = config.embedding
    return f"docs_{c.strategy.value}_{c.chunk_size}_{c.overlap}_{e.provider.value}_{e.dimension}"


def update_pipeline_config(updates: dict) -> PipelineConfig:
    global _pipeline_config
    current = _pipeline_config.model_dump()
    for section, values in updates.items():
        if section in current and isinstance(values, dict):
            current[section].update(values)
    _pipeline_config = PipelineConfig(**current)
    return _pipeline_config
