"""
Populate pool price data for vaults
"""
import asyncio
from datetime import datetime, timedelta
from tortoise import Tortoise
import random
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

async def populate_pool_prices():
    db_host = os.getenv('JOBS_POSTGRES_HOST', 'localhost')
    db_port = os.getenv('JOBS_POSTGRES_PORT', '5432')
    db_name = os.getenv('JOBS_POSTGRES_DB', 'sn98_jobs_test')
    db_user = os.getenv('JOBS_POSTGRES_USER', 'sn98_user')
    db_pass = os.getenv('JOBS_POSTGRES_PASSWORD', 'testpass123')

    db_url = f"postgres://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    print(f"🔗 Connecting to database...")

    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job', 'validator.models.pool_events']}
    )

    from validator.models.job import Job
    from validator.models.pool_events import SwapEvent

    jobs = await Job.filter(is_active=True).all()

    print(f"📊 Populating pool price data for {len(jobs)} vaults...")

    for job in jobs:
        # Base price depends on pair
        if "eth" in job.job_id.lower():
            base_price = 3000.0  # ETH/USDC ~ $3000
            volatility = 100.0
        elif "wbtc" in job.job_id.lower():
            base_price = 45000.0  # WBTC/USDC ~ $45000
            volatility = 1500.0
        elif "tao" in job.job_id.lower():
            base_price = 520.0  # TAO/USDC ~ $520
            volatility = 30.0
        elif "xtao" in job.job_id.lower():
            base_price = 1.05  # xTao/USDC ~ $1.05 (wrapped TAO ratio)
            volatility = 0.03
        else:
            base_price = 1.0
            volatility = 0.05

        # Create 24 hours of swap data (one swap every 10 minutes)
        now = datetime.now()
        swaps_created = 0

        for hours_ago in range(24, 0, -1):
            for minute_offset in [0, 10, 20, 30, 40, 50]:
                timestamp = now - timedelta(hours=hours_ago, minutes=minute_offset)

                # Price walks randomly
                price_change = random.uniform(-volatility * 0.02, volatility * 0.02)
                current_price = base_price + price_change

                # Check if swap exists
                evt_block_time = int(timestamp.timestamp())
                existing = await SwapEvent.filter(
                    evt_address=job.pair_address,
                    evt_block_time__gte=evt_block_time - 300,
                    evt_block_time__lte=evt_block_time + 300
                ).first()

                if not existing:
                    # Create swap event with simple values
                    amount0_val = int(random.uniform(0.1, 5.0) * (1 if random.random() > 0.5 else -1) * 1e18)
                    amount1_val = int(-amount0_val * current_price / 1e18)
                    tick_val = int(random.uniform(-50000, 50000))

                    # Store current price for later API retrieval
                    # Using simplified values to avoid Decimal issues
                    await SwapEvent.create(
                        evt_address=job.pair_address,
                        evt_block_number=20000000 + int((now - timestamp).total_seconds() / 12),
                        evt_tx_hash=f"0x{os.urandom(32).hex()}",
                        evt_block_time=evt_block_time,
                        sender=f"0x{os.urandom(20).hex()}",
                        recipient=f"0x{os.urandom(20).hex()}",
                        amount0=str(amount0_val),
                        amount1=str(amount1_val),
                        sqrt_price_x96=str(int(7922816251426433759354395033)),  # Smaller value
                        liquidity=str(int(random.uniform(100000, 500000))),
                        tick=tick_val,
                    )
                    swaps_created += 1

                # Small base_price update for next iteration
                base_price = current_price

        print(f"  ✓ {job.metadata['pair_name']}: Created {swaps_created} swap events")
        print(f"    Current Price: ${current_price:.2f}")
        print(f"    24h Range: ${base_price - volatility:.2f} - ${base_price + volatility:.2f}")

    print(f"\n🎉 Pool price data populated!")
    print(f"   - Swap events created for last 24 hours")
    print(f"   - One swap every 10 minutes")
    print(f"   - Realistic price movements with volatility")

    await Tortoise.close_connections()

if __name__ == "__main__":
    try:
        asyncio.run(populate_pool_prices())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
