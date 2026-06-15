"""Evaluation run endpoints."""

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from api.dependencies import get_eval_runner
from api.schemas import (
    EvalCompareResponse,
    EvalResultResponse,
    EvalRunProgress,
    EvalRunRequest,
    EvalRunResponse,
    SourceInfo,
)
from config import get_pipeline_config
from database import repository as repo
from database.models import EvalRun
from database.session import get_db, async_session as async_session_factory
from evaluation.comparison import compare_runs
from evaluation.runner import EvalRunner
from exceptions import DatasetNotFoundError, EvalResultNotFoundError, EvalRunNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/eval", tags=["Evaluation"])


def _run_to_response(
    run,
    *,
    include_results: bool = False,
    include_progress: bool = False,
    dataset_name: str | None = None,
    question_count: int | None = None,
    pass_count: int | None = None,
) -> EvalRunResponse:
    """Convert an EvalRun ORM object to a response schema."""
    results = None
    if include_results and hasattr(run, "eval_results") and run.eval_results:
        results = [
            EvalResultResponse(
                id=str(r.id),
                question=r.question,
                ground_truth=r.ground_truth,
                generated_answer=r.generated_answer,
                retrieved_chunks=r.retrieved_chunks,
                metrics=r.metrics,
                latency_ms=r.latency_ms,
                tokens_used=r.tokens_used,
                passed=r.passed,
                failure_reason=r.failure_reason,
            )
            for r in run.eval_results
        ]

    progress = None
    if include_progress and run.status == "running":
        progress = EvalRunProgress(
            completed=run.progress_done,
            total=run.progress_total,
        )

    # Resolve dataset_name from relationship if available
    ds_name = dataset_name
    if ds_name is None and hasattr(run, "dataset") and run.dataset is not None:
        ds_name = run.dataset.name

    return EvalRunResponse(
        id=str(run.id),
        name=getattr(run, "name", None),
        status=run.status,
        dataset_id=str(run.dataset_id),
        dataset_name=ds_name,
        document_ids=run.document_ids or [],
        config=run.config or {},
        metrics=run.metrics,
        scoring_mode=getattr(run, "scoring_mode", None),
        progress=progress,
        results=results,
        question_count=question_count,
        pass_count=pass_count,
        created_at=run.created_at,
    )


@router.post("/run", status_code=202, response_model=EvalRunResponse)
async def start_eval_run(
    body: EvalRunRequest,
    session: AsyncSession = Depends(get_db),
    eval_runner: EvalRunner = Depends(get_eval_runner),
):
    """Start an evaluation run (async background task)."""
    dataset = await repo.get_dataset(session, UUID(body.dataset_id))
    if dataset is None:
        raise DatasetNotFoundError()

    # Use dataset's document_ids if none provided
    document_ids = body.document_ids or dataset.document_ids or []

    # Snapshot current pipeline config
    config = get_pipeline_config()
    config_snapshot = config.model_dump()

    total_questions = len(dataset.test_cases) if dataset.test_cases else 0

    # Create the eval run record
    run = await repo.create_eval_run(
        session,
        dataset_id=UUID(body.dataset_id),
        document_ids=document_ids,
        config=config_snapshot,
        progress_total=total_questions,
        name=body.name or None,
        project_id=UUID(body.project_id) if body.project_id else None,
    )

    # Flush to ensure the run is persisted before the background task starts
    await session.commit()

    # Launch background task
    asyncio.create_task(
        eval_runner.run(
            run_id=str(run.id),
            dataset_id=body.dataset_id,
            document_ids=document_ids,
            session_factory=async_session_factory,
        )
    )

    return _run_to_response(
        run,
        dataset_name=dataset.name,
    )


@router.get("/runs", response_model=list[EvalRunResponse])
async def list_eval_runs(
    project_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
):
    """List evaluation runs, optionally filtered by project."""
    from sqlalchemy import and_
    filters = []
    if project_id:
        filters.append(EvalRun.project_id == UUID(project_id))
    result = await session.execute(
        select(EvalRun)
        .options(
            selectinload(EvalRun.eval_results),
            selectinload(EvalRun.dataset),
        )
        .where(*filters)
        .order_by(EvalRun.created_at.desc())
    )
    runs = list(result.scalars().all())

    responses = []
    for run in runs:
        q_count = len(run.eval_results) if run.eval_results else None
        p_count = (
            sum(1 for r in run.eval_results if r.passed)
            if run.eval_results
            else None
        )
        responses.append(
            _run_to_response(
                run,
                question_count=q_count,
                pass_count=p_count,
            )
        )
    return responses


@router.get("/runs/{run_id}", response_model=EvalRunResponse)
async def get_eval_run(
    run_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get a single evaluation run. Includes results if completed, progress if running."""
    run = await repo.get_eval_run(session, UUID(run_id))
    if run is None:
        raise EvalRunNotFoundError()

    # Eagerly load the dataset for the name
    result = await session.execute(
        select(EvalRun)
        .options(
            selectinload(EvalRun.eval_results),
            selectinload(EvalRun.dataset),
        )
        .where(EvalRun.id == UUID(run_id))
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise EvalRunNotFoundError()

    is_completed = run.status == "completed"
    q_count = len(run.eval_results) if run.eval_results else None
    p_count = (
        sum(1 for r in run.eval_results if r.passed)
        if run.eval_results
        else None
    )

    return _run_to_response(
        run,
        include_results=is_completed,
        include_progress=not is_completed,
        question_count=q_count,
        pass_count=p_count,
    )


@router.get("/compare", response_model=EvalCompareResponse)
async def compare_eval_runs(
    run_a: str = Query(...),
    run_b: str = Query(...),
    session: AsyncSession = Depends(get_db),
):
    """Compare two evaluation runs."""
    # Load both runs with dataset relationship
    result_a = await session.execute(
        select(EvalRun)
        .options(selectinload(EvalRun.dataset))
        .where(EvalRun.id == UUID(run_a))
    )
    eval_run_a = result_a.scalar_one_or_none()
    if eval_run_a is None:
        raise EvalRunNotFoundError(f"Evaluation run {run_a} not found")

    result_b = await session.execute(
        select(EvalRun)
        .options(selectinload(EvalRun.dataset))
        .where(EvalRun.id == UUID(run_b))
    )
    eval_run_b = result_b.scalar_one_or_none()
    if eval_run_b is None:
        raise EvalRunNotFoundError(f"Evaluation run {run_b} not found")

    run_a_dict = {
        "id": str(eval_run_a.id),
        "dataset_name": eval_run_a.dataset.name if eval_run_a.dataset else "",
        "config": eval_run_a.config or {},
        "metrics": eval_run_a.metrics or {},
    }
    run_b_dict = {
        "id": str(eval_run_b.id),
        "dataset_name": eval_run_b.dataset.name if eval_run_b.dataset else "",
        "config": eval_run_b.config or {},
        "metrics": eval_run_b.metrics or {},
    }

    comparison = compare_runs(run_a_dict, run_b_dict)

    return EvalCompareResponse(**comparison)


@router.get(
    "/runs/{run_id}/results/{result_id}/chunks",
    response_model=list[SourceInfo],
)
async def get_eval_result_chunks(
    run_id: str,
    result_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get retrieved chunks for a single evaluation result."""
    chunks = await repo.get_eval_result_chunks(
        session, UUID(run_id), UUID(result_id)
    )
    if chunks is None:
        raise EvalResultNotFoundError()
    return chunks
