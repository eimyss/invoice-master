# backend/app/api/v1/endpoints/projects.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import List, Optional, Annotated
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api import deps
from app.models.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
)  # Use Project models
from app.crud.crud_project import crud_project
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Use Annotated dependencies from deps.py
CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
Database = Annotated[AsyncIOMotorDatabase, Depends(deps.get_db)]


@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    *, project_in: ProjectCreate, db: Database, current_user: CurrentUser
):
    """Create a new project."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    # TODO: Add validation - check if client_id exists and belongs to this user?
    logger.info(f"User {user_id} creating project: {project_in.name}")
    try:
        created_project = await crud_project.create(
            db=db, obj_in=project_in, user_id=user_id
        )
        return created_project
    except Exception as e:
        logger.error(f"Failed to create project for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Project creation failed.")


@router.get("/", response_model=List[dict])  # Or keep as dict for now
async def read_projects_endpoint(
    *,
    db: Database,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    client_id: Optional[UUID] = Query(None),  # Filter by client
):
    """Retrieve projects for the current user."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(
        f"User {user_id} fetching projects. Skip: {skip}, Limit: {limit}, Search: '{search}', ClientID: {client_id}"
    )
    projects_with_clients = await crud_project.get_multi_with_client_info(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=limit,
        search=search,
        client_id=client_id,
    )
    return projects_with_clients


@router.get("/{project_id}", response_model=Project)
async def read_project_by_id_endpoint(
    *, project_id: UUID, db: Database, current_user: CurrentUser
):
    """Get a specific project by ID."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(f"User {user_id} fetching project ID: {project_id}")
    project = await crud_project.get(db=db, id=project_id, user_id=user_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


@router.put("/{project_id}", response_model=Project)
async def update_project_endpoint(
    *,
    project_id: UUID,
    project_in: Annotated[ProjectUpdate, Body()],
    db: Database,
    current_user: CurrentUser,
):
    """Update a project."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    # TODO: Add validation if client_id is updated - check ownership?
    logger.info(f"User {user_id} updating project ID: {project_id}")
    updated_project = await crud_project.update(
        db=db, item_id=project_id, user_id=user_id, obj_in=project_in
    )
    if updated_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or update failed",
        )
    return updated_project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_endpoint(
    *, project_id: UUID, db: Database, current_user: CurrentUser
):
    """Delete a project."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(f"User {user_id} deleting project ID: {project_id}")
    # TODO: Consider implications - delete associated time entries? Or just archive?
    deleted = await crud_project.remove(db=db, id=project_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return None
