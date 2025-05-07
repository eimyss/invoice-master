# backend/app/services/pdf_generator.py
import logging
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
from datetime import date, datetime
from typing import Dict, Any

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
