# tests/conftest.py
import pytest
import pytest_asyncio

from httpx import ASGITransport, AsyncClient
from httpx import AsyncClient
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


async def override_get_current_active_user():
    """
    Mock dependency to return a predefined user payload,
    bypassing actual token validation.
    """
    print(
        f"[CONTEST_AUTH_OVERRIDE] Providing mock user: sub={MOCK_USER_SUB}"
    )  # Log when override is used
    return {
        "sub": MOCK_USER_SUB,
        "email": MOCK_USER_EMAIL,
        "name": MOCK_USER_NAME,
        "is_active": True,  # Assuming your real dep might check this
        # Add other claims your app might use from the token
        # "groups": ["test_group"],
    }


# --- Database Fixture (Revised for loop consistency) ---
TEST_DB_URL = "mongodb://localhost:27017/test_rechnung_db"


@pytest_asyncio.fixture(scope="function")
async def async_client(
    db_conn_session: AsyncIOMotorDatabase,
) -> AsyncClient:  # Depends on db_conn
    """
    Provides an AsyncClient for making API requests to the test app,
    with authentication and database dependencies overridden for testing.
    """

    # Define the override for the database dependency
    async def override_get_database_for_test() -> AsyncIOMotorDatabase:
        # print("[ASYNC_CLIENT_DB_OVERRIDE] Providing db_conn fixture to app")
        return db_conn_session  # Return the function-scoped test DB connection

    # Store original dependencies to restore them later
    original_get_db = deps.get_db if hasattr(deps, "get_db") else None
    original_get_current_user = (
        deps.get_current_active_user
        if hasattr(deps, "get_current_active_user")
        else None
    )

    # Apply overrides
    if hasattr(deps, "get_db"):
        app.dependency_overrides[deps.get_db] = override_get_database_for_test
    if hasattr(deps, "get_current_active_user"):
        app.dependency_overrides[deps.get_current_active_user] = (
            override_get_current_active_user
        )

    print(f"Type of AsyncClient being used: {type(AsyncClient)}")
    print(f"Module of AsyncClient: {AsyncClient.__module__}")
    print(
        f"Version of httpx from AsyncClient: {getattr(AsyncClient, '__version__', 'N/A')}"
    )  # May not exist, but try

    print("[ASYNC_CLIENT_FIXTURE] Initialized with overridden dependencies.")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        yield client

    # Clean up overrides after the test client is done
    print("[ASYNC_CLIENT_FIXTURE] Cleaning up dependency overrides.")
    if original_get_db:
        app.dependency_overrides[deps.get_db] = original_get_db
    else:
        app.dependency_overrides.pop(deps.get_db, None)

    if original_get_current_user:
        app.dependency_overrides[deps.get_current_active_user] = (
            original_get_current_user
        )
    else:
        app.dependency_overrides.pop(deps.get_current_active_user, None)


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


@pytest_asyncio.fixture(scope="function")  # Changed scope to "session"
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


@pytest_asyncio.fixture(scope="function")  # Changed scope to "session"
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


@pytest_asyncio.fixture(scope="function", autouse=True)
async def clear_collections(
    db_conn: AsyncIOMotorDatabase,
):  # <<< Depends on FUNCTION-scoped db_conn
    """Clears relevant collections before each test function using the function's DB connection."""
    # print(f"[clear_collections ({id(db_conn)})] Running BEFORE test. Loop: {id(asyncio.get_running_loop())}")
    collections_to_clear = [
        "clients",
        "projects",
        "workItems",  # Use the correct case as defined in your code
        "invoices",
        "counters",
        "users",  # Add users if you have a users collection for tests
    ]
    for collection_name in collections_to_clear:
        await db_conn[collection_name].delete_many({})
    yield
    # print(f"[clear_collections ({id(db_conn)})] Running AFTER test.")


# -----------------------------------------------------------------


@pytest_asyncio.fixture(scope="function")
async def db_conn(event_loop) -> AsyncIOMotorDatabase:
    original_db_url = settings.MONGODB_URL
    settings.MONGODB_URL = TEST_DB_URL
    client = None
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL, uuidRepresentation="standard")
        await client.admin.command("ping")
        db_instance = client.get_default_database(default="test_rechnung_db")
        # print(f"[db_conn FUNCTION SCOPE ({id(db_instance)})] Yielding DB. Loop: {id(asyncio.get_running_loop())}")
        yield db_instance
    finally:
        if client:
            client.close()
        settings.MONGODB_URL = original_db_url


@pytest_asyncio.fixture(scope="function")
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


@pytest_asyncio.fixture(scope="session")
def mock_user_id_session() -> str:  # Session-scoped mock user ID
    return MOCK_USER_SUB
