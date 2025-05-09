# tests/conftest.py
import pytest
import pytest_asyncio

from httpx import AsyncClient  # Ensure this is the upgraded httpx
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from uuid import uuid4
from datetime import datetime
import asyncio

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


@pytest_asyncio.fixture(scope="function")
async def db_conn(event_loop) -> AsyncIOMotorDatabase:
    original_db_url = settings.MONGODB_URL
    settings.MONGODB_URL = TEST_DB_URL
    client = None
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL, uuidRepresentation="standard")
        await client.admin.command("ping")
        db_instance = client.get_default_database(default="test_rechnung_db")
        yield db_instance
    finally:
        if client:
            client.close()
        settings.MONGODB_URL = original_db_url


@pytest_asyncio.fixture(scope="function", autouse=True)
async def clear_collections(db_conn: AsyncIOMotorDatabase):
    collections_to_clear = [
        "clients",
        "projects",
        "workItems",
        "invoices",
        "counters",
        "users",
    ]
    for collection_name in collections_to_clear:
        await db_conn[collection_name].delete_many({})
    yield


# --- API Test Client Fixture ---
@pytest_asyncio.fixture(scope="function")
async def async_client(
    db_conn: AsyncIOMotorDatabase,
) -> AsyncClient:  # Added db_conn dependency
    async def override_get_database() -> AsyncIOMotorDatabase:
        return db_conn

    app.dependency_overrides[deps.get_db] = override_get_database
    app.dependency_overrides[deps.get_current_active_user] = (
        override_get_current_active_user
    )
    async with AsyncClient(base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.pop(deps.get_db, None)
    app.dependency_overrides.pop(deps.get_current_active_user, None)


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


# ---------------------------------------------------------------
