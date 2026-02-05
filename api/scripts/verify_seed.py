"""
Verify Seeded Data

Shows statistics about seeded data in the database.

Usage:
    python api/scripts/verify_seed.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from tortoise import Tortoise
from validator.models.job import Job, Round, MinerScore, Prediction, LiveExecution
from validator.models.pool_events import SwapEvent
from datetime import datetime, timedelta


async def verify_data():
    """Verify and display seeded data statistics"""

    # Initialize DB
    db_url = os.getenv("DB_URL", "postgresql://postgres:postgres@localhost:5432/forevermoneydb")
    await Tortoise.init(
        db_url=db_url,
        modules={'models': [
            'validator.models.job',
            'validator.models.pool_events'
        ]}
    )

    print("=" * 70)
    print("📊 SEEDED DATA VERIFICATION")
    print("=" * 70)

    # Jobs
    jobs = await Job.filter(job_id__contains="mock").all()
    print(f"\n🎯 JOBS (Trading Pairs): {len(jobs)}")
    for job in jobs:
        pair_name = job.metadata.get("pair_name", "Unknown")
        pool_data = job.metadata.get("pool_data", {})
        current_price = pool_data.get("current_price", 0)

        print(f"  • {job.job_id}")
        print(f"    └─ {pair_name} - Current Price: ${current_price:.4f if current_price < 100 else current_price:.2f}")

        # Count rounds for this job
        rounds = await Round.filter(job=job).all()
        eval_rounds = [r for r in rounds if r.round_type == "evaluation"]
        live_rounds = [r for r in rounds if r.round_type == "live"]

        print(f"    └─ Rounds: {len(eval_rounds)} evaluation, {len(live_rounds)} live")

        # Count miners for this job
        miners = await MinerScore.filter(job=job).all()
        eligible = [m for m in miners if m.is_eligible_for_live]

        print(f"    └─ Miners: {len(miners)} total, {len(eligible)} eligible")

        # Count swaps
        pool_address = job.pair_address.lower().replace("0x", "")
        swaps = await SwapEvent.filter(evt_address=pool_address).count()
        recent_swaps = await SwapEvent.filter(
            evt_address=pool_address,
            evt_block_time__gte=int((datetime.utcnow() - timedelta(hours=24)).timestamp())
        ).count()

        print(f"    └─ Swaps: {swaps} total, {recent_swaps} in last 24h")

    # Total counts
    total_rounds = await Round.all().count()
    total_predictions = await Prediction.all().count()
    total_executions = await LiveExecution.all().count()
    total_miners = await MinerScore.all().count()
    total_swaps = await SwapEvent.all().count()

    print(f"\n📈 TOTALS:")
    print(f"  • Rounds: {total_rounds}")
    print(f"  • Predictions: {total_predictions}")
    print(f"  • Live Executions: {total_executions}")
    print(f"  • Miner Scores: {total_miners}")
    print(f"  • Swap Events: {total_swaps}")

    # Execution success rate
    successful_executions = await LiveExecution.filter(success=True).count()
    success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0

    print(f"\n✅ EXECUTION SUCCESS RATE: {success_rate:.1f}% ({successful_executions}/{total_executions})")

    # Recent activity
    recent_rounds = await Round.filter(
        start_time__gte=datetime.utcnow() - timedelta(days=7)
    ).count()

    print(f"\n📅 RECENT ACTIVITY (Last 7 days):")
    print(f"  • Rounds: {recent_rounds}")

    # Show sample data
    print(f"\n🔍 SAMPLE DATA:")

    # Show one round with predictions
    sample_round = await Round.first()
    if sample_round:
        predictions = await Prediction.filter(round_id=sample_round.id).count()
        print(f"  • Round #{sample_round.round_number} ({sample_round.round_type})")
        print(f"    └─ {predictions} predictions submitted")

    # Show miner with best score
    best_miner = await MinerScore.all().order_by('-combined_score').first()
    if best_miner:
        print(f"  • Best Miner: UID {best_miner.miner_uid}")
        print(f"    └─ Combined Score: {best_miner.combined_score:.4f}")
        print(f"    └─ Evaluation: {best_miner.evaluation_score:.4f}, Live: {best_miner.live_score:.4f}")

    print("\n" + "=" * 70)
    print("✅ VERIFICATION COMPLETE")
    print("=" * 70)
    print("\n💡 TIP: Visit http://localhost:3000/admin to see this data in the UI")

    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(verify_data())
