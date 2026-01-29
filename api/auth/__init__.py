"""
Authentication package
"""
from .config import (
    create_access_token,
    verify_token,
    generate_challenge,
    store_challenge,
    get_challenge,
    remove_challenge,
    revoke_token,
    is_token_revoked
)
from .admin_manager import admin_manager
from .signature import verify_signature, verify_evm_signature, verify_any_signature, verify_challenge_signature
from .dependencies import (
    get_current_user,
    require_permissions,
    require_read,
    require_write,
    require_admin
)

__all__ = [
    "create_access_token",
    "verify_token",
    "generate_challenge",
    "store_challenge",
    "get_challenge",
    "remove_challenge",
    "revoke_token",
    "is_token_revoked",
    "admin_manager",
    "verify_signature",
    "verify_evm_signature",
    "verify_any_signature",
    "verify_challenge_signature",
    "get_current_user",
    "require_permissions",
    "require_read",
    "require_write",
    "require_admin",
]
