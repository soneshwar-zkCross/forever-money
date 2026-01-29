#!/bin/bash
# Quick Start Script for SN98 API

echo "🚀 Starting SN98 Admin Panel API..."

# Check if .env exists
if [ ! -f "api/.env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp api/.env.example api/.env
    echo "✏️  Please edit api/.env with your database credentials"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "api/venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv api/venv
    echo "📦 Installing dependencies..."
    api/venv/bin/pip install -r api/requirements.txt
fi

# Activate venv and run
echo "▶️  Starting API server..."
cd api
source venv/bin/activate
python main.py
