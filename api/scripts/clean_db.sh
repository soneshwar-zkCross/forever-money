#!/bin/bash
# Clean database - removes all rounds, predictions, executions, and swap events

echo "🧹 Cleaning Forever Money Database..."
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

# Run Python script to clean database
python -c "
import asyncio
from tortoise import Tortoise
from validator.models.job import Round, Prediction, LiveExecution
from validator.models.pool_events import SwapEvent
import os

async def clean():
    db_url = os.getenv('DB_URL', 'postgres://sn98_user:testpass123@localhost:5432/sn98_jobs_test')
    if db_url.startswith('postgresql://'):
        db_url = db_url.replace('postgresql://', 'postgres://', 1)

    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job', 'validator.models.pool_events']}
    )

    print('⏳ Deleting swap events...')
    await SwapEvent.all().delete()

    print('⏳ Deleting live executions...')
    await LiveExecution.all().delete()

    print('⏳ Deleting predictions...')
    await Prediction.all().delete()

    print('⏳ Deleting rounds...')
    await Round.all().delete()

    await Tortoise.close_connections()

    print('')
    print('✅ Database cleaned successfully!')
    print('   - All rounds deleted')
    print('   - All predictions deleted')
    print('   - All executions deleted')
    print('   - All swap events deleted')
    print('')
    print('ℹ️  Jobs are preserved')

asyncio.run(clean())
"

echo ""
echo "✨ Done! Database is clean and ready for new data."
