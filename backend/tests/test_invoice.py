# tests/test_dashboard.py
import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase
from uuid import uuid4
from datetime import datetime, date, timedelta, timezone

from app.services import pdf_generator, email_service  # Import services
from app.models.project import ProjectCreate, ProjectInDB, Rate as ProjectRate

# Import models and CRUD for setting up test data
from app.models.workItem import (
    WorkItemCreate,
    TimeEntry as TimeEntryData,
    ItemStatus,
    WorkItemInDB,
)
from app.models.invoice import InvoiceCreateRequest
from app.crud.crud_workItem import crud_workItem
from app.models.client import ClientInDB
import logging
from app.crud.crud_invoice import crud_invoice

# Import the response model for assertion
from app.models.dashboard import HoursSummaryResponse, DailyHours


logger = logging.getLogger(__name__)


def dt(year, month, day, hour=0, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_create_pdf_invoice_from_crud(
    db_conn_session: AsyncIOMotorDatabase,
    mock_user_id: str,
    default_test_client: ClientInDB,  # <<< USE SESSION-SCOPED FIXTURE
    default_test_project: ProjectInDB,  # <<< USE SESSION-SCOPED FIXTURE
    default_test_workItem: WorkItemInDB,  # <<< USE SESSION-SCOPED FIXTURE
):
    """
    Test fetching hours summary with some data for current and previous months.
    """
    user_id = mock_user_id

    invoice_create_request = InvoiceCreateRequest(
        client_id=default_test_client.id,
        project_ids=[default_test_project.id],
        time_entry_ids=[default_test_workItem.id],
        notes="this is test request",
    )  # --- Setup Test Data ---

    created_invoice = await crud_invoice.create_from_request(
        db=db_conn_session, user_id=user_id, request=invoice_create_request
    )

    await pdf_generator.generate_and_store_invoice_pdf(
        db=db_conn_session, invoice_id=created_invoice.id, user_id=user_id
    )

    logger.info("Created PDF")
    # we get it from db. becase we need updated version with pdf content
    created_invoice_db = await crud_invoice.get(
        db=db_conn_session, id=created_invoice.id, user_id=user_id
    )

    # --- Assertions ---
    assert created_invoice_db is not None
    assert created_invoice_db.invoice_number is not None
    assert created_invoice_db.issue_date == date.today()
    assert created_invoice_db.subtotal == 600.0
    assert created_invoice_db.tax_rate == 19
    assert created_invoice_db.tax_amount == 114
    assert created_invoice_db.total_amount == 714.0
    assert created_invoice_db.status == ItemStatus.PROCESSED
    assert created_invoice_db.notes == "this is test request"
    assert len(created_invoice_db.line_items) == 2
    assert created_invoice_db.pdf_content is not None

    updated_te1 = await crud_workItem.get(
        db=db_conn_session, id=default_test_workItem.id, user_id=user_id
    )
    logger.info(f"Checking updated work Item: {updated_te1}")
    assert updated_te1 is not None
    assert updated_te1.invoice_id == created_invoice_db.id
    assert updated_te1.status == ItemStatus.PROCESSED


@pytest.mark.asyncio
async def test_get_hours_summary_no_data(
    db_conn_session: AsyncIOMotorDatabase,
    async_client: AsyncClient,
    mock_user_id: str,
):
    """Test fetching hours summary when there are no work items."""
    # No data setup for user mock_user_id

    response = await async_client.get("/api/v1/dashboard/summary/hours-this-month")
    assert response.status_code == 200
    summary_data = response.json()

    try:
        parsed_summary = HoursSummaryResponse(**summary_data)
    except Exception as e:
        pytest.fail(
            f"Response data could not be parsed for no_data case: {e}\nData: {summary_data}"
        )

    assert parsed_summary.current_month_total_hours == 0.0
    assert parsed_summary.previous_month_total_hours == 0.0
    assert len(parsed_summary.daily_hours_current_month) == 0
