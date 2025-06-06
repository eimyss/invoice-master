from datetime import datetime, timedelta
from typing import Optional, Any, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer  # Can adapt for Bearer token directly
from pydantic import BaseModel
import httpx  # For fetching JWKS
import logging
from functools import lru_cache  # Cache JWKS keys

from .config import settings

logger = logging.getLogger(__name__)

# Password hashing context (if you add local user/password later)
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Placeholder for OAuth2 scheme if using password flow (not for Authentik OIDC directly)
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")

# More direct Bearer scheme for tokens from frontend
oauth2_scheme_bearer = OAuth2PasswordBearer(
    tokenUrl="token"
)  # URL doesn't matter much here


# --- JWKS fetching and caching ---
@lru_cache()
def get_jwks() -> Dict[str, Any]:
    """Fetches JWKS keys from Authentik."""
    try:
        # --- Use the setting to control SSL verification ---
        verify_ssl = settings.HTTPX_VERIFY_SSL
        if not verify_ssl:
            # Add an extra warning right before the call
            logger.warning(
                f"Disabling SSL verification for request to {settings.AUTHENTIK_JWKS_URI}"
            )

        response = httpx.get(settings.AUTHENTIK_JWKS_URI, verify=verify_ssl)
        # ---------------------------------------------------

        response.raise_for_status()  # Raise exception for bad status codes
        logger.info(f"Successfully fetched JWKS from {settings.AUTHENTIK_JWKS_URI}")
        return response.json()
    except httpx.RequestError as e:
        logger.error(f"Error fetching JWKS: {e}")
        # Attempt to give a more specific error if it's an SSL issue and verification was enabled
        if (
            isinstance(e, httpx.ConnectError)
            and "SSL" in str(e)
            and settings.HTTPX_VERIFY_SSL
        ):
            logger.error(
                "SSL verification failed. If using a self-signed cert for local dev,"
            )
            logger.error(
                "consider setting HTTPX_VERIFY_SSL=False in your .env file (INSECURE!)"
            )
            logger.error(
                "or configure system/docker trust store with your local CA cert (preferred)."
            )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not fetch authentication keys from provider. Error: {e}",
        )
    except Exception as e:
        # Catch any other unexpected errors during JWKS fetch
        logger.error(f"Unexpected error fetching JWKS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching authentication keys.",
        )


# --- Token Data Model ---
class TokenData(BaseModel):
    sub: Optional[str] = None  # 'sub' claim usually holds the user ID
    # Add other claims you expect from Authentik (e.g., email, name, groups/roles)
    email: Optional[str] = None
    name: Optional[str] = None
    groups: Optional[list[str]] = None


# --- Token Verification (Authentik specific) ---
async def verify_authentik_token(
    token: str = Depends(oauth2_scheme_bearer),
) -> Dict[str, Any]:
    """
    Verifies the JWT token using Authentik's JWKS endpoint.
    Returns the decoded payload if valid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # --- Fetch JWKS (will now respect the verify_ssl setting) ---
        jwks = get_jwks()
        # --- rest of the function remains the same ---
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        # ... (key finding logic) ...
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break
        else:
            logger.error(
                f"Unable to find matching key for kid {unverified_header.get('kid')}"
            )
            raise credentials_exception

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=[settings.ALGORITHM],  # Usually RS256
            audience=settings.AUTHENTIK_AUDIENCE,
            issuer=settings.AUTHENTIK_ISSUER,
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.error("Token payload missing 'sub' claim")
            raise credentials_exception

        logger.debug(f"Token successfully validated for user: {user_id}")
        return payload

    except HTTPException as e:
        # Re-raise HTTPExceptions (like 503 from get_jwks failure) directly
        raise e
    except jwt.ExpiredSignatureError:
        # ... (specific JWT error handling) ...
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTClaimsError as e:
        logger.warning(f"Token claims validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.error(f"JWTError during token validation: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(
            f"Unexpected error during token validation: {e}", exc_info=True
        )  # Log traceback
        raise credentials_exception


# --- Dependency to get current user ---
async def get_current_user(
    payload: Dict[str, Any] = Depends(verify_authentik_token),
) -> Dict[str, Any]:
    """
    Dependency that provides the validated token payload.
    In a real app, you might fetch user details from your DB based on payload['sub']
    """
    # For now, just return the payload.
    # You could fetch a User object from your DB here if needed:
    # user = await crud_user.get_by_external_id(db, external_id=payload.get("sub"))
    # if not user:
    #     # Optionally auto-create user on first login
    #     raise HTTPException(status_code=404, detail="User not found in internal database")
    # return user # Return your internal user model
    return payload  # Return the token payload directly for now


# --- Utility functions (Example: Not used for Authentik OIDC directly) ---
# def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
#     to_encode = data.copy()
#     if expires_delta:
#         expire = datetime.utcnow() + expires_delta
#     else:
#         expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
#     to_encode.update({"exp": expire})
#     encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
#     return encoded_jwt

# def verify_password(plain_password: str, hashed_password: str) -> bool:
#      return pwd_context.verify(plain_password, hashed_password)

# def get_password_hash(password: str) -> str:
#      return pwd_context.hash(password)
