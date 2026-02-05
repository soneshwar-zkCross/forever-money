#!/bin/bash

# Forever Money API Startup Script

cd /Users/soneshwar/Desktop/codes/forever-money

echo "🚀 Starting Forever Money API..."
echo ""

# Load environment variables from .env
echo "📋 Loading environment variables..."
export $(cat api/.env | grep -v '^#' | xargs)

# Verify READER_DB_URL is loaded
if [ -z "$READER_DB_URL" ]; then
    echo "❌ ERROR: READER_DB_URL not found in api/.env"
    exit 1
fi

echo "✅ READER_DB_URL loaded"
echo ""

# Activate virtual environment
echo "🐍 Activating virtual environment..."
source api/venv/bin/activate

# Start API server
echo "🌐 Starting API server on http://0.0.0.0:8000"
echo "📊 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 --loop asyncio
