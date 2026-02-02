#!/bin/bash
# Complete Setup and Test Script for SN98 Admin Panel

echo "🚀 SN98 ForeverMoney Admin Panel Setup"
echo "======================================="
echo ""

# Step 1: Setup environment
echo "📋 Step 1: Setting up environment..."
if [ ! -f ".env" ]; then
    cp .env.testnet .env
    echo "✅ Copied .env.testnet to .env"
else
    echo "✅ .env already exists"
fi

# Step 2: Generate test data
echo ""
echo "📊 Step 2: Generating test data..."
echo "This will create ~16,000 test records..."
./generate_test_data.sh

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate test data"
    exit 1
fi

# Step 3: Start API
echo ""
echo "🔌 Step 3: Starting API server..."
cd api
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt
python main.py &
API_PID=$!
cd ..

echo "✅ API started on http://localhost:8000 (PID: $API_PID)"

# Wait for API to be ready
echo "⏳ Waiting for API to be ready..."
sleep 3

for i in {1..10}; do
    if curl -s http://localhost:8000/health > /dev/null; then
        echo "✅ API is ready!"
        break
    fi
    sleep 1
done

# Step 4: Test API endpoints
echo ""
echo "🧪 Step 4: Testing API endpoints..."

echo "Testing /api/jobs..."
curl -s http://localhost:8000/api/jobs | jq '.total' 2>/dev/null

echo "Testing /api/jobs/job_eth_usdc_001..."
curl -s http://localhost:8000/api/jobs/job_eth_usdc_001 | jq '.job_id' 2>/dev/null

echo "Testing /api/jobs/job_eth_usdc_001/leaderboard..."
curl -s http://localhost:8000/api/jobs/job_eth_usdc_001/leaderboard | jq '.total_miners' 2>/dev/null

echo ""
echo "✅ API tests passed!"

# Step 5: Start Frontend
echo ""
echo "🎨 Step 5: Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ Frontend started on http://localhost:3000 (PID: $FRONTEND_PID)"

# Summary
echo ""
echo "======================================="
echo "✨ Setup Complete!"
echo "======================================="
echo ""
echo "📊 Services Running:"
echo "  - API:      http://localhost:8000"
echo "  - Docs:     http://localhost:8000/docs"
echo "  - Frontend: http://localhost:3000"
echo ""
echo "🎯 Next Steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Explore the admin panel"
echo "  3. View API docs at http://localhost:8000/docs"
echo ""
echo "🛑 To stop services:"
echo "  kill $API_PID $FRONTEND_PID"
echo ""
echo "📝 Process IDs saved to .pids file"
echo "$API_PID" > .pids
echo "$FRONTEND_PID" >> .pids
