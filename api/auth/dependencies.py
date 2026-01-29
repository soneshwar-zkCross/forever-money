"""
Authentication middleware and dependencies
"""
from datetime import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import verify_token, is_token_revoked
from .admin_manager import admin_manager

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current authenticated user from JWT token
    
    Returns:
        Decoded token payload with user info
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    
    # Check if token is revoked
    jti = payload.get("jti")
    if jti and is_token_revoked(jti):
        raise HTTPException(
            status_code=401,
            detail="Token has been revoked"
        )
    
    # Check if wallet is still in admin list
    wallet_address = payload.get("sub")
    if not admin_manager.is_admin(wallet_address):
        raise HTTPException(
            status_code=401,
            detail="Access revoked - wallet no longer in admin list"
        )
    
    return payload


async def require_permissions(
    required_permissions: List[str],
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to check if user has required permissions
    
    Args:
        required_permissions: List of required permissions
        current_user: Current authenticated user
        
    Returns:
        User payload if authorized
        
    Raises:
        HTTPException: If user lacks required permissions
    """
    user_permissions = current_user.get("permissions", [])
    
    # Check if user has all required permissions
    has_all = all(perm in user_permissions for perm in required_permissions)
    
    if not has_all:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required: {required_permissions}"
        )
    
    return current_user


# Permission-specific dependencies
async def require_read(user: dict = Depends(get_current_user)) -> dict:
    """Require read permission"""
    return await require_permissions(["read"], user)


async def require_write(user: dict = Depends(get_current_user)) -> dict:
    """Require write permission"""
    return await require_permissions(["write"], user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin management permission"""
    return await require_permissions(["manage_admins"], user)
