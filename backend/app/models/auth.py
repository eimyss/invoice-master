from pydantic import BaseModel, Field, validator  # Import validator
from typing import Optional


class TokenExchangeRequest(BaseModel):
    authorization_code: str = Field(..., alias="code")  # Receive 'code' from frontend
    code_verifier: str

    @validator("code_verifier")
    def code_verifier_must_be_valid(cls, v):
        if v == "undefined" or not v:  # Check for the literal string or empty
            raise ValueError("code_verifier cannot be undefined or empty")
        return v

    # Optional: You might pass redirect_uri from frontend if it can vary,
    # but usually it's fixed and known by the backend config.


class TokenResponse(BaseModel):  # What your backend sends to frontend
    access_token: str
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None
    expires_in: int
    token_type: str = "Bearer"


class AuthentikTokenResponse(BaseModel):  # What Authentik sends to backend
    access_token: str
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None
    expires_in: int
    token_type: str
    scope: Optional[str] = None  # Changed from 'str' to 'Optional[str]'
