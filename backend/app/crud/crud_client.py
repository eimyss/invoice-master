from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
import logging

# Import your models (adjust path if needed)
from app.models.client import ClientCreate, ClientUpdate, ClientInDB

logger = logging.getLogger(__name__)

# Placeholder for the database collection
COLLECTION_NAME = "clients"


def get_collection(db: AsyncIOMotorDatabase) -> AsyncIOMotorCollection:
    """Gets the MongoDB collection."""
    return db[COLLECTION_NAME]


async def create(
    db: AsyncIOMotorDatabase, *, obj_in: ClientCreate, user_id: str
) -> ClientInDB:
    """Create a new client in the database."""
    collection = get_collection(db)
    client_data = obj_in.dict()
    db_obj = ClientInDB(
        **client_data, user_id=user_id
    )  # Create DB model instance, assigns ID
    logger.info(f"Creating client '{db_obj.name}' for user {user_id}")
    # Insert into MongoDB
    result = await collection.insert_one(
        db_obj.dict(by_alias=True)
    )  # Use alias for _id
    # Fetch the created document to return it (optional, but good practice)
    created_client = await collection.find_one({"_id": result.inserted_id})
    if created_client:
        logger.info(f"Client created with ID: {created_client['_id']}")
        return ClientInDB(**created_client)
    else:
        # This should ideally not happen if insert succeeds
        logger.error("Failed to fetch client after creation.")
        raise Exception("Client creation failed unexpectedly")


async def get(
    db: AsyncIOMotorDatabase, *, id: UUID, user_id: str
) -> Optional[ClientInDB]:
    """Get a single client by ID, ensuring ownership."""
    collection = get_collection(db)
    logger.debug(f"Fetching client with ID {id} for user {user_id}")
    doc = await collection.find_one({"_id": id, "user_id": user_id})
    if doc:
        return ClientInDB(**doc)
    logger.warning(f"Client with ID {id} not found for user {user_id}")
    return None


async def get_multi_by_owner(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
) -> List[ClientInDB]:
    """Get multiple clients belonging to a specific user, with optional search."""
    collection = get_collection(db)
    query = {"user_id": user_id}
    if search:
        # Basic search implementation (case-insensitive) - adjust as needed
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"email": search_regex},
            {"vat_id": search_regex},
            # Add other searchable fields here
        ]

    logger.debug(
        f"Fetching clients for user {user_id} with query: {query}, skip: {skip}, limit: {limit}"
    )
    cursor = (
        collection.find(query).skip(skip).limit(limit).sort("name", 1)
    )  # Sort by name
    results = await cursor.to_list(length=limit)
    logger.info(f"Found {len(results)} clients for user {user_id}")
    return [ClientInDB(**doc) for doc in results]


async def update(
    db: AsyncIOMotorDatabase, *, db_obj: ClientInDB, obj_in: ClientUpdate
) -> Optional[ClientInDB]:
    """Update an existing client."""
    collection = get_collection(db)
    update_data = obj_in.dict(exclude_unset=True)  # Get only fields that were set

    if not update_data:
        logger.warning(f"Update called for client {db_obj.id} with no data.")
        return db_obj  # No changes, return original

    logger.info(f"Updating client {db_obj.id} with data: {update_data}")
    result = await collection.update_one(
        {
            "_id": db_obj.id,
            "user_id": db_obj.user_id,
        },  # Ensure we update the correct user's client
        {"$set": update_data},
    )

    if result.modified_count == 1:
        # Fetch the updated document to return it
        updated_doc = await collection.find_one({"_id": db_obj.id})
        if updated_doc:
            return ClientInDB(**updated_doc)
    elif result.matched_count == 1:
        logger.warning(
            f"Client {db_obj.id} matched but not modified (data might be the same)."
        )
        return db_obj  # Return original if no modification occurred
    else:
        logger.error(f"Client {db_obj.id} not found or update failed.")
        return None  # Indicate failure


async def remove(db: AsyncIOMotorDatabase, *, id: UUID, user_id: str) -> bool:
    """Remove a client by ID, ensuring ownership."""
    collection = get_collection(db)
    logger.info(f"Attempting to delete client {id} for user {user_id}")
    result = await collection.delete_one({"_id": id, "user_id": user_id})
    if result.deleted_count == 1:
        logger.info(f"Successfully deleted client {id}")
        return True
    logger.warning(f"Client {id} not found for user {user_id} or delete failed.")
    return False
