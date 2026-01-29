"""
Rate limiting middleware for API endpoints
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting middleware
    
    In production, use Redis for distributed rate limiting
    """
    
    def __init__(
        self,
        app,
        calls: int = 100,
        period: int = 60,
        exclude_paths: list = None
    ):
        """
        Args:
            app: FastAPI app
            calls: Number of allowed calls
            period: Time period in seconds
            exclude_paths: Paths to exclude from rate limiting
        """
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]
        
        # Storage: {ip_address: [(timestamp, path), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
    
    def _clean_old_requests(self, ip: str):
        """Remove requests older than the time window"""
        cutoff = time.time() - self.period
        self.requests[ip] = [
            (ts, path) for ts, path in self.requests[ip]
            if ts > cutoff
        ]
    
    def _is_rate_limited(self, ip: str, path: str) -> Tuple[bool, int]:
        """
        Check if IP is rate limited
        
        Returns:
            (is_limited, requests_remaining)
        """
        # Clean old requests
        self._clean_old_requests(ip)
        
        # Count requests in current window
        current_requests = len(self.requests[ip])
        
        if current_requests >= self.calls:
            return True, 0
        
        return False, self.calls - current_requests
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""
        
        # Skip excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host
        
        # Check rate limit
        is_limited, remaining = self._is_rate_limited(client_ip, request.url.path)
        
        if is_limited:
            # Calculate retry after
            oldest_request = min(ts for ts, _ in self.requests[client_ip])
            retry_after = int(self.period - (time.time() - oldest_request))
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": retry_after,
                    "limit": self.calls,
                    "period": self.period
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        # Record this request
        self.requests[client_ip].append((time.time(), request.url.path))
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.calls)
        response.headers["X-RateLimit-Remaining"] = str(remaining - 1)
        response.headers["X-RateLimit-Reset"] = str(
            int(time.time() + self.period)
        )
        
        return response


# Stricter rate limit for auth endpoints
class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Stricter rate limiting for authentication endpoints
    to prevent brute force attacks
    """
    
    def __init__(self, app, calls: int = 10, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.requests: Dict[str, list] = defaultdict(list)
        self.auth_paths = ["/auth/challenge", "/auth/verify"]
    
    def _clean_old_requests(self, ip: str):
        """Remove requests older than the time window"""
        cutoff = time.time() - self.period
        self.requests[ip] = [
            ts for ts in self.requests[ip]
            if ts > cutoff
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request with strict auth rate limiting"""
        
        # Only apply to auth endpoints
        if request.url.path not in self.auth_paths:
            return await call_next(request)
        
        client_ip = request.client.host
        
        # Clean and check
        self._clean_old_requests(client_ip)
        current_requests = len(self.requests[client_ip])
        
        if current_requests >= self.calls:
            oldest_request = min(self.requests[client_ip])
            retry_after = int(self.period - (time.time() - oldest_request))
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Too many authentication attempts",
                    "message": "Please wait before trying again",
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        # Record request
        self.requests[client_ip].append(time.time())
        
        # Process
        response = await call_next(request)
        
        # Add headers
        response.headers["X-Auth-RateLimit-Remaining"] = str(
            self.calls - current_requests - 1
        )
        
        return response
