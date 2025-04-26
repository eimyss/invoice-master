# backend/app/core/db.py
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure

# No need to import CodecOptions here anymore
from pymongo.uri_parser import parse_uri  # Import the URI parser
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
        uuid_representation = "standard"
        logger.info(
            f"Configuring MongoDB client with uuidRepresentation='{uuid_representation}'"
        )

        db.client = AsyncIOMotorClient(
            settings.MONGODB_URL, uuidRepresentation=uuid_representation
        )

        # --- Get Database Name from URI or Default ---
        # Method 1: Use pymongo's URI parser (more robust)
        try:
            # Parse the connection string
            uri_dict = parse_uri(settings.MONGODB_URL)
            db_name = uri_dict.get("database")  # Get the database name if specified
            if not db_name:
                db_name = "rechnungmeister"  # Default if not in URI
                logger.info(
                    f"No database specified in MONGODB_URL, using default: '{db_name}'"
                )
            else:
                logger.info(f"Database specified in MONGODB_URL: '{db_name}'")
        except Exception as parse_error:
            logger.warning(
                f"Could not parse MONGODB_URL to determine database name ({parse_error}), using default 'rechnungmeister'"
            )
            db_name = "rechnungmeister"  # Fallback default

        # Method 2: Simpler approach using client default (less explicit logging)
        # db_name = db.client.get_default_database(default="rechnungmeister").name
        # logger.info(f"Using MongoDB database: '{db_name}'")
        # ------------------------------------------

        # Get the database instance
        db.db = db.client[db_name]  # Access database using dictionary style

        # Ping the server to verify connection
        await db.client.admin.command("ping")
        logger.info(f"Successfully connected to MongoDB database '{db_name}'.")

    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise
    except Exception as e:
        logger.error(
            f"Could not connect to MongoDB or configure client: {e}", exc_info=True
        )
        raise


async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if db.client:
        db.client.close()
        logger.info("MongoDB connection closed.")


async def get_database() -> AsyncIOMotorDatabase:
    if db.db is None:
        logger.warning(
            "Database not initialized. Attempting connection (this shouldn't happen in normal flow)."
        )
        await connect_to_mongo()
    if db.db is None:
        logger.critical("Failed to establish database connection.")
        raise Exception("Database connection could not be established.")
    return db.db

