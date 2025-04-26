# backend/app/models/client.py
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
)  # Import ConfigDict for Pydantic v2
from typing import Optional
from uuid import UUID, uuid4


# Shared properties
class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Example GmbH"])
    email: Optional[EmailStr] = Field(default=None, examples=["kontakt@example.com"])
    address_street: Optional[str] = Field(
        default=None, max_length=100, examples=["Musterstraße 123"]
    )
    address_zip: Optional[str] = Field(default=None, max_length=20, examples=["12345"])
    address_city: Optional[str] = Field(
        default=None, max_length=100, examples=["Musterstadt"]
    )
    address_country: Optional[str] = Field(default="Germany", max_length=100)
    vat_id: Optional[str] = Field(
        default=None, max_length=50, examples=["DE123456789"]
    )  # USt-IdNr.
    contact_person: Optional[str] = Field(
        default=None, max_length=100, examples=["Max Mustermann"]
    )
    phone: Optional[str] = Field(
        default=None, max_length=50, examples=["+49 30 12345678"]
    )
    notes: Optional[str] = Field(default=None, max_length=5000)

    # Pydantic v2 config
    model_config = ConfigDict(
        from_attributes=True,  # Replaces orm_mode
        json_schema_extra={  # Adds examples to OpenAPI docs
            "example": {
                "name": "Beispiel Kunde AG",
                "email": "info@beispiel.de",
                "address_street": "Hauptstr. 1",
                "address_zip": "10115",
                "address_city": "Berlin",
                "address_country": "Germany",
                "vat_id": "DE987654321",
                "contact_person": "Erika Musterfrau",
                "phone": "+49 30 87654321",
                "notes": "Wichtiger Kunde, bevorzugt E-Mail.",
            }
        },
    )


# Properties to receive via API on creation
class ClientCreate(ClientBase):
    pass  # Inherits all fields and config


# Properties to receive via API on update (all optional)
class ClientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = Field(default=None)
    address_street: Optional[str] = Field(default=None, max_length=100)
    address_zip: Optional[str] = Field(default=None, max_length=20)
    address_city: Optional[str] = Field(default=None, max_length=100)
    address_country: Optional[str] = Field(default=None, max_length=100)
    vat_id: Optional[str] = Field(default=None, max_length=50)
    contact_person: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=5000)

    # Example for partial update
    model_config = ConfigDict(
        json_schema_extra={
            "example": {"email": "new.email@beispiel.de", "phone": "+49 170 11223344"}
        }
    )


# Properties shared by models stored in DB
class ClientInDBBase(ClientBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    user_id: str  # Store the user's ID (e.g., Authentik 'sub' claim)

    # Pydantic v2 config
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # Replaces allow_population_by_field_name
    )


# Properties to return to client (API Response Schema)
class Client(ClientInDBBase):
    pass  # Inherits all fields from ClientInDBBase


# Properties stored in DB (Internal representation)
class ClientInDB(ClientInDBBase):
    pass  # Inherits all fields

