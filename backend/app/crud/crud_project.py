# backend/app/crud/crud_project.py
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.crud.base import CRUDBase
from app.models.project import ProjectCreate, ProjectUpdate, ProjectInDB

from app.models.client import Client  # Import Client model for embedding shape

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

    async def get_multi_with_client_info(  # New method or modify existing one
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        client_id: Optional[UUID] = None,
        # ) -> List[ProjectWithClientName]: # Return type depends on chosen model
    ) -> List[dict]:  # Return list of dicts initially for flexibility
        collection = self._get_collection(db)
        pipeline = []

        # --- Stage 1: Match projects for the user (and optionally client_id) ---
        match_stage = {"$match": {"user_id": user_id}}
        if client_id:
            match_stage["$match"]["client_id"] = client_id
        pipeline.append(match_stage)

        # --- Stage 2: Optional Search (before or after lookup) ---
        # Searching on project fields is easier before lookup
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append(
                {
                    "$match": {
                        "$or": [
                            {"name": search_regex},
                            {"description": search_regex},
                        ]
                    }
                }
            )

        # --- Stage 3: Lookup Client Information ---
        pipeline.append(
            {
                "$lookup": {
                    "from": "clients",  # The collection to join with
                    "localField": "client_id",  # Field from the projects collection
                    "foreignField": "_id",  # Field from the clients collection (make sure clients use UUID for _id)
                    "as": "client_info",  # Name of the new array field to add
                }
            }
        )

        # --- Stage 4: Unwind the client_info array ---
        # $lookup returns an array, even if only one match. Unwind makes it an object.
        # Use preserveNullAndEmptyArrays if a project might not have a matching client (shouldn't happen if client_id is required)
        pipeline.append(
            {
                "$unwind": {
                    "path": "$client_info",
                    "preserveNullAndEmptyArrays": True,  # Keep project even if client is missing (handle in code)
                }
            }
        )

        # --- Stage 5: Optional Search on Client Name (after lookup) ---
        if search:  # Example if searching client name too
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append({"$match": {"client_info.name": search_regex}})

        # --- Stage 6: Project Fields (Shape the output) ---
        # Select fields you want to return. Add client name.
        # This replaces parsing with Pydantic model directly, as aggregation changes structure
        project_stage = {
            "$project": {
                # Project fields (use 1 to include)
                "_id": 1,  # Or map id: "$_id" if needed by Pydantic later
                "user_id": 1,
                "name": 1,
                "client_id": 1,
                "description": 1,
                "status": 1,
                "rates": 1,
                "created_at": 1,
                "updated_at": 1,
                # Add client name from the lookup result
                "client_name": "$client_info.name",
                # Optionally include full client object instead/as well:
                # "client": "$client_info"
            }
        }
        pipeline.append(project_stage)

        # --- Stage 7: Sorting, Skipping, Limiting ---
        pipeline.append({"$sort": {"name": 1}})  # Sort after shaping
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})

        logger.debug(f"CRUDProject Aggregation Pipeline: {pipeline}")

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=limit)
        logger.info(
            f"CRUDProject Aggregation: Found {len(results)} projects for user {user_id}"
        )

        # --- Return list of dicts ---
        # Frontend will use this structure directly or you can parse into ProjectWithClientName here
        return results


# Instantiate the specific CRUD class for Projects
crud_project = CRUDProject(ProjectInDB, collection_name="projects")
