# backend/app/models/invoice.py
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import date, datetime


# --- Referenced Models (for embedding/display) ---
# Assuming you have simplified Client/Project models for embedding if needed
# Example:
class ClientInfo(BaseModel):
    id: UUID
    name: str
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = None
    vat_id: Optional[str] = None


class ProjectInfo(BaseModel):
    id: UUID
    name: str


# --- Invoice Line Item ---
# Represents one row on the invoice, summarizing work or adding manual items
class InvoiceLineItem(BaseModel):
    description: str = Field(
        ..., max_length=500, examples=["Development work on Feature X"]
    )
    quantity: float = Field(
        ..., ge=0, examples=[10.5]
    )  # Often hours, but could be units
    unit_price: float = Field(..., ge=0, examples=[80.0])  # Price per unit/hour
    # Optional: Link back to TimeEntry IDs covered by this line item
    time_entry_ids: Optional[List[UUID]] = Field(default=None)
    # Calculated amount = quantity * unit_price (calculated on backend)
    amount: float = Field(..., ge=0, examples=[840.0])

    model_config = ConfigDict(from_attributes=True)


# --- Invoice Status ---
class InvoiceStatus:
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"  # Optional: For canceled invoices


# --- Base Invoice Schema ---
class InvoiceBase(BaseModel):
    # Details populated when creating/fetching
    client_id: UUID
    project_ids: List[UUID]  # Link to one or more projects covered by this invoice
    issue_date: date = Field(default_factory=date.today)
    due_date: date
    # Optional fields for German requirements
    service_date_from: Optional[date] = None  # Leistungsdatum/zeitraum Start
    service_date_to: Optional[date] = None  # Leistungsdatum/zeitraum End
    # Fields calculated based on items
    subtotal: float = Field(..., ge=0)  # Sum of line item amounts
    tax_rate: float = Field(
        default=19.0, ge=0, description="Tax rate in percent (e.g., 19.0 for 19%)"
    )  # Default German VAT
    tax_amount: float = Field(..., ge=0)
    total_amount: float = Field(..., ge=0)
    # Status and payment tracking
    status: str = Field(default=InvoiceStatus.DRAFT)
    payment_date: Optional[date] = None
    # Template/Notes
    notes: Optional[str] = Field(default=None, max_length=5000)
    # Reference to the PDF template used (optional)
    template_id: Optional[str] = Field(
        default="default"
    )  # or UUID if using DB templates

    model_config = ConfigDict(from_attributes=True)


# --- Schema for Creating an Invoice ---
# Input needed from the user/frontend to generate an invoice
class InvoiceCreateRequest(BaseModel):
    client_id: UUID
    project_ids: List[UUID] = Field(..., min_length=1)
    time_entry_ids: List[UUID] = Field(
        ..., description="List of TimeEntry IDs to include"
    )
    # Optional overrides / manual data for the invoice
    issue_date: Optional[date] = None  # Default to today if not provided
    due_date_days: int = Field(
        default=14, ge=0, description="Payment due N days after issue date"
    )
    service_date_from: Optional[date] = (
        None  # Auto-calculate if possible, allow override
    )
    service_date_to: Optional[date] = None  # Auto-calculate if possible, allow override
    tax_rate: Optional[float] = Field(default=19.0, ge=0)  # Allow override
    notes: Optional[str] = None
    # Manual line items could be added here if needed


# --- Schema Stored in DB ---
class InvoiceInDB(InvoiceBase):
    id: UUID = Field(default_factory=uuid4, alias="_id")
    invoice_number: str = Field(..., unique=True)  # Generated, unique number
    user_id: str  # Owner
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # Embed client/project info for easier display/PDF generation? Optional.
    client_snapshot: Optional[ClientInfo] = (
        None  # Store client info *at time of invoice creation*
    )
    # project_snapshots: Optional[List[ProjectInfo]] = None
    line_items: List[InvoiceLineItem]  # Store the calculated line items

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- Schema Returned by API ---
# Might include more details than the base, like the generated number and items
class Invoice(InvoiceInDB):
    # Add calculated fields like due date if not stored directly
    # Or potentially add linked objects if not embedding snapshots
    pass


# --- Schema for Sending Email (simplified example) ---
class InvoiceEmailRequest(BaseModel):
    recipient_email: EmailStr  # Usually client's email
    subject: Optional[str] = "Your Invoice [Invoice Number]"
    body_template: Optional[str] = """
Dear [Client Name],

Please find attached your invoice [Invoice Number] for the amount of €[Total Amount].

Payment is due by [Due Date].

Bank Details:
[Your Bank Details]

Thank you for your business!

Best regards,
[Your Name]
    """  # Example Jinja2-like template
