# backend/app/crud/crud_invoice.py
import logging
from uuid import UUID
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from datetime import date, timedelta, datetime

from pydantic import BaseModel, Field, ConfigDict, EmailStr
from app.crud.base import CRUDBase
from app.models.invoice import (  # Import Invoice models
    InvoiceCreateRequest,
    InvoiceInDB,
    Invoice,  # Need InvoiceUpdate model
    InvoiceLineItem,
    ClientInfo,
)

# Need TimeEntry model to fetch entries
from app.models.time_entry import TimeEntryInDB  # Assuming you have this model

# Need Client model to get snapshot
from app.models.client import ClientInDB as FullClientModel

# Need Counter function
from app.crud.crud_counter import get_next_invoice_number

logger = logging.getLogger(__name__)


# Define InvoiceUpdate if needed (e.g., for updating status, payment_date)
class InvoiceUpdate(BaseModel):  # Or inherit from InvoiceBase selectively
    status: Optional[str] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None
    # Add other updatable fields


class CRUDInvoice(
    CRUDBase[InvoiceInDB, InvoiceCreateRequest, InvoiceUpdate]
):  # Note: Create differs
    async def create_from_request(
        self, db: AsyncIOMotorDatabase, *, user_id: str, request: InvoiceCreateRequest
    ) -> InvoiceInDB:
        """
        Creates an invoice by fetching time entries, calculating totals,
        generating an invoice number, and marking time entries as invoiced.
        """
        time_entry_collection = db["time_entries"]  # Access TimeEntry collection
        client_collection = db["clients"]  # Access Client collection
        invoice_collection = self._get_collection(db)  # Invoice collection

        # --- 1. Fetch Client Info (Snapshot) ---
        client_doc = await client_collection.find_one(
            {"_id": request.client_id, "user_id": user_id}
        )
        if not client_doc:
            raise ValueError(
                f"Client not found or not owned by user: {request.client_id}"
            )
        # Create a snapshot using a specific model if needed
        client_snapshot = ClientInfo(**FullClientModel(**client_doc).model_dump())

        # --- 2. Fetch Uninvoiced Time Entries for the User/Client/Projects ---
        time_entries_cursor = time_entry_collection.find(
            {
                "_id": {"$in": request.time_entry_ids},
                "user_id": user_id,
                "client_id": request.client_id,  # Optional check if client_id stored on time entry
                "project_id": {"$in": request.project_ids},
                "invoice_id": None,  # IMPORTANT: Only fetch uninvoiced entries
            }
        )
        time_entries = await time_entries_cursor.to_list(
            length=None
        )  # Fetch all matching

        if not time_entries:
            raise ValueError("No uninvoiced time entries found matching the criteria.")

        logger.info(f"Found {len(time_entries)} time entries to include in invoice.")

        # Verify all requested IDs were found and uninvoiced
        found_ids = {te["_id"] for te in time_entries}
        requested_ids = set(request.time_entry_ids)
        if found_ids != requested_ids:
            missing = requested_ids - found_ids
            # Check if missing IDs were already invoiced or belong elsewhere
            logger.warning(
                f"Some requested time entries not found or already invoiced: {missing}"
            )
            # Decide whether to proceed or raise error - for now, proceed with found ones
            # raise ValueError(f"Some requested time entries not found or already invoiced: {missing}")

        # Parse fetched entries into Pydantic models
        time_entry_models = [TimeEntryInDB(**te) for te in time_entries]

        # --- 3. Calculate Line Items and Totals ---
        line_items: List[InvoiceLineItem] = []
        subtotal = 0.0
        # Group time entries (e.g., by project and rate) or list individually
        # Example: List individually for simplicity
        min_service_date = None
        max_service_date = None
        for entry in time_entry_models:
            line = InvoiceLineItem(
                description=f"{entry.date.strftime('%Y-%m-%d')}: {entry.description} (Rate: {entry.rate_name})",
                quantity=entry.duration,
                unit_price=entry.rate_price_per_hour,
                amount=entry.amount,  # Use pre-calculated amount from time entry
                time_entry_ids=[entry.id],  # Link this line item back to the time entry
            )
            line_items.append(line)
            subtotal += entry.amount
            # Track min/max dates for service period
            if min_service_date is None or entry.date < min_service_date:
                min_service_date = entry.date
            if max_service_date is None or entry.date > max_service_date:
                max_service_date = entry.date

        # Tax calculation
        tax_rate = (
            request.tax_rate if request.tax_rate is not None else 19.0
        )  # Use default if needed
        tax_amount = round(subtotal * (tax_rate / 100.0), 2)
        total_amount = round(subtotal + tax_amount, 2)

        # --- 4. Determine Dates ---
        issue_date = request.issue_date or date.today()
        due_date = issue_date + timedelta(days=request.due_date_days)
        service_date_from = request.service_date_from or min_service_date
        service_date_to = request.service_date_to or max_service_date

        # --- 5. Generate Invoice Number ---
        # Consider passing a prefix from user settings later
        invoice_number = await get_next_invoice_number(db, prefix="RE-")

        # --- 6. Prepare Invoice Document ---
        invoice_data = {
            "user_id": user_id,
            "invoice_number": invoice_number,
            "client_id": request.client_id,
            "project_ids": request.project_ids,
            "issue_date": issue_date,
            "due_date": due_date,
            "service_date_from": service_date_from,
            "service_date_to": service_date_to,
            "line_items": [item.model_dump() for item in line_items],
            "subtotal": subtotal,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "status": InvoiceStatus.DRAFT,  # Start as draft
            "notes": request.notes,
            "client_snapshot": client_snapshot.model_dump(),  # Store snapshot
            # Initialize other fields
            "payment_date": None,
            "template_id": "default",  # Example
        }
        db_invoice = InvoiceInDB(**invoice_data)

        # --- 7. Insert Invoice into DB ---
        insert_data = db_invoice.model_dump(by_alias=True)
        result = await invoice_collection.insert_one(insert_data)
        new_invoice_id = result.inserted_id
        logger.info(
            f"Invoice {invoice_number} created successfully with ID: {new_invoice_id}"
        )

        # --- 8. Update Time Entries - Mark as Invoiced ---
        # IMPORTANT: Do this *after* successfully inserting the invoice
        update_result = await time_entry_collection.update_many(
            {"_id": {"$in": [entry.id for entry in time_entry_models]}},
            {"$set": {"invoice_id": new_invoice_id, "updated_at": datetime.utcnow()}},
        )
        logger.info(
            f"Marked {update_result.modified_count} time entries as invoiced with ID {new_invoice_id}"
        )
        if update_result.modified_count != len(time_entry_models):
            logger.warning(
                "Mismatch between time entries found and time entries updated with invoice ID."
            )
            # Consider potential rollback or notification logic here if critical

        # --- 9. Return the Created Invoice ---
        # Fetch the newly created doc to ensure all fields (like defaults) are present
        created_doc = await invoice_collection.find_one({"_id": new_invoice_id})
        if created_doc:
            return InvoiceInDB(**created_doc)  # Return the full DB object
        else:
            logger.error(
                f"Failed to fetch invoice {invoice_number} immediately after creation."
            )
            raise Exception("Failed to retrieve invoice after creation")


# Instantiate CRUD class
crud_invoice = CRUDInvoice(InvoiceInDB, collection_name="invoices")
