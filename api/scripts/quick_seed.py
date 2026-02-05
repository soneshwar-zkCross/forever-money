"""
Quick Seed Script - Minimal data for rapid testing

Creates just 1 pair with minimal rounds and swaps for fast iteration.

Usage:
    python api/scripts/quick_seed.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from api.scripts.seed_mock_data import MockDataSeeder


async def main():
    """Seed minimal data for quick testing"""
    print("⚡ QUICK SEED - Minimal data for rapid testing\n")

    seeder = MockDataSeeder(
        num_jobs=1,  # Just xTAO/USDC
        num_rounds=5,  # 5 rounds only
        num_miners=5,  # 5 miners
        num_swaps=200  # 200 swaps for basic chart
    )

    try:
        await seeder.seed_all()
        print("\n⚡ Quick seed complete! Ready for testing in ~5 seconds.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await seeder.close()


if __name__ == "__main__":
    asyncio.run(main())
