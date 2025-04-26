# backend/app/api/v1/endpoints/clients.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import List, Optional, Annotated
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api import deps
from app.models.client import Client, ClientCreate, ClientUpdate  # Use correct schemas
from app.crud import crud_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependency for getting current user payload
CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
# Dependency for getting DB connection
Database = Annotated[AsyncIOMotorDatabase, Depends(deps.get_db)]


@router.post(
    "/",
    response_model=Client,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new client",
    response_description="The created client",
)
async def create_client_endpoint(
    *, client_in: ClientCreate, db: Database, current_user: CurrentUser
):
    """
    Create a new client record associated with the current authenticated user.
    Requires client details in the request body.
    """
    user_id = current_user.get("sub")
    if not user_id:
        # This should ideally be caught by the dependency itself, but good practice
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate user credentials",
        )

    try:
        logger.info(f"User {user_id} attempting to create client: {client_in.name}")
        created_client = await crud_client.create(
            db=db, obj_in=client_in, user_id=user_id
        )
        return created_client
    except Exception as e:
        logger.error(f"Failed to create client for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Client creation failed.",
        )


@router.get(
    "/",
    response_model=List[Client],
    summary="Retrieve clients for the current user",
    response_description="A list of clients",
)
async def read_clients_endpoint(
    *,
    db: Database,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(
        100, ge=1, le=500, description="Maximum number of records to return"
    ),
    search: Optional[str] = Query(
        None, description="Search term for clients (name, email, etc.)"
    ),
):
    """
    Retrieve a list of clients associated with the current user. Supports pagination and search.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate user credentials",
        )

    logger.info(
        f"User {user_id} fetching clients. Skip: {skip}, Limit: {limit}, Search: '{search}'"
    )
    clients = await crud_client.get_multi_by_owner(
        db=db, user_id=user_id, skip=skip, limit=limit, search=search
    )
    return clients


@router.get(
    "/{client_id}",
    response_model=Client,
    summary="Get a specific client by ID",
    response_description="The requested client",
)
async def read_client_by_id_endpoint(
    *,
    client_id: UUID,  # Use UUID type hint for automatic validation
    db: Database,
    current_user: CurrentUser,
):
    """
    Retrieve details for a specific client by its unique ID. Ensures the client belongs to the current user.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate user credentials",
        )

    logger.info(f"User {user_id} fetching client with ID: {client_id}")
    client = await crud_client.get(db=db, id=client_id, user_id=user_id)
    if not client:
        logger.warning(f"Client {client_id} not found for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client


@router.put(
    "/{client_id}",
    response_model=Client,
    summary="Update an existing client",
    response_description="The updated client",
)
async def update_client_endpoint(
    *,
    client_id: UUID,
    # Use Annotated for explicit Body dependency with Pydantic v2
    client_in: Annotated[ClientUpdate, Body()],
    db: Database,
    current_user: CurrentUser,
):
    """
    Update an existing client record. Requires the client ID in the path and
    updated client details (partial updates allowed) in the request body.
    Ensures the client belongs to the current user.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate user credentials",
        )

    logger.info(f"User {user_id} attempting to update client ID: {client_id}")

    # The crud update function now handles the check for existence and returns None if not found/owned
    updated_client = await crud_client.update(
        db=db, client_id=client_id, user_id=user_id, obj_in=client_in
    )

    if updated_client is None:
        # This means the client wasn't found for this user OR the update failed unexpectedly
        logger.warning(
            f"Update failed or client {client_id} not found for user {user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found or update failed",
        )

    return updated_client


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a client",
    response_description="No content on successful deletion",
)
async def delete_client_endpoint(
    *, client_id: UUID, db: Database, current_user: CurrentUser
):
    """
    Delete a specific client record by its unique ID. Ensures the client belongs to the current user.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate user credentials",
        )

    logger.info(f"User {user_id} attempting to delete client ID: {client_id}")
    deleted = await crud_client.remove(db=db, id=client_id, user_id=user_id)

    if not deleted:
        logger.warning(
            f"Delete failed, client {client_id} not found for user {user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

    # No return value needed for 204
    return None
