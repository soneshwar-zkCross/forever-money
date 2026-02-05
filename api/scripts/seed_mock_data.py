"""
Mock Data Seeding Script

Populates local database with realistic seed data for development/testing.

Usage:
    python api/scripts/seed_mock_data.py --jobs 3 --rounds 20 --miners 10 --swaps 1000
"""

import asyncio
import sys
import os
import random
from datetime import datetime, timedelta
from decimal import Decimal
import argparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from tortoise import Tortoise
from validator.models.job import Job, Round, MinerScore, Prediction, LiveExecution
from validator.models.pool_events import SwapEvent


# Real pool configurations from Base chain (matching reader database)
MOCK_POOLS = [
    {
        "pair_id": "xtao_usdc_base",
        "pair_address": "0xf9d5533091B5339BC102fCE5DecFe74C09512315",
        "token0": {"symbol": "USDC", "decimals": 6, "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
        "token1": {"symbol": "xTAO", "decimals": 18, "address": "0xb99fbe68c8a0cc14be8c1af73dd4dfea8a76add7"},
        "fee_rate": 0.003,
        "base_price": 199.00,  # xTAO/USDC (inverted from tick)
        "price_volatility": 0.15,
        "invert_price": True,
    },
    {
        "pair_id": "usdc_weth_base",
        "pair_address": "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
        "token0": {"symbol": "WETH", "decimals": 18, "address": "0x4200000000000000000000000000000000000006"},
        "token1": {"symbol": "USDC", "decimals": 6, "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
        "fee_rate": 0.0005,
        "base_price": 3100.00,  # WETH/USDC (inverted from tick)
        "price_volatility": 0.05,
        "invert_price": True,
    },
    {
        "pair_id": "usdc_cbbtc_base",
        "pair_address": "0x4e962bb3889bf030368f56810a9c96b83cb3e778",
        "token0": {"symbol": "USDC", "decimals": 6, "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
        "token1": {"symbol": "cbBTC", "decimals": 8, "address": "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"},
        "fee_rate": 0.003,
        "base_price": 91000.00,  # cbBTC/USDC (inverted from tick)
        "price_volatility": 0.03,
        "invert_price": True,
    },
    {
        "pair_id": "bid_weth_base",
        "pair_address": "0x1024c20c048ea6087293f46d4a1c042cb6705924",
        "token0": {"symbol": "WETH", "decimals": 18, "address": "0x4200000000000000000000000000000000000006"},
        "token1": {"symbol": "BID", "decimals": 18, "address": "0x21759497eA7c270E43F14b87C392aA7F2D513903"},
        "fee_rate": 0.01,
        "base_price": 112000.00,  # BID/WETH (from tick, no inversion)
        "price_volatility": 0.20,
        "invert_price": False,
    },
    {
        "pair_id": "weth_cbbtc_base",
        "pair_address": "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
        "token0": {"symbol": "WETH", "decimals": 18, "address": "0x4200000000000000000000000000000000000006"},
        "token1": {"symbol": "cbBTC", "decimals": 8, "address": "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"},
        "fee_rate": 0.003,
        "base_price": 0.034,  # cbBTC/WETH (no inversion)
        "price_volatility": 0.04,
        "invert_price": False,
    }
]


class MockDataSeeder:
    """Generates and seeds realistic mock data"""

    def __init__(self, num_jobs: int = 3, num_rounds: int = 20, num_miners: int = 10, num_swaps: int = 1000):
        self.num_jobs = min(num_jobs, len(MOCK_POOLS))  # Cap at available pools
        self.num_rounds = num_rounds
        self.num_miners = num_miners
        self.num_swaps = num_swaps
        self.jobs = []
        self.rounds = []
        self.miner_uids = list(range(1, num_miners + 1))

    async def initialize_db(self):
        """Initialize database connection"""
        db_url = os.getenv("DB_URL", "postgresql://postgres:postgres@localhost:5432/forevermoneydb")

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
        await Tortoise.generate_schemas()
        print(f"✅ Connected to database: {db_url}")

    async def clean_existing_data(self):
        """Clean ALL existing data - complete wipe"""
        print("🧹 Cleaning ALL existing data...")

        # Delete EVERYTHING in reverse dependency order
        await SwapEvent.all().delete()
        await LiveExecution.all().delete()
        await Prediction.all().delete()
        await MinerScore.all().delete()
        await Round.all().delete()
        await Job.all().delete()

        print("✅ Cleaned ALL data - fresh start")

    async def seed_jobs(self):
        """Create mock jobs (trading pairs)"""
        print(f"\n📊 Seeding {self.num_jobs} jobs...")

        for i in range(self.num_jobs):
            pool_config = MOCK_POOLS[i % len(MOCK_POOLS)]

            job = await Job.create(
                job_id=pool_config["pair_id"],
                sn_liquidity_manager_address=pool_config["pair_address"],
                pair_address=pool_config["pair_address"],
                fee_rate=pool_config["fee_rate"],
                target="PoL",
                target_ratio=0.5,
                chain_id=8453,
                is_active=True,
                round_duration_seconds=900,
                metadata={
                    "pair_name": f"{pool_config['token1']['symbol']}/{pool_config['token0']['symbol']}",
                    "token0": pool_config["token0"],
                    "token1": pool_config["token1"],
                    "base_price": pool_config["base_price"],
                    "description": f"Mock {pool_config['token1']['symbol']}/{pool_config['token0']['symbol']} pair for testing"
                }
            )

            self.jobs.append(job)
            print(f"  ✓ Created job: {job.job_id} ({job.metadata['pair_name']})")

        print(f"✅ Seeded {len(self.jobs)} jobs")

    async def seed_rounds(self):
        """Create mock rounds for each job"""
        print(f"\n🔄 Seeding rounds ({self.num_rounds} per job)...")

        start_time = datetime.utcnow() - timedelta(days=30)
        start_block = 17000000

        for job in self.jobs:
            for round_num in range(1, self.num_rounds + 1):
                # Alternate between evaluation and live rounds
                from validator.models.job import RoundType, RoundStatus
                round_type = RoundType.LIVE if round_num % 2 == 0 else RoundType.EVALUATION

                round_start = start_time + timedelta(minutes=15 * (round_num - 1))
                round_deadline = round_start + timedelta(minutes=5)
                round_end = round_start + timedelta(minutes=15)

                round_obj = await Round.create(
                    round_id=f"{job.job_id}_round_{round_num}",
                    job=job,
                    round_number=round_num,
                    round_type=round_type,
                    start_time=round_start,
                    round_deadline=round_deadline,
                    end_time=round_end,
                    start_block=start_block + (round_num * 100),
                    status=RoundStatus.COMPLETED if round_num < self.num_rounds else RoundStatus.ACTIVE,
                    performance_data={}
                )

                self.rounds.append({
                    "round": round_obj,
                    "job": job,
                    "round_type": round_type
                })

            print(f"  ✓ Created {self.num_rounds} rounds for {job.job_id}")

        print(f"✅ Seeded {len(self.rounds)} total rounds")

    async def seed_miner_scores(self):
        """Create miner scores for each job"""
        print(f"\n👷 Seeding miner scores ({self.num_miners} miners per job)...")

        for job in self.jobs:
            for miner_uid in self.miner_uids:
                # Generate realistic scores
                evaluation_score = random.uniform(0.6, 0.95)
                live_score = random.uniform(0.5, 0.9)
                combined_score = (evaluation_score * 0.4 + live_score * 0.6)

                # Some miners are eligible, some not
                is_eligible = combined_score > 0.65

                await MinerScore.create(
                    job=job,
                    miner_uid=miner_uid,
                    miner_hotkey=f"5{'0' * 46}{miner_uid:02d}",
                    evaluation_score=Decimal(str(evaluation_score)),
                    live_score=Decimal(str(live_score)),
                    combined_score=Decimal(str(combined_score)),
                    is_eligible_for_live=is_eligible,
                    last_active=datetime.utcnow()
                )

            print(f"  ✓ Created scores for {len(self.miner_uids)} miners on {job.job_id}")

        print(f"✅ Seeded miner scores")

    async def seed_predictions_and_executions(self):
        """Create predictions and live executions for rounds with strategic miners based on real swap data"""
        print(f"\n🎯 Seeding predictions and executions based on real swap data...")

        prediction_count = 0
        execution_count = 0

        # Strategic miner configurations: rebalance at 10%, 20%, ..., 100% price movement
        miner_strategies = {
            1: {"rebalance_threshold": 0.10, "name": "Conservative"},
            2: {"rebalance_threshold": 0.20, "name": "Moderate-Conservative"},
            3: {"rebalance_threshold": 0.30, "name": "Balanced"},
            4: {"rebalance_threshold": 0.40, "name": "Moderate-Aggressive"},
            5: {"rebalance_threshold": 0.50, "name": "Aggressive"},
            6: {"rebalance_threshold": 0.60, "name": "Very Aggressive"},
            7: {"rebalance_threshold": 0.70, "name": "High Risk"},
            8: {"rebalance_threshold": 0.80, "name": "Extreme"},
            9: {"rebalance_threshold": 0.90, "name": "Maximum"},
            10: {"rebalance_threshold": 1.00, "name": "All-In"},
        }

        for round_data in self.rounds:
            round_obj = round_data["round"]
            job = round_data["job"]
            round_type = round_data["round_type"]

            # Get actual price data for this round period from swaps
            pool_address = job.pair_address.lower().replace("0x", "")
            round_start_ts = int(round_obj.start_time.timestamp())
            round_end_ts = int(round_obj.end_time.timestamp()) if round_obj.end_time else round_start_ts + 900

            # Fetch swaps during this round
            round_swaps = await SwapEvent.filter(
                evt_address=pool_address,
                evt_block_time__gte=round_start_ts,
                evt_block_time__lte=round_end_ts
            ).order_by('evt_block_time').all()

            # Calculate opening price from first swap (or use default)
            if round_swaps:
                opening_tick = round_swaps[0].tick
                opening_price = pow(1.0001, opening_tick)
            else:
                # No swaps in this round, use a default mid-price
                opening_price = 1.0

            # Get eligible miners for this job
            eligible_miners = await MinerScore.filter(
                job=job,
                is_eligible_for_live=True
            ).all()

            if not eligible_miners:
                continue

            # Select random miners to participate (70-90% of eligible)
            num_participants = random.randint(
                int(len(eligible_miners) * 0.7),
                int(len(eligible_miners) * 0.9)
            )
            participants = random.sample(eligible_miners, num_participants)

            for miner_score in participants:
                # Get miner's strategy
                miner_uid = miner_score.miner_uid
                strategy = miner_strategies.get(miner_uid, {"rebalance_threshold": 0.50, "name": "Default"})

                # Calculate strategic bounds based on ACTUAL opening price and miner's threshold
                threshold = strategy["rebalance_threshold"]
                lower_bound = opening_price * (1 - threshold)
                upper_bound = opening_price * (1 + threshold)

                # Calculate realistic liquidity based on pool config
                pool_config = next(p for p in MOCK_POOLS if p["pair_id"] == job.job_id)
                base_liquidity = random.uniform(5000, 50000)

                prediction = await Prediction.create(
                    prediction_id=f"pred_{round_obj.round_id}_{miner_score.miner_uid}",
                    round=round_obj,
                    job=job,
                    miner_uid=miner_score.miner_uid,
                    miner_hotkey=miner_score.miner_hotkey,
                    accepted=True,
                    prediction_data={
                        "lower_price_bound": lower_bound,
                        "upper_price_bound": upper_bound,
                        "target_ratio": 0.5,
                        "liquidity_amount": base_liquidity,
                        "opening_price": opening_price,
                        "strategy": {
                            "name": strategy["name"],
                            "rebalance_threshold": strategy["rebalance_threshold"],
                            "description": f"Rebalances when price moves {strategy['rebalance_threshold']*100:.0f}% from opening"
                        }
                    }
                )
                prediction_count += 1

                # Create live execution if it's a live round
                from validator.models.job import RoundType
                if round_type == RoundType.LIVE:
                    # Determine success based on whether price stayed in range
                    if round_swaps:
                        # Get min/max price during round
                        min_tick = min(s.tick for s in round_swaps)
                        max_tick = max(s.tick for s in round_swaps)
                        min_price = pow(1.0001, min_tick)
                        max_price = pow(1.0001, max_tick)

                        # Success if price stayed within bounds
                        stayed_in_range = min_price >= lower_bound and max_price <= upper_bound
                        execution_success = stayed_in_range or random.random() > 0.3  # Some succeed even out of range

                        # Calculate fees earned (proportional to time in range)
                        time_in_range = 1.0 if stayed_in_range else random.uniform(0.2, 0.8)
                        fees_earned = base_liquidity * 0.0003 * time_in_range  # 0.03% fee
                    else:
                        execution_success = random.random() > 0.15
                        fees_earned = 0

                    # Generate 64-char hex tx_hash (0x + 64 chars = 66 total)
                    tx_hash = f"0x{'a' * 60}{execution_count:04d}"

                    await LiveExecution.create(
                        execution_id=f"exec_{round_obj.round_id}_{miner_score.miner_uid}",
                        round=round_obj,
                        job=job,
                        miner_uid=miner_score.miner_uid,
                        sn_liquidity_manager_address=job.sn_liquidity_manager_address,
                        strategy_data=prediction.prediction_data,
                        tx_hash=tx_hash,
                        tx_status="success" if execution_success else "failed",
                        actual_performance={
                            "success": execution_success,
                            "fees_earned": fees_earned if execution_success else 0,
                            "time_in_range": time_in_range if round_swaps else 0,
                            "opening_price": opening_price,
                            "final_price": max_price if round_swaps else opening_price,
                            "error": None if execution_success else "Price moved out of range"
                        }
                    )
                    execution_count += 1

        print(f"  ✓ Created {prediction_count} predictions")
        print(f"  ✓ Created {execution_count} live executions")
        print(f"✅ Seeded predictions and executions")

    async def seed_pool_events(self):
        """Fetch and copy real swap events from reader database"""
        print(f"\n💧 Fetching real swap events from reader database...")

        # Connect to reader database
        reader_db_url = os.getenv("READER_DB_URL")
        if not reader_db_url:
            print("  ⚠️  READER_DB_URL not set, skipping swap events")
            return

        import asyncpg

        try:
            reader_pool = await asyncpg.create_pool(
                reader_db_url,
                ssl="require",
                min_size=1,
                max_size=2
            )
            print(f"  ✓ Connected to reader database")
        except Exception as e:
            print(f"  ⚠️  Failed to connect to reader DB: {e}")
            print(f"  Skipping swap events seeding")
            return

        for job in self.jobs:
            pool_config = next(p for p in MOCK_POOLS if p["pair_id"] == job.job_id)
            pool_address = job.pair_address.lower().replace("0x", "")

            # Fetch last N swaps from reader database
            query = """
                SELECT
                    evt_address,
                    evt_block_number::bigint,
                    evt_tx_hash,
                    evt_block_time::bigint,
                    sqrt_price_x96::text,
                    tick::int,
                    amount0::text,
                    amount1::text,
                    liquidity::text,
                    sender,
                    recipient
                FROM "base_poocl_swaps_v2"
                WHERE evt_address = $1
                ORDER BY evt_block_time::bigint DESC
                LIMIT $2
            """

            try:
                async with reader_pool.acquire() as conn:
                    rows = await conn.fetch(query, pool_address, self.num_swaps)

                if not rows:
                    print(f"  ⚠️  No swaps found for {job.job_id} ({pool_address})")
                    continue

                # Copy swaps to local database
                for row in rows:
                    await SwapEvent.create(
                        evt_address=row["evt_address"],
                        evt_block_number=row["evt_block_number"],
                        evt_tx_hash=row["evt_tx_hash"],
                        evt_block_time=row["evt_block_time"],
                        sqrt_price_x96=int(row["sqrt_price_x96"]),
                        tick=row["tick"],
                        amount0=int(row["amount0"]),
                        amount1=int(row["amount1"]),
                        liquidity=int(row["liquidity"]),
                        sender=row["sender"],
                        recipient=row["recipient"]
                    )

                print(f"  ✓ Copied {len(rows)} real swaps for {job.job_id}")

            except Exception as e:
                print(f"  ⚠️  Error fetching swaps for {job.job_id}: {e}")
                continue

        await reader_pool.close()
        print(f"✅ Seeded pool events from reader database")

    async def update_job_metadata(self):
        """Update job metadata with aggregated stats"""
        print(f"\n📈 Updating job metadata with stats...")

        for job in self.jobs:
            pool_config = next(p for p in MOCK_POOLS if p["pair_id"] == job.job_id)

            # Get recent swaps
            recent_swaps = await SwapEvent.filter(
                evt_address=job.pair_address.lower().replace("0x", ""),
                evt_block_time__gte=int((datetime.utcnow() - timedelta(hours=24)).timestamp())
            ).order_by('evt_block_time').all()

            if recent_swaps:
                # Calculate prices from ticks
                prices = [pow(1.0001, swap.tick) for swap in recent_swaps]
                current_price = prices[-1] if prices else 0

                # Normalize amounts
                decimals0 = pool_config["token0"]["decimals"]
                decimals1 = pool_config["token1"]["decimals"]

                volume0 = sum(abs(float(s.amount0)) / (10 ** decimals0) for s in recent_swaps)
                volume1 = sum(abs(float(s.amount1)) / (10 ** decimals1) for s in recent_swaps)

                job.metadata.update({
                    "pool_data": {
                        "last_sync": datetime.utcnow().isoformat(),
                        "lookback_hours": 24,
                        "current_price": current_price,
                        "high_price_24h": max(prices) if prices else 0,
                        "low_price_24h": min(prices) if prices else 0,
                        "price_change_pct": ((current_price - prices[0]) / prices[0] * 100) if prices and prices[0] > 0 else 0,
                        "total_swaps": len(recent_swaps),
                        "volume_24h_token0": volume0,
                        "volume_24h_token1": volume1,
                        "token0_symbol": pool_config["token0"]["symbol"],
                        "token1_symbol": pool_config["token1"]["symbol"],
                    }
                })

                await job.save()
                print(f"  ✓ Updated metadata for {job.job_id} - Price: ${current_price:.4f}")

        print(f"✅ Updated job metadata")

    async def seed_all(self):
        """Run all seeding operations"""
        print("=" * 60)
        print("🌱 MOCK DATA SEEDER")
        print("=" * 60)

        await self.initialize_db()
        await self.clean_existing_data()
        await self.seed_jobs()
        await self.seed_rounds()
        await self.seed_miner_scores()
        await self.seed_predictions_and_executions()
        await self.seed_pool_events()
        await self.update_job_metadata()

        print("\n" + "=" * 60)
        print("✅ SEEDING COMPLETE!")
        print("=" * 60)
        print(f"\nSeeded:")
        print(f"  • {len(self.jobs)} jobs (trading pairs)")
        print(f"  • {len(self.rounds)} rounds")
        print(f"  • {len(self.jobs) * self.num_miners} miner scores")
        print(f"  • ~{len([r for r in self.rounds if r['round_type'] == 'live']) * int(self.num_miners * 0.8)} executions")
        print(f"  • {len(self.jobs) * self.num_swaps} pool events")
        print("\n🚀 Your local database is ready for testing!")

    async def close(self):
        """Close database connection"""
        await Tortoise.close_connections()


# Add missing math import
import math


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Seed mock data for ForeverMoney local development")
    parser.add_argument("--jobs", type=int, default=3, help="Number of jobs/pairs to create (default: 3, max: 3)")
    parser.add_argument("--rounds", type=int, default=20, help="Number of rounds per job (default: 20)")
    parser.add_argument("--miners", type=int, default=10, help="Number of miners (default: 10)")
    parser.add_argument("--swaps", type=int, default=1000, help="Number of swap events per job (default: 1000)")

    args = parser.parse_args()

    # Validate
    if args.jobs > 3:
        print("⚠️  Warning: Only 3 mock pools configured. Using 3 jobs.")
        args.jobs = 3

    seeder = MockDataSeeder(
        num_jobs=args.jobs,
        num_rounds=args.rounds,
        num_miners=args.miners,
        num_swaps=args.swaps
    )

    try:
        await seeder.seed_all()
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await seeder.close()


if __name__ == "__main__":
    asyncio.run(main())
