from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime


# Define possible status for work items
class ItemStatus:
    ACTIVE = "active"
    CREATED = "created"
    DISABLED = "disabled"
    CANCELED = "canceled"
    PROCESSED = "processed"
    SENT = "sent"


class TimeEntry(BaseModel):
    description: str = Field(..., max_length=100, description="Description of the rate")
    rate_name: str = Field(
        ..., max_length=100, description="Name of the original Rate in Project"
    )
    duration: float = Field(..., description="Number of hours for this item")
    calculatedAmount: Optional[float] = Field(
        default=None, description="Calculated amount based on other fields"
    )
    price_per_hour: Optional[float] = Field(
        default=None, description="Price per hour for this item"
    )

    model_config = ConfigDict(from_attributes=True)


# Base properties for Work Item
class WorkItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, examples=["Website Relaunch"])
    invoice_id: Optional[UUID] = Field(
        default=None,  # Make it optional by providing a default value (None)
        description="ID of the invoice this time entry belongs to, null if not invoiced yet",  # Correct description
        alias="invoiceId",  # Optional: Define alias if DB field name differs
    )
    is_invoiced: Optional[bool] = False
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    project_id: UUID = Field(
        ..., description="ID of the client this project belongs to"
    )
    description: Optional[str] = Field(default=None, max_length=5000)
    status: str = Field(
        default=ItemStatus.CREATED,
        examples=[ItemStatus.ACTIVE, ItemStatus.DISABLED],
    )

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    # Store rates directly embedded for simplicity initially
    timeEntries: List[TimeEntry] = Field(
        default_factory=list, examples=[[{"name": "Dev", "price_per_hour": 80}]]
    )
    # Add start/end dates if needed
    # start_date: Optional[datetime] = None
    # end_date: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Mobile App Development",
                "client_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",  # Example UUID
                "description": "Develop native iOS and Android apps.",
                "status": ItemStatus.CREATED,
                "rates": [
                    {"name": "iOS Dev", "price_per_hour": 90.0},
                    {"name": "Android Dev", "price_per_hour": 85.0},
                    {"name": "Project Management", "price_per_hour": 110.0},
                ],
            }
        },
    )


# Schema for creating a project via API
class WorkItemCreate(WorkItemBase):
    pass  # Inherits all fields


# Schema for updating a project via API (all fields optional)
class WorkItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    client_id: Optional[UUID] = Field(default=None)
    project_id: Optional[UUID] = Field(default=None)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[str] = Field(default=None)
    timeEntries: Optional[List[TimeEntry]] = Field(default=None)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# Internal DB representation base
class WorkItemInDBBase(WorkItemBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    user_id: str  # Belongs to this user
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# Schema returned by API
class WorkItem(WorkItemInDBBase):
    pass  # Includes all DB base fields


class WorkItemWithProjectName(WorkItemInDBBase):  # Inherit common DB fields
    project_name: Optional[str] = Field(
        default=None, description="Name of the associated project"
    )
    # You could also add client_id here if needed from the project lookup
    # client_id_from_project: Optional[UUID] = Field(alias="clientIdFromProject", default=None)

    # Ensure config allows population by name if aliases are used elsewhere
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# Internal DB representation
class WorkItemInDB(WorkItemInDBBase):
    pass
