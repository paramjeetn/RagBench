"""SQLAlchemy 2.0 declarative models for the RAG Eval System."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, LargeBinary, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))
    chunk_count: Mapped[int] = mapped_column(Integer)
    chunk_strategy: Mapped[str] = mapped_column(String(50))
    file_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    test_cases: Mapped[list["TestCase"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )
    eval_runs: Mapped[list["EvalRun"]] = relationship(back_populates="dataset")


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    dataset_id: Mapped[UUID] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE")
    )
    question: Mapped[str] = mapped_column(Text)
    ground_truth: Mapped[str] = mapped_column(Text)

    dataset: Mapped["Dataset"] = relationship(back_populates="test_cases")


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id"))
    document_ids: Mapped[list] = mapped_column(JSON, default=list)
    config: Mapped[dict] = mapped_column(JSON)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scoring_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    progress_done: Mapped[int] = mapped_column(Integer, default=0)
    progress_total: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    dataset: Mapped["Dataset"] = relationship(back_populates="eval_runs")
    eval_results: Mapped[list["EvalResult"]] = relationship(
        back_populates="eval_run", cascade="all, delete-orphan"
    )


class EvalResult(Base):
    __tablename__ = "eval_results"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    run_id: Mapped[UUID] = mapped_column(
        ForeignKey("eval_runs.id", ondelete="CASCADE")
    )
    question: Mapped[str] = mapped_column(Text)
    ground_truth: Mapped[str] = mapped_column(Text)
    generated_answer: Mapped[str] = mapped_column(Text)
    retrieved_chunks: Mapped[list] = mapped_column(JSON)
    metrics: Mapped[dict] = mapped_column(JSON)
    latency_ms: Mapped[int] = mapped_column(Integer)
    tokens_used: Mapped[int] = mapped_column(Integer)
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    eval_run: Mapped["EvalRun"] = relationship(back_populates="eval_results")
