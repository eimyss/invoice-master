# backend/app/models/event.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, date


# Optional: Define an Enum for event types for consistency
class EventType:
    WORK_ITEM_CREATED = "work_item.created"
    WORK_ITEM_UPDATED = "work_item.updated"
    WORK_ITEM_DELETED = "work_item.deleted"
    INVOICE_CREATED = "invoice.created"
    INVOICE_STATUS_UPDATED = "invoice.status.updated"  # e.g., sent, paid
    INVOICE_PDF_GENERATED = "invoice.pdf.generated"
    EMAIL_SENT = "email.sent"  # Generic email sent
    CLIENT_CREATED = "client.created"
    PROJECT_CREATED = "project.created"
    # Add more as needed
    USER_LOGIN = "user.login"  # Example system event


class EventBase(BaseModel):
    event_type: str = Field(
        ..., description="Type of the event (e.g., 'invoice.created')"
    )
    user_id: str = Field(
        ..., description="ID of the user who triggered or is associated with the event"
    )
    # relevant_date is the primary date for calendar display
    # This could be the WorkItem date, Invoice issue_date, etc.
    relevant_date: date = Field(
        ...,
        description="The primary date associated with this event for calendar display",
    )
    description: Optional[str] = Field(
        default=None, description="A human-readable description of the event"
    )
    # Optional: Store related entity IDs for linking/filtering
    related_entity_id: Optional[UUID] = Field(
        default=None,
        description="ID of the primary entity related to this event (e.g., WorkItem ID, Invoice ID)",
    )
    related_entity_type: Optional[str] = Field(
        default=None,
        description="Type of the related entity (e.g., 'WorkItem', 'Invoice')",
    )
    # Optional: Store additional metadata specific to the event type
    details: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional structured data about the event"
    )

    model_config = ConfigDict(from_attributes=True)


class EventInDB(EventBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when the event was logged",
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
