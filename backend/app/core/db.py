from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings
import logging

logger = logging.getLogger(__name__)


class DataBase:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None


db = DataBase()


async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    try:
        db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        # Extract db name from URL or set explicitly
        db_name = settings.MONGODB_URL.split("/")[-1].split("?")[0]  # Basic extraction
        if not db_name:
            db_name = "rechnungmeister"  # Default DB name
        db.db = db.client[db_name]
        # Ping the server to verify connection
        await db.client.admin.command("ping")
        logger.info("Successfully connected to MongoDB.")
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        # Depending on your strategy, you might want to exit or retry
        raise


async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db.client:
        db.client.close()
        logger.info("MongoDB connection closed.")


async def get_database() -> AsyncIOMotorDatabase:
    if db.db is None:
        # This case shouldn't happen if connect_to_mongo is called on startup
        logger.warning("Database not initialized. Attempting connection.")
        await connect_to_mongo()
    return db.db
