"""
Authentication API endpoints
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from api.auth import (
    generate_challenge,
    store_challenge,
    get_challenge,
    remove_challenge,
    create_access_token,
    verify_challenge_signature,
    admin_manager,
    revoke_token,
    get_current_user,
    require_admin
)
from api.auth.config import CHALLENGE_EXPIRY_MINUTES

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Request/Response Models
class ChallengeRequest(BaseModel):
    wallet_address: str


class ChallengeResponse(BaseModel):
    challenge: str
    expires_at: str
    message: str


class VerifyRequest(BaseModel):
    wallet_address: str
    challenge: str
    signature: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    wallet_address: str
    permissions: list[str]


class LogoutResponse(BaseModel):
    message: str


@router.post("/challenge", response_model=ChallengeResponse)
async def request_challenge(request: ChallengeRequest):
    """
    Generate authentication challenge for wallet
    
    The client should sign the challenge message with their wallet
    and submit it to /auth/verify
    """
    wallet_address = request.wallet_address
    
    # Generate challenge
    challenge_data = generate_challenge(wallet_address)
    
    # Store challenge temporarily
    store_challenge(wallet_address, challenge_data)
    
    return ChallengeResponse(
        challenge=challenge_data["challenge"],
        expires_at=challenge_data["expires_at"],
        message=challenge_data["message"]
    )


@router.post("/verify", response_model=TokenResponse)
async def verify_signature(request: VerifyRequest):
    """
    Verify signature and issue JWT access token
    
    The signature must be created by signing the challenge message
    with the wallet's private key
    """
    wallet_address = request.wallet_address
    challenge = request.challenge
    signature = request.signature
    
    # Get stored challenge
    stored_challenge = get_challenge(wallet_address)
    if not stored_challenge:
        raise HTTPException(
            status_code=400,
            detail="No active challenge found. Please request a new challenge."
        )
    
    # Verify challenge matches
    if stored_challenge["challenge"] != challenge:
        raise HTTPException(
            status_code=400,
            detail="Challenge mismatch"
        )
    
    # Check challenge expiry
    expires_at = datetime.fromisoformat(stored_challenge["expires_at"])
    if datetime.utcnow() > expires_at:
        remove_challenge(wallet_address)
        raise HTTPException(
            status_code=400,
            detail=f"Challenge expired. Please request a new one. Challenges expire after {CHALLENGE_EXPIRY_MINUTES} minutes."
        )
    
    # Verify wallet is in admin list
    if not admin_manager.is_admin(wallet_address):
        raise HTTPException(
            status_code=403,
            detail="Wallet not authorized. Contact administrator to get access."
        )
    
    # Verify signature
    is_valid = verify_challenge_signature(wallet_address, challenge, signature)
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid signature"
        )
    
    # Remove used challenge
    remove_challenge(wallet_address)
    
    # Get admin permissions
    admin = admin_manager.get_admin(wallet_address)
    permissions = admin.get("permissions", ["read"])
    
    # Generate JWT token
    token_data = {
        "sub": wallet_address,
        "permissions": permissions,
        "jti": str(uuid.uuid4())  # Unique token ID for revocation
    }
    
    access_token = create_access_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=86400,  # 24 hours in seconds
        wallet_address=wallet_address,
        permissions=permissions
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout current user by revoking their token
    """
    jti = current_user.get("jti")
    if jti:
        revoke_token(jti)
    
    return LogoutResponse(message="Logged out successfully")


class InternalSignRequest(BaseModel):
    wallet_name: str = "default"
    hotkey: str = "default"
    message: str


@router.post("/sign-internal")
async def sign_internal(request: InternalSignRequest):
    """
    INTERNAL USE ONLY: Sign a message using a local bittensor wallet.
    Only enabled when ALLOW_INTERNAL_SIGNING is true.
    """
    from api.auth.config import ALLOW_INTERNAL_SIGNING
    from api.auth.signature import sign_message
    import bittensor as bt
    
    if not ALLOW_INTERNAL_SIGNING:
        raise HTTPException(
            status_code=403,
            detail="Internal signing is disabled on this server."
        )
    
    try:
        wallet = bt.Wallet(name=request.wallet_name, hotkey=request.hotkey)
        if not wallet.hotkey_file.exists_on_device():
            raise HTTPException(
                status_code=404,
                detail=f"Hotkey {request.hotkey} not found for wallet {request.wallet_name}"
            )
        
        signature = sign_message(wallet, request.message)
        return {
            "wallet_address": wallet.hotkey.ss58_address,
            "signature": signature,
            "message": request.message
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error signing message: {str(e)}"
        )


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    wallet_address = current_user.get("sub")
    admin = admin_manager.get_admin(wallet_address)
    
    return {
        "wallet_address": wallet_address,
        "name": admin.get("name", "Unknown"),
        "permissions": current_user.get("permissions", []),
        "added_at": admin.get("added_at"),
        "added_by": admin.get("added_by")
    }
