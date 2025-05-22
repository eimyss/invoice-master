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


@pytest.mark.asyncio
async def test_hours_this_month(
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

    result_from_crud = await crud_workItem.get_single_with_details(
        db=db_conn_session, item_id=te1.id, user_id=user_id
    )
    logger.info(f"Item : {result_from_crud}")
    assert result_from_crud.client_name == default_test_client.name
    assert result_from_crud.project_name == default_test_project.name
    assert len(result_from_crud.timeEntries) == 2
    assert result_from_crud.timeEntries[0].calculatedAmount == 240
    assert result_from_crud.timeEntries[0].price_per_hour == 120
    assert result_from_crud.timeEntries[0].duration == 2.0
    assert result_from_crud.timeEntries[0].rate_name == "Session Standard Rate"
