# backend/app/api/v1/endpoints/dashboard.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Annotated  # Added Dict
from datetime import datetime, date, timedelta, timezone  # Ensure all are imported

from app.crud.crud_workItem import crud_workItem
from app.api import deps  # Your dependencies (get_db, get_current_active_user)
from app.models.dashboard import (
    HoursSummaryResponse,
    DailyHours,
)  # Import your response model
from app.utils.date_utils import get_month_range  # Import helper

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependencies
CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
Database = Annotated[deps.AsyncIOMotorDatabase, Depends(deps.get_db)]

# Collection name for work items/time entries
WORK_ITEM_COLLECTION = "workItems"  # Or "time_entries"


@router.get(
    "/summary/hours-this-month",
    response_model=HoursSummaryResponse,
    summary="Get Summary of Hours Logged (Current & Previous Month, Daily for Current)",
)
async def get_hours_summary(*, db: Database, current_user: CurrentUser):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid user"
        )

    logger.info(f"User {user_id} fetching hours summary for dashboard.")
    collection = db[WORK_ITEM_COLLECTION]

    now_utc = datetime.now(timezone.utc)
    current_year = now_utc.year
    current_month = now_utc.month
    # --- 1. Total hours for the current month ---
    current_month_start, next_month_start = get_month_range(current_year, current_month)

    logger.info(
        f"Current month query range: {current_month_start} to {next_month_start}"
    )
    pipeline_current_month_total = [
        {
            "$match": {
                "user_id": user_id,
                "date": {
                    "$gte": current_month_start,
                    "$lt": next_month_start,
                },
            }
        },
        {"$unwind": "$timeEntries"},
        {
            "$group": {
                "_id": None,  # Group all matched (and unwound) documents
                "total_hours": {
                    "$sum": "$timeEntries.duration"
                },  # Sum the nested duration
                "total_revenue": {
                    "$sum": "$timeEntries.calculatedAmount"
                },  # Sum the nested duration
            }
        },
    ]
    logger.info(f"Current month total pipeline: {pipeline_current_month_total}")
    current_month_result = await collection.aggregate(
        pipeline_current_month_total
    ).to_list(length=1)
    logger.info(f"Current month total result from DB: {current_month_result}")
    current_month_total_hours = (
        current_month_result[0]["total_hours"] if current_month_result else 0.0
    )

    current_month_total_revenue = (
        current_month_result[0]["total_revenue"] if current_month_result else 0.0
    )
    # --- 2. Total hours for the previous month ---
    if current_month == 1:
        prev_month = 12
        prev_month_year = current_year - 1
    else:
        prev_month = current_month - 1
        prev_month_year = current_year

    prev_month_start, current_month_start_for_prev_calc = get_month_range(
        prev_month_year, prev_month
    )

    pipeline_prev_month_total = [
        {
            "$match": {
                "user_id": user_id,
                "date": {
                    "$gte": prev_month_start,
                    "$lt": current_month_start_for_prev_calc,
                },
            }
        },
        {"$unwind": "$timeEntries"},
        {
            "$group": {
                "_id": None,  # Group all matched (and unwound) documents
                "total_hours": {
                    "$sum": "$timeEntries.duration"
                },  # Sum the nested duration
                "total_revenue": {
                    "$sum": "$timeEntries.calculatedAmount"
                },  # Sum the nested duration
            }
        },
    ]
    prev_month_result = await collection.aggregate(pipeline_prev_month_total).to_list(
        length=1
    )
    previous_month_total_hours = (
        prev_month_result[0]["total_hours"] if prev_month_result else 0.0
    )
    previous_month_total_revenue = (
        prev_month_result[0]["total_revenue"] if prev_month_result else 0.0
    )

    # --- 3. Daily hours for the current month ---
    # Reuse current_month_start and next_month_start
    pipeline_daily_current_month = [
        {
            "$match": {
                "user_id": user_id,
                "date": {"$gte": current_month_start, "$lt": next_month_start},
            }
        },
        {"$unwind": "$timeEntries"},
        {
            "$group": {
                # Group by the date part only (year, month, day)
                "_id": {
                    "year": {"$year": {"date": "$date", "timezone": "UTC"}},
                    "month": {"$month": {"date": "$date", "timezone": "UTC"}},
                    "day": {"$dayOfMonth": {"date": "$date", "timezone": "UTC"}},
                },
                "daily_total_hours": {"$sum": "$timeEntries.duration"},
            }
        },
        {"$sort": {"_id": 1}},  # Sort by date
    ]
    daily_results_cursor = collection.aggregate(pipeline_daily_current_month)
    daily_hours_list: List[DailyHours] = []

    logger.info(
        f"Previous month query range: {prev_month_start} to {current_month_start_for_prev_calc}"
    )
    async for doc in daily_results_cursor:
        # Construct date object from grouped components
        day_date = date(doc["_id"]["year"], doc["_id"]["month"], doc["_id"]["day"])
        daily_hours_list.append(
            DailyHours(day=day_date, hours=doc.get("daily_total_hours", 0.0))
        )

    pipeline_distinct_work_dates_current_month = [
        {
            "$match": {
                "user_id": user_id,
                "date": {
                    "$gte": current_month_start,
                    "$lt": next_month_start,
                },  # Match WorkItems in current month
            }
        },
        {
            "$group": {
                # Group by the date part only to get distinct dates
                "_id": {
                    "year": {"$year": {"date": "$date", "timezone": "UTC"}},
                    "month": {"$month": {"date": "$date", "timezone": "UTC"}},
                    "day": {"$dayOfMonth": {"date": "$date", "timezone": "UTC"}},
                }
            }
        },
        {
            "$project": {
                "_id": 0,  # Exclude the default _id from group stage
                # Reconstruct the date object or string
                "work_date": {
                    "$dateFromParts": {  # For MongoDB 3.6+
                        "year": "$_id.year",
                        "month": "$_id.month",
                        "day": "$_id.day",
                        "timezone": "UTC",  # Output as UTC datetime at midnight
                    }
                },
            }
        },
        {"$sort": {"work_date": 1}},  # Sort the dates
    ]
    distinct_dates_cursor = collection.aggregate(
        pipeline_distinct_work_dates_current_month
    )
    active_work_dates_current_month: List[date] = []  # Store as Python date objects
    async for doc in distinct_dates_cursor:
        # doc will be like {'work_date': datetime.datetime(2023, 5, 8, 0, 0, tzinfo=timezone.utc)}
        if doc.get("work_date") and isinstance(doc["work_date"], datetime):
            active_work_dates_current_month.append(
                doc["work_date"].date()
            )  # Convert to date object

    logger.info(
        f"Distinct work dates for current month: {active_work_dates_current_month}"
    )
    # If using Dict[str, float] for daily_hours_current_month:
    # daily_hours_dict = {doc["_id"]: doc.get("daily_total_hours", 0.0) async for doc in daily_results_cursor}

    return HoursSummaryResponse(
        current_month_total_hours=current_month_total_hours,
        current_month_total_revenue=current_month_total_revenue,
        previous_month_total_hours=previous_month_total_hours,
        previous_month_total_revenue=previous_month_total_revenue,
        daily_hours_current_month=daily_hours_list,  # or daily_hours_dict
        active_work_dates_current_month=active_work_dates_current_month,
    )
