"""Async repository for all database CRUD operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database.models import Dataset, Document, EvalResult, EvalRun, TestCase


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

async def create_document(
    session: AsyncSession,
    filename: str,
    file_type: str,
    chunk_count: int,
    chunk_strategy: str,
    file_bytes: bytes = b"",
) -> Document:
    doc = Document(
        filename=filename,
        file_type=file_type,
        chunk_count=chunk_count,
        chunk_strategy=chunk_strategy,
        file_bytes=file_bytes,
    )
    session.add(doc)
    await session.flush()
    return doc


async def get_document(session: AsyncSession, document_id: UUID) -> Document | None:
    return await session.get(Document, document_id)


async def list_documents(session: AsyncSession) -> list[Document]:
    result = await session.execute(select(Document).order_by(Document.uploaded_at.desc()))
    return list(result.scalars().all())


async def delete_document(session: AsyncSession, document_id: UUID) -> bool:
    doc = await session.get(Document, document_id)
    if doc is None:
        return False
    await session.delete(doc)
    await session.flush()
    return True


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

async def create_dataset(
    session: AsyncSession,
    name: str,
    description: str | None,
    document_ids: list,
    items: list[dict],
) -> Dataset:
    dataset = Dataset(
        name=name,
        description=description,
        document_ids=document_ids,
    )
    session.add(dataset)
    await session.flush()

    for item in items:
        tc = TestCase(
            dataset_id=dataset.id,
            question=item["question"],
            ground_truth=item["ground_truth"],
        )
        session.add(tc)

    await session.flush()

    # Reload with test_cases relationship
    result = await session.execute(
        select(Dataset)
        .options(selectinload(Dataset.test_cases))
        .where(Dataset.id == dataset.id)
    )
    return result.scalar_one()


async def get_dataset(session: AsyncSession, dataset_id: UUID) -> Dataset | None:
    result = await session.execute(
        select(Dataset)
        .options(selectinload(Dataset.test_cases))
        .where(Dataset.id == dataset_id)
    )
    return result.scalar_one_or_none()


async def list_datasets(session: AsyncSession) -> list[Dataset]:
    result = await session.execute(
        select(Dataset)
        .options(selectinload(Dataset.test_cases))
        .order_by(Dataset.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_dataset(session: AsyncSession, dataset_id: UUID) -> bool:
    dataset = await session.get(Dataset, dataset_id)
    if dataset is None:
        return False
    await session.delete(dataset)
    await session.flush()
    return True


# ---------------------------------------------------------------------------
# Eval Runs
# ---------------------------------------------------------------------------

async def create_eval_run(
    session: AsyncSession,
    dataset_id: UUID,
    document_ids: list,
    config: dict,
    progress_total: int,
) -> EvalRun:
    run = EvalRun(
        dataset_id=dataset_id,
        document_ids=document_ids,
        config=config,
        progress_total=progress_total,
    )
    session.add(run)
    await session.flush()
    return run


async def get_eval_run(session: AsyncSession, run_id: UUID) -> EvalRun | None:
    result = await session.execute(
        select(EvalRun)
        .options(selectinload(EvalRun.eval_results))
        .where(EvalRun.id == run_id)
    )
    return result.scalar_one_or_none()


async def list_eval_runs(session: AsyncSession) -> list[EvalRun]:
    result = await session.execute(
        select(EvalRun).order_by(EvalRun.created_at.desc())
    )
    return list(result.scalars().all())


async def update_eval_run_progress(
    session: AsyncSession,
    run_id: UUID,
    progress_done: int,
) -> EvalRun | None:
    run = await session.get(EvalRun, run_id)
    if run is None:
        return None
    run.progress_done = progress_done
    await session.flush()
    return run


async def update_eval_run_complete(
    session: AsyncSession,
    run_id: UUID,
    status: str,
    metrics: dict,
    scoring_mode: str | None = None,
) -> EvalRun | None:
    run = await session.get(EvalRun, run_id)
    if run is None:
        return None
    run.status = status
    run.metrics = metrics
    if scoring_mode is not None:
        run.scoring_mode = scoring_mode
    await session.flush()
    return run


# ---------------------------------------------------------------------------
# Eval Results
# ---------------------------------------------------------------------------

async def create_eval_result(
    session: AsyncSession,
    run_id: UUID,
    question: str,
    ground_truth: str,
    generated_answer: str,
    retrieved_chunks: list,
    metrics: dict,
    latency_ms: int,
    tokens_used: int,
    passed: bool = True,
    failure_reason: str | None = None,
) -> EvalResult:
    result = EvalResult(
        run_id=run_id,
        question=question,
        ground_truth=ground_truth,
        generated_answer=generated_answer,
        retrieved_chunks=retrieved_chunks,
        metrics=metrics,
        latency_ms=latency_ms,
        tokens_used=tokens_used,
        passed=passed,
        failure_reason=failure_reason,
    )
    session.add(result)
    await session.flush()
    return result


async def get_eval_result_chunks(
    session: AsyncSession,
    run_id: UUID,
    result_id: UUID,
) -> list | None:
    """Return retrieved_chunks JSON for a single eval result, or None if not found."""
    result = await session.execute(
        select(EvalResult.retrieved_chunks).where(
            EvalResult.id == result_id,
            EvalResult.run_id == run_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return row
