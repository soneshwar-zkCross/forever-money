"""
API Configuration Module

Loads environment variables and provides configuration settings for the API.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Settings
API_TITLE = "SN98 ForeverMoney API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "API for SN98 subnet admin panel"

# CORS Settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# Database Settings (Jobs Database)
# Use JOBS_DB_URL if set, otherwise fall back to READER_DB_URL, otherwise build from parts
JOBS_POSTGRES_HOST = os.getenv("JOBS_POSTGRES_HOST", "localhost")
JOBS_POSTGRES_PORT = int(os.getenv("JOBS_POSTGRES_PORT", "5432"))
JOBS_POSTGRES_DB = os.getenv("JOBS_POSTGRES_DB", "sn98_jobs")
JOBS_POSTGRES_USER = os.getenv("JOBS_POSTGRES_USER", "sn98_user")
JOBS_POSTGRES_PASSWORD = os.getenv("JOBS_POSTGRES_PASSWORD", "")

# Build database URL - prefer explicit URL, then reader DB, then constructed from parts
DATABASE_URL = os.getenv("JOBS_DB_URL") or os.getenv("READER_DB_URL") or (
    f"postgres://{JOBS_POSTGRES_USER}:{JOBS_POSTGRES_PASSWORD}"
    f"@{JOBS_POSTGRES_HOST}:{JOBS_POSTGRES_PORT}/{JOBS_POSTGRES_DB}"
)

# Pagination defaults
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100
