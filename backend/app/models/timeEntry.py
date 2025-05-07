# backend/app/models/timeEntry.py
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import date, datetime


class TimeEntryBase(BaseModel):
    name: str = Field(..., max_length=100, description="Rate name is required")
    description: str = Field(..., max_length=100, description="Description of the rate")
    hours: float = Field(..., description="Number of hours for this item")
    rateId: str = Field(..., max_length=100, description="Rate Reference is required")
    calculatedAmount: Optional[float] = Field(
        default=None, description="Calculated amount based on other fields"
    )
    price_per_hour: Optional[float] = Field(
        default=None, description="Price per hour for this item"
    )

    model_config = ConfigDict(from_attributes=True)


class TimeEntryInDB(TimeEntryBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    invoice_number: str = Field(..., unique=True)  # Generated, unique number
    user_id: str  # Owner
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # Embed client/project info for easier display/PDF generation? Optional.

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TimeEntry(TimeEntryInDB):
    pass  # Includes all DB base fields
