"""
Create Mock Metrics Data

Populates all metrics tables with realistic test data for frontend testing.
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from tortoise import Tortoise
from validator.models.job import Job, MinerScore
from api.models.metrics import (
    JobMetrics,
    MinerMetrics,
    PairMetrics,
    VaultBalanceSnapshot,
    SubnetMetricsSnapshot
)

# Database URL
from validator.utils.env import (
    JOBS_POSTGRES_HOST,
    JOBS_POSTGRES_PORT,
    JOBS_POSTGRES_DB,
    JOBS_POSTGRES_USER,
    JOBS_POSTGRES_PASSWORD,
)

DB_URL = f"postgres://{JOBS_POSTGRES_USER}:{JOBS_POSTGRES_PASSWORD}@{JOBS_POSTGRES_HOST}:{JOBS_POSTGRES_PORT}/{JOBS_POSTGRES_DB}"


async def create_mock_job_metrics():
    """Create realistic job metrics for all active jobs."""
    print("\n1. Creating Job Metrics...")

    jobs = await Job.filter(is_active=True).all()

    for job in jobs:
        print(f"   Creating metrics for {job.job_id}...")

        # Generate realistic values based on pair
        if "eth" in job.job_id.lower() or "wbtc" in job.job_id.lower():
            # High value pools
            base_tvl = random.uniform(50000, 200000)
            base_revenue = random.uniform(500, 2000)
        elif "tao" in job.job_id.lower():
            # Medium value pools
            base_tvl = random.uniform(20000, 80000)
            base_revenue = random.uniform(200, 800)
        else:
            # Smaller pools
            base_tvl = random.uniform(5000, 30000)
            base_revenue = random.uniform(50, 300)

        # Create snapshots for last 30 days (one per day)
        for days_ago in range(30, -1, -1):
            timestamp = datetime.now() - timedelta(days=days_ago)

            # Add some variation over time (growth trend)
            growth_factor = 1 + (30 - days_ago) * 0.02  # 2% growth per day
            tvl_variation = random.uniform(0.9, 1.1)

            tvl_usd = base_tvl * growth_factor * tvl_variation
            tvl_token0 = tvl_usd * random.uniform(0.4, 0.6) / 1.0  # Assume token0 ~$1
            tvl_token1 = tvl_usd * random.uniform(0.4, 0.6) / 1.0  # Assume token1 ~$1

            # Revenue accumulates over time
            revenue_usd = base_revenue * (30 - days_ago) / 30
            revenue_token0 = revenue_usd * random.uniform(0.45, 0.55)
            revenue_token1 = revenue_usd - revenue_token0

            # PnL = current TVL - initial TVL + accumulated fees
            if days_ago == 30:
                pnl_usd = 0.0
            else:
                initial_tvl = base_tvl
                pnl_usd = tvl_usd - initial_tvl

            # APY calculation
            if tvl_usd > 0:
                daily_return = revenue_usd / tvl_usd / 30
                apy_percent = daily_return * 365 * 100
            else:
                apy_percent = 0.0

            # Create snapshot
            await JobMetrics.create(
                job_id=job.job_id,
                calculated_at=timestamp,
                tvl_token0=tvl_token0,
                tvl_token1=tvl_token1,
                tvl_usd=tvl_usd,
                token0_price_usd=1.0,
                token1_price_usd=1.0,
                revenue_token0=revenue_token0 / 1e18,  # Convert to tokens
                revenue_token1=revenue_token1 / 1e18,
                revenue_usd=revenue_usd,
                pnl_token0=pnl_usd * 0.5,
                pnl_token1=pnl_usd * 0.5,
                pnl_usd=pnl_usd,
                apy_percent=apy_percent,
                round_count=150 - days_ago * 5,
                last_round_number=150 - days_ago * 5,
            )

    print(f"   ✓ Created metrics for {len(jobs)} jobs (30 days each)")


async def create_vault_balance_snapshots():
    """Create initial vault balance snapshots for inventory tracking."""
    print("\n2. Creating Vault Balance Snapshots...")

    jobs = await Job.filter(is_active=True).all()

    for job in jobs:
        # Create initial snapshot (30 days ago)
        if "eth" in job.job_id.lower() or "wbtc" in job.job_id.lower():
            initial_balance_usd = random.uniform(50000, 100000)
        elif "tao" in job.job_id.lower():
            initial_balance_usd = random.uniform(20000, 50000)
        else:
            initial_balance_usd = random.uniform(5000, 20000)

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

    print(f"   ✓ Created initial snapshots for {len(jobs)} vaults")


async def create_miner_metrics():
    """Create miner metrics with earnings and win rates."""
    print("\n3. Creating Miner Metrics...")

    # Get all unique miners
    miner_scores = await MinerScore.all()
    unique_miners = {}
    for score in miner_scores:
        if score.miner_uid not in unique_miners:
            unique_miners[score.miner_uid] = score

    # Alpha price (mock)
    alpha_price_usd = 0.15

    # Total emissions pool (mock)
    total_emissions_alpha = 1000.0

    # Calculate total scores
    total_score = sum(float(s.combined_score) for s in unique_miners.values())

    for uid, score in unique_miners.items():
        # Calculate earnings based on score proportion
        score_percentage = float(score.combined_score) / total_score if total_score > 0 else 0
        earnings_alpha = total_emissions_alpha * score_percentage
        earnings_usd = earnings_alpha * alpha_price_usd

        # Calculate win rate (winners have higher scores)
        # Assume 10-30% win rate, higher for higher scores
        base_win_rate = 10 + (score_percentage * 20)
        win_rate = min(30, base_win_rate + random.uniform(-5, 5))

        # Total participations (roughly 150 rounds across all jobs)
        total_participations = random.randint(100, 200)
        total_wins = int(total_participations * win_rate / 100)

        # Per-job breakdown
        job_breakdown = {}
        jobs = await MinerScore.filter(miner_uid=uid).all()
        for job_score in jobs:
            job_breakdown[job_score.job_id] = {
                "earnings_alpha": earnings_alpha / len(jobs),
                "earnings_usd": earnings_usd / len(jobs),
                "score": float(job_score.combined_score),
                "wins": total_wins // len(jobs),
            }

        await MinerMetrics.create(
            miner_uid=uid,
            miner_hotkey=score.miner_hotkey,
            calculated_at=datetime.now(),
            estimated_earnings_alpha=earnings_alpha,
            estimated_earnings_usd=earnings_usd,
            total_score=float(score.combined_score),
            win_rate=win_rate,
            total_wins=total_wins,
            total_participations=total_participations,
            job_breakdown=job_breakdown,
        )

    print(f"   ✓ Created metrics for {len(unique_miners)} miners")


async def create_pair_metrics():
    """Create aggregated pair metrics."""
    print("\n4. Creating Pair Metrics...")

    # Group jobs by pair
    jobs = await Job.filter(is_active=True).all()
    pairs = {}
    for job in jobs:
        if job.pair_address not in pairs:
            pairs[job.pair_address] = []
        pairs[job.pair_address].append(job)

    for pair_address, pair_jobs in pairs.items():
        # Aggregate metrics from latest job metrics
        total_tvl_usd = 0.0
        total_revenue_usd = 0.0
        total_pnl_usd = 0.0
        job_breakdown = {}

        for job in pair_jobs:
            latest_metric = await JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()
            if latest_metric:
                total_tvl_usd += latest_metric.tvl_usd
                total_revenue_usd += latest_metric.revenue_usd
                total_pnl_usd += latest_metric.pnl_usd

                job_breakdown[job.job_id] = {
                    "tvl": latest_metric.tvl_usd,
                    "revenue": latest_metric.revenue_usd,
                    "pnl": latest_metric.pnl_usd,
                    "apy": latest_metric.apy_percent,
                }

        # Calculate average APY
        avg_apy = sum(j["apy"] for j in job_breakdown.values()) / len(job_breakdown) if job_breakdown else 0.0

        # Count unique miners across all jobs in this pair
        unique_miners_set = set()
        for job in pair_jobs:
            miners = await MinerScore.filter(job=job).all()
            for miner in miners:
                unique_miners_set.add(miner.miner_uid)
        total_miners = len(unique_miners_set)

        await PairMetrics.create(
            pair_address=pair_address,
            chain_id=pair_jobs[0].chain_id,
            calculated_at=datetime.now(),
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            total_pnl_usd=total_pnl_usd,
            avg_apy_percent=avg_apy,
            active_jobs_count=len(pair_jobs),
            total_miners=total_miners,
            job_breakdown=job_breakdown,
        )

    print(f"   ✓ Created metrics for {len(pairs)} pairs")


async def create_subnet_snapshots():
    """Create subnet-wide metric snapshots."""
    print("\n5. Creating Subnet Snapshots...")

    # Create snapshots for last 30 days
    for days_ago in range(30, -1, -1):
        timestamp = datetime.now() - timedelta(days=days_ago)

        # Aggregate all job metrics at this timestamp
        job_metrics = await JobMetrics.filter(
            calculated_at__gte=timestamp - timedelta(hours=12),
            calculated_at__lte=timestamp + timedelta(hours=12),
        ).all()

        if not job_metrics:
            continue

        total_tvl_usd = sum(m.tvl_usd for m in job_metrics)
        total_revenue_usd = sum(m.revenue_usd for m in job_metrics)
        total_pnl_usd = sum(m.pnl_usd for m in job_metrics)

        # Mock emissions
        alpha_price_usd = 0.15
        total_emissions_alpha = 1000.0
        total_emissions_usd = total_emissions_alpha * alpha_price_usd

        # Calculate burn ratio based on profitability
        profit_ratio = min(1.0, total_revenue_usd / (total_emissions_usd * 0.5)) if total_emissions_usd > 0 else 0.5
        miner_ratio = profit_ratio
        burn_ratio = 1.0 - miner_ratio

        await SubnetMetricsSnapshot.create(
            snapshot_time=timestamp,
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            total_pnl_usd=total_pnl_usd,
            total_emissions_alpha=total_emissions_alpha,
            total_emissions_usd=total_emissions_usd,
            alpha_price_usd=alpha_price_usd,
            burn_ratio=burn_ratio,
            miner_ratio=miner_ratio,
            profit_ratio=profit_ratio,
        )

    snapshots_count = await SubnetMetricsSnapshot.all().count()
    print(f"   ✓ Created {snapshots_count} subnet snapshots")


async def main():
    """Main execution."""
    print("=" * 60)
    print("Creating Mock Metrics Data")
    print("=" * 60)

    # Initialize Tortoise ORM
    await Tortoise.init(
        db_url=DB_URL,
        modules={'models': [
            'validator.models.job',
            'api.models.metrics',
        ]}
    )
    await Tortoise.generate_schemas(safe=True)

    try:
        # Clear existing metrics data
        print("\nClearing existing metrics data...")
        await JobMetrics.all().delete()
        await MinerMetrics.all().delete()
        await PairMetrics.all().delete()
        await VaultBalanceSnapshot.all().delete()
        await SubnetMetricsSnapshot.all().delete()
        print("   ✓ Cleared")

        # Create mock data
        await create_mock_job_metrics()
        await create_vault_balance_snapshots()
        await create_miner_metrics()
        await create_pair_metrics()
        await create_subnet_snapshots()

        print("\n" + "=" * 60)
        print("Mock Metrics Data Created Successfully!")
        print("=" * 60)

        # Summary
        print("\nSummary:")
        job_metrics_count = await JobMetrics.all().count()
        miner_metrics_count = await MinerMetrics.all().count()
        pair_metrics_count = await PairMetrics.all().count()
        vault_snapshots_count = await VaultBalanceSnapshot.all().count()
        subnet_snapshots_count = await SubnetMetricsSnapshot.all().count()

        print(f"  - Job Metrics: {job_metrics_count} snapshots")
        print(f"  - Miner Metrics: {miner_metrics_count} miners")
        print(f"  - Pair Metrics: {pair_metrics_count} pairs")
        print(f"  - Vault Balance Snapshots: {vault_snapshots_count}")
        print(f"  - Subnet Snapshots: {subnet_snapshots_count}")

        print("\nNow refresh your frontend to see the data!")
        print("  - Dashboard: http://localhost:3000/admin")
        print("  - Jobs: http://localhost:3000/admin/jobs")
        print("  - Metrics: http://localhost:3000/admin/metrics")
        print()

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
