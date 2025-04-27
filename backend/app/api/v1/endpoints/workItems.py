# backend/app/api/v1/endpoints/workItems.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import List, Optional, Annotated
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api import deps
from app.models.workItem import (
    WorkItem,
    WorkItemCreate,
    WorkItemUpdate,
)  # Use Project models
from app.crud.crud_workItem import crud_workItem
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Use Annotated dependencies from deps.py
CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
Database = Annotated[AsyncIOMotorDatabase, Depends(deps.get_db)]


@router.post("/", response_model=WorkItem, status_code=status.HTTP_201_CREATED)
async def create_workItem_endpoint(
    *, workItem_in: WorkItemCreate, db: Database, current_user: CurrentUser
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    # TODO: Add validation - check if client_id exists and belongs to this user?
    logger.info(f"User {user_id} creating WorkItem: {workItem_in.name}")
    try:
        created_workItem = await crud_workItem.create(
            db=db, obj_in=workItem_in, user_id=user_id
        )
        return created_workItem
    except Exception as e:
        logger.error(
            f"Failed to create workItem for user {user_id}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Work Item creation failed.")


@router.get("/", response_model=List[dict])  # Or keep as dict for now
async def read_workItems_endpoint(
    *,
    db: Database,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    project_id: Optional[UUID] = Query(None),  # Filter by client
):
    """Retrieve workItems for the current user."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(
        f"User {user_id} fetching workItems. Skip: {skip}, Limit: {limit}, Search: '{search}', ProjectID: {project_id}"
    )
    workItems_with_clients = await crud_workItem.get_multi_with_project_info(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=limit,
        search=search,
        project_id=project_id,
    )
    return workItems_with_clients


@router.get("/{workItem_id}", response_model=WorkItem)
async def read_workItem_by_id_endpoint(
    *, workItem_id: UUID, db: Database, current_user: CurrentUser
):
    """Get a specific workItem by ID."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(f"User {user_id} fetching workItem ID: {workItem_id}")
    workItem = await crud_workItem.get(db=db, id=workItem_id, user_id=user_id)
    if not workItem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return workItem


@router.put("/{workItem_id}", response_model=WorkItem)
async def update_workItem_endpoint(
    *,
    workItem_id: UUID,
    workItem_in: Annotated[WorkItemUpdate, Body()],
    db: Database,
    current_user: CurrentUser,
):
    """Update a workItem."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    # TODO: Add validation if client_id is updated - check ownership?
    logger.info(f"User {user_id} updating workItem ID: {workItem_id}")
    updated_workItem = await crud_workItem.update(
        db=db, item_id=workItem_id, user_id=user_id, obj_in=workItem_in
    )
    if updated_workItem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or update failed",
        )
    return updated_workItem


@router.delete("/{workItem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workItem_endpoint(
    *, workItem_id: UUID, db: Database, current_user: CurrentUser
):
    """Delete a workItem."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )
    logger.info(f"User {user_id} deleting workItem ID: {workItem_id}")
    # TODO: Consider implications - delete associated time entries? Or just archive?
    deleted = await crud_workItem.remove(db=db, id=workItem_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return None
