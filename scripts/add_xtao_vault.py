"""
Add xTao/USDC vault with complete data including rebalances
"""
import asyncio
from datetime import datetime, timedelta
from tortoise import Tortoise
import random
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

async def add_xtao_vault():
    # Build database URL
    db_host = os.getenv('JOBS_POSTGRES_HOST', 'localhost')
    db_port = os.getenv('JOBS_POSTGRES_PORT', '5432')
    db_name = os.getenv('JOBS_POSTGRES_DB', 'sn98_jobs_test')
    db_user = os.getenv('JOBS_POSTGRES_USER', 'sn98_user')
    db_pass = os.getenv('JOBS_POSTGRES_PASSWORD', 'testpass123')

    db_url = f"postgres://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    print(f"🔗 Connecting to database: {db_host}:{db_port}/{db_name}")

    # Initialize Tortoise ORM
    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job', 'validator.models.pool_events', 'api.models.metrics']}
    )

    await Tortoise.generate_schemas(safe=True)
    print("✅ Database schemas ready")

    from validator.models.job import Job, Round, MinerScore, RoundType, RoundStatus, LiveExecution
    from api.models.metrics import JobMetrics, MinerMetrics, PairMetrics, VaultBalanceSnapshot

    # Check if xTao vault already exists
    existing = await Job.filter(job_id="test_xtao_usdc_004").first()
    if existing:
        print("⚠️  xTao/USDC vault already exists, updating data...")
        job = existing
    else:
        # Create xTao/USDC vault
        job = await Job.create(
            job_id="test_xtao_usdc_004",
            sn_liquidity_manager_address="0x4567890123456789012345678901234567890123",
            pair_address="0x3210987654321098765432109876543210987654",
            fee_rate=0.05,
            target="PoL",
            target_ratio=0.5,
            chain_id=8453,
            is_active=True,
            round_duration_seconds=300,
            metadata={
                "pair_name": "xTao/USDC",
                "description": "Liquidity vault for xTao/USDC pair with active rebalancing",
                "token0_symbol": "xTao",
                "token1_symbol": "USDC",
                "pool_address": "0x3210987654321098765432109876543210987654"
            }
        )
        print(f"✅ Created job: {job.job_id} (xTao/USDC)")

    # Create miner scores
    miner_uids = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50]

    for uid in miner_uids:
        existing_score = await MinerScore.filter(job=job, miner_uid=uid).first()
        if not existing_score:
            base_score = random.uniform(100, 9000)
            await MinerScore.create(
                job=job,
                miner_uid=uid,
                miner_hotkey=f"5F{('ABCDEFGHIJ' * 5)[:46]}{uid:02d}",
                combined_score=base_score,
                evaluation_score=base_score * random.uniform(0.8, 1.0),
                live_score=base_score * random.uniform(0.9, 1.0),
                participation_days=random.randint(1, 30),
                is_eligible_for_live=(random.randint(1, 30) >= 7),
                total_evaluations=random.randint(100, 500),
                total_live_rounds=random.randint(10, 100),
                successful_evaluations=random.randint(90, 480),
                successful_live_rounds=random.randint(8, 95),
                refusals=random.randint(0, 10),
                first_seen=datetime.now() - timedelta(days=random.randint(1, 30)),
                last_active=datetime.now() - timedelta(hours=random.randint(0, 24))
            )
    print(f"✅ Created/verified {len(miner_uids)} miners for xTao/USDC")

    # Create rounds with rebalance data
    base_time = datetime.now() - timedelta(hours=48)
    rounds_created = 0

    for i in range(50):
        round_start = base_time + timedelta(minutes=i * 10)
        round_deadline = round_start + timedelta(minutes=5)
        round_end = round_deadline + timedelta(seconds=30)

        # Create performance data with miner predictions
        scores_dict = {}
        predictions_dict = {}
        participating_miners = random.sample(miner_uids, random.randint(8, 12))

        for uid in participating_miners:
            score_value = random.uniform(100, 9000)
            scores_dict[str(uid)] = {
                "hotkey": f"5F{('ABCDEFGHIJ' * 5)[:46]}{uid:02d}",
                "score": score_value,
                "accepted": True
            }

            # Miner prediction (rebalance proposal)
            predictions_dict[str(uid)] = {
                "lower_tick": random.randint(-50000, -10000),
                "upper_tick": random.randint(10000, 50000),
                "liquidity_token0": random.uniform(1000, 10000),
                "liquidity_token1": random.uniform(1000, 10000),
                "predicted_fee_apr": random.uniform(3.0, 8.0),
                "confidence": random.uniform(0.7, 0.95)
            }

        # Winner must be from participating miners
        winner_uid = random.choice(participating_miners)

        # Check if round exists
        existing_round = await Round.filter(round_id=f"round_{job.job_id}_{i+1}").first()
        if not existing_round:
            round_obj = await Round.create(
                job=job,
                round_id=f"round_{job.job_id}_{i+1}",
                round_type=RoundType.EVALUATION if i % 5 != 0 else RoundType.LIVE,
                round_number=i + 1,
                start_time=round_start,
                round_deadline=round_deadline,
                end_time=round_end,
                start_block=20000000 + (i * 100),
                status=RoundStatus.COMPLETED,
                winner_uid=winner_uid,
                winner_hotkey=f"5F{('ABCDEFGHIJ' * 5)[:46]}{winner_uid:02d}",
                winner_score=scores_dict[str(winner_uid)]["score"],
                performance_data={
                    "scores": scores_dict,
                    "predictions": predictions_dict,
                    "pool_state": {
                        "current_price": random.uniform(0.90, 1.10),
                        "current_tick": random.randint(-5000, 5000),
                        "liquidity": random.uniform(100000, 500000),
                        "volume_24h": random.uniform(50000, 200000)
                    }
                }
            )
            rounds_created += 1

            # Create LiveExecution for live rounds with rebalance details
            if round_obj.round_type == RoundType.LIVE:
                await LiveExecution.create(
                    job=job,
                    round=round_obj,
                    execution_id=f"exec_{job.job_id}_{i+1}",
                    miner_uid=winner_uid,
                    sn_liquidity_manager_address=job.sn_liquidity_manager_address,
                    strategy_data={
                        "lower_tick": predictions_dict[str(winner_uid)]["lower_tick"],
                        "upper_tick": predictions_dict[str(winner_uid)]["upper_tick"],
                        "liquidity_token0": predictions_dict[str(winner_uid)]["liquidity_token0"],
                        "liquidity_token1": predictions_dict[str(winner_uid)]["liquidity_token1"],
                    },
                    tx_hash=f"0x{'a' * 64}",
                    tx_status="SUCCESS",
                    actual_performance={
                        "rebalance": {
                            "old_lower_tick": random.randint(-60000, -20000),
                            "old_upper_tick": random.randint(20000, 60000),
                            "new_lower_tick": predictions_dict[str(winner_uid)]["lower_tick"],
                            "new_upper_tick": predictions_dict[str(winner_uid)]["upper_tick"],
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

    print(f"✅ Created {rounds_created} rounds with rebalance data for xTao/USDC")

    # Create job metrics (30 days of history)
    base_tvl = random.uniform(80000, 150000)
    base_revenue = random.uniform(400, 1200)

    metrics_created = 0
    for days_ago in range(30, -1, -1):
        timestamp = datetime.now() - timedelta(days=days_ago)

        # Check if metric exists
        existing_metric = await JobMetrics.filter(
            job_id=job.job_id,
            calculated_at__gte=timestamp - timedelta(hours=12),
            calculated_at__lte=timestamp + timedelta(hours=12)
        ).first()

        if not existing_metric:
            growth_factor = 1 + (30 - days_ago) * 0.02
            tvl_variation = random.uniform(0.9, 1.1)

            tvl_usd = base_tvl * growth_factor * tvl_variation
            tvl_token0 = tvl_usd * random.uniform(0.4, 0.6) / 1.0
            tvl_token1 = tvl_usd * random.uniform(0.4, 0.6) / 1.0

            revenue_usd = base_revenue * (30 - days_ago) / 30
            revenue_token0 = revenue_usd * random.uniform(0.45, 0.55)
            revenue_token1 = revenue_usd - revenue_token0

            if days_ago == 30:
                pnl_usd = 0.0
            else:
                initial_tvl = base_tvl
                pnl_usd = tvl_usd - initial_tvl

            if tvl_usd > 0:
                daily_return = revenue_usd / tvl_usd / 30
                apy_percent = daily_return * 365 * 100
            else:
                apy_percent = 0.0

            await JobMetrics.create(
                job_id=job.job_id,
                calculated_at=timestamp,
                tvl_token0=tvl_token0,
                tvl_token1=tvl_token1,
                tvl_usd=tvl_usd,
                token0_price_usd=1.0,
                token1_price_usd=1.0,
                revenue_token0=revenue_token0 / 1e18,
                revenue_token1=revenue_token1 / 1e18,
                revenue_usd=revenue_usd,
                pnl_token0=pnl_usd * 0.5,
                pnl_token1=pnl_usd * 0.5,
                pnl_usd=pnl_usd,
                apy_percent=apy_percent,
                round_count=150 - days_ago * 5,
                last_round_number=150 - days_ago * 5,
            )
            metrics_created += 1

    print(f"✅ Created {metrics_created} job metrics snapshots for xTao/USDC")

    # Create initial vault balance snapshot
    existing_snapshot = await VaultBalanceSnapshot.filter(
        job_id=job.job_id,
        snapshot_type="initial"
    ).first()

    if not existing_snapshot:
        initial_balance_usd = random.uniform(80000, 120000)
        initial_token0 = initial_balance_usd * random.uniform(0.45, 0.55)
        initial_token1 = initial_balance_usd - initial_token0

        await VaultBalanceSnapshot.create(
            job_id=job.job_id,
            timestamp=datetime.now() - timedelta(days=30),
            balance_token0=initial_token0,
            balance_token1=initial_token1,
            balance_usd=initial_balance_usd,
            snapshot_type="initial",
        )
        print(f"✅ Created initial vault balance snapshot for xTao/USDC")

    # Update pair metrics
    pair_metric = await PairMetrics.filter(pair_address=job.pair_address).first()
    if pair_metric:
        # Update existing
        latest_job_metric = await JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()
        if latest_job_metric:
            if not pair_metric.job_breakdown:
                pair_metric.job_breakdown = {}

            pair_metric.job_breakdown[job.job_id] = {
                "tvl": latest_job_metric.tvl_usd,
                "revenue": latest_job_metric.revenue_usd,
                "pnl": latest_job_metric.pnl_usd,
                "apy": latest_job_metric.apy_percent,
            }
            pair_metric.active_jobs_count += 1
            pair_metric.total_revenue_usd += latest_job_metric.revenue_usd
            pair_metric.total_tvl_usd += latest_job_metric.tvl_usd
            pair_metric.total_pnl_usd += latest_job_metric.pnl_usd
            await pair_metric.save()
            print(f"✅ Updated pair metrics for xTao/USDC")
    else:
        # Create new pair metric
        latest_job_metric = await JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()
        if latest_job_metric:
            miner_count = await MinerScore.filter(job=job).distinct().count()

            await PairMetrics.create(
                pair_address=job.pair_address,
                chain_id=job.chain_id,
                calculated_at=datetime.now(),
                total_tvl_usd=latest_job_metric.tvl_usd,
                total_revenue_usd=latest_job_metric.revenue_usd,
                total_pnl_usd=latest_job_metric.pnl_usd,
                avg_apy_percent=latest_job_metric.apy_percent,
                active_jobs_count=1,
                total_miners=miner_count,
                job_breakdown={
                    job.job_id: {
                        "tvl": latest_job_metric.tvl_usd,
                        "revenue": latest_job_metric.revenue_usd,
                        "pnl": latest_job_metric.pnl_usd,
                        "apy": latest_job_metric.apy_percent,
                    }
                }
            )
            print(f"✅ Created pair metrics for xTao/USDC")

    print(f"\n🎉 xTao/USDC vault setup complete!")
    print(f"   - Job ID: {job.job_id}")
    print(f"   - Miners: {len(miner_uids)}")
    print(f"   - Rounds with rebalances: {rounds_created}")
    print(f"   - Metrics snapshots: {metrics_created}")

    await Tortoise.close_connections()

if __name__ == "__main__":
    try:
        asyncio.run(add_xtao_vault())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
