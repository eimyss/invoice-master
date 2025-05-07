# backend/app/api/v1/endpoints/invoices.py
import logging
from uuid import UUID
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from fastapi.responses import Response  # For returning PDF directly

from app.api import deps
from app.models.invoice import (
    Invoice,
    InvoiceCreateRequest,
    InvoiceInDB,
    InvoiceEmailRequest,
)
from app.crud import crud_invoice  # Use Invoice CRUD
from app.services import pdf_generator, email_service  # Import services
from app.core.config import settings  # For potentially getting 'your_details'

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependencies
CurrentUser = Annotated[dict, Depends(deps.get_current_active_user)]
Database = Annotated[deps.AsyncIOMotorDatabase, Depends(deps.get_db)]


# --- Endpoint to Create an Invoice ---
@router.post(
    "/",
    response_model=Invoice,  # Returns the created invoice details (not PDF)
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Invoice from Time Entries",
)
async def create_invoice_endpoint(
    *, request_body: InvoiceCreateRequest, db: Database, current_user: CurrentUser
):
    """
    Generates a new invoice based on selected client, projects, and time entries.
    Marks the included time entries as invoiced.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")

    logger.info(
        f"User {user_id} requesting invoice creation for client {request_body.client_id}"
    )
    try:
        # Call the custom create method in CRUD
        created_invoice_db = await crud_invoice.create_from_request(
            db=db, user_id=user_id, request=request_body
        )
        # Return the Pydantic model for the created invoice
        return Invoice(**created_invoice_db.model_dump())

    except ValueError as ve:  # Catch specific errors from CRUD logic
        logger.warning(f"Invoice creation validation failed: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to create invoice: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invoice creation failed.",
        )


# --- Endpoint to Get Invoice List ---
# (Uses standard CRUDBase methods - implement if needed in crud_invoice)
@router.get("/", response_model=List[Invoice])
async def read_invoices_endpoint(
    *,
    db: Database,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    # TODO: Add filters (status, client_id, date range etc)
):
    """Retrieve invoices for the current user."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")
    invoices = await crud_invoice.get_multi_by_owner(
        db=db, user_id=user_id, skip=skip, limit=limit
    )
    # Need to ensure the base get_multi_by_owner returns InvoiceInDB compatible objects
    return [Invoice(**inv.model_dump()) for inv in invoices]


# --- Endpoint to Get Single Invoice Details ---
@router.get("/{invoice_id}", response_model=Invoice)
async def read_invoice_by_id_endpoint(
    *, invoice_id: UUID, db: Database, current_user: CurrentUser
):
    """Get details for a specific invoice."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")
    invoice = await crud_invoice.get(db=db, id=invoice_id, user_id=user_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return Invoice(**invoice.model_dump())


# --- Endpoint to Download Invoice PDF ---
@router.get(
    "/{invoice_id}/pdf",
    summary="Download Invoice as PDF",
    response_description="The invoice PDF file",
    # Define response content type
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Invoice PDF file.",
        },
        404: {"description": "Invoice not found"},
    },
)
async def download_invoice_pdf_endpoint(
    *, invoice_id: UUID, db: Database, current_user: CurrentUser
):
    """Generates and returns the PDF for a specific invoice."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")

    # 1. Fetch Invoice Data
    invoice_db = await crud_invoice.get(db=db, id=invoice_id, user_id=user_id)
    if not invoice_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )

    # 2. Get Your Details (e.g., from config or a user settings collection)
    # Example: Load from config, replace with DB lookup if needed
    your_details = {
        "name": settings.YOUR_COMPANY_NAME,  # Add these to Settings/env
        "address_line1": settings.YOUR_ADDRESS_LINE1,
        "zip_city": settings.YOUR_ZIP_CITY,
        "tax_id": settings.YOUR_TAX_ID,
        "vat_id": settings.YOUR_VAT_ID,
        "bank_account_holder": settings.YOUR_BANK_HOLDER,
        "bank_iban": settings.YOUR_BANK_IBAN,
        "bank_bic": settings.YOUR_BANK_BIC,
        "bank_name": settings.YOUR_BANK_NAME,
        # Add other fields used in template
    }

    # 3. Generate PDF
    try:
        pdf_bytes = await pdf_generator.generate_invoice_pdf(invoice_db, your_details)
    except Exception as e:
        logger.error(
            f"PDF generation failed for invoice {invoice_id}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Failed to generate PDF.")

    # 4. Return PDF as Response
    filename = f"Rechnung_{invoice_db.invoice_number}_{invoice_db.issue_date.strftime('%Y-%m-%d')}.pdf"
    headers = {
        "Content-Disposition": f'inline; filename="{filename}"'  # Use 'inline' to display in browser, 'attachment' to force download
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


# --- Endpoint to Generate Email Content ---
@router.post(
    "/{invoice_id}/email-preview",
    response_model=dict[str, str],  # Returns dict with subject, body, recipient
    summary="Generate Email Preview Content",
)
async def generate_email_preview_endpoint(
    *,
    invoice_id: UUID,
    email_request: Annotated[
        InvoiceEmailRequest, Body()
    ],  # Optional: Allow customizing template/subject via body
    db: Database,
    current_user: CurrentUser,
):
    """Generates the subject and body for an invoice email based on a template."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=403, detail="Invalid user")

    # 1. Fetch Invoice Data
    invoice_db = await crud_invoice.get(db=db, id=invoice_id, user_id=user_id)
    if not invoice_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )

    # 2. Get Your Details (same as PDF endpoint)
    your_details = {
        "name": settings.YOUR_COMPANY_NAME,
        "Address": settings.YOUR_ZIP_CITY,
    }  # Fetch details

    # 3. Generate Email Content
    try:
        email_content = await email_service.generate_invoice_email_content(
            invoice=invoice_db, email_request=email_request, your_details=your_details
        )
        return email_content
    except Exception as e:
        logger.error(
            f"Email content generation failed for invoice {invoice_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to generate email content.")


# --- TODO: Add endpoints for ---
# - Updating invoice status (e.g., mark as sent, paid) -> using InvoiceUpdate model
# - Listing invoices (with filters)
# - Getting invoice details (already added)
