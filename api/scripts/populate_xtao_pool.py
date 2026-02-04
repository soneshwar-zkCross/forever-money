"""
Populate xTAO/USDC Pool Data

This script syncs pool data from the reader database to the xTAO/USDC job metadata.
Run this once to set up the reference implementation with real pool data.

Usage:
    python scripts/populate_xtao_pool.py

This will:
1. Connect to the reader database
2. Fetch latest pool statistics for xTAO/USDC
3. Update the job metadata with current pool information
4. Display the synced data
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from tortoise import Tortoise
from validator.models.job import Job
from api.services.candle_service import CandleService
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def populate_xtao_pool():
    """Populate xTAO/USDC pool with real data from reader database"""

    # Initialize Tortoise ORM
    try:
        # Get database URL from environment
        db_url = os.getenv("JOBS_POSTGRES_HOST")
        if db_url:
            db_url = (
                f"postgres://{os.getenv('JOBS_POSTGRES_USER')}:{os.getenv('JOBS_POSTGRES_PASSWORD')}"
                f"@{os.getenv('JOBS_POSTGRES_HOST')}:{os.getenv('JOBS_POSTGRES_PORT')}"
                f"/{os.getenv('JOBS_POSTGRES_DB')}"
            )
        else:
            db_url = "sqlite://db.sqlite3"  # Fallback

        await Tortoise.init(
            db_url=db_url,
            modules={'models': ['validator.models.job', 'validator.models.pool_events']}
        )
        await Tortoise.generate_schemas()

        logger.info("✓ Database connection established")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return

    try:
        # Find xTAO/USDC job (look for various possible identifiers)
        job = None

        # Try to find by metadata pair_name
        jobs = await Job.all()
        for j in jobs:
            if j.metadata and "pair_name" in j.metadata:
                pair_name = j.metadata["pair_name"].lower()
                if "xtao" in pair_name or "tao" in pair_name:
                    job = j
                    break

        # If not found, try by pair_address
        if not job:
            xtao_pool_address = "0xf9d5533091B5339BC102fCE5DecFe74C09512315"
            job = await Job.filter(pair_address__icontains=xtao_pool_address[2:10]).first()

        if not job:
            logger.warning("❌ xTAO/USDC job not found in database")
            logger.info("Available jobs:")
            for j in jobs:
                logger.info(f"  - {j.job_id}: {j.metadata.get('pair_name', 'Unknown') if j.metadata else 'No metadata'}")

            # Create a new job for demonstration
            logger.info("\n📝 Creating new xTAO/USDC job for demonstration...")
            job = await Job.create(
                job_id="xtao_usdc_aerodrome",
                pair_address="0xf9d5533091B5339BC102fCE5DecFe74C09512315",
                sn_liquidity_manager_address="0x0000000000000000000000000000000000000000",  # Placeholder
                fee_rate=0.003,
                target="PoL",
                target_ratio=0.5,
                chain_id=8453,  # Base
                is_active=True,
                round_duration_seconds=900,
                metadata={
                    "pair_name": "xTAO/USDC",
                    "description": "xTAO/USDC Aerodrome Pool on Base",
                    "network": "base",
                    "dex": "aerodrome"
                }
            )
            logger.info(f"✓ Created job: {job.job_id}")

        logger.info(f"\n📊 Found xTAO/USDC job: {job.job_id}")
        logger.info(f"   Pair Name: {job.metadata.get('pair_name', 'N/A') if job.metadata else 'N/A'}")
        logger.info(f"   Pair Address: {job.pair_address}")

        # Fetch pool data from reader database
        logger.info("\n🔄 Fetching pool data from reader database...")

        try:
            pool_stats = await CandleService.get_pool_stats_from_reader_db(
                job=job,
                lookback_hours=24
            )

            if not pool_stats:
                logger.warning("❌ No pool data available from reader database")
                logger.info("   Make sure READER_DB_URL is configured in .env")
                return

            logger.info("✓ Successfully fetched pool statistics")

        except Exception as e:
            logger.error(f"❌ Failed to fetch pool data: {e}")
            logger.info("   Error details:", exc_info=True)
            return

        # Update job metadata with pool data
        logger.info("\n💾 Updating job metadata...")

        if job.metadata is None:
            job.metadata = {}

        job.metadata.update({
            "pool_data": {
                "last_sync": datetime.utcnow().isoformat(),
                "lookback_hours": 24,
                "current_price": pool_stats.get("close_price"),
                "price_change_pct": pool_stats.get("price_change_pct"),
                "high_price_24h": pool_stats.get("high_price"),
                "low_price_24h": pool_stats.get("low_price"),
                "volume_24h_token0": pool_stats.get("volume0"),
                "volume_24h_token1": pool_stats.get("volume1"),
                "fees_24h_token0": pool_stats.get("fees0"),
                "fees_24h_token1": pool_stats.get("fees1"),
                "total_swaps": pool_stats.get("total_swaps"),
                "token0_symbol": pool_stats.get("token0_symbol"),
                "token1_symbol": pool_stats.get("token1_symbol"),
            }
        })

        await job.save()

        logger.info("✓ Job metadata updated successfully")

        # Display synced data
        logger.info("\n" + "="*60)
        logger.info("📈 xTAO/USDC POOL DATA SUMMARY")
        logger.info("="*60)

        pool_data = job.metadata["pool_data"]

        logger.info(f"\n💰 Price Information:")
        logger.info(f"   Current Price:    ${pool_data['current_price']:.4f}")
        logger.info(f"   24h Change:       {pool_data['price_change_pct']:+.2f}%")
        logger.info(f"   24h High:         ${pool_data['high_price_24h']:.4f}")
        logger.info(f"   24h Low:          ${pool_data['low_price_24h']:.4f}")

        logger.info(f"\n📊 Volume (24h):")
        logger.info(f"   {pool_data['token0_symbol']}: {pool_data['volume_24h_token0']:,.2f}")
        logger.info(f"   {pool_data['token1_symbol']}: {pool_data['volume_24h_token1']:,.4f}")
        volume_usd = pool_data['volume_24h_token1'] * pool_data['current_price']
        logger.info(f"   USD Equivalent: ${volume_usd:,.2f}")

        logger.info(f"\n💵 Fees Collected (24h):")
        logger.info(f"   {pool_data['token0_symbol']}: {pool_data['fees_24h_token0']:,.2f}")
        logger.info(f"   {pool_data['token1_symbol']}: {pool_data['fees_24h_token1']:,.4f}")
        fees_usd = pool_data['fees_24h_token1'] * pool_data['current_price']
        logger.info(f"   USD Equivalent: ${fees_usd:,.2f}")

        logger.info(f"\n🔄 Activity:")
        logger.info(f"   Total Swaps: {pool_data['total_swaps']:,}")

        logger.info(f"\n⏰ Last Synced:")
        logger.info(f"   {pool_data['last_sync']}")

        logger.info("\n" + "="*60)
        logger.info("✅ xTAO/USDC pool data successfully populated!")
        logger.info("="*60)

        # Fetch a few candles as verification
        logger.info("\n🕯️ Fetching sample candles (last 5)...")

        try:
            candles = await CandleService.fetch_candles_from_reader_db(
                job=job,
                interval_seconds=300,
                lookback_hours=1
            )

            if candles:
                logger.info(f"\n   Successfully fetched {len(candles)} candles")

                # Show last 3 candles
                for candle in candles[-3:]:
                    timestamp = datetime.fromtimestamp(candle["timestamp"])
                    logger.info(f"   {timestamp.strftime('%H:%M:%S')} - "
                              f"O: ${candle['open']:.4f} "
                              f"H: ${candle['high']:.4f} "
                              f"L: ${candle['low']:.4f} "
                              f"C: ${candle['close']:.4f}")
            else:
                logger.warning("   No candles data available")

        except Exception as e:
            logger.warning(f"   Could not fetch candles: {e}")

        logger.info("\n✨ Population complete! You can now view this data in the admin panel:")
        logger.info(f"   http://localhost:3000/admin/pairs/{job.job_id}")

    except Exception as e:
        logger.error(f"❌ Error during population: {e}", exc_info=True)

    finally:
        # Close database connection
        await Tortoise.close_connections()
        logger.info("\n🔌 Database connection closed")


async def main():
    """Main entry point"""
    logger.info("🚀 Starting xTAO/USDC Pool Data Population Script")
    logger.info("="*60 + "\n")

    await populate_xtao_pool()


if __name__ == "__main__":
    asyncio.run(main())
