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
    model: str = "gpt-5-nano"


class EmbeddingConfig(BaseModel):
    provider: EmbeddingProvider = EmbeddingProvider.openai
    model: str = "text-embedding-3-small"
    dimension: int = 1536


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
