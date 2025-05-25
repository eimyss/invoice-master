# backend/app/crud/crud_project.py
from typing import List, Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
from datetime import datetime, UTC, date
from app.crud.base import CRUDBase
from app.models.workItem import (
    WorkItemCreate,
    WorkItemUpdate,
    TimeEntry,
    WorkItemInDB,
    WorkItemWithProjectName,
)
from app.models.client import Client  # Import Client model for embedding shape

from app.services.event_service import (
    log_event,
    EventType,
)  # Import the service and enum
from app.crud.crud_project import crud_project  # To use the project CRUD instance

logger = logging.getLogger(__name__)


class CRUDWorkItem(CRUDBase[WorkItemInDB, WorkItemCreate, WorkItemUpdate]):
    async def create(
        self, db: AsyncIOMotorDatabase, *, obj_in: WorkItemCreate, user_id: str
    ) -> WorkItemInDB:
        """
        Create a new WorkItem, performing pre-save calculations for TimeEntry amounts.
        Overrides the base create method.
        """
        logger.info(
            f"CRUDWorkItem: Starting creation for WorkItem '{obj_in.name}' for user {user_id}"
        )

        # --- 1. Fetch the Associated Project to get its rates ---
        project = await crud_project.get(
            db=db, id=obj_in.project_id, user_id=user_id
        )  # Ensure user owns project
        if not project:
            logger.error(
                f"Project with ID {obj_in.project_id} not found or not owned by user {user_id}."
            )
            raise ValueError(f"Project not found: {obj_in.project_id}")

        # Create a dictionary of project rates for quick lookup: {rate_name: price_per_hour}
        project_rates_map = {rate.name: rate.price_per_hour for rate in project.rates}
        logger.debug(f"Project rates map for project {project.id}: {project_rates_map}")

        # --- 2. Process and Calculate Amounts for TimeEntries ---
        processed_time_entries: List[TimeEntry] = []
        for te_in in obj_in.timeEntries:  # te_in is from WorkItemCreate.timeEntries
            if te_in.rate_name not in project_rates_map:
                logger.error(
                    f"Invalid rate_name '{te_in.rate_name}' provided for project {project.id}. Available: {list(project_rates_map.keys())}"
                )
                raise ValueError(
                    f"Rate '{te_in.rate_name}' not found for project '{project.name}'."
                )

            # Get the authoritative price per hour from the project
            authoritative_price_per_hour = project_rates_map[te_in.rate_name]

            # Calculate amount based on backend data
            calculated_amount = round(te_in.duration * authoritative_price_per_hour, 2)

            # Create a new TimeEntry object (or update existing if obj_in.timeEntries are full models)
            # Ensure the TimeEntry model in WorkItemInDB can accept all these fields.
            processed_te = TimeEntry(
                description=te_in.description,
                rate_name=te_in.rate_name,
                duration=te_in.duration,
                price_per_hour=authoritative_price_per_hour,  # Use authoritative price
                calculatedAmount=calculated_amount,  # Use backend calculated amount
            )
            processed_time_entries.append(processed_te)
            logger.debug(
                f"Processed TimeEntry: desc='{processed_te.description}', amount={processed_te.calculatedAmount}"
            )

        # --- 3. Prepare the WorkItemInDB object ---
        # Create a dictionary from the input object, then update timeEntries
        obj_in_data = obj_in.model_dump(
            exclude={"timeEntries"}
        )  # Exclude original timeEntries

        db_obj_data = {
            **obj_in_data,  # Spread other fields from WorkItemCreate
            "user_id": user_id,
            "timeEntries": [
                te.model_dump() for te in processed_time_entries
            ],  # Use processed entries
            # id, created_at, updated_at will be handled by WorkItemInDB model defaults
        }
        # Instantiate the DB model
        db_obj = WorkItemInDB(**db_obj_data)

        # --- 4. Call the base class's standard MongoDB insertion logic ---
        # This part now essentially becomes the original CRUDBase.create logic,
        # but we're calling it after our custom processing.
        # OR, more directly, perform the insert here:

        collection = self._get_collection(db)
        insert_data = db_obj.model_dump(by_alias=True)  # For _id alias
        logger.info(
            f"CRUDWorkItem ({self.model.__name__}): Attempting to insert processed data for user {user_id}"
        )
        result = await collection.insert_one(insert_data)
        created_doc = await collection.find_one({"_id": result.inserted_id})
        if created_doc:
            await log_event(
                db=db,
                event_type=EventType.WORK_ITEM_CREATED,
                user_id=user_id,
                relevant_date=datetime.now(UTC).date(),
                description=f"Work Item '{db_obj.name}' created.",
                related_entity_id=result.inserted_id,
                related_entity_type="WorkItem",
                details={
                    "project_id": str(db_obj.project_id),
                    "number_of_time_logs": len(db_obj.timeEntries),
                },
            )
            logger.info(
                f"CRUDWorkItem ({self.model.__name__}): Created successfully with ID: {created_doc['_id']}"
            )
            return WorkItemInDB(**created_doc)  # Parse back to ensure type consistency
        else:
            logger.error(
                f"CRUDWorkItem ({self.model.__name__}): Failed to fetch object immediately after creation for user {user_id}"
            )
            raise Exception("Failed to retrieve WorkItem after creation")

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

    async def get_single_with_details(
        self,
        db: AsyncIOMotorDatabase,
        *,
        item_id: UUID,  # ID of the WorkItem to fetch
        user_id: str,
    ) -> Optional[WorkItemWithProjectName]:
        """
        Retrieves a single WorkItem by its ID for a user, including
        the associated project name and the project's client name.
        """
        collection = self._get_collection(db)  # Gets the "work_items" collection
        pipeline = []

        # --- Stage 1: Match the specific WorkItem by ID and user_id ---
        pipeline.append({"$match": {"_id": item_id, "user_id": user_id}})
        # --- Stage 2: Lookup Project Information ---
        pipeline.append(
            {
                "$lookup": {
                    "from": "projects",  # Projects collection
                    "localField": "project_id",  # From work_items
                    "foreignField": "_id",  # From projects
                    "as": "project_data_array",  # Use a distinct name for the array
                }
            }
        )
        # --- Stage 3: Unwind the project_data_array ---
        # (Since we matched a single WorkItem, this should at most yield one document)
        pipeline.append(
            {
                "$unwind": {
                    "path": "$project_data_array",
                    "preserveNullAndEmptyArrays": True,  # Keep WorkItem if project somehow missing
                }
            }
        )
        # --- Stage 4: Lookup Client Information (based on project_data_array.client_id) ---
        pipeline.append(
            {
                "$lookup": {
                    "from": "clients",  # Clients collection
                    "localField": "project_data_array.client_id",  # Field from the joined project
                    "foreignField": "_id",  # Field from clients
                    "as": "client_data_array",  # Temporary field name for joined client data
                }
            }
        )

        # --- Stage 5: Unwind the client_data_array ---
        pipeline.append(
            {
                "$unwind": {
                    "path": "$client_data_array",
                    "preserveNullAndEmptyArrays": True,  # Keep result even if client somehow missing
                }
            }
        )
        # --- Stage 6: Add the project_name and client_name fields ---
        pipeline.append(
            {
                "$addFields": {
                    "project_name": "$project_data_array.name",
                    "client_name": "$client_data_array.name",
                    # You could add client_id_from_project: "$project_data_array.client_id"
                    # if you needed it and it wasn't already on the WorkItem
                }
            }
        )
        # --- Stage 7: Project (Select final fields and remove temporary lookup data) ---
        # This ensures the output matches your WorkItemWithProjectAndClientName model
        pipeline.append(
            {
                "$project": {
                    "project_data_array": 0,  # Exclude the temporary project array
                    "client_data_array": 0,  # Exclude the temporary client array
                    # All other fields from the original WorkItem (and added fields) will be kept
                    # because $addFields doesn't remove them.
                    # If you need to be very explicit about which WorkItem fields to keep:
                    # "_id": 1, "user_id": 1, "name": 1, "project_id": 1, ... etc.
                    # "project_name": 1, "client_name": 1
                }
            }
        )

        # --- Stage 8: Limit to 1 (since we matched by ID, just to be safe) ---
        pipeline.append({"$limit": 1})

        logger.debug(f"CRUDWorkItem get_single_with_details Pipeline: {pipeline}")

        # --- Execute pipeline ---
        cursor = collection.aggregate(pipeline)
        results_list = await cursor.to_list(length=1)  # Expect 0 or 1 result

        if not results_list:
            logger.debug(
                f"CRUDWorkItem: WorkItem with ID {item_id} not found for user {user_id} after aggregation."
            )
            return None

        # The result is a dictionary
        doc = results_list[0]
        logger.info(
            f"CRUDWorkItem: Fetched WorkItem {item_id} with details for user {user_id}"
        )

        # --- Parse into the specific Pydantic model ---
        try:
            return WorkItemWithProjectName(**doc)
        except Exception as parse_error:
            logger.error(
                f"Failed to parse aggregated result for WorkItem {item_id} into Pydantic model: {parse_error}",
                exc_info=True,
            )
            logger.error(f"Data that failed parsing: {doc}")
            return None  # Or raise an internal error


# Instantiate the specific CRUD class for WorkItems
crud_work_item = CRUDWorkItem(
    WorkItemInDB, collection_name="work_items"
)  # Adjust collection name if different

# Instantiate the specific CRUD class for Projects
crud_workItem = CRUDWorkItem(WorkItemInDB, collection_name="workItems")
