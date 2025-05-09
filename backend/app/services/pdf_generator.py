# backend/app/services/pdf_generator.py
import logging
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
from datetime import date, datetime
from typing import Dict, Any

from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase  # Need DB type hint
from app.crud import crud_invoice  # Need CRUD to fetch/update
from app.services import pdf_generator  # Import the actual generator function
from app.core.config import settings  # To get your details
from app.models.invoice import InvoiceInDB  # Import the Invoice model

logger = logging.getLogger(__name__)

# --- Configuration ---
TEMPLATE_DIR = os.path.join(
    os.path.dirname(__file__), "../templates"
)  # Assumes templates folder is one level up
DEFAULT_TEMPLATE = "invoice_default.html"
DEFAULT_CSS = "invoice_style.css"

# Setup Jinja2 environment
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html", "xml"]),
    enable_async=False,  # Jinja2 rendering is typically synchronous
)
jinja_env.filters["date"] = (
    lambda d, fmt="%d.%m.%Y": d.strftime(fmt) if isinstance(d, (date, datetime)) else d
)
jinja_env.filters["currency"] = (
    lambda v, curr="€": f"{v:,.2f}".replace(",", "X")
    .replace(".", ",")
    .replace("X", ".")
    + f" {curr}"
)  # Basic German currency format


# --- Font Configuration (Optional but Recommended for Complex Scripts/Custom Fonts) ---
font_config = FontConfiguration()
# Example: Add custom font if needed
# css_fonts = CSS(string='@font-face { font-family: MyCustomFont; src: url(/path/to/font.ttf); }', font_config=font_config)


async def generate_invoice_pdf(
    invoice_data: InvoiceInDB, your_details: Dict[str, Any]
) -> bytes:
    """
    Generates a PDF invoice from InvoiceInDB data using an HTML template.

    Args:
        invoice_data: The InvoiceInDB Pydantic model instance.
        your_details: A dictionary containing your company/freelancer info
                      (name, address, tax_id, vat_id, bank_details, etc.).

    Returns:
        PDF content as bytes.
    """
    logger.info(f"Generating PDF for invoice: {invoice_data.invoice_number}")
    try:
        # 1. Load Template
        template_name = f"invoice_{invoice_data.template_id or 'default'}.html"
        try:
            template = jinja_env.get_template(template_name)
        except Exception:
            logger.warning(
                f"Template '{template_name}' not found, falling back to default."
            )
            template = jinja_env.get_template(DEFAULT_TEMPLATE)

        # 2. Prepare Context Data for Jinja
        context = {
            "invoice": invoice_data.model_dump(),  # Pass invoice data as dict
            "your": your_details,  # Pass your company details
            # Add any other helper variables needed by the template
            "current_date": datetime.utcnow(),
        }
        # Convert nested dates in context if Jinja doesn't handle Pydantic date automatically
        context["invoice"]["issue_date"] = invoice_data.issue_date
        context["invoice"]["due_date"] = invoice_data.due_date
        # ... other dates ...

        # 3. Render HTML
        html_content = template.render(context)
        logger.debug("HTML content rendered successfully.")

        # 4. Load CSS (Optional: Could be linked within HTML template)
        css_path = os.path.join(TEMPLATE_DIR, DEFAULT_CSS)
        base_url = (
            TEMPLATE_DIR  # Base URL for relative paths in HTML/CSS (e.g., images)
        )
        stylesheets = (
            [CSS(filename=css_path, font_config=font_config)]
            if os.path.exists(css_path)
            else []
        )
        logger.debug(f"Using base URL for WeasyPrint: {base_url}")
        if stylesheets:
            logger.debug(f"Loading stylesheet: {css_path}")

        # 5. Generate PDF using WeasyPrint
        html = HTML(string=html_content, base_url=base_url)
        pdf_bytes = html.write_pdf(stylesheets=stylesheets, font_config=font_config)

        logger.info(
            f"PDF generated successfully for invoice {invoice_data.invoice_number} ({len(pdf_bytes)} bytes)"
        )
        return pdf_bytes

    except Exception as e:
        logger.error(
            f"Failed to generate PDF for invoice {invoice_data.invoice_number}: {e}",
            exc_info=True,
        )
        # Depending on requirements, you might raise a specific exception
        raise RuntimeError(f"PDF generation failed: {e}") from e


async def generate_and_store_invoice_pdf(
    db: AsyncIOMotorDatabase, invoice_id: UUID, user_id: str
):
    """
    Background task to generate PDF for an invoice and store it in the DB.
    """
    logger.info(f"[BackgroundTask] Starting PDF generation for invoice {invoice_id}")
    # Note: If 'db' passed from endpoint isn't usable here,
    # you might need to establish a new connection or use a dependency injection system.
    # For simplicity, assume 'db' is usable or call get_database() again.
    # db = await get_database() # Example if needing new connection

    try:
        # 1. Fetch the full invoice data again
        invoice_db = await crud_invoice.get(db=db, id=invoice_id, user_id=user_id)
        if not invoice_db:
            logger.error(
                f"[BackgroundTask] Invoice {invoice_id} not found for PDF generation."
            )
            return  # Exit task

        # 2. Check if PDF already exists (optional, prevents re-generation)
        if invoice_db.pdf_content:
            logger.info(
                f"[BackgroundTask] PDF already exists for invoice {invoice_id}. Skipping generation."
            )
            return

        # 3. Get Your Details
        your_details = {
            "name": settings.YOUR_COMPANY_NAME,
            "address_line1": settings.YOUR_ADDRESS_LINE1,
            # ... fill all details needed by the template ...
            "zip_city": settings.YOUR_ZIP_CITY,
            "tax_id": settings.YOUR_TAX_ID,
            "vat_id": settings.YOUR_VAT_ID,
            "bank_account_holder": settings.YOUR_BANK_HOLDER,
            "bank_iban": settings.YOUR_BANK_IBAN,
            "bank_bic": settings.YOUR_BANK_BIC,
            "bank_name": settings.YOUR_BANK_NAME,
        }

        # 4. Generate PDF bytes
        pdf_bytes = await pdf_generator.generate_invoice_pdf(invoice_db, your_details)

        # 5. Update the Invoice in DB with PDF content
        if pdf_bytes:
            invoice_collection = crud_invoice.get_collection(
                db
            )  # Access collection via CRUD instance
            update_result = await invoice_collection.update_one(
                {"_id": invoice_id, "user_id": user_id},
                {"$set": {"pdf_content": pdf_bytes, "updated_at": datetime.utcnow()}},
            )
            if update_result.modified_count == 1:
                logger.info(
                    f"[BackgroundTask] Successfully stored PDF content for invoice {invoice_id}."
                )
            else:
                logger.error(
                    f"[BackgroundTask] Failed to update invoice {invoice_id} with PDF content (modified_count={update_result.modified_count})."
                )
        else:
            logger.error(
                f"[BackgroundTask] PDF generation returned empty bytes for invoice {invoice_id}."
            )

    except Exception as e:
        logger.error(
            f"[BackgroundTask] Error generating/storing PDF for invoice {invoice_id}: {e}",
            exc_info=True,
        )
    # finally:
    # Close DB connection here if you opened a new one for the task
