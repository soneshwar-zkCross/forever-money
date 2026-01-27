#!/bin/bash
# Quick Test Data Generator

echo "🚀 SN98 Test Data Generator"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo "📝 Copying .env.testnet to .env..."
    cp .env.testnet .env
    echo "✏️  Please edit .env with your database credentials"
    echo ""
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "📦 Installing dependencies..."
    venv/bin/pip install -r requirements.txt
fi

# Activate virtual environment
source venv/bin/activate

# Run test data generator
echo "🔧 Generating test data..."
python scripts/create_test_data.py

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✅ Test data created successfully!"
    echo "================================"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Start the API: ./start_api.sh"
    echo "  2. Test endpoints: curl http://localhost:8000/api/jobs"
    echo "  3. View docs: open http://localhost:8000/docs"
    echo ""
else
    echo ""
    echo "❌ Error creating test data"
    echo "Please check the error messages above"
    exit 1
fi
