"""
Unit tests for authentication system
"""
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta

from api.auth.config import (
    create_access_token,
    verify_token,
    generate_challenge,
    JWT_SECRET,
    JWT_ALGORITHM
)
from api.auth.admin_manager import AdminWalletManager


class TestJWTTokens:
    """Test JWT token creation and validation"""
    
    def test_create_token(self):
        """Test token creation"""
        data = {"sub": "test_user", "permissions": ["read"]}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
    
    def test_verify_valid_token(self):
        """Test verifying valid token"""
        data = {"sub": "test_user", "permissions": ["read"]}
        token = create_access_token(data)
        
        payload = verify_token(token)
        
        assert payload is not None
        assert payload["sub"] == "test_user"
        assert "read" in payload["permissions"]
    
    def test_verify_expired_token(self):
        """Test that expired tokens are rejected"""
        data = {"sub": "test_user"}
        
        # Create expired token
        expires = datetime.utcnow() - timedelta(hours=1)
        data["exp"] = expires
        
        token = pyjwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        payload = verify_token(token)
        
        assert payload is None
    
    def test_verify_invalid_token(self):
        """Test that invalid tokens are rejected"""
        payload = verify_token("invalid_token_string")
        
        assert payload is None


class TestChallengeGeneration:
    """Test authentication challenge generation"""
    
    def test_generate_challenge(self):
        """Test challenge generation"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        challenge_data = generate_challenge(wallet)
        
        assert "challenge" in challenge_data
        assert "wallet_address" in challenge_data
        assert "expires_at" in challenge_data
        assert "message" in challenge_data
        
        assert challenge_data["wallet_address"] == wallet
        assert "SN98-AUTH-" in challenge_data["challenge"]
    
    def test_challenge_format(self):
        """Test challenge has correct format"""
        wallet = "5GrwvaEF..."
        challenge_data = generate_challenge(wallet)
        
        challenge = challenge_data["challenge"]
        parts = challenge.split("-")
        
        assert len(parts) == 4
        assert parts[0] == "SN98"
        assert parts[1] == "AUTH"
        assert parts[2].isdigit()  # timestamp
        assert len(parts[3]) == 12  # nonce


class TestAdminWalletManager:
    """Test admin wallet management"""
    
    @pytest.fixture
    def manager(self, tmp_path):
        """Create temporary admin manager"""
        wallet_file = tmp_path / "test_wallets.json"
        return AdminWalletManager(str(wallet_file))
    
    def test_add_admin(self, manager):
        """Test adding admin wallet"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        admin = manager.add_admin(
            wallet_address=wallet,
            name="Test Admin",
            added_by="system",
            permissions=["read", "write"]
        )
        
        assert admin["wallet_address"] == wallet
        assert admin["name"] == "Test Admin"
        assert "read" in admin["permissions"]
    
    def test_is_admin(self, manager):
        """Test checking if wallet is admin"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        # Not admin yet
        assert not manager.is_admin(wallet)
        
        # Add admin
        manager.add_admin(wallet, "Test", "system")
        
        # Now is admin
        assert manager.is_admin(wallet)
    
    def test_remove_admin(self, manager):
        """Test removing admin wallet"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        # Add and verify
        manager.add_admin(wallet, "Test", "system")
        assert manager.is_admin(wallet)
        
        # Remove
        success = manager.remove_admin(wallet)
        
        assert success
        assert not manager.is_admin(wallet)
    
    def test_has_permission(self, manager):
        """Test permission checking"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        manager.add_admin(
            wallet,
            "Test",
            "system",
            permissions=["read", "write"]
        )
        
        assert manager.has_permission(wallet, "read")
        assert manager.has_permission(wallet, "write")
        assert not manager.has_permission(wallet, "manage_admins")
    
    def test_duplicate_admin(self, manager):
        """Test that duplicate admins are rejected"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        manager.add_admin(wallet, "Test", "system")
        
        with pytest.raises(ValueError):
            manager.add_admin(wallet, "Test2", "system")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
