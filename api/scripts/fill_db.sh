#!/bin/bash
# Fill database with mock data - runs backtesting engine to simulate 30 days of data

echo "🚀 Filling Forever Money Database with Mock Data..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname $(dirname $SCRIPT_DIR))"

# Load environment variables
if [ -f "$PROJECT_ROOT/api/.env" ]; then
    export $(cat "$PROJECT_ROOT/api/.env" | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ Error: .env file not found at $PROJECT_ROOT/api/.env"
    exit 1
fi

# Activate virtual environment
source "$PROJECT_ROOT/api/venv/bin/activate"

echo ""
echo "📊 Running backtesting engine..."
echo "   - Fetching 30 days of historical data"
echo "   - Simulating 10 miners with different strategies"
echo "   - Generating rounds, predictions, and executions"
echo ""

# Run backtest engine
python "$SCRIPT_DIR/backtest_engine.py"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✨ Success! Database filled with mock data."
    echo ""
    echo "📈 Summary:"
    echo "   - xTAO/USDC: ~188 rounds"
    echo "   - WETH/USDC: ~2,147 rounds"
    echo "   - cbBTC/USDC: ~2,083 rounds"
    echo "   - Total: ~4,418 rounds with predictions & executions"
    echo ""
    echo "👥 Each round has 10 miners with strategies:"
    echo "   - Conservative (10% rebalance)"
    echo "   - Moderate (20%-40% rebalance)"
    echo "   - Aggressive (50%-100% rebalance)"
else
    echo ""
    echo "❌ Error: Backtesting engine failed with exit code $exit_code"
    echo "   Check the output above for details"
    exit $exit_code
fi
