# backend/app/crud/crud_project.py
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
from datetime import datetime
from app.crud.base import CRUDBase
from app.models.workItem import (
    WorkItemCreate,
    WorkItemUpdate,
    WorkItemInDB,
    WorkItemWithProjectName,
)
from app.models.client import Client  # Import Client model for embedding shape

logger = logging.getLogger(__name__)


class CRUDWorkItem(CRUDBase[WorkItemInDB, WorkItemCreate, WorkItemUpdate]):
    # Override get_multi_by_owner for Workitem-specific search if needed
    async def get_multi_by_owner(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        project_id: Optional[UUID] = None,  # Add client_id filter
    ) -> List[WorkItemInDB]:
        """Get multiple projects for user_id, with optional search and client filter."""
        collection = self._get_collection(db)
        query = {"user_id": user_id}
        if project_id:  # Filter by client ID if provided
            query["project_id"] = project_id
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
        logger.info(f"results is: {results}")

        try:
            import json

            log_output = json.dumps(
                results[:5], indent=2, default=str
            )  # Use default=str for non-serializable types like UUID/datetime
            logger.info(log_output)
            if len(results) > 5:
                logger.info("... (results truncated for logging)")
        except Exception as log_e:
            logger.error(f"Could not serialize results for logging: {log_e}")
            logger.info(f"Raw results list (might be large): {results}")
        return [self.model(**doc) for doc in results]

    # You might add other project-specific CRUD methods here,
    # e.g., find_projects_by_status, add_rate_to_project, etc.

    async def get_multi_with_project_info(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,  # Search might apply to time entry description
        project_id: Optional[UUID] = None,  # Filter by specific project
        invoice_id: Optional[UUID] = None,  # Filter by invoice
        is_invoiced: Optional[bool] = None,  # Filter by invoiced status
        date_from: Optional[datetime] = None,  # Date range filters
        date_to: Optional[datetime] = None,
        # ) -> List[TimeEntryWithProjectInfo]: # Example specific return type
    ) -> List[dict]:  # Return list of dicts for flexibility
        collection = self._get_collection(db)  # Should be db["time_entries"]
        pipeline = []

        # --- Stage 1: Match Time Entries ---
        match_conditions = {"user_id": user_id}
        if project_id:
            match_conditions["project_id"] = project_id
        if invoice_id:
            match_conditions["invoice_id"] = invoice_id
        if is_invoiced is True:
            match_conditions["invoice_id"] = {"$ne": None}  # Has an invoice_id
        elif is_invoiced is False:
            match_conditions["invoice_id"] = None  # Does not have invoice_id
        if date_from or date_to:
            match_conditions["date"] = {}
            if date_from:
                match_conditions["date"]["$gte"] = date_from
            if date_to:
                match_conditions["date"]["$lte"] = date_to

        match_stage = {"$match": match_conditions}
        pipeline.append(match_stage)

        # --- Stage 2: Lookup Project Information ---
        pipeline.append(
            {
                "$lookup": {
                    # *** FIX: Correct collection name ***
                    "from": "projects",  # Collection containing projects
                    "localField": "project_id",  # Field from time_entries
                    "foreignField": "_id",  # Field from projects
                    "as": "project_info",  # Alias for the joined project data
                }
            }
        )
        # --- Stage 3: Unwind the project_info array ---
        pipeline.append(
            {
                "$unwind": {
                    "path": "$project_info",
                    # Set to True if a time entry could theoretically exist
                    # without a matching project (e.g., project deleted)
                    # Set to False if project_id link is always guaranteed
                    "preserveNullAndEmptyArrays": True,
                }
            }
        )

        # --- Stage 4: Optional Search (after lookup) ---
        # Search time entry description OR project name
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append(
                {
                    "$match": {
                        "$or": [
                            {
                                "description": search_regex
                            },  # Search time entry description
                            {"project_info.name": search_regex},  # Search project name
                        ]
                    }
                }
            )

        # --- Stage 5: Project Fields (Shape the output) ---
        # *** FIX: Use $project stage ***
        project_stage = {
            "$project": {
                # Include fields from TimeEntry (use 1 to include)
                # Adjust these fields based on your TimeEntry model
                "_id": 1,
                "user_id": 1,
                "project_id": 1,
                "date": 1,
                "duration": 1,
                "description": 1,
                "rate_name": 1,
                "rate_price_per_hour": 1,
                "amount": 1,
                # Add fields from the joined project_info
                "project_name": "$project_info.name",  # Get project name
                "client_id": "$project_info.client_id",  # Get client_id from project
                # Add other project fields if needed (e.g., status)
                # "project_status": "$project_info.status",
            }
        }
        add_fields_stage = {
            "$addFields": {
                # Add fields from the joined project_info
                "project_name": "$project_info.name",
                "client_id": "$project_info.client_id",
                # Add other project fields if needed
                # "project_status": "$project_info.status",
            }
        }
        pipeline.append(add_fields_stage)
        pipeline.append(project_stage)

        # --- Stage 6: Sorting, Skipping, Limiting ---
        pipeline.append(
            {"$sort": {"date": -1, "created_at": -1}}
        )  # Sort by date descending typically
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})

        logger.debug(f"CRUDTimeEntry Aggregation Pipeline: {pipeline}")

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=limit)
        logger.info(f"Result is: {results}")
        logger.info(
            f"CRUDTimeEntry Aggregation: Found {len(results)} time entries for user {user_id}"
        )

        return results

    # Method to get items *with* project name included
    async def get_multi_with_project_name(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        project_id: Optional[UUID] = None,
        is_invoiced: Optional[bool] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        # Add other filters as needed
    ) -> List[WorkItemWithProjectName]:  # Return list of the new model type
        """
        Retrieves multiple WorkItems for a user, including the associated project name.
        """
        collection = self._get_collection(db)  # Gets the "work_items" collection
        pipeline = []

        # --- Stage 1: Match Work Items ---
        match_conditions = {"user_id": user_id}
        if project_id:
            match_conditions["project_id"] = project_id
        if is_invoiced is True:
            match_conditions["invoice_id"] = {"$ne": None}
        elif is_invoiced is False:
            match_conditions["invoice_id"] = None
        if date_from or date_to:
            # Assuming your WorkItemBase has 'date' field, adjust if needed
            # If you have date_from/date_to, you need a date field to match against
            date_field_to_match = (
                "start_date"  # Or "created_at" or specific 'date' field
            )
            match_conditions[date_field_to_match] = {}
            if date_from:
                match_conditions[date_field_to_match]["$gte"] = date_from
            if date_to:
                match_conditions[date_field_to_match]["$lte"] = date_to

        match_stage = {"$match": match_conditions}
        pipeline.append(match_stage)

        # --- Stage 2: Lookup Project Information ---
        pipeline.append(
            {
                "$lookup": {
                    "from": "projects",  # Correct collection name
                    "localField": "project_id",  # Field from work_items
                    "foreignField": "_id",  # Field from projects (_id assumed UUID)
                    "as": "project_data",  # Temporary field name for joined data
                }
            }
        )

        # --- Stage 3: Unwind the project_data array ---
        pipeline.append(
            {
                "$unwind": {
                    "path": "$project_data",
                    "preserveNullAndEmptyArrays": True,  # Keep WorkItem even if project is missing
                }
            }
        )

        # --- Stage 4: Optional Search (on description or project name) ---
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            pipeline.append(
                {
                    "$match": {
                        "$or": [
                            {
                                "description": search_regex
                            },  # Search WorkItem description
                            {"name": search_regex},  # Search WorkItem name
                            {
                                "project_data.name": search_regex
                            },  # Search joined Project name
                        ]
                    }
                }
            )

        # --- Stage 5: Add the project_name field ---
        pipeline.append(
            {
                "$addFields": {
                    "project_name": "$project_data.name"  # Extract name from joined data
                    # You could add other project fields here if needed
                    # "client_id_from_project": "$project_data.client_id"
                }
            }
        )

        # --- Stage 6: Remove temporary lookup data ---
        pipeline.append(
            {
                "$project": {
                    "project_data": 0  # Exclude the temporary field
                }
            }
        )

        # --- Stage 7: Sorting (e.g., by date or creation time) ---
        # Adjust sort field based on your WorkItem model
        pipeline.append({"$sort": {"created_at": -1}})  # Example: Sort by newest first

        # --- Stage 8: Pagination ---
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})

        logger.debug(f"CRUDWorkItem Aggregation Pipeline: {pipeline}")

        # --- Execute pipeline ---
        cursor = collection.aggregate(pipeline)
        results_dicts = await cursor.to_list(length=limit)  # Get list of dictionaries
        logger.info(
            f"CRUDWorkItem Aggregation: Found {len(results_dicts)} raw documents for user {user_id}"
        )

        # --- Parse into the specific Pydantic model WITH project_name ---
        try:
            # Use the new model that includes project_name
            parsed_results = [WorkItemWithProjectName(**doc) for doc in results_dicts]
            logger.info(
                f"Successfully parsed {len(parsed_results)} results into WorkItemWithProjectName models."
            )
            return parsed_results
        except Exception as parse_error:
            logger.error(
                f"Failed to parse aggregation results into WorkItemWithProjectName: {parse_error}",
                exc_info=True,
            )
            logger.error(
                f"Data that failed parsing (first item): {results_dicts[0] if results_dicts else 'N/A'}"
            )
            # Return empty list or raise an internal error
            return []


# Instantiate the specific CRUD class for WorkItems
crud_work_item = CRUDWorkItem(
    WorkItemInDB, collection_name="work_items"
)  # Adjust collection name if different

# Instantiate the specific CRUD class for Projects
crud_workItem = CRUDWorkItem(WorkItemInDB, collection_name="workItems")
