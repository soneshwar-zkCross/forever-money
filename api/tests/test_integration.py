"""
Integration tests for authentication flow
"""
import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


class TestAuthFlow:
    """Test complete authentication flow"""
    
    def test_request_challenge(self):
        """Test requesting authentication challenge"""
        response = client.post(
            "/auth/challenge",
            json={"wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "challenge" in data
        assert "expires_at" in data
        assert "message" in data
        assert "SN98-AUTH-" in data["challenge"]
    
    def test_verify_without_challenge(self):
        """Test that verify fails without active challenge"""
        response = client.post(
            "/auth/verify",
            json={
                "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
                "challenge": "fake-challenge",
                "signature": "0x123"
            }
        )
        
        assert response.status_code == 400
        assert "No active challenge" in response.json()["detail"]
    
    def test_unauthorized_wallet(self):
        """Test that non-admin wallets are rejected"""
        # Request challenge
        challenge_response = client.post(
            "/auth/challenge",
            json={"wallet_address": "5UnauthorizedWallet123"}
        )
        
        assert challenge_response.status_code == 200
        challenge_data = challenge_response.json()
        
        # Try to verify (will fail because not in admin list)
        verify_response = client.post(
            "/auth/verify",
            json={
                "wallet_address": "5UnauthorizedWallet123",
                "challenge": challenge_data["challenge"],
                "signature": "0x123"  # Fake signature
            }
        )
        
        assert verify_response.status_code == 403
        assert "not authorized" in verify_response.json()["detail"].lower()


class TestProtected Endpoints:
    """Test that endpoints are properly protected"""
    
    def test_jobs_without_auth(self):
        """Test that jobs endpoint requires auth"""
        response = client.get("/api/jobs")
        
        assert response.status_code == 403  # Forbidden
    
    def test_jobs_with_invalid_token(self):
        """Test that invalid tokens are rejected"""
        response = client.get(
            "/api/jobs",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401  # Unauthorized
    
    def test_health_check_no_auth(self):
        """Test that health check doesn't require auth"""
        response = client.get("/health")
        
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_auth_rate_limit(self):
        """Test that auth endpoints are rate limited"""
        wallet = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        
        # Make 10 requests (should be OK)
        for i in range(10):
            response = client.post(
                "/auth/challenge",
                json={"wallet_address": wallet}
            )
            if i < 10:
                assert response.status_code == 200
        
        # 11th request should be rate limited
        response = client.post(
            "/auth/challenge",
            json={"wallet_address": wallet}
        )
        
        assert response.status_code == 429  # Too Many Requests
        assert "rate limit" in response.json()["detail"]["error"].lower()
    
    def test_rate_limit_headers(self):
        """Test that rate limit headers are present"""
        response = client.get("/health")
        
        # Should have rate limit headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


class TestAdminEndpoints:
    """Test admin management endpoints"""
    
    def test_list_admins_without_auth(self):
        """Test that admin endpoints require auth"""
        response = client.get("/admin/wallets")
        
        assert response.status_code == 403  # Forbidden
    
    def test_add_admin_without_manage_permission(self):
        """Test that adding admins requires manage_admins permission"""
        # This would require a valid token without manage_admins permission
        # For now, just test that it requires auth
        response = client.post(
            "/admin/wallets",
            json={
                "wallet_address": "5NewAdmin123",
                "name": "New Admin",
                "message": "Add admin wallet: 5NewAdmin123",
                "signature": "0x123"
            }
        )
        
        assert response.status_code == 403  # Forbidden


class TestLogout:
    """Test logout functionality"""
    
    def test_logout_without_auth(self):
        """Test that logout requires auth"""
        response = client.post("/auth/logout")
        
        assert response.status_code == 403  # Forbidden


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
