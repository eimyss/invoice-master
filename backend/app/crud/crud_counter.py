# backend/app/crud/crud_counter.py
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo import ReturnDocument

from datetime import datetime, date, timedelta, timezone, UTC

logger = logging.getLogger(__name__)
COUNTER_COLLECTION = "counters"
INVOICE_COUNTER_ID = "invoice_number"  # Document ID for the invoice counter


async def get_next_invoice_number(
    db: AsyncIOMotorDatabase, prefix: str = "INV-"
) -> str:
    """
    Atomically increments and returns the next invoice number.
    Format: PREFIX-YYYY-NNNN (e.g., INV-2024-0001)
    """
    collection = db[COUNTER_COLLECTION]
    current_year = datetime.now(UTC).year
    counter_id = f"{INVOICE_COUNTER_ID}_{current_year}"  # Year-specific counter

    # Atomically find and increment the sequence for the current year
    # upsert=True creates the counter document if it doesn't exist for the year
    counter_doc = await collection.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"sequence_value": 1}},
        projection={"sequence_value": True},
        upsert=True,
        return_document=ReturnDocument.AFTER,  # Get the document AFTER incrementing
    )

    sequence_value = counter_doc.get(
        "sequence_value", 1
    )  # Should always exist after upsert

    # Format the number (e.g., INV-2024-0001)
    # Adjust padding (e.g., 4 digits) as needed
    formatted_number = f"{prefix}{current_year}-{sequence_value:04d}"
    logger.info(f"Generated next invoice number: {formatted_number}")
    return formatted_number


# --- Need datetime ---
from datetime import datetime
