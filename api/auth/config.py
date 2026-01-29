"""
Authentication configuration and utilities
"""
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

# Auth Configuration
CHALLENGE_EXPIRY_MINUTES = int(os.getenv("CHALLENGE_EXPIRY_MINUTES", "5"))
ADMIN_WALLETS_FILE = os.getenv(
    "ADMIN_WALLETS_FILE",
    "api/config/admin_wallets.json"
)
ALLOW_INTERNAL_SIGNING = os.getenv("ALLOW_INTERNAL_SIGNING", "false").lower() == "true"

# Password context (for future use if needed)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Payload data to encode
        expires_delta: Custom expiration time
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    Verify and decode JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_challenge(wallet_address: str) -> dict:
    """
    Generate authentication challenge for wallet
    
    Args:
        wallet_address: Wallet address to authenticate
        
    Returns:
        Challenge data with nonce and expiry
    """
    import uuid
    import time
    
    timestamp = int(time.time())
    nonce = uuid.uuid4().hex[:12]
    challenge = f"SN98-AUTH-{timestamp}-{nonce}"
    
    expires_at = datetime.utcnow() + timedelta(minutes=CHALLENGE_EXPIRY_MINUTES)
    
    return {
        "challenge": challenge,
        "wallet_address": wallet_address,
        "expires_at": expires_at.isoformat(),
        "message": f"Sign this message to authenticate to SN98 Admin Panel:\n\n{challenge}\n\nTimestamp: {timestamp}"
    }


# In-memory storage for active challenges and revoked tokens
# In production, use Redis or database
active_challenges = {}
revoked_tokens = set()


def store_challenge(wallet_address: str, challenge_data: dict):
    """Store active challenge"""
    active_challenges[wallet_address] = challenge_data


def get_challenge(wallet_address: str) -> Optional[dict]:
    """Retrieve active challenge"""
    return active_challenges.get(wallet_address)


def remove_challenge(wallet_address: str):
    """Remove used challenge"""
    active_challenges.pop(wallet_address, None)


def revoke_token(jti: str):
    """Add token to revoke list"""
    revoked_tokens.add(jti)


def is_token_revoked(jti: str) -> bool:
    """Check if token is revoked"""
    return jti in revoked_tokens
