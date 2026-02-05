"""
Reset Database and Seed with Real Data

Drops all tables, recreates schema, and seeds with real data from reader database.

Usage:
    python api/scripts/reset_db.py
    python api/scripts/reset_db.py --jobs 5 --swaps 2000
"""

import asyncio
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from tortoise import Tortoise
from api.scripts.seed_mock_data import MockDataSeeder


async def drop_all_tables(db_url: str):
    """Drop all tables and recreate schema"""
    print("🗑️  Dropping all tables...")

    # Tortoise ORM expects 'postgres' not 'postgresql'
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgres://", 1)

    await Tortoise.init(
        db_url=db_url,
        modules={'models': [
            'validator.models.job',
            'validator.models.pool_events'
        ]}
    )

    # Drop all tables
    await Tortoise._drop_databases()
    print("  ✓ All tables dropped")

    # Recreate schema
    await Tortoise.generate_schemas()
    print("  ✓ Schema recreated")

    await Tortoise.close_connections()


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Clean database and seed with real data")
    parser.add_argument("--jobs", type=int, default=3, help="Number of jobs/pairs (default: 3, max: 5)")
    parser.add_argument("--rounds", type=int, default=20, help="Number of rounds per job (default: 20)")
    parser.add_argument("--miners", type=int, default=10, help="Number of miners (default: 10)")
    parser.add_argument("--swaps", type=int, default=1000, help="Number of real swaps per job (default: 1000)")

    args = parser.parse_args()

    # Get database URL
    db_url = os.getenv("DB_URL", "postgresql://postgres:postgres@localhost:5432/forevermoneydb")

    print("=" * 70)
    print("🔄 RESET DATABASE & SEED WITH REAL DATA")
    print("=" * 70)
    print(f"\n📍 Database: {db_url}\n")

    # Step 1: Drop all tables
    try:
        await drop_all_tables(db_url)
        print("✅ Database cleaned\n")
    except Exception as e:
        print(f"❌ Failed to drop tables: {e}")
        print("Continuing with seeding...\n")

    # Step 2: Seed with real data
    print("🌱 Seeding with real data from reader database...\n")

    seeder = MockDataSeeder(
        num_jobs=args.jobs,
        num_rounds=args.rounds,
        num_miners=args.miners,
        num_swaps=args.swaps
    )

    try:
        await seeder.seed_all()
        print("\n" + "=" * 70)
        print("✅ RESET & SEED COMPLETE!")
        print("=" * 70)
        print("\n💡 Next steps:")
        print("   1. Start API: cd api && ./start_api.sh")
        print("   2. Start Frontend: cd frontend && npm run dev")
        print("   3. Visit: http://localhost:3000/admin")
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await seeder.close()


if __name__ == "__main__":
    asyncio.run(main())
