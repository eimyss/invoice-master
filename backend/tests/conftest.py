# tests/conftest.py
import pytest
import pytest_asyncio

from httpx import AsyncClient  # Ensure this is the upgraded httpx
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from uuid import uuid4
from datetime import datetime
import asyncio

from app.models.client import ClientCreate, ClientInDB
from app.models.project import ProjectCreate, ProjectInDB, Rate as ProjectRate

# Assuming your WorkItem models are in app.models.workItem
from app.models.workItem import (
    WorkItemInDB,
    WorkItemCreate,
    TimeEntry,
    ItemStatus,
)  # Added TimeEntry for clarity
from app.crud import (
    crud_workItem,
)  # Import the singleton instances#
from app.crud.crud_client import crud_client
from app.crud.crud_project import crud_project
from app.main import app
from app.core.config import settings
from app.api import deps  # Import the 'deps' module

# --- Mocked User Constants ---
MOCK_USER_SUB = str(uuid4())
MOCK_USER_EMAIL = "mockuser@example.com"
MOCK_USER_NAME = "Mock User"


# --- Mocked Authentication Dependency ---
async def override_get_current_active_user():
    """Mock dependency to return a predefined user payload."""
    return {
        "sub": MOCK_USER_SUB,
        "email": MOCK_USER_EMAIL,
        "name": MOCK_USER_NAME,
        "is_active": True,
    }


# --- Database Fixture (Revised for loop consistency) ---
TEST_DB_URL = "mongodb://localhost:27017/test_rechnung_db"


@pytest_asyncio.fixture(scope="session")
def event_loop(request):
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# --- Re-added/Modified test_user fixture and mock_user_id ---
@pytest.fixture(scope="function")
def test_user() -> dict:
    """
    Provides a dictionary representing the mock user's data.
    This user data is what the API endpoints will "see" due to the
    overridden get_current_active_user dependency.
    This fixture DOES NOT necessarily insert this user into the database,
    as the auth is mocked. It's for providing consistent user details.
    """
    return {
        "sub": MOCK_USER_SUB,
        "email": MOCK_USER_EMAIL,
        "name": MOCK_USER_NAME,
        # Add any other fields your tests might need to reference,
        # that would normally come from the decoded token/user object.
    }


@pytest.fixture(scope="function")
def auth_headers() -> dict:
    return {
        "sub": MOCK_USER_SUB,
        "email": MOCK_USER_EMAIL,
        "name": MOCK_USER_NAME,
        # Add any other fields your tests might need to reference,
        # that would normally come from the decoded token/user object.
    }


@pytest.fixture(scope="function")
def mock_user_id(test_user: dict) -> str:  # Now depends on test_user
    """Returns the 'sub' (ID) of the mock user."""
    return test_user["sub"]


@pytest_asyncio.fixture(scope="session")  # Changed scope to "session"
async def default_test_client(
    db_conn_session: AsyncIOMotorDatabase, mock_user_id_session: str
) -> ClientInDB:
    """Creates a default client once per test session."""
    print("SESSION FIXTURE: Creating default_test_client")
    client_data = ClientCreate(name="Default Test Client Session")
    # Use the singleton crud_client instance for creation
    created_client = await crud_client.create(
        db=db_conn_session, obj_in=client_data, user_id=mock_user_id_session
    )
    return created_client


@pytest_asyncio.fixture(scope="session")  # Changed scope to "session"
async def default_test_project(
    db_conn_session: AsyncIOMotorDatabase,
    default_test_client: ClientInDB,
    mock_user_id_session: str,
) -> ProjectInDB:
    """Creates a default project once per test session, linked to the default client."""
    print("SESSION FIXTURE: Creating default_test_project")
    project_rates = [ProjectRate(name="Session Standard Rate", price_per_hour=120.0)]
    project_data = ProjectCreate(
        name="Default Test Project Session",
        client_id=default_test_client.id,  # Use ID from the session-scoped client
        rates=project_rates,
    )
    # Use the singleton crud_project instance
    created_project = await crud_project.create(
        db=db_conn_session, obj_in=project_data, user_id=mock_user_id_session
    )
    return created_project


@pytest_asyncio.fixture(scope="session")
async def db_conn_session(
    event_loop,
) -> AsyncIOMotorDatabase:  # Similar to db_conn but session-scoped
    original_db_url = settings.MONGODB_URL
    settings.MONGODB_URL = TEST_DB_URL
    client = None
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL, uuidRepresentation="standard")
        await client.admin.command("ping")
        db_instance = client.get_default_database(default="test_rechnung_db")
        # Clear collections once at the start of the session for these session-scoped fixtures
        print("SESSION DB: Clearing collections for session-scoped data setup...")
        collections_to_clear = [
            "clients",
            "projects",
            "workItems",
            "invoices",
            "counters",
            "users",
        ]
        for collection_name in collections_to_clear:
            await db_instance[collection_name].delete_many({})
        print("SESSION DB: Collections cleared for session setup.")
        yield db_instance
    finally:
        if client:
            client.close()
        settings.MONGODB_URL = original_db_url


@pytest.fixture(scope="session")
def mock_user_id_session() -> str:  # Session-scoped mock user ID
    return MOCK_USER_SUB
