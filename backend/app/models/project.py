# backend/app/models/project.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime


# Define possible project statuses
class ProjectStatus:
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


# Reusable rate structure (can be embedded or separate collection later)
class Rate(BaseModel):
    name: str = Field(..., examples=["Development", "Consulting"])
    price_per_hour: float = Field(..., gt=0, examples=[75.0, 100.0])


# Base properties for a Project
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, examples=["Website Relaunch"])
    client_id: UUID = Field(..., description="ID of the client this project belongs to")
    description: Optional[str] = Field(default=None, max_length=5000)
    status: str = Field(
        default=ProjectStatus.ACTIVE,
        examples=[ProjectStatus.ACTIVE, ProjectStatus.COMPLETED],
    )
    # Store rates directly embedded for simplicity initially
    rates: List[Rate] = Field(
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
                "status": ProjectStatus.ACTIVE,
                "rates": [
                    {"name": "iOS Dev", "price_per_hour": 90.0},
                    {"name": "Android Dev", "price_per_hour": 85.0},
                    {"name": "Project Management", "price_per_hour": 110.0},
                ],
            }
        },
    )


# Schema for creating a project via API
class ProjectCreate(ProjectBase):
    pass  # Inherits all fields


# Schema for updating a project via API (all fields optional)
class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    client_id: Optional[UUID] = Field(default=None)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[str] = Field(default=None)
    rates: Optional[List[Rate]] = Field(default=None)
    # start_date: Optional[datetime] = None
    # end_date: Optional[datetime] = None


# Internal DB representation base
class ProjectInDBBase(ProjectBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    user_id: str  # Belongs to this user
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# Schema returned by API
class Project(ProjectInDBBase):
    pass  # Includes all DB base fields


# Internal DB representation
class ProjectInDB(ProjectInDBBase):
    pass
