#!/bin/bash
# Clean Database and Seed with Real Data - All in One Command

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

echo "="
echo "🗑️  CLEAN & SEED DATABASE"
echo "="
echo "📍 Database: $DB_URL"
echo ""

# Extract database connection details
DB_HOST=$(echo $DB_URL | sed -E 's|postgresql://[^@]*@([^:/]+).*|\1|')
DB_PORT=$(echo $DB_URL | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo $DB_URL | sed -E 's|.*/([^?]*).*|\1|')
DB_USER=$(echo $DB_URL | sed -E 's|postgresql://([^:]+):.*|\1|')

echo "🧹 Step 1: Cleaning existing data..."
echo ""

# Drop and recreate tables using psql
PGPASSWORD="postgres" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS swaps CASCADE;
DROP TABLE IF EXISTS live_executions CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS miner_participation CASCADE;
DROP TABLE IF EXISTS miner_scores CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- Recreate tables using Tortoise ORM will handle this
\echo '✓ Dropped all tables'
EOF

echo ""
echo "✅ Database cleaned"
echo ""
echo "🌱 Step 2: Seeding with real data from reader database..."
echo ""

# Run the seeding script with any passed arguments
python api/scripts/seed_mock_data.py "$@"

echo ""
echo "="
echo "✅ CLEAN & SEED COMPLETE!"
echo "="
echo ""
echo "💡 Next steps:"
echo "   1. Start API: cd api && ./start_api.sh"
echo "   2. Start Frontend: cd frontend && npm run dev"
echo "   3. Visit: http://localhost:3000/admin"
