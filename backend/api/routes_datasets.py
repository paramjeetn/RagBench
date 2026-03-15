"""Dataset management endpoints."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    DatasetCreateRequest,
    DatasetDetailResponse,
    DatasetSummaryResponse,
    TestCaseResponse,
)
from database import repository as repo
from database.session import get_db
from exceptions import DatasetNotFoundError

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


def _dataset_to_summary(dataset) -> DatasetSummaryResponse:
    """Convert a Dataset ORM object to a summary response."""
    return DatasetSummaryResponse(
        id=str(dataset.id),
        name=dataset.name,
        description=dataset.description,
        document_ids=dataset.document_ids or [],
        item_count=len(dataset.test_cases) if dataset.test_cases else 0,
        created_at=dataset.created_at,
    )


def _dataset_to_detail(dataset) -> DatasetDetailResponse:
    """Convert a Dataset ORM object to a detail response with QA pairs."""
    items = [
        TestCaseResponse(
            id=str(tc.id),
            question=tc.question,
            ground_truth=tc.ground_truth,
        )
        for tc in (dataset.test_cases or [])
    ]
    return DatasetDetailResponse(
        id=str(dataset.id),
        name=dataset.name,
        description=dataset.description,
        document_ids=dataset.document_ids or [],
        items=items,
        created_at=dataset.created_at,
    )


@router.post("/", status_code=201, response_model=DatasetSummaryResponse)
async def create_dataset(
    body: DatasetCreateRequest,
    session: AsyncSession = Depends(get_db),
):
    """Create a new test dataset with QA pairs."""
    items = [item.model_dump() for item in body.items]
    dataset = await repo.create_dataset(
        session,
        name=body.name,
        description=body.description,
        document_ids=body.document_ids,
        items=items,
    )
    return _dataset_to_summary(dataset)


@router.post("/upload", status_code=201, response_model=DatasetSummaryResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    document_ids: str = Form(...),
    session: AsyncSession = Depends(get_db),
):
    """Upload a test dataset from a JSON file.

    The JSON file should contain a list of objects with 'question' and
    'ground_truth' fields. ``document_ids`` is passed as a JSON-encoded
    string in the form data.
    """
    file_bytes = await file.read()
    items_raw = json.loads(file_bytes)
    doc_ids = json.loads(document_ids)

    items = [
        {"question": item["question"], "ground_truth": item["ground_truth"]}
        for item in items_raw
    ]

    dataset = await repo.create_dataset(
        session,
        name=name,
        description=None,
        document_ids=doc_ids,
        items=items,
    )
    return _dataset_to_summary(dataset)


@router.get("/", response_model=list[DatasetSummaryResponse])
async def list_datasets(
    session: AsyncSession = Depends(get_db),
):
    """List all test datasets."""
    datasets = await repo.list_datasets(session)
    return [_dataset_to_summary(ds) for ds in datasets]


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset(
    dataset_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Get a dataset with all QA pairs."""
    dataset = await repo.get_dataset(session, UUID(dataset_id))
    if dataset is None:
        raise DatasetNotFoundError()
    return _dataset_to_detail(dataset)


@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Delete a test dataset."""
    deleted = await repo.delete_dataset(session, UUID(dataset_id))
    if not deleted:
        raise DatasetNotFoundError()
    return Response(status_code=204)
