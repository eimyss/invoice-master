from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from uuid import UUID, uuid4


# Shared properties
class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, examples=["Example GmbH"])
    email: Optional[EmailStr] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = Field(default="Germany")
    vat_id: Optional[str] = Field(None, examples=["DE123456789"])  # USt-IdNr.
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        orm_mode = True  # Important for mapping to DB models later


# Properties to receive via API on creation
class ClientCreate(ClientBase):
    pass  # No extra fields needed for creation initially


# Properties to receive via API on update
class ClientUpdate(BaseModel):  # Allow partial updates
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = None
    vat_id: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


# Properties shared by models stored in DB
class ClientInDBBase(ClientBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    user_id: str  # Store the user's ID (e.g., Authentik 'sub' claim)

    class Config:
        orm_mode = True
        allow_population_by_field_name = True  # Allow using '_id' from MongoDB


# Properties to return to client
class Client(ClientInDBBase):
    pass  # Inherits all fields from ClientInDBBase


# Properties stored in DB
class ClientInDB(ClientInDBBase):
    pass  # Inherits all fields
