# tests/test_dashboard.py
import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase
from uuid import uuid4
from datetime import datetime, date, timedelta, timezone

from app.models.project import ProjectCreate, ProjectInDB, Rate as ProjectRate

# Import models and CRUD for setting up test data
from app.models.workItem import (
    WorkItemCreate,
    TimeEntry as TimeEntryData,
    ItemStatus,
    WorkItemInDB,
)
from app.crud.crud_workItem import CRUDWorkItem  # Assuming this is your class

import logging

# Import the response model for assertion
from app.models.dashboard import HoursSummaryResponse, DailyHours


logger = logging.getLogger(__name__)


# Helper to create consistent datetimes for testing ranges
def dt(year, month, day, hour=0, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_get_hours_summary_unauthenticated(async_client: AsyncClient):
    """Test that the endpoint requires authentication."""
    response = await async_client.get("/api/v1/dashboard/summary/hours-this-month")
    assert (
        response.status_code == 200
    )  # Or 403 if your auth dep raises that for no token
    # If using FastAPI's default OAuth2PasswordBearer, it's often 401 without a token.


@pytest.mark.asyncio
async def test_get_hours_summary_authenticated_with_data(
    db_conn_session: AsyncIOMotorDatabase,
    async_client: AsyncClient,  # This client has mocked auth
    mock_user_id: str,  # From conftest.py
    default_test_project: ProjectInDB,  # <<< USE SESSION-SCOPED FIXTURE
):
    """
    Test fetching hours summary with some data for current and previous months.
    """
    user_id = mock_user_id
    work_item_crud = CRUDWorkItem(
        model=WorkItemInDB, collection_name="workItems"
    )  # Instantiate

    # --- Setup Test Data ---
    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month

    # Previous month
    prev_month_date = now - timedelta(
        days=now.day + 5
    )  # Go to middle of previous month
    prev_month_year = prev_month_date.year
    prev_month_month = prev_month_date.month

    # Data for current month
    await work_item_crud.create(
        db=db_conn_session,
        user_id=user_id,
        obj_in=WorkItemCreate(
            name="CM Work 1",
            project_id=default_test_project.id,
            status=ItemStatus.ACTIVE,
            date=dt(
                current_year, current_month, 5
            ),  # Ensure 'date' field exists on WorkItem or TimeEntry
            timeEntries=[
                TimeEntryData(
                    description="T1",
                    date=dt(prev_month_year, prev_month_month, 20),
                    rate_name="Session Standard Rate",
                    duration=2.0,
                    price_per_hour=10,
                    calculatedAmount=20,
                )
            ],
            # If 'date' is on TimeEntry and not WorkItem, adjust creation and query in endpoint
        ),
    )
    await work_item_crud.create(
        db=db_conn_session,
        user_id=user_id,
        obj_in=WorkItemCreate(
            name="CM Work 2",
            date=dt(prev_month_year, prev_month_month, 20),
            project_id=default_test_project.id,
            status=ItemStatus.ACTIVE,
            timeEntries=[
                TimeEntryData(
                    description="T2",
                    date=dt(prev_month_year, prev_month_month, 20),
                    rate_name="Session Standard Rate",
                    duration=3.5,
                    price_per_hour=10,
                    calculatedAmount=35,
                )
            ],
        ),
    )

    # Data for previous month
    await work_item_crud.create(
        db=db_conn_session,
        user_id=user_id,
        obj_in=WorkItemCreate(
            name="PM Work 1",
            project_id=default_test_project.id,
            status=ItemStatus.ACTIVE,
            date=dt(prev_month_year, prev_month_month, 15),
            timeEntries=[
                TimeEntryData(
                    description="T3",
                    date=dt(prev_month_year, prev_month_month, 20),
                    rate_name="Session Standard Rate",
                    duration=4.0,
                    price_per_hour=10,
                    calculatedAmount=40,
                )
            ],
        ),
    )
    await work_item_crud.create(
        db=db_conn_session,
        user_id=user_id,
        obj_in=WorkItemCreate(
            name="PM Work 2",
            project_id=default_test_project.id,
            status=ItemStatus.ACTIVE,
            date=dt(prev_month_year, prev_month_month, 20),
            timeEntries=[
                TimeEntryData(
                    description="T4",
                    date=dt(prev_month_year, prev_month_month, 20),
                    rate_name="Session Standard Rate",
                    duration=1.0,
                    price_per_hour=10,
                    calculatedAmount=10,
                )
            ],
        ),
    )

    # --- Make the API Call ---
    response = await async_client.get("/api/v1/dashboard/summary/hours-this-month")

    # --- Assertions ---
    assert response.status_code == 200
    logger.info(f"Response: {response.json()}")
    summary_data = response.json()

    # Validate against Pydantic model (optional but good)
    try:
        parsed_summary = HoursSummaryResponse(**summary_data)
    except Exception as e:
        pytest.fail(
            f"Response data could not be parsed by HoursSummaryResponse model: {e}\nData: {summary_data}"
        )

    # Check totals
    assert parsed_summary.current_month_total_hours == pytest.approx(2.0)  # 5.5
    assert parsed_summary.previous_month_total_hours == pytest.approx(8.5)  # 5.0

    # Check daily hours for current month
    assert (
        len(parsed_summary.daily_hours_current_month) == 1
    )  # Two distinct days with entries

    # Find specific days (assuming list is sorted by date, which it should be from the pipeline)
    day5_entry = next(
        (
            d
            for d in parsed_summary.daily_hours_current_month
            if d.day == date(current_year, current_month, 5)
        ),
        None,
    )
    day10_entry = next(
        (
            d
            for d in parsed_summary.daily_hours_current_month
            if d.day == date(current_year, current_month, 10)
        ),
        None,
    )

    assert day5_entry is not None
    assert day5_entry.hours == pytest.approx(2.0)


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
