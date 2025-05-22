# backend/app/models/dashboard.py
from pydantic import BaseModel, Field
from typing import List, Dict, Union
from datetime import date  # Use date for daily summary keys if preferred


class DailyHours(BaseModel):
    # Using string for date key as dict keys are strings when serialized
    # Or you can have a list of objects: {"date": "YYYY-MM-DD", "hours": 2.5}
    day: date  # The specific day
    hours: float = Field(..., ge=0)


class HoursSummaryResponse(BaseModel):
    current_month_total_hours: float = Field(..., ge=0)
    current_month_total_revenue: float = Field(..., ge=0)
    previous_month_total_hours: float = Field(..., ge=0)
    previous_month_total_revenue: float = Field(..., ge=0)
    # daily_hours_current_month: Dict[str, float] = Field(default_factory=dict) # Option 1: Dict
    daily_hours_current_month: List[DailyHours] = Field(
        default_factory=list
    )  # Option 2: List of objects (often better for charts)
    active_work_dates_current_month: List[date] = Field(
        default_factory=list
    )  # Option 2: List of objects (often better for charts)
