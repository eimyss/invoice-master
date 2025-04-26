from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase

# Import your dependencies, models, and CRUD functions
from app.api import deps
from app.models.client import Client, ClientCreate, ClientUpdate, ClientInDB
from app.crud import crud_client

router = APIRouter()


@router.post("/", response_model=Client, status_code=status.HTTP_201_CREATED)
async def create_client(
    *,
    client_in: ClientCreate,
    db: AsyncIOMotorDatabase = Depends(deps.get_db),
    current_user: dict = Depends(deps.get_current_active_user),  # Get user payload
):
    """
    Create a new client for the current user.
    """
    user_id = current_user.get("sub")  # Get user ID from token payload
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")

    try:
        created_client = await crud_client.create(
            db=db, obj_in=client_in, user_id=user_id
        )
        return created_client
    except Exception as e:
        # Log the exception e
        raise HTTPException(status_code=500, detail="Client creation failed.")


@router.get("/", response_model=List[Client])
async def read_clients(
    *,
    db: AsyncIOMotorDatabase = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(
        None, description="Search clients by name, email, VAT ID"
    ),
    current_user: dict = Depends(deps.get_current_active_user),
):
    """
    Retrieve clients for the current user with optional search.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")

    clients = await crud_client.get_multi_by_owner(
        db=db, user_id=user_id, skip=skip, limit=limit, search=search
    )
    return clients


@router.get("/{client_id}", response_model=Client)
async def read_client_by_id(
    *,
    client_id: UUID,
    db: AsyncIOMotorDatabase = Depends(deps.get_db),
    current_user: dict = Depends(deps.get_current_active_user),
):
    """
    Get a specific client by ID.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")

    client = await crud_client.get(db=db, id=client_id, user_id=user_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client


@router.put("/{client_id}", response_model=Client)
async def update_client(
    *,
    client_id: UUID,
    client_in: ClientUpdate,
    db: AsyncIOMotorDatabase = Depends(deps.get_db),
    current_user: dict = Depends(deps.get_current_active_user),
):
    """
    Update a client.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")

    # First, check if the client exists and belongs to the user
    db_client = await crud_client.get(db=db, id=client_id, user_id=user_id)
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

    # Perform the update
    updated_client = await crud_client.update(db=db, db_obj=db_client, obj_in=client_in)
    if updated_client is None:
        # This might happen if the update operation itself fails unexpectedly
        raise HTTPException(status_code=500, detail="Client update failed.")
    return updated_client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    *,
    client_id: UUID,
    db: AsyncIOMotorDatabase = Depends(deps.get_db),
    current_user: dict = Depends(deps.get_current_active_user),
):
    """
    Delete a client.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")

    # Check existence first (optional, delete can handle non-existence)
    # db_client = await crud_client.get(db=db, id=client_id, user_id=user_id)
    # if not db_client:
    #     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    deleted = await crud_client.remove(db=db, id=client_id, user_id=user_id)
    if not deleted:
        # Raise 404 if the client wasn't found for this user
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

    return None  # Return None for 204 response
