"""
FastAPI Main Application

Entry point for the SN98 Admin Panel API.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging

from tortoise import Tortoise

from api.config import (
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    CORS_ORIGINS,
    DATABASE_URL
)
from api.routers import jobs, leaderboard, rounds, miners, executions, auth, admin

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Database lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Initializing database connection...")
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={'models': [
            'validator.models.job',
            'validator.models.pool_events'
        ]}
    )
    logger.info("Database connected successfully")
    
    yield
    
    # Shutdown
    logger.info("Closing database connection...")
    await Tortoise.close_connections()
    logger.info("Database connection closed")


# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
    lifespan=lifespan
)


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
from api.middleware import RateLimitMiddleware, AuthRateLimitMiddleware

# General rate limit: 100 requests per minute
app.add_middleware(
    RateLimitMiddleware,
    calls=100,
    period=60,
    exclude_paths=["/health", "/docs", "/openapi.json", "/redoc"]
)

# Strict auth rate limit: 10 requests per minute
app.add_middleware(
    AuthRateLimitMiddleware,
    calls=10,
    period=60
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing"""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Log
    logger.info(
        f"{request.method} {request.url.path} "
        f"completed in {duration:.3f}s with status {response.status_code}"
    )
    
    # Add timing header
    response.headers["X-Process-Time"] = str(duration)
    
    return response


# Error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors"""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if app.debug else "An unexpected error occurred"
        }
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": API_VERSION,
        "timestamp": time.time()
    }


# Register routers
# Authentication routes (public, but rate-limited)
app.include_router(auth.router)
app.include_router(admin.router)

# Data routes (protected - require authentication)
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(leaderboard.router, prefix="/api/jobs", tags=["Leaderboard"])
app.include_router(rounds.router, prefix="/api/jobs", tags=["Rounds"])
app.include_router(miners.router, prefix="/api/miners", tags=["Miners"])
app.include_router(executions.router, prefix="/api/jobs", tags=["Executions"])


# Root endpoint
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "description": API_DESCRIPTION,
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
