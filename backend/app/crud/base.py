# backend/app/crud/base.py
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo import ReturnDocument
from pymongo.results import DeleteResult
import logging

logger = logging.getLogger(__name__)

# --- Define Type Variables for Pydantic Models ---
# ModelType: The Pydantic model representing the DB object (e.g., ClientInDB)
# CreateSchemaType: The Pydantic model for creating the object (e.g., ClientCreate)
# UpdateSchemaType: The Pydantic model for updating the object (e.g., ClientUpdate)
ModelType = TypeVar("ModelType", bound=BaseModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)
# -------------------------------------------------


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType], collection_name: str):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        **Parameters**

        * `model`: A Pydantic model (schema) class for the DB object.
        * `collection_name`: The name of the MongoDB collection.
        """
        self.model = model
        self.collection_name = collection_name

    def _get_collection(self, db: AsyncIOMotorDatabase) -> AsyncIOMotorCollection:
        """Internal helper to get the MongoDB collection."""
        return db[self.collection_name]

    async def get(
        self, db: AsyncIOMotorDatabase, *, id: UUID, user_id: str
    ) -> Optional[ModelType]:
        """Get a single object by ID, ensuring ownership."""
        collection = self._get_collection(db)
        logger.debug(
            f"CRUD ({self.model.__name__}): Fetching by ID {id} for user {user_id}"
        )
        doc = await collection.find_one({"_id": id, "user_id": user_id})
        if doc:
            return self.model(**doc)
        logger.debug(
            f"CRUD ({self.model.__name__}): ID {id} not found for user {user_id}"
        )
        return None

    async def get_multi_by_owner(
        self, db: AsyncIOMotorDatabase, *, user_id: str, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """Get multiple objects for user_id, with basic pagination."""
        # Note: Search logic is often entity-specific, so kept basic here.
        # Override this method in subclasses for custom search/filtering.
        collection = self._get_collection(db)
        query = {"user_id": user_id}
        logger.debug(
            f"CRUD ({self.model.__name__}): Fetching multiple for user {user_id}, skip: {skip}, limit: {limit}"
        )
        cursor = (
            collection.find(query).skip(skip).limit(limit).sort("_id", -1)
        )  # Default sort
        results = await cursor.to_list(length=limit)
        return [self.model(**doc) for doc in results]

    async def create(
        self, db: AsyncIOMotorDatabase, *, obj_in: CreateSchemaType, user_id: str
    ) -> ModelType:
        """Create a new object owned by user_id."""
        collection = self._get_collection(db)
        # Assume the ModelType includes user_id and generates _id
        # We need to ensure ModelType can be instantiated from CreateSchemaType + user_id
        obj_in_data = obj_in.model_dump()
        # Instantiate the *database* model type, which should handle defaults like ID
        db_obj = self.model(**obj_in_data, user_id=user_id)

        # Use model_dump(by_alias=True) for MongoDB field names like _id
        insert_data = db_obj.model_dump(by_alias=True)
        logger.info(
            f"CRUD ({self.model.__name__}): Attempting to create for user {user_id}"
        )
        result = await collection.insert_one(insert_data)

        # Fetch the created document to return the complete object
        created_doc = await collection.find_one({"_id": result.inserted_id})
        if created_doc:
            logger.info(
                f"CRUD ({self.model.__name__}): Created successfully with ID: {created_doc['_id']}"
            )
            return self.model(**created_doc)
        else:
            logger.error(
                f"CRUD ({self.model.__name__}): Failed to fetch object immediately after creation for user {user_id}"
            )
            raise Exception("Failed to retrieve object after creation")

    async def update(
        self,
        db: AsyncIOMotorDatabase,
        *,
        item_id: UUID,  # Use generic name
        user_id: str,
        obj_in: UpdateSchemaType,
    ) -> Optional[ModelType]:
        """Update an existing object, ensuring ownership."""
        collection = self._get_collection(db)
        update_data = obj_in.model_dump(
            exclude_unset=True
        )  # Get only fields that were set

        if not update_data:
            logger.warning(
                f"CRUD ({self.model.__name__}): Update called for {item_id} by user {user_id} with no data."
            )
            # Fetch and return existing if no update data
            existing_doc = await collection.find_one(
                {"_id": item_id, "user_id": user_id}
            )
            return self.model(**existing_doc) if existing_doc else None

        logger.info(
            f"CRUD ({self.model.__name__}): Attempting to update {item_id} for user {user_id}"
        )
        updated_doc = await collection.find_one_and_update(
            {"_id": item_id, "user_id": user_id},  # Filter by ID and owner
            {"$set": update_data},
            return_document=ReturnDocument.AFTER,
        )

        if updated_doc:
            logger.info(
                f"CRUD ({self.model.__name__}): {item_id} updated successfully."
            )
            return self.model(**updated_doc)
        else:
            logger.warning(
                f"CRUD ({self.model.__name__}): {item_id} not found for user {user_id} during update."
            )
            return None

    async def remove(self, db: AsyncIOMotorDatabase, *, id: UUID, user_id: str) -> bool:
        """Remove an object by ID, ensuring ownership."""
        collection = self._get_collection(db)
        logger.info(
            f"CRUD ({self.model.__name__}): Attempting to delete {id} for user {user_id}"
        )
        result: DeleteResult = await collection.delete_one(
            {"_id": id, "user_id": user_id}
        )
        if result.deleted_count == 1:
            logger.info(
                f"CRUD ({self.model.__name__}): Successfully deleted {id} for user {user_id}"
            )
            return True
        logger.warning(
            f"CRUD ({self.model.__name__}): {id} not found for user {user_id} or delete failed."
        )
        return False
