#!/bin/bash
# Seed Mock Data - Wrapper Script

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

cd "$PROJECT_ROOT"

# Load environment variables
if [ -f "api/.env" ]; then
    export $(grep -v '^#' api/.env | xargs)
fi

# Default DB_URL if not set
export DB_URL=${DB_URL:-"postgresql://postgres:postgres@localhost:5432/forevermoneydb"}

echo "🌱 Seeding mock data..."
echo "📍 Database: $DB_URL"
echo ""

# Run the seeding script with any passed arguments
python api/scripts/seed_mock_data.py "$@"
