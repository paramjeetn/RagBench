"""Project management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import ProjectCreateRequest, ProjectResponse
from database import repository as repo
from database.session import get_db
from exceptions import ProjectNotFoundError

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def _project_to_response(project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


@router.post("/", status_code=201, response_model=ProjectResponse)
async def create_project(
    body: ProjectCreateRequest,
    session: AsyncSession = Depends(get_db),
):
    """Create a new project workspace."""
    project = await repo.create_project(session, name=body.name, description=body.description)
    await session.commit()
    return _project_to_response(project)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(session: AsyncSession = Depends(get_db)):
    """List all projects."""
    projects = await repo.list_projects(session)
    return [_project_to_response(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, session: AsyncSession = Depends(get_db)):
    """Get a single project by ID."""
    project = await repo.get_project(session, UUID(project_id))
    if project is None:
        raise ProjectNotFoundError()
    return _project_to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, session: AsyncSession = Depends(get_db)):
    """Delete a project (documents/datasets/runs are unlinked, not deleted)."""
    deleted = await repo.delete_project(session, UUID(project_id))
    if not deleted:
        raise ProjectNotFoundError()
    await session.commit()
    return Response(status_code=204)
