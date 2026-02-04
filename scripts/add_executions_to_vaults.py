"""
Add LiveExecution records to existing vaults
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

async def add_executions():
    db_host = os.getenv('JOBS_POSTGRES_HOST', 'localhost')
    db_port = os.getenv('JOBS_POSTGRES_PORT', '5432')
    db_name = os.getenv('JOBS_POSTGRES_DB', 'sn98_jobs_test')
    db_user = os.getenv('JOBS_POSTGRES_USER', 'sn98_user')
    db_pass = os.getenv('JOBS_POSTGRES_PASSWORD', 'testpass123')

    db_url = f"postgres://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    print(f"🔗 Connecting to database...")

    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job']}
    )

    from validator.models.job import Job, Round, RoundType, LiveExecution, MinerScore

    # Get all jobs
    jobs = await Job.filter(is_active=True).all()

    print(f"📊 Adding executions to {len(jobs)} vaults...")

    for job in jobs:
        # Get all LIVE rounds for this job that don't have executions
        live_rounds = await Round.filter(
            job=job,
            round_type=RoundType.LIVE
        ).all()

        # Check which rounds already have executions
        rounds_with_executions = set()
        existing_executions = await LiveExecution.filter(job=job).all()
        for exec in existing_executions:
            await exec.fetch_related('round')
            rounds_with_executions.add(exec.round.id)

        rounds_to_add = [r for r in live_rounds if r.id not in rounds_with_executions]

        if not rounds_to_add:
            print(f"  ✓ {job.metadata['pair_name']}: Already has executions")
            continue

        # Get miners for this job
        miners = await MinerScore.filter(job=job).all()
        if not miners:
            print(f"  ⚠ {job.metadata['pair_name']}: No miners found")
            continue

        executions_created = 0

        for round_obj in rounds_to_add:
            # Pick a random winner from participating miners
            winner = random.choice(miners)

            # Create execution with rebalance data
            await LiveExecution.create(
                job=job,
                round=round_obj,
                execution_id=f"exec_{job.job_id}_{round_obj.round_number}",
                miner_uid=winner.miner_uid,
                sn_liquidity_manager_address=job.sn_liquidity_manager_address,
                strategy_data={
                    "lower_tick": random.randint(-50000, -10000),
                    "upper_tick": random.randint(10000, 50000),
                    "liquidity_token0": random.uniform(1000, 10000),
                    "liquidity_token1": random.uniform(1000, 10000),
                },
                tx_hash=f"0x{os.urandom(32).hex()}",
                tx_status="SUCCESS",
                actual_performance={
                    "rebalance": {
                        "old_lower_tick": random.randint(-60000, -20000),
                        "old_upper_tick": random.randint(20000, 60000),
                        "new_lower_tick": random.randint(-50000, -10000),
                        "new_upper_tick": random.randint(10000, 50000),
                        "tokens_removed_0": random.uniform(5000, 15000),
                        "tokens_removed_1": random.uniform(5000, 15000),
                        "tokens_added_0": random.uniform(5000, 15000),
                        "tokens_added_1": random.uniform(5000, 15000),
                        "fees_collected_0": random.uniform(10, 100),
                        "fees_collected_1": random.uniform(10, 100)
                    },
                    "price_impact": random.uniform(-0.005, 0.005),
                    "slippage": random.uniform(0.001, 0.01)
                }
            )
            executions_created += 1

        print(f"  ✓ {job.metadata['pair_name']}: Created {executions_created} executions")

    print(f"\n🎉 Executions added to all vaults!")

    await Tortoise.close_connections()

if __name__ == "__main__":
    try:
        asyncio.run(add_executions())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
