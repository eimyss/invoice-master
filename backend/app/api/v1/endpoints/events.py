# backend/app/api/v1/endpoints/events.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import List, Optional, Annotated
from datetime import date, datetime

from uuid import UUID
from app.api import deps
from app.models.event import EventInDB  # Import your Event model
from motor.motor_asyncio import AsyncIOMotorDatabase  # For type hinting

logger = logging.getLogger(__name__)
router = APIRouter()

CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
Database = Annotated[AsyncIOMotorDatabase, Depends(deps.get_db)]

EVENTS_COLLECTION_NAME = "events"  # Consistent with service


@router.get(
    "/",
    response_model=List[EventInDB],
    summary="Get logged events for the current user",
)
async def read_events(
    *,
    db: Database,
    current_user: CurrentUser,
    date_from: Optional[date] = Query(
        None, description="Start date for event range (YYYY-MM-DD)"
    ),
    date_to: Optional[date] = Query(
        None, description="End date for event range (YYYY-MM-DD)"
    ),
    event_type: Optional[str] = Query(
        None, description="Filter by a specific event type"
    ),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")

    event_collection = db[EVENTS_COLLECTION_NAME]
    query_filter = {"user_id": user_id}

    # Date range filtering for 'relevant_date'
    # Remember 'relevant_date' is stored as datetime at midnight UTC in DB
    if date_from or date_to:
        from datetime import time, timezone  # Import for conversion

        query_filter["relevant_date"] = {}
        if date_from:
            query_filter["relevant_date"]["$gte"] = datetime.combine(
                date_from, time.min, tzinfo=timezone.utc
            )
        if date_to:
            # For $lte, use end of day or start of next day with $lt
            end_of_date_to = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
            # Or better: datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc) and use $lt
            query_filter["relevant_date"]["$lte"] = end_of_date_to

    if event_type:
        query_filter["event_type"] = event_type

    logger.debug(f"Fetching events with filter: {query_filter}")
    cursor = (
        event_collection.find(query_filter)
        .sort("timestamp", -1)
        .skip(skip)
        .limit(limit)
    )  # Sort by when logged
    events_dicts = await cursor.to_list(length=limit)

    # Parse to Pydantic models for response
    return [EventInDB(**event_doc) for event_doc in events_dicts]


@router.get("/{event_id}", response_model=List[EventInDB])
async def read_project_by_id_endpoint(
    *, event_id: UUID, db: Database, current_user: CurrentUser
):
    """Get a specific event by ID."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")

    event_collection = db[EVENTS_COLLECTION_NAME]
    query_filter = {"user_id": user_id, "_id": event_id}

    logger.debug(f"Fetching events with filter: {query_filter}")
    cursor = event_collection.find(query_filter).sort(
        "timestamp", -1
    )  # Sort by when logged
    events_dicts = await cursor.to_list()

    # Parse to Pydantic models for response
    return [EventInDB(**event_doc) for event_doc in events_dicts]
