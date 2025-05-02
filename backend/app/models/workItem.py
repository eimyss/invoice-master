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


# Reusable rate structure (can be embedded or separate collection later)
class PaymentItems(BaseModel):
    name: str = Field(..., examples=["Development", "Consulting"])
    descriptionInvoice: str = Field(..., examples=["Consulting Januar 2025"])
    price_per_hour: float = Field(..., gt=0, examples=[75.0, 100.0])
    hours: float = Field(..., gt=0, examples=[75.0, 100.0])
    calculatedAmount: float = Field(..., gt=0, examples=[75.0, 100.0])
    rateId: UUID = Field(..., description="Referece to the rate of the Project")


# Base properties for Work Item
class WorkItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, examples=["Website Relaunch"])

    invoice_id: UUID = Field(
        ..., description="ID of the client this project belongs to"
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
    rates: List[PaymentItems] = Field(
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
    rates: Optional[List[PaymentItems]] = Field(default=None)
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


# Internal DB representation
class WorkItemInDB(WorkItemInDBBase):
    pass
