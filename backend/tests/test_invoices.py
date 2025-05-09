# tests/test_invoices.py
import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase  # Changed from AsyncIOMotorClient
from uuid import UUID, uuid4
from datetime import datetime, date, timedelta, timezone, UTC

# Import models and CRUD functions
from app.models.client import ClientCreate, ClientInDB
from app.models.project import ProjectCreate, ProjectInDB, Rate as ProjectRate
from app.models.invoice import InvoiceCreateRequest, InvoiceInDB
from app.crud import (
    crud_client,
    crud_project,
    crud_workItem,
)  # Assuming crud_time_entry
from app.crud.crud_invoice import crud_invoice  # The instance
from app.models.workItem import (
    WorkItemInDB,
    WorkItemCreate,
    TimeEntry,
    TimeEntryCreate,
    ItemStatus,
)


# --- Test 1: Invoice Amount Calculation ---
@pytest.mark.asyncio
async def test_invoice_creation_calculates_correct_amount(
    db_conn: AsyncIOMotorDatabase,  # Use db_conn from conftest
    test_user: dict,
    async_client: AsyncClient,  # For API level test
    auth_headers: dict,
):
    """
    Tests if the invoice creation process correctly sums amounts from time entries.
    """
    user_id = test_user["sub"]

    # 1. Setup: Create Client, Project, and Time Entries
    # Client
    client_crud = crud_client.CRUDClient(ClientInDB, collection_name="clients")
    client_data = ClientCreate(name="Test Client for Invoice Calc")
    created_client = await client_crud.create(
        db=db_conn, obj_in=client_data, user_id=user_id
    )

    # Project
    project_crud = crud_project.CRUDProject(ProjectInDB, collection_name="projects")
    project_rates = [ProjectRate(name="Standard Rate", price_per_hour=100.0)]
    project_data = ProjectCreate(
        name="Project for Invoice Calc",
        client_id=created_client.id,
        rates=project_rates,
    )
    created_project = await project_crud.create(
        db=db_conn, obj_in=project_data, user_id=user_id
    )

    # Time Entries
    time_entry_crud = crud_workItem.CRUDWorkItem(
        WorkItemInDB, collection_name="workItems"
    )  # Instantiate

    timeEntry_data_1 = TimeEntryCreate(
        description="Time Entry item 1",  # Description of the rate
        rate_name="Standard Rate 1",  # Name of the original rate in the project
        duration=2.0,  # hours
        price_per_hour=100.0,  # Price per hour for this item
    )
    timeEntry_data_2 = TimeEntryCreate(
        description="Time Entry item 2",  # Description of the rate
        rate_name="Standard Rate 2",  # Name of the original rate in the project
        duration=5.0,  # hours
        price_per_hour=150.0,  # Price per hour for this item
    )
    timeEntry_data_3 = TimeEntryCreate(
        description="Time Entry item 3",  # Description of the rate
        rate_name="Standard Rate 3",  # Name of the original rate in the project
        duration=2.0,  # hours
        price_per_hour=100.0,  # Price per hour for this item
    )
    timeEntry_data_4 = TimeEntryCreate(
        description="Time Entry item 4",  # Description of the rate
        rate_name="Standard Rate 4",  # Name of the original rate in the project
        duration=5.0,  # hours
        price_per_hour=150.0,  # Price per hour for this item
    )
    te1_data = WorkItemCreate(
        project_id=created_project.id,
        name="Work item 1",
        description="Work item 1",
        status=ItemStatus.CREATED,
        timeEntries=[timeEntry_data_1, timeEntry_data_2],
        start_date=datetime.now(UTC),
        end_date=datetime.now(UTC) + timedelta(days=7),
    )
    te1 = await time_entry_crud.create(db=db_conn, obj_in=te1_data, user_id=user_id)

    te2_data = WorkItemCreate(
        project_id=created_project.id,
        name="Work item 2",
        description="Work item 2",
        status=ItemStatus.CREATED,
        timeEntries=[timeEntry_data_3, timeEntry_data_4],
        start_date=datetime.now(UTC),
        end_date=datetime.now(UTC) + timedelta(days=7),
    )
    te2 = await time_entry_crud.create(db=db_conn, obj_in=te2_data, user_id=user_id)

    # 2. Prepare Invoice Creation Request (via API)
    invoice_request_data = InvoiceCreateRequest(
        client_id=created_client.id,
        project_ids=[created_project.id],
        time_entry_ids=[te1.id, te2.id],
        due_date_days=14,
        tax_rate=19.0,  # Example tax rate
    )

    created_invoice_api_data = await crud_invoice.create_from_request(
        db=db_conn, user_id=user_id, request=invoice_request_data
    )

    # 4. Assertions
    # expected_subtotal = te1.amount + te2.amount  # 200.0 + 150.0 = 350.0
    expected_subtotal = 1900  # 200.0 + 150.0 = 350.0
    expected_tax_amount = round(expected_subtotal * 0.19, 2)
    expected_total_amount = round(expected_subtotal + expected_tax_amount, 2)

    assert created_invoice_api_data.subtotal == pytest.approx(expected_subtotal)
    assert created_invoice_api_data.tax_amount == pytest.approx(expected_tax_amount)
    assert created_invoice_api_data.total_amount == pytest.approx(expected_total_amount)
    assert (
        len(created_invoice_api_data.line_items) == 4
    )  # Two time entries -> two line items (in this simple setup)

    # Verify time entries are marked as invoiced
    updated_te1 = await time_entry_crud.get(db=db_conn, id=te1.id, user_id=user_id)
    updated_te2 = await time_entry_crud.get(db=db_conn, id=te2.id, user_id=user_id)
    assert updated_te1.invoice_id == created_invoice_api_data.id
    assert updated_te2.invoice_id == created_invoice_api_data.id
    assert updated_te1.status == ItemStatus.PROCESSED
    assert updated_te2.status == ItemStatus.PROCESSED
