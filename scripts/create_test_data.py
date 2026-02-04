"""
Create test data for development
"""
import asyncio
from datetime import datetime, timedelta
from tortoise import Tortoise
import random
import os
import sys

# Add parent directory to path to import validator modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

async def create_test_data():
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
        modules={'models': ['validator.models.job', 'validator.models.pool_events']}
    )

    # Generate schemas
    await Tortoise.generate_schemas()
    print("✅ Database schemas created")

    from validator.models.job import Job, Round, MinerScore, RoundType, RoundStatus

    # Create test jobs
    jobs_data = [
        {
            "job_id": "test_eth_usdc_001",
            "pair_name": "TEST-ETH/USDC",
            "sn_liquidity_manager_address": "0x1234567890123456789012345678901234567890",
            "pair_address": "0x0987654321098765432109876543210987654321",
            "fee_rate": 0.03,
        },
        {
            "job_id": "test_wbtc_usdc_002",
            "pair_name": "TEST-WBTC/USDC",
            "sn_liquidity_manager_address": "0x2345678901234567890123456789012345678901",
            "pair_address": "0x1098765432109876543210987654321098765432",
            "fee_rate": 0.05,
        },
        {
            "job_id": "test_tao_usdc_003",
            "pair_name": "TEST-TAO/USDC",
            "sn_liquidity_manager_address": "0x3456789012345678901234567890123456789012",
            "pair_address": "0x2109876543210987654321098765432109876543",
            "fee_rate": 0.1,
        },
        {
            "job_id": "test_xtao_usdc_004",
            "pair_name": "xTao/USDC",
            "sn_liquidity_manager_address": "0x4567890123456789012345678901234567890123",
            "pair_address": "0x3210987654321098765432109876543210987654",
            "fee_rate": 0.05,
        },
    ]

    created_jobs = []
    for job_data in jobs_data:
        job = await Job.create(
            job_id=job_data["job_id"],
            sn_liquidity_manager_address=job_data["sn_liquidity_manager_address"],
            pair_address=job_data["pair_address"],
            fee_rate=job_data["fee_rate"],
            target="PoL",
            target_ratio=0.5,
            chain_id=84532,
            is_active=True,
            round_duration_seconds=300,
            metadata={
                "pair_name": job_data["pair_name"],
                "description": f"Test vault for {job_data['pair_name']}"
            }
        )
        created_jobs.append(job)
        print(f"✅ Created job: {job.job_id} ({job_data['pair_name']})")

    # Create test miners with realistic scores
    miner_uids = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50]

    for job in created_jobs:
        for uid in miner_uids:
            base_score = random.uniform(100, 9000)
            score = await MinerScore.create(
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
                first_seen=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                last_active=datetime.utcnow() - timedelta(hours=random.randint(0, 24))
            )
        print(f"✅ Created {len(miner_uids)} miners for {job.metadata['pair_name']}")

    # Create test rounds for each job
    for job in created_jobs:
        base_time = datetime.utcnow() - timedelta(hours=48)

        for i in range(50):
            round_start = base_time + timedelta(minutes=i * 10)
            round_deadline = round_start + timedelta(minutes=5)
            round_end = round_deadline + timedelta(seconds=30)

            # Create performance data
            scores_dict = {}
            participating_miners = random.sample(miner_uids, random.randint(8, 12))
            for uid in participating_miners:
                scores_dict[str(uid)] = {
                    "hotkey": f"5F{('ABCDEFGHIJ' * 5)[:46]}{uid:02d}",
                    "score": random.uniform(100, 9000),
                    "accepted": True
                }

            # Winner must be from participating miners
            winner_uid = random.choice(participating_miners)

            round_obj = await Round.create(
                job=job,
                round_id=f"round_{job.job_id}_{i+1}",
                round_type=RoundType.EVALUATION if i % 5 != 0 else RoundType.LIVE,
                round_number=i + 1,
                start_time=round_start,
                round_deadline=round_deadline,
                end_time=round_end,
                start_block=20000000 + (i * 100),  # Mock block number
                status=RoundStatus.COMPLETED,
                winner_uid=winner_uid,
                winner_hotkey=f"5F{('ABCDEFGHIJ' * 5)[:46]}{winner_uid:02d}",
                winner_score=scores_dict[str(winner_uid)]["score"],
                performance_data={"scores": scores_dict}
            )

        print(f"✅ Created 50 rounds for {job.metadata['pair_name']}")

    print(f"\n🎉 Test data created successfully!")
    print(f"   - {len(created_jobs)} jobs")
    print(f"   - {len(miner_uids)} miners per job ({len(miner_uids) * len(created_jobs)} total)")
    print(f"   - 50 rounds per job (150 total)")
    print(f"\n📊 You can now test the API at http://localhost:8000")

    await Tortoise.close_connections()

if __name__ == "__main__":
    try:
        asyncio.run(create_test_data())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
