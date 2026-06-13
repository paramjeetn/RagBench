"""Pydantic v2 schemas for all API request/response bodies."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    chunk_count: int
    chunk_strategy: str
    uploaded_at: datetime


class ChunkItem(BaseModel):
    index: int
    text: str


class PaginatedChunks(BaseModel):
    items: list[ChunkItem]
    total: int
    page: int
    page_size: int


class DocumentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    chunk_count: int
    chunk_strategy: str
    uploaded_at: datetime
    chunks: PaginatedChunks


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    document_ids: list[str] | None = None


class SourceInfo(BaseModel):
    text: str
    source_file: str
    doc_id: str
    page_number: int | None = None
    chunk_index: int | None = None
    score: float


class QueryMetadata(BaseModel):
    latency_ms: int
    tokens_used: int
    estimated_cost: float
    retrieval_mode: str
    chunks_used: int
    total_chunks: int
    model: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    metadata: QueryMetadata


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

class TestCaseItem(BaseModel):
    question: str
    ground_truth: str


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    ground_truth: str


class DatasetCreateRequest(BaseModel):
    name: str
    description: str | None = None
    document_ids: list[str]
    items: list[TestCaseItem]


class DatasetSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    document_ids: list[str]
    item_count: int
    created_at: datetime


class DatasetDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    document_ids: list[str]
    items: list[TestCaseResponse]
    created_at: datetime


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

class EvalRunRequest(BaseModel):
    dataset_id: str
    document_ids: list[str] | None = None
    name: str | None = None


class EvalResultResponse(BaseModel):
    id: str
    question: str
    ground_truth: str
    generated_answer: str
    retrieved_chunks: list[Any]
    metrics: dict[str, Any]
    latency_ms: int
    tokens_used: int
    passed: bool
    failure_reason: str | None = None


class EvalRunProgress(BaseModel):
    completed: int
    total: int


class EvalRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str | None = None
    status: str
    dataset_id: str
    dataset_name: str | None = None
    document_ids: list[str]
    config: dict[str, Any]
    metrics: dict[str, Any] | None = None
    scoring_mode: str | None = None
    progress: EvalRunProgress | None = None
    results: list[EvalResultResponse] | None = None
    question_count: int | None = None
    pass_count: int | None = None
    created_at: datetime


class EvalCompareResponse(BaseModel):
    run_a: dict[str, Any]
    run_b: dict[str, Any]
    deltas: dict[str, float]
    config_diff: list[dict[str, Any]]
    insights: list[str]


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class ChunkingConfigSchema(BaseModel):
    strategy: str
    chunk_size: int
    overlap: int


class RetrievalConfigSchema(BaseModel):
    mode: str
    top_k: int
    reranker_enabled: bool


class GenerationConfigSchema(BaseModel):
    model: str


class EmbeddingConfigSchema(BaseModel):
    provider: str
    model: str
    dimension: int


class ConfigStatusSchema(BaseModel):
    reindexing: bool = False
    active_collection: str = ""
    collection_ready: bool = True
    scoring_available: bool = False


class CollectionInfo(BaseModel):
    name: str
    dimension: int
    vector_count: int
    is_active: bool


class PipelineConfigResponse(BaseModel):
    chunking: ChunkingConfigSchema
    retrieval: RetrievalConfigSchema
    generation: GenerationConfigSchema
    embedding: EmbeddingConfigSchema
    status: ConfigStatusSchema


class PipelineConfigUpdateRequest(BaseModel):
    chunking: dict[str, Any] | None = None
    retrieval: dict[str, Any] | None = None
    generation: dict[str, Any] | None = None
    embedding: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    database: str
    qdrant: str
