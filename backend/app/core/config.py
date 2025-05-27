# backend/app/core/config.py
import os
import logging
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Union, Optional
import json

logger = logging.getLogger(__name__)

# --- Determine which .env file to load ---
ENV_VAR_FOR_ENV_FILE = "APP_ENV_FILE"
DEFAULT_ENV_FILE = ".env.local"  # Changed default for convenience

env_file_path = os.getenv(ENV_VAR_FOR_ENV_FILE, DEFAULT_ENV_FILE)

if not os.path.exists(env_file_path):
    logger.warning(
        f"Specified environment file '{env_file_path}' not found. Trying '.env' or system vars."
    )
    # Fallback logic if needed, e.g., try plain '.env'
    if os.path.exists(".env"):
        env_file_path = ".env"
        logger.info("Falling back to loading settings from '.env'")
    else:
        env_file_path = None  # Let pydantic-settings use only system env vars
        logger.info(
            "No '.env' file found. Loading settings solely from environment variables."
        )
else:
    logger.info(f"Loading settings from environment file: '{env_file_path}'")


class Settings(BaseSettings):
    PROJECT_NAME: str = "RechnungMeister API"
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    HTTPX_VERIFY_SSL: bool = False
    VITE_AUTHENTIK_REDIRECT_URI: str  # Load from .env

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        # ... (validator logic remains the same) ...
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

    # invoice stuff
    YOUR_COMPANY_NAME: str = "yOUR Company GmbH"
    YOUR_ADDRESS_LINE1: str = "Your Street 123"
    YOUR_ZIP_CITY: str = "12345 Your City"
    YOUR_TAX_ID: Optional[str] = None  # Steuernummer
    YOUR_VAT_ID: Optional[str] = None  # USt-IdNr.
    YOUR_BANK_HOLDER: str = "Account Holder Name"
    YOUR_BANK_IBAN: str = "DE12..."
    YOUR_BANK_BIC: Optional[str] = None
    YOUR_BANK_NAME: Optional[str] = None

    MONGODB_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "RS256"  # Changed default from HS256
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    AUTHENTIK_URL: AnyHttpUrl  # Base URL
    AUTHENTIK_JWKS_URI: str  # JWKS endpoint (for token verification)
    AUTHENTIK_TOKEN_URL: (
        str  # *** ADDED: Token endpoint (for code/refresh exchange) ***
    )
    AUTHENTIK_ISSUER: str  # Issuer ID
    AUTHENTIK_AUDIENCE: str  # Client ID / Audience
    AUTHENTIK_CLIENT_SECRET: Optional[str] = None  # Optional secret
    VITE_AUTHENTIK_REDIRECT_URI: (
        str  # Redirect URI (must match frontend/Authentik config)
    )

    # --- New Setting for SSL Verification ---
    HTTPX_VERIFY_SSL: bool = True  # Default to True (verify SSL certs)
    APP_VERSION: str = Field(
        default="0.0.0-dev", description="Application version/build number"
    )
    # ...

    # Log it on startup
    class Config:
        env_file = (
            env_file_path if env_file_path and os.path.exists(env_file_path) else None
        )
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

logger.info(f"--- Version: {settings.APP_VERSION} ---")
logger.info(f"Project Name: {settings.PROJECT_NAME}")
logger.info(f"MongoDB URL Host: {settings.MONGODB_URL.split('@')[-1].split('/')[0]}")
logger.info(
    f"HTTPX SSL Verification Enabled: {settings.HTTPX_VERIFY_SSL}"
)  # Log the setting status
if not settings.HTTPX_VERIFY_SSL:
    logger.warning("*****************************************************")
    logger.warning("* WARNING: HTTPX SSL Verification is DISABLED!      *")
    logger.warning("* This is insecure and should ONLY be used for      *")
    logger.warning("* local development with trusted self-signed certs. *")
    logger.warning("*****************************************************")
