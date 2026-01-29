"""
Admin wallet management endpoints
"""
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from api.auth import (
    admin_manager,
    require_admin,
    get_current_user,
    verify_signature,
    verify_any_signature  # Added this
)

router = APIRouter(prefix="/admin", tags=["Admin Management"])


# Request/Response Models
class AdminWallet(BaseModel):
    wallet_address: str
    name: str
    added_by: str
    added_at: str
    permissions: List[str]


class AdminListResponse(BaseModel):
    admins: List[AdminWallet]
    total: int


class AddAdminRequest(BaseModel):
    wallet_address: str
    name: str
    permissions: List[str] = ["read", "write"]
    # For extra security, require signature
    message: str
    signature: str


class AddAdminResponse(BaseModel):
    message: str
    wallet: AdminWallet


class RemoveAdminResponse(BaseModel):
    message: str


class UpdatePermissionsRequest(BaseModel):
    permissions: List[str]


@router.get("/wallets", response_model=AdminListResponse)
async def list_admin_wallets(current_user: dict = Depends(get_current_user)):
    """
    List all admin wallets
    
    Requires authentication
    """
    admins = admin_manager.get_all_admins()
    
    return AdminListResponse(
        admins=[AdminWallet(**admin) for admin in admins],
        total=len(admins)
    )


@router.post("/wallets", response_model=AddAdminResponse)
async def add_admin_wallet(
    request: AddAdminRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Add new admin wallet to whitelist
    
    Requires 'manage_admins' permission
    
    For security, the requesting admin must sign a message confirming the action
    """
    # Get current admin's wallet
    current_wallet = current_user.get("sub")
    
    # Verify signature to confirm intent
    expected_message = f"Add admin wallet: {request.wallet_address}"
    is_valid = verify_any_signature(current_wallet, expected_message, request.signature)
    
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid signature. Please sign the message: " + expected_message
        )
    
    # Add admin
    try:
        new_admin = admin_manager.add_admin(
            wallet_address=request.wallet_address,
            name=request.name,
            added_by=current_wallet,
            permissions=request.permissions
        )
        
        return AddAdminResponse(
            message="Admin wallet added successfully",
            wallet=AdminWallet(**new_admin)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/wallets/{wallet_address}", response_model=RemoveAdminResponse)
async def remove_admin_wallet(
    wallet_address: str,
    current_user: dict = Depends(require_admin)
):
    """
    Remove admin wallet from whitelist
    
    Requires 'manage_admins' permission
    
    Cannot remove yourself
    """
    current_wallet = current_user.get("sub")
    
    # Prevent self-removal
    if wallet_address == current_wallet:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove your own wallet"
        )
    
    # Remove admin
    success = admin_manager.remove_admin(wallet_address)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found in admin list"
        )
    
    return RemoveAdminResponse(
        message="Admin wallet removed successfully"
    )


@router.patch("/wallets/{wallet_address}/permissions")
async def update_admin_permissions(
    wallet_address: str,
    request: UpdatePermissionsRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Update admin wallet permissions
    
    Requires 'manage_admins' permission
    """
    current_wallet = current_user.get("sub")
    
    # Prevent modifying own permissions
    if wallet_address == current_wallet:
        raise HTTPException(
            status_code=400,
            detail="Cannot modify your own permissions"
        )
    
    # Update permissions
    success = admin_manager.update_permissions(wallet_address, request.permissions)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found in admin list"
        )
    
    return {
        "message": "Permissions updated successfully",
        "wallet_address": wallet_address,
        "new_permissions": request.permissions
    }
