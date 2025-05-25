# backend/app/services/email_service.py
import logging
from jinja2 import Environment, BaseLoader  # Use BaseLoader for string templates
from typing import Dict, Any
from app.models.invoice import InvoiceInDB, InvoiceEmailRequest  # Import models

from datetime import date, datetime

logger = logging.getLogger(__name__)

# Setup Jinja2 environment for string templates
string_template_env = Environment(loader=BaseLoader())
string_template_env.filters["date"] = (
    lambda d, fmt="%d.%m.%Y": d.strftime(fmt) if isinstance(d, (date, datetime)) else d
)
string_template_env.filters["currency"] = (
    lambda v, curr="€": f"{v:,.2f}".replace(",", "X")
    .replace(".", ",")
    .replace("X", ".")
    + f" {curr}"
)


async def generate_invoice_email_content(
    invoice: InvoiceInDB,
    email_request: InvoiceEmailRequest,
    your_details: Dict[str, Any],
) -> Dict[str, str]:
    """Generates subject and body for the invoice email."""
    logger.info(f"Generating email content for invoice {invoice.invoice_number}")

    # Prepare context for templates
    context = {
        "invoice": invoice.model_dump(),  # Pass invoice data as dict
        "your": your_details,
        # Add specific fields for easier template access
        "ClientName": invoice.client_snapshot.name
        if invoice.client_snapshot
        else "Client",
        "InvoiceNumber": invoice.invoice_number,
        "TotalAmount": invoice.total_amount,  # Use value already in context dict
        "DueDate": invoice.due_date,  # Use value already in context dict
        "YourName": your_details.get("name", "Your Name"),
        "YourBankDetails": f"""
Kontoinhaber: {your_details.get("bank_account_holder", "")}
IBAN: {your_details.get("bank_iban", "")}
BIC: {your_details.get("bank_bic", "")}
Bank: {your_details.get("bank_name", "")}
        """.strip(),
    }
    # Convert dates in context if needed (might already be handled by Pydantic dump)
    context["invoice"]["issue_date"] = invoice.issue_date
    context["invoice"]["due_date"] = invoice.due_date
    # ... other dates ...

    try:
        # Render Subject
        subject_template = string_template_env.from_string(
            email_request.subject or "Invoice " + invoice.invoice_number
        )
        logger.info(f"Rendered subject template: {subject_template}")
        subject = subject_template.render(context)
        logger.info(f"Rendered subject: {subject}")

        # Render Body
        body_template = string_template_env.from_string(
            email_request.body_template or "Error: Body template missing."
        )
        body = body_template.render(context)

        logger.info("Email subject and body rendered successfully.")
        return {
            "subject": subject,
            "body": body,
            "recipient": email_request.recipient_email,
        }

    except Exception as e:
        logger.error(
            f"Failed to render email template for invoice {invoice.invoice_number}: {e}",
            exc_info=True,
        )
        # Return default or raise error
        return {
            "subject": f"Error processing Invoice {invoice.invoice_number}",
            "body": f"Could not generate email content. Error: {e}",
            "recipient": email_request.recipient_email,
        }


# --- Need datetime ---
