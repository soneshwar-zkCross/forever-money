"""
Enhance miner data with more detailed statistics
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

async def enhance_miner_data():
    db_host = os.getenv('JOBS_POSTGRES_HOST', 'localhost')
    db_port = os.getenv('JOBS_POSTGRES_PORT', '5432')
    db_name = os.getenv('JOBS_POSTGRES_DB', 'sn98_jobs_test')
    db_user = os.getenv('JOBS_POSTGRES_USER', 'sn98_user')
    db_pass = os.getenv('JOBS_POSTGRES_PASSWORD', 'testpass123')

    db_url = f"postgres://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    print(f"🔗 Connecting to database...")

    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job', 'api.models.metrics']}
    )

    from validator.models.job import MinerScore, Job
    from api.models.metrics import MinerMetrics

    # Get all miners
    all_miners = await MinerScore.all()
    miner_uids = set(m.miner_uid for m in all_miners)

    print(f"📊 Enhancing data for {len(miner_uids)} miners...")

    for uid in miner_uids:
        # Get all jobs this miner participates in
        miner_scores = await MinerScore.filter(miner_uid=uid).all()

        # Update each score with more detailed stats
        for score in miner_scores:
            # Add realistic variation to scores
            if score.combined_score < 100:
                score.combined_score = random.uniform(1000, 9000)
                score.evaluation_score = score.combined_score * random.uniform(0.85, 0.95)
                score.live_score = score.combined_score * random.uniform(0.90, 1.05)

            # Update participation metrics
            score.participation_days = random.randint(5, 45)
            score.total_evaluations = random.randint(200, 600)
            score.total_live_rounds = random.randint(50, 150)
            score.successful_evaluations = int(score.total_evaluations * random.uniform(0.85, 0.98))
            score.successful_live_rounds = int(score.total_live_rounds * random.uniform(0.80, 0.95))
            score.refusals = random.randint(0, 5)

            # Eligibility based on participation
            score.is_eligible_for_live = score.participation_days >= 7

            # Timestamps
            score.first_seen = datetime.now() - timedelta(days=score.participation_days)
            score.last_active = datetime.now() - timedelta(hours=random.randint(0, 12))

            await score.save()

        # Update miner metrics
        miner_metric = await MinerMetrics.filter(miner_uid=uid).first()
        if miner_metric:
            # Calculate comprehensive stats
            total_evals = sum(s.total_evaluations for s in miner_scores)
            total_live = sum(s.total_live_rounds for s in miner_scores)
            total_participations = total_evals + total_live

            # Win rate based on score performance
            avg_score = sum(float(s.combined_score) for s in miner_scores) / len(miner_scores)
            win_rate = min(35, max(10, (avg_score / 9000) * 30))  # 10-35% range
            total_wins = int(total_participations * win_rate / 100)

            miner_metric.win_rate = win_rate
            miner_metric.total_wins = total_wins
            miner_metric.total_participations = total_participations

            # Update job breakdown with detailed info
            job_breakdown = {}
            for score in miner_scores:
                job = await Job.filter(id=score.job_id).first()
                if job:
                    earnings_for_job = miner_metric.estimated_earnings_alpha / len(miner_scores)
                    job_breakdown[job.job_id] = {
                        "earnings_alpha": earnings_for_job,
                        "earnings_usd": earnings_for_job * 0.15,
                        "score": float(score.combined_score),
                        "wins": total_wins // len(miner_scores),
                        "participations": total_participations // len(miner_scores),
                        "win_rate": win_rate,
                        "eval_score": float(score.evaluation_score),
                        "live_score": float(score.live_score),
                        "successful_evals": score.successful_evaluations,
                        "successful_live": score.successful_live_rounds,
                        "refusals": score.refusals,
                        "days_active": score.participation_days,
                    }

            miner_metric.job_breakdown = job_breakdown
            await miner_metric.save()

        print(f"  ✓ Enhanced UID {uid}")

    print(f"\n🎉 Enhanced {len(miner_uids)} miners with detailed statistics!")
    print(f"   - Participation days: 5-45 days")
    print(f"   - Evaluations: 200-600 per miner")
    print(f"   - Live rounds: 50-150 per miner")
    print(f"   - Win rates: 10-35%")
    print(f"   - Success rates: 80-98%")

    await Tortoise.close_connections()

if __name__ == "__main__":
    try:
        asyncio.run(enhance_miner_data())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
