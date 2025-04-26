# backend/app/crud/crud_project.py
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.crud.base import CRUDBase
from app.models.project import ProjectCreate, ProjectUpdate, ProjectInDB

logger = logging.getLogger(__name__)


class CRUDProject(CRUDBase[ProjectInDB, ProjectCreate, ProjectUpdate]):
    # Override get_multi_by_owner for project-specific search if needed
    async def get_multi_by_owner(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        client_id: Optional[UUID] = None,  # Add client_id filter
    ) -> List[ProjectInDB]:
        """Get multiple projects for user_id, with optional search and client filter."""
        collection = self._get_collection(db)
        query = {"user_id": user_id}
        if client_id:  # Filter by client ID if provided
            query["client_id"] = client_id
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            # Project-specific search fields
            query["$or"] = [
                {"name": search_regex},
                {"description": search_regex},
                # Maybe search client name via $lookup later if needed
            ]
        logger.debug(
            f"CRUDProject: Fetching projects for user {user_id} with query: {query}, skip: {skip}, limit: {limit}"
        )
        cursor = collection.find(query).sort("name", 1).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)
        logger.info(
            f"CRUDProject: Found {len(results)} projects for user {user_id} matching criteria."
        )
        return [self.model(**doc) for doc in results]

    # You might add other project-specific CRUD methods here,
    # e.g., find_projects_by_status, add_rate_to_project, etc.


# Instantiate the specific CRUD class for Projects
crud_project = CRUDProject(ProjectInDB, collection_name="projects")
