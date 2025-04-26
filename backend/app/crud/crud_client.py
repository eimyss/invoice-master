# backend/app/crud/crud_client.py
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.crud.base import CRUDBase  # Import the base class
from app.models.client import (
    ClientCreate,
    ClientUpdate,
    ClientInDB,
)  # Import specific models

logger = logging.getLogger(__name__)


class CRUDClient(CRUDBase[ClientInDB, ClientCreate, ClientUpdate]):
    # Override methods here if specific logic is needed, e.g., complex search
    async def get_multi_by_owner(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
    ) -> List[ClientInDB]:
        """Get multiple clients for user_id, with client-specific search."""
        collection = self._get_collection(db)
        query = {"user_id": user_id}
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            # Client-specific search fields
            query["$or"] = [
                {"name": search_regex},
                {"email": search_regex},
                {"vat_id": search_regex},
                {"contact_person": search_regex},
                {"address_city": search_regex},
            ]
        logger.debug(
            f"CRUDClient: Fetching clients for user {user_id} with query: {query}, skip: {skip}, limit: {limit}"
        )
        cursor = collection.find(query).sort("name", 1).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)
        logger.info(
            f"CRUDClient: Found {len(results)} clients for user {user_id} matching criteria."
        )
        # Ensure results are parsed back into the correct Pydantic model
        return [self.model(**doc) for doc in results]


# Instantiate the specific CRUD class
# The collection name 'clients' is passed here
crud_client = CRUDClient(ClientInDB, collection_name="clients")
