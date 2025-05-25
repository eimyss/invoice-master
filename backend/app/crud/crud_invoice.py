# backend/app/crud/crud_invoice.py
import logging
from uuid import UUID
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from app.services.event_service import (
    log_event,
    EventType,
)  # Import the service and enum
from datetime import date, timedelta, datetime, time, timezone, UTC

from pydantic import BaseModel, Field, ConfigDict, EmailStr
from app.crud.base import CRUDBase
from app.models.invoice import (  # Import Invoice models
    InvoiceCreateRequest,
    InvoiceInDB,
    Invoice,  # Need InvoiceUpdate model
    InvoiceLineItem,
    ClientInfo,
)
from app.models.workItem import WorkItemInDB, ItemStatus  # Assuming you have this

# Need TimeEntry model to fetch entries
from app.models.timeEntry import TimeEntryInDB  # Assuming you have this model

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
    async def get_multi_by_owner(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        client_id: Optional[UUID] = None,  # Add client_id filter
    ) -> List[InvoiceInDB]:
        """Get multiple invoices for user_id, with optional search and client filter."""
        collection = self._get_collection(db)
        query = {"user_id": user_id}
        if client_id:  # Filter by client ID if provided
            query["client_id"] = client_id
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            # Project-specific search fields
            query["$or"] = [
                {"name": search_regex},
                {"description": search_regex},
                # Maybe search client name via $lookup later if needed
            ]
        logger.debug(
            f"CRUDInvoice: Fetching invoices for user {user_id} with query: {query}, skip: {skip}, limit: {limit}"
        )
        cursor = collection.find(query).sort("name", 1).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)
        logger.info(
            f"CRUDInvoice: Found {len(results)} invoices for user {user_id} matching criteria."
        )
        return [self.model(**doc) for doc in results]

    async def create_from_request(
        self, db: AsyncIOMotorDatabase, *, user_id: str, request: InvoiceCreateRequest
    ) -> InvoiceInDB:
        """
        Creates an invoice by fetching time entries, calculating totals,
        generating an invoice number, and marking time entries as invoiced.
        """
        time_entry_collection = db["workItems"]  # Access TimeEntry collection
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
        logger.info(f"reqest Info: {request}")
        # Create a snapshot using a specific model if needed
        client_snapshot = ClientInfo(**FullClientModel(**client_doc).model_dump())

        # --- 2. Fetch Uninvoiced Time Entries for the User/Client/Projects ---
        time_entries_cursor = time_entry_collection.find(
            {
                "_id": {"$in": request.time_entry_ids},
                "user_id": user_id,
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
        time_entry_models = [WorkItemInDB(**te) for te in time_entries]

        # --- 3. Calculate Line Items and Totals ---
        line_items: List[InvoiceLineItem] = []
        subtotal = 0.0
        # Group time entries (e.g., by project and rate) or list individually
        # Example: List individually for simplicity
        min_service_date = None
        max_service_date = None
        for workItem in time_entry_models:
            for entry in workItem.timeEntries:
                pricePerHour = entry.price_per_hour
                duration = entry.duration
                amountCalc = pricePerHour * duration
                line = InvoiceLineItem(
                    description=f"{workItem.created_at.strftime('%Y-%m-%d')}: {workItem.name} (Rate: {entry.rate_name})",
                    quantity=entry.duration,
                    unit_price=pricePerHour,
                    amount=amountCalc,  # Use pre-calculated amount from time entry
                    time_entry_ids=[
                        workItem.id
                    ],  # Link this line item back to the time entry
                )
                line_items.append(line)
                logger.info(f"Calculated Amount is : {amountCalc} for rate: {entry}")
                subtotal += amountCalc
                # Track min/max dates for service period
                if min_service_date is None or workItem.created_at < min_service_date:
                    min_service_date = workItem.created_at
                if max_service_date is None or workItem.created_at > max_service_date:
                    max_service_date = workItem.created_at
        # Tax calculation
        tax_rate = (
            request.tax_rate if request.tax_rate is not None else 19.0
        )  # Use default if needed
        tax_amount = round(subtotal * (tax_rate / 100.0), 2)
        total_amount = round(subtotal + tax_amount, 2)

        # --- 4. Determine Dates ---
        issue_date: date = request.issue_date or date.today()
        due_date: date = issue_date + timedelta(days=request.due_date_days)
        service_date_from = request.service_date_from or min_service_date
        service_date_to = request.service_date_to or max_service_date

        # --- 5. Generate Invoice Number ---
        # Consider passing a prefix from user settings later
        invoice_number = await get_next_invoice_number(db, prefix="RE-")

        # --- 6. Prepare Invoice Document ---
        invoice_data_for_model = {
            "user_id": user_id,
            "invoice_number": await get_next_invoice_number(
                db, prefix="RE-"
            ),  # Generate number here
            "client_id": request.client_id,
            "project_ids": request.project_ids,
            "issue_date": issue_date,  # date object
            "due_date": due_date,  # date object
            # "service_date_from": service_date_from, # date object (or None)
            # "service_date_to": service_date_to,     # date object (or None)
            "line_items": [item.model_dump() for item in line_items],
            "subtotal": subtotal,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "status": ItemStatus.PROCESSED,
            "notes": request.notes,
            "client_snapshot": client_snapshot.model_dump(),
            "payment_date": None,  # date object (or None)
            "template_id": "default",
            # created_at/updated_at handled by model default_factory
            # id handled by model default_factory
        }
        try:
            # This ensures the input data conforms to the logical model (with dates)
            db_invoice = InvoiceInDB(**invoice_data_for_model)
            logger.info("Invoice data validated successfully against Pydantic model.")
            await log_event(
                db=db,
                event_type=EventType.INVOICE_CREATED,
                user_id=user_id,
                relevant_date=db_invoice.issue_date,  # Use invoice issue date
                description=f"Invoice {db_invoice.invoice_number} created for client {db_invoice.client_snapshot.name if db_invoice.client_snapshot else 'N/A'}.",
                related_entity_id=db_invoice.id,
                related_entity_type="Invoice",
                details={
                    "invoice_number": db_invoice.invoice_number,
                    "client_id": str(db_invoice.client_id),  # Store as string if needed
                    "total_amount": db_invoice.total_amount,
                },
            )
        except Exception as validation_error:
            logger.error(
                f"Pydantic validation failed creating InvoiceInDB: {validation_error}",
                exc_info=True,
            )
            raise ValueError("Invalid invoice data.") from validation_error

        # --- Convert date fields to datetime FOR MONGODB INSERTION ---
        insert_data = db_invoice.model_dump(by_alias=True)  # Get dict for DB

        def date_to_datetime_utc(d: Optional[date]) -> Optional[datetime]:
            if d is None:
                return None
            # Combine date with min time and set timezone to UTC
            return datetime.combine(d, time.min, tzinfo=timezone.utc)

        # Overwrite date fields in the dict going to MongoDB
        insert_data["issue_date"] = date_to_datetime_utc(db_invoice.issue_date)
        insert_data["due_date"] = date_to_datetime_utc(db_invoice.due_date)
        if db_invoice.service_date_from:
            insert_data["service_date_from"] = date_to_datetime_utc(
                db_invoice.service_date_from
            )
        if db_invoice.service_date_to:
            insert_data["service_date_to"] = date_to_datetime_utc(
                db_invoice.service_date_to
            )
        if db_invoice.payment_date:  # Handle payment date if it exists
            insert_data["payment_date"] = date_to_datetime_utc(db_invoice.payment_date)
        # created_at/updated_at from model_dump are already datetimes

        logger.debug(f"Data prepared for MongoDB insertion: {insert_data}")
        # -------------------------------------------------------------

        # --- Insert into DB ---
        result = await invoice_collection.insert_one(
            insert_data
        )  # Insert the dict with datetimes
        new_invoice_id = result.inserted_id
        logger.info(
            f"Invoice {db_invoice.invoice_number} created successfully with ID: {new_invoice_id}"
        )

        processed_work_item_ids = [wi.id for wi in time_entry_models]

        if processed_work_item_ids:  # Only update if there are items
            update_result = await time_entry_collection.update_many(
                {
                    "_id": {"$in": processed_work_item_ids},
                    "user_id": user_id,
                },  # Ensure user ownership
                {
                    "$set": {
                        "invoiceId": new_invoice_id,
                        "is_invoiced": True,
                        "status": ItemStatus.PROCESSED,
                        "updated_at": datetime.now(UTC),
                    }
                },
            )
            logger.info(
                f"Marked {update_result.modified_count} work items as invoiced with Invoice ID {new_invoice_id}"
            )
            if update_result.modified_count != len(processed_work_item_ids):
                logger.warning(
                    f"Mismatch: Expected to update {len(processed_work_item_ids)} work items, "
                    f"but updated {update_result.modified_count}."
                )
                # This could happen if some items were somehow invoiced by another process
                # between step 2 and step 7, or if user_id check failed for some.
                # Consider how critical this is for your application.
        else:
            logger.info("No work items were processed to be marked as invoiced.")
        # ... (update time entries, return created invoice) ...
        # Fetching back will get datetime objects, Pydantic's from_attributes=True
        # should handle converting them back to 'date' for the model fields.
        created_doc = await invoice_collection.find_one({"_id": new_invoice_id})
        if created_doc:
            # Pydantic should convert the stored datetime back to date here
            return InvoiceInDB(**created_doc)
        else:
            logger.error(
                f"Failed to fetch invoice {invoice_number} immediately after creation."
            )
            raise Exception("Failed to retrieve invoice after creation")


# Instantiate CRUD class
crud_invoice = CRUDInvoice(InvoiceInDB, collection_name="invoices")
