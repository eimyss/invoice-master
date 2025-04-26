# backend/app/core/config.py
import os
import logging  # Import logging
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings
from typing import List, Union, Optional
import json
# No need for python-dotenv explicitly here, pydantic-settings handles it

logger = logging.getLogger(__name__)  # Get logger instance

# --- Determine which .env file to load ---
# Define the environment variable name to look for
ENV_VAR_FOR_ENV_FILE = "APP_ENV_FILE"
# Define the default file if the environment variable is not set
DEFAULT_ENV_FILE = ".env"  # Or maybe '.env.local' if that's your usual default

# Get the desired .env file path from the environment variable
env_file_path = os.getenv(ENV_VAR_FOR_ENV_FILE, DEFAULT_ENV_FILE)

# Check if the specified file exists (optional but helpful for debugging)
if not os.path.exists(env_file_path):
    logger.warning(
        f"Specified environment file '{env_file_path}' not found. "
        f"Falling back to default loading behavior (might use '.env' if present, or only env vars)."
    )
    # You could force it to use the default here if desired:
    # if not os.path.exists(DEFAULT_ENV_FILE):
    #    logger.warning(f"Default environment file '{DEFAULT_ENV_FILE}' also not found.")
    #    env_file_path = None # Let pydantic-settings use only system env vars
    # else:
    #    env_file_path = DEFAULT_ENV_FILE
else:
    logger.info(f"Loading settings from environment file: '{env_file_path}'")


class Settings(BaseSettings):
    PROJECT_NAME: str = "RechnungMeister API"
    API_V1_STR: str = "/api/v1"

    # Backend CORS origins
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            try:
                if isinstance(v, str) and v.startswith("[") and v.endswith("]"):
                    return json.loads(v)
                elif isinstance(v, list):
                    return v
            except json.JSONDecodeError:
                raise ValueError("Could not parse BACKEND_CORS_ORIGINS")
        raise ValueError(v)

    # MongoDB
    MONGODB_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Authentik
    AUTHENTIK_URL: AnyHttpUrl
    AUTHENTIK_JWKS_URI: str
    AUTHENTIK_ISSUER: str
    AUTHENTIK_AUDIENCE: str

    class Config:
        # Tell pydantic-settings which file(s) to load
        # It will load the specified file if it exists.
        # If env_file_path is None (because specified file didn't exist), it skips file loading.
        env_file = (
            env_file_path if env_file_path and os.path.exists(env_file_path) else None
        )
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields not defined in Settings model


# Instantiate settings - this triggers the loading based on the Config above
settings = Settings()

# Log some settings on startup (be careful not to log secrets!)
logger.info(f"Project Name: {settings.PROJECT_NAME}")
logger.info(
    f"MongoDB URL Host: {settings.MONGODB_URL.split('@')[-1].split('/')[0]}"
)  # Example of logging part of URL safely

