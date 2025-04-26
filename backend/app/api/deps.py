from typing import Generator, Dict, Any
from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_database
from app.core.security import get_current_user  # Import the actual dependency

# Re-export for easier access in endpoint files
from app.core.security import get_current_user


# Dependency to get DB session
async def get_db() -> AsyncIOMotorDatabase:
    return await get_database()


# Placeholder for current active user (can add checks like is_active here later)
async def get_current_active_user(
    current_user_payload: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    # Add checks here if needed, e.g., check if user is marked active in your DB
    # if not current_user_payload.get("is_active"): # Assuming an 'is_active' field
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user_payload
