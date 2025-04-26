import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import Annotated  # Use Annotated for Body

from app.core.config import settings
from app.models.auth import TokenExchangeRequest, TokenResponse, AuthentikTokenResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/token", response_model=TokenResponse)
async def exchange_token(
    payload: Annotated[TokenExchangeRequest, Body(alias="payload")],
):
    token_url = settings.AUTHENTIK_TOKEN_URL
    if not token_url:
        logger.error("AUTHENTIK_TOKEN_URL is not configured.")
        raise HTTPException(
            status_code=500, detail="Authentication provider URL not configured."
        )

    data = {
        "grant_type": "authorization_code",
        "code": payload.authorization_code,
        "redirect_uri": settings.VITE_AUTHENTIK_REDIRECT_URI,
        "client_id": settings.AUTHENTIK_AUDIENCE,
        "code_verifier": payload.code_verifier,
    }

    auth = None
    if settings.AUTHENTIK_CLIENT_SECRET:
        logger.debug("Using Client Secret for token exchange.")
        auth = (settings.AUTHENTIK_AUDIENCE, settings.AUTHENTIK_CLIENT_SECRET)
    else:
        logger.debug(
            "No Client Secret found, performing token exchange for public client."
        )

    try:
        async with httpx.AsyncClient(verify=settings.HTTPX_VERIFY_SSL) as client:
            if not settings.HTTPX_VERIFY_SSL:
                logger.warning(
                    f"Disabling SSL verification for Authentik token request to {token_url}"
                )

            # --- Log Request Data Just Before Sending ---
            log_data_safe = (
                data.copy()
            )  # Copy data to avoid logging sensitive parts if needed later
            # log_data_safe['code'] = '***REDACTED***' # Example: redact code if needed
            logger.info(
                f"Sending token exchange request to Authentik. Data: {log_data_safe}, Auth: {'Basic' if auth else 'None'}"
            )

            response = await client.post(token_url, data=data, auth=auth)

            # --- Log Response Status and RAW Body ---
            logger.info(
                f"Received response from Authentik. Status: {response.status_code}"
            )
            response_text = response.text  # Get raw text before trying JSON
            logger.debug(f"Raw Authentik token response body: {response_text}")
            # ------------------------------------------

            response.raise_for_status()  # Raise exception for non-2xx status codes AFTER logging

            # Try parsing JSON AFTER successful status code
            response_json = response.json()
            logger.debug(f"Parsed Authentik token response JSON: {response_json}")

            # --- Pydantic Validation ---
            # This is where the previous error occurred
            try:
                auth_data = AuthentikTokenResponse(**response_json)
                logger.info(
                    f"Successfully validated Authentik response against Pydantic model."
                )
                # logger.info(f"Successfully exchanged code for token (User Scope from Pydantic: {auth_data.scope})") # Now scope should exist if validation passes
            except Exception as pydantic_error:
                logger.error(
                    f"Pydantic validation failed for Authentik response. Error: {pydantic_error}"
                )
                logger.error(f"Response JSON that failed validation: {response_json}")
                # Re-raise or handle appropriately
                raise HTTPException(
                    status_code=500,
                    detail="Received unexpected token response format from authentication provider.",
                )
            # --------------------------

            # Return relevant token info to the frontend
            return TokenResponse(
                access_token=auth_data.access_token,
                refresh_token=auth_data.refresh_token,
                id_token=auth_data.id_token,
                expires_in=auth_data.expires_in,
                token_type=auth_data.token_type,
            )

    # ... (exception handling remains the same) ...
    except httpx.HTTPStatusError as e:
        # ...
        logger.error(
            f"Authentik token exchange failed: Status {e.response.status_code}, Response: {e.response.text}"
        )
        detail = f"Failed to exchange code with authentication provider."
        try:
            error_details = e.response.json()
            detail = f"{detail} Error: {error_details.get('error_description', error_details.get('error', 'Unknown'))}"
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )
    except httpx.RequestError as e:
        # ...
        logger.error(f"Network error during Authentik token exchange: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication provider for token exchange.",
        )
    except Exception as e:
        logger.exception("Unexpected error during token exchange.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during authentication.",
        )
