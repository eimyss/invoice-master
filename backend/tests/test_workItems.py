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
from app.crud.crud_invoice import crud_invoice  # The instance
from app.models.workItem import (
    WorkItemInDB,
    WorkItemCreate,
    TimeEntry as TimeEntryData,
    ItemStatus,
)  # Renamed TimeEntryCreate to TimeEntryData

from app.crud.crud_workItem import crud_workItem
from app.crud import (
    crud_client,
    crud_project,
)  # Assuming crud_time_entry

import logging

logger = logging.getLogger(__name__)
"""
Firefox sends this: 
POST: 
host
	localhost:8000
filename
	/api/v1/workItems/
{
  "name": "Work Items Another TEst",
  "timeEntries": [
    {
      "rate_name": "Consulting",
      "rate_price_per_hour": 120,
      "duration": 5.5,
      "description": "Consulting Jboss"
    },
    {
      "rate_name": "Administration",
      "rate_price_per_hour": 150,
      "duration": 13,
      "description": "Admin Jboss"
    }
  ],
  "project_id": "b55ea0a6-571d-4027-95bb-efd0b30a593c",
  "status": "created"
}


"""


# --- Test 1: Invoice Amount Calculation ---
@pytest.mark.asyncio
async def test_invoice_creation_calculates_correct_amount(
    db_conn_session: AsyncIOMotorDatabase,  # Use db_conn from conftest
    test_user: dict,
    default_test_client: AsyncClient,  # For API level test
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
        db=db_conn_session, obj_in=client_data, user_id=user_id
    )

    # Project
    project_crud = crud_project.CRUDProject(ProjectInDB, collection_name="projects")
    project_rates = [ProjectRate(name="Session Standard Rate", price_per_hour=120.0)]
    project_data = ProjectCreate(
        name="Project for Invoice Calc",
        client_id=created_client.id,
        rates=project_rates,
    )
    created_project = await project_crud.create(
        db=db_conn_session, obj_in=project_data, user_id=user_id
    )

    # Time Entries
    timeEntry_data_1 = TimeEntryData(
        description="Time Entry item 1",  # Description of the rate
        rate_name="Session Standard Rate",  # Name of the original rate in the project
        duration=2.0,  # hours
        price_per_hour=100.0,  # Price per hour for this item
    )
    timeEntry_data_2 = TimeEntryData(
        description="Time Entry item 2",  # Description of the rate
        rate_name="Session Standard Rate",  # Name of the original rate in the project
        duration=5.0,  # hours
        price_per_hour=150.0,  # Price per hour for this item
    )
    timeEntry_data_3 = TimeEntryData(
        description="Time Entry item 3",  # Description of the rate
        rate_name="Session Standard Rate",  # Name of the original rate in the project
        duration=2.0,  # hours
        price_per_hour=100.0,  # Price per hour for this item
    )
    timeEntry_data_4 = TimeEntryData(
        description="Time Entry item 4",  # Description of the rate
        rate_name="Session Standard Rate",  # Name of the original rate in the project
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
    te1 = await crud_workItem.create(
        db=db_conn_session, obj_in=te1_data, user_id=user_id
    )

    te2_data = WorkItemCreate(
        project_id=created_project.id,
        name="Work item 2",
        description="Work item 2",
        status=ItemStatus.CREATED,
        timeEntries=[timeEntry_data_3, timeEntry_data_4],
        start_date=datetime.now(UTC),
        end_date=datetime.now(UTC) + timedelta(days=7),
    )
    te2 = await crud_workItem.create(
        db=db_conn_session, obj_in=te2_data, user_id=user_id
    )

    # 2. Prepare Invoice Creation Request (via API)
    invoice_request_data = InvoiceCreateRequest(
        client_id=created_client.id,
        project_ids=[created_project.id],
        time_entry_ids=[te1.id, te2.id],
        due_date_days=14,
        tax_rate=19.0,  # Example tax rate
    )

    created_invoice_api_data = await crud_invoice.create_from_request(
        db=db_conn_session, user_id=user_id, request=invoice_request_data
    )

    # 4. Assertions
    # expected_subtotal = te1.amount + te2.amount  # 200.0 + 150.0 = 350.0
    expected_subtotal = 1680  # 200.0 + 150.0 = 350.0
    expected_tax_amount = round(expected_subtotal * 0.19, 2)
    expected_total_amount = round(expected_subtotal + expected_tax_amount, 2)

    assert created_invoice_api_data.subtotal == pytest.approx(expected_subtotal)
    assert created_invoice_api_data.tax_amount == pytest.approx(expected_tax_amount)
    assert created_invoice_api_data.total_amount == pytest.approx(expected_total_amount)
    assert (
        len(created_invoice_api_data.line_items) == 4
    )  # Two time entries -> two line items (in this simple setup)

    # Verify time entries are marked as invoiced
    updated_te1 = await crud_workItem.get(
        db=db_conn_session, id=te1.id, user_id=user_id
    )
    updated_te2 = await crud_workItem.get(
        db=db_conn_session, id=te2.id, user_id=user_id
    )
    assert updated_te1.invoice_id == created_invoice_api_data.id
    assert updated_te2.invoice_id == created_invoice_api_data.id
    assert updated_te1.status == ItemStatus.PROCESSED
    assert updated_te2.status == ItemStatus.PROCESSED


@pytest.mark.asyncio
async def test_invoice_creation_calculates_correct_amount_with_fixtures(
    db_conn_session: AsyncIOMotorDatabase,
    mock_user_id: str,  # For creating work items specific to this test
    default_test_client: ClientInDB,  # <<< USE SESSION-SCOPED FIXTURE
    default_test_project: ProjectInDB,  # <<< USE SESSION-SCOPED FIXTURE
):
    """
    Tests if the invoice creation process correctly sums amounts from time entries.
    """
    user_id = mock_user_id  # User ID for this test's specific data

    # Client and Project are now provided by fixtures default_test_client and default_test_project

    # 1. Setup: Create Time Entries (WorkItems) linked to the default project
    # Ensure your WorkItemCreate can handle the structure of TimeEntryData for its timeEntries field
    time_entry_data_1 = TimeEntryData(
        description="Session Work item 1 task 1",
        rate_name="Session Standard Rate",
        duration=2.0,
        price_per_hour=120.0,
        calculatedAmount=240.0,
    )
    time_entry_data_2 = TimeEntryData(
        description="Session Work item 1 task 2",
        rate_name="Session Standard Rate",
        duration=3.0,
        price_per_hour=120.0,
        calculatedAmount=360.0,
    )
    te1_data = WorkItemCreate(
        name="Work Item for Session Project 1",
        project_id=default_test_project.id,
        status=ItemStatus.CREATED,
        timeEntries=[time_entry_data_1, time_entry_data_2],  # List of TimeEntryData
        start_date=datetime.now(UTC),  # Use UTC for timezone aware
        # No date_from/date_to directly on WorkItemCreate if they come from timeEntries
    )
    te1 = await crud_workItem.create(
        db=db_conn_session, obj_in=te1_data, user_id=user_id
    )

    time_entry_data_3 = TimeEntryData(
        description="Session Work item 2 task 1",
        rate_name="Session Standard Rate",
        duration=1.0,
        price_per_hour=120.0,
        calculatedAmount=120.0,
    )
    te2_data = WorkItemCreate(
        name="Work Item for Session Project 2",
        project_id=default_test_project.id,
        status=ItemStatus.CREATED,
        timeEntries=[time_entry_data_3],
        start_date=datetime.now(UTC),
    )
    te2 = await crud_workItem.create(
        db=db_conn_session, obj_in=te2_data, user_id=user_id
    )

    # 2. Prepare Invoice Creation Request (via API or direct CRUD call for focused test)
    # Using direct CRUD call to focus on calculation logic, not API serialization for this test
    invoice_request_data = InvoiceCreateRequest(
        client_id=default_test_client.id,
        project_ids=[default_test_project.id],
        time_entry_ids=[te1.id, te2.id],  # These are WorkItem IDs
        due_date_days=14,
        tax_rate=19.0,
    )

    # Call the CRUD function directly to test its calculation
    created_invoice_db_model = await crud_invoice.create_from_request(
        db=db_conn_session, user_id=user_id, request=invoice_request_data
    )

    # 4. Assertions
    # Calculate expected subtotal based on ALL TimeEntryData amounts within te1 and te2
    expected_subtotal = (
        time_entry_data_1.calculatedAmount
        + time_entry_data_2.calculatedAmount
        + time_entry_data_3.calculatedAmount
    )  # 240 + 360 + 120 = 720

    expected_tax_amount = round(expected_subtotal * 0.19, 2)
    expected_total_amount = round(expected_subtotal + expected_tax_amount, 2)

    assert created_invoice_db_model.subtotal == pytest.approx(expected_subtotal)
    assert created_invoice_db_model.tax_amount == pytest.approx(expected_tax_amount)
    assert created_invoice_db_model.total_amount == pytest.approx(expected_total_amount)
    # The number of line items depends on how your create_from_request groups them.
    # If it creates one line item per TimeEntryData, then 3.
    # If it creates one line item per WorkItem, then 2.
    # Based on previous InvoiceLineItem, it seems to create per TimeEntryData
    assert len(created_invoice_db_model.line_items) == 3

    # Verify work items are marked as invoiced
    # Assuming your WorkItem model has invoice_id and status
    updated_te1 = await crud_workItem.get(
        db=db_conn_session, id=te1.id, user_id=user_id
    )
    updated_te2 = await crud_workItem.get(
        db=db_conn_session, id=te2.id, user_id=user_id
    )
    assert updated_te1.invoice_id == created_invoice_db_model.id
    assert updated_te2.invoice_id == created_invoice_db_model.id


@pytest.mark.asyncio
async def test_work_items_create_and_retrieve(
    db_conn_session: AsyncIOMotorDatabase,
    mock_user_id: str,  # For creating work items specific to this test
    default_test_client: ClientInDB,  # <<< USE SESSION-SCOPED FIXTURE
    default_test_project: ProjectInDB,  # <<< USE SESSION-SCOPED FIXTURE
):
    """
    Tests if the Work Item is created and it can be retrieved
    """
    user_id = mock_user_id  # User ID for this test's specific data

    # Client and Project are now provided by fixtures default_test_client and default_test_project

    # 1. Setup: Create Time Entries (WorkItems) linked to the default project
    # Ensure your WorkItemCreate can handle the structure of TimeEntryData for its timeEntries field
    time_entry_data_1 = TimeEntryData(
        description="Session Work item 1 task 1",
        rate_name="Session Standard Rate",
        duration=2.0,
        price_per_hour=120.0,
    )
    time_entry_data_2 = TimeEntryData(
        description="Session Work item 1 task 2",
        rate_name="Session Standard Rate",
        duration=3.0,
        price_per_hour=120.0,
    )
    te1_data = WorkItemCreate(
        name="Work Item for Session Project 1",
        project_id=default_test_project.id,
        status=ItemStatus.CREATED,
        timeEntries=[time_entry_data_1, time_entry_data_2],  # List of TimeEntryData
        start_date=datetime.now(UTC),  # Use UTC for timezone aware
        # No date_from/date_to directly on WorkItemCreate if they come from timeEntries
    )
    te1 = await crud_workItem.create(
        db=db_conn_session, obj_in=te1_data, user_id=user_id
    )

    # 2. Prepare Invoice Creation Request (via API or direct CRUD call for focused test)
    # 4. Assertions
    # Calculate expected subtotal based on ALL TimeEntryData amounts within te1 and te2
    updated_te1 = await crud_workItem.get(
        db=db_conn_session, id=te1.id, user_id=user_id
    )

    results_from_crud = await crud_workItem.get_multi_with_project_name(
        db=db_conn_session,
        user_id=user_id,
        project_id=default_test_project.id,
    )
    assert len(results_from_crud) == 3

    assert results_from_crud[0].name == te1_data.name
    assert results_from_crud[0].description == te1_data.description
    assert len(results_from_crud[0].timeEntries) == 2
    assert results_from_crud[0].timeEntries[0].calculatedAmount == 240
    assert results_from_crud[0].timeEntries[0].price_per_hour == 120
    assert results_from_crud[0].timeEntries[0].duration == 2.0
    assert results_from_crud[0].timeEntries[0].rate_name == "Session Standard Rate"

@pytest.mark.asyncio
async def test_single_item_create_and_retrieve_with_aggregated_field(
    db_conn_session: AsyncIOMotorDatabase,
    mock_user_id: str,  # For creating work items specific to this test
    default_test_client: ClientInDB,  # <<< USE SESSION-SCOPED FIXTURE
    default_test_project: ProjectInDB,  # <<< USE SESSION-SCOPED FIXTURE
):
    """
    Tests if the Work Item is created and it can be retrieved
    """
    user_id = mock_user_id  # User ID for this test's specific data

    # Client and Project are now provided by fixtures default_test_client and default_test_project

    # 1. Setup: Create Time Entries (WorkItems) linked to the default project
    # Ensure your WorkItemCreate can handle the structure of TimeEntryData for its timeEntries field
    time_entry_data_1 = TimeEntryData(
        description="Session Work item 1 task 1",
        rate_name="Session Standard Rate",
        duration=2.0,
        price_per_hour=120.0,
    )
    time_entry_data_2 = TimeEntryData(
        description="Session Work item 1 task 2",
        rate_name="Session Standard Rate",
        duration=3.0,
        price_per_hour=120.0,
    )
    te1_data = WorkItemCreate(
        name="Work Item for Session Project 1",
        project_id=default_test_project.id,
        status=ItemStatus.CREATED,
        timeEntries=[time_entry_data_1, time_entry_data_2],  # List of TimeEntryData
        start_date=datetime.now(UTC),  # Use UTC for timezone aware
        # No date_from/date_to directly on WorkItemCreate if they come from timeEntries
    )
    te1 = await crud_workItem.create(
        db=db_conn_session, obj_in=te1_data, user_id=user_id
    )

    # 2. Prepare Invoice Creation Request (via API or direct CRUD call for focused test)
    # 4. Assertions
    # Calculate expected subtotal based on ALL TimeEntryData amounts within te1 and te2

    result_from_crud = await crud_workItem.get_single_with_details( db=db_conn_session, item_id=te1.id, user_id=user_id)
    logger.info(f"Item : {result_from_crud}")
    assert result_from_crud.client_name == default_test_client.name
    assert result_from_crud.project_name == default_test_project.name
    assert len(result_from_crud.timeEntries) == 2 
    assert result_from_crud.timeEntries[0].calculatedAmount == 240
    assert result_from_crud.timeEntries[0].price_per_hour == 120
    assert result_from_crud.timeEntries[0].duration == 2.0
    assert result_from_crud.timeEntries[0].rate_name == "Session Standard Rate"



