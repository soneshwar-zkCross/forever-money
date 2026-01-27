"""
Create test data for development and testing

This script populates the database with realistic test data for:
- Jobs
- Miner scores
- Rounds
- Predictions

Run this to test the API and frontend without needing real validator data.
"""
import asyncio
from datetime import datetime, timedelta
from tortoise import Tortoise
import random
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from env
DB_HOST = os.getenv("JOBS_POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("JOBS_POSTGRES_PORT", "5432")
DB_NAME = os.getenv("JOBS_POSTGRES_DB", "sn98_jobs_test")
DB_USER = os.getenv("JOBS_POSTGRES_USER", "sn98_user")
DB_PASS = os.getenv("JOBS_POSTGRES_PASSWORD", "")

DATABASE_URL = f"postgres://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


async def create_test_data():
    """Create comprehensive test data"""
    print("🔧 Initializing database connection...")
    
    # Initialize database
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={'models': ['validator.models.job']}
    )
    await Tortoise.generate_schemas()
    
    print("✅ Database connected\n")

    from validator.models.job import (
        Job, Round, MinerScore, Prediction, MinerParticipation, LiveExecution,
        RoundType, RoundStatus
    )

    # Create test jobs
    print("📋 Creating test jobs...")
    jobs_data = [
        {
            "job_id": "job_eth_usdc_001",
            "pair_address": "0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C",
            "sn_liquditiy_manager_address": "0x1234567890123456789012345678901234567890",
            "fee_rate": 0.03,
            "target": "PoL",
            "target_ratio": 0.5,
            "chain_id": 8453,
            "metadata": {
                "pair_name": "ETH/USDC",
                "description": "Ethereum - USDC liquidity pool"
            }
        },
        {
            "job_id": "job_weth_usdc_002",
            "pair_address": "0x99A43bbDF9D098eEC7bCEda4e2494615dfD9bB8B",
            "sn_liquditiy_manager_address": "0x2345678901234567890123456789012345678901",
            "fee_rate": 0.05,
            "target": "PoL",
            "target_ratio": 0.6,
            "chain_id": 8453,
            "metadata": {
                "pair_name": "WETH/USDC",
                "description": "Wrapped Ethereum - USDC pool"
            }
        }
    ]
    
    jobs = []
    for job_data in jobs_data:
        job = await Job.create(
            job_id=job_data["job_id"],
            sn_liquditiy_manager_address=job_data["sn_liquditiy_manager_address"],
            pair_address=job_data["pair_address"],
            fee_rate=job_data["fee_rate"],
            target=job_data["target"],
            target_ratio=job_data["target_ratio"],
            chain_id=job_data["chain_id"],
            is_active=True,
            round_duration_seconds=900,
            metadata=job_data["metadata"]
        )
        jobs.append(job)
        print(f"  ✓ Created job: {job.job_id} ({job_data['metadata']['pair_name']})")
    
    print(f"\n✅ Created {len(jobs)} jobs\n")

    # Create test miners
    print("👥 Creating test miners...")
    miner_uids = list(range(1, 51))  # 50 miners
    miner_names = [
        "AlphaStrategy", "BetaBot", "GammaAI", "DeltaTrader", "EpsilonLP",
        "ZetaOptimizer", "EtaRebalancer", "ThetaFund", "IotaPool", "KappaVault"
    ]
    
    miners_created = 0
    for job in jobs:
        for uid in miner_uids:
            # Randomize participation
            participation_days = random.randint(0, 20)
            is_eligible = participation_days >= 7
            
            # Generate scores with some correlation
            base_score = random.uniform(5000, 15000)
            noise = random.uniform(0.8, 1.2)
            
            eval_score = base_score * noise * random.uniform(0.7, 1.3)
            live_score = base_score * noise * random.uniform(0.6, 1.4) if is_eligible else 0
            combined_score = eval_score * 0.6 + live_score * 0.4 if is_eligible else eval_score
            
            # Participation stats
            total_evals = random.randint(50, 500)
            successful_evals = int(total_evals * random.uniform(0.85, 0.98))
            total_live = random.randint(0, 100) if is_eligible else 0
            successful_live = int(total_live * random.uniform(0.80, 0.95)) if total_live > 0 else 0
            
            score = await MinerScore.create(
                job=job,
                miner_uid=uid,
                miner_hotkey=f"5F{uid:02d}{'x' * 44}{random.randint(100,999)}",
                combined_score=combined_score,
                evaluation_score=eval_score,
                live_score=live_score,
                participation_days=participation_days,
                is_eligible_for_live=is_eligible,
                total_evaluations=total_evals,
                total_live_rounds=total_live,
                successful_evaluations=successful_evals,
                successful_live_rounds=successful_live,
                refusals=random.randint(0, 10),
                first_seen=datetime.utcnow() - timedelta(days=participation_days),
                last_active=datetime.utcnow() - timedelta(hours=random.randint(0, 24))
            )
            miners_created += 1
            
            # Add score history
            history = []
            for i in range(min(20, total_evals)):
                history.append({
                    "round_number": i + 1,
                    "timestamp": (datetime.utcnow() - timedelta(hours=i * 2)).isoformat(),
                    "round_type": "evaluation" if i % 5 != 0 else "live",
                    "round_score": random.uniform(1000, 5000),
                    "evaluation_score": eval_score * random.uniform(0.9, 1.1),
                    "live_score": live_score * random.uniform(0.9, 1.1) if is_eligible else 0,
                    "combined_score": combined_score * random.uniform(0.9, 1.1),
                    "rank": random.randint(1, 50)
                })
            score.score_history = {"history": history}
            await score.save()
    
    print(f"  ✓ Created {miners_created} miner scores across all jobs")
    print(f"\n✅ Created miners\n")

    # Create test rounds
    print("🔄 Creating test rounds...")
    rounds_created = 0
    base_time = datetime.utcnow() - timedelta(days=7)
    
    for job in jobs:
        # Create 100 rounds per job
        for i in range(100):
            round_start = base_time + timedelta(minutes=i * 15)
            round_deadline = round_start + timedelta(minutes=5)
            round_end = round_deadline + timedelta(seconds=random.randint(10, 120))
            
            # Determine round type (80% evaluation, 20% live)
            round_type = RoundType.LIVE if i % 5 == 0 else RoundType.EVALUATION
            
            # Select participants (70-90% of miners)
            num_participants = random.randint(35, 45)
            participants = random.sample(miner_uids, num_participants)
            
            # Generate scores
            scores_dict = {}
            for uid in participants:
                scores_dict[str(uid)] = {
                    "hotkey": f"5F{uid:02d}{'x' * 44}{random.randint(100,999)}",
                    "score": random.uniform(1000, 10000),
                    "accepted": random.random() > 0.05,  # 95% acceptance rate
                    "performance": {
                        "value_gain": random.uniform(-100, 500),
                        "inventory_loss_ratio": random.uniform(0, 0.3),
                        "fees_collected": random.uniform(50, 300)
                    }
                }
            
            # Select winner (highest score among accepted)
            accepted = {uid: data for uid, data in scores_dict.items() if data["accepted"]}
            if accepted:
                winner_uid = int(max(accepted.items(), key=lambda x: x[1]["score"])[0])
            else:
                winner_uid = None
            
            round_obj = await Round.create(
                job=job,
                round_type=round_type,
                round_number=i + 1,
                start_time=round_start,
                round_deadline=round_deadline,
                end_time=round_end,
                status=RoundStatus.COMPLETED,
                winner_uid=winner_uid,
                performance_data={"scores": scores_dict}
            )
            rounds_created += 1
    
    print(f"  ✓ Created {rounds_created} rounds across all jobs")
    print(f"\n✅ Created rounds\n")

    # Create predictions for rounds
    print("📝 Creating predictions for rounds...")
    predictions_created = 0
    
    for job in jobs:
        # Get rounds for this job  
        job_rounds = await Round.filter(job=job).order_by("-round_number").limit(50)
        
        for round_obj in job_rounds:
            # Get scores from performance_data
            scores = round_obj.performance_data.get("scores", {}) if round_obj.performance_data else {}
            
            for uid_str, score_data in scores.items():
                uid = int(uid_str)
                
                # Create prediction record
                await Prediction.create(
                    job=job,
                    round=round_obj,
                    miner_uid=uid,
                    accepted=score_data.get("accepted", True),
                    refusal_reason=None if score_data.get("accepted", True) else "test_refusal",
                    prediction_data=[
                        {
                            "trigger_block": round_obj.start_time.timestamp(),
                            "new_positions": [
                                {
                                    "tick_lower": random.randint(-887000, 0),
                                    "tick_upper": random.randint(0, 887000),
                                    "allocation0": random.uniform(0.3, 0.7),
                                    "allocation1": random.uniform(0.3, 0.7),
                                    "confidence": random.uniform(0.7, 0.95)
                                }
                            ]
                        }
                    ],
                    simulated_performance=score_data.get("performance"),
                    response_time_ms=random.randint(50, 500),
                    submitted_at=round_obj.start_time + timedelta(seconds=random.randint(10, 120))
                )
                predictions_created += 1
    
    print(f"  ✓ Created {predictions_created} predictions")
    print(f"\n✅ Created predictions\n")

    # Create live executions for live rounds
    print("⚡ Creating live executions...")
    executions_created = 0
    
    for job in jobs:
        # Get live rounds for this job
        live_rounds = await Round.filter(
            job=job,
            round_type=RoundType.LIVE,
            status=RoundStatus.COMPLETED
        ).order_by("-round_number").limit(20)
        
        for round_obj in live_rounds:
            if not round_obj.winner_uid:
                continue
            
            # Get winner hotkey from performance data
            scores = round_obj.performance_data.get("scores", {}) if round_obj.performance_data else {}
            winner_data = scores.get(str(round_obj.winner_uid), {})
            winner_hotkey = winner_data.get("hotkey", f"5F{round_obj.winner_uid:02d}{'x' * 44}")
            
            # Create live execution
            from validator.models.job import LiveExecution
            import uuid
            
            tx_statuses = ["success", "success", "success", "pending", "failed"]  # 60% success
            tx_status = random.choice(tx_statuses)
            
            execution = await LiveExecution.create(
                execution_id=str(uuid.uuid4()),
                job=job,
                round=round_obj,
                miner_uid=round_obj.winner_uid,
                strategy_data={
                    "positions": [
                        {
                            "tick_lower": random.randint(-887000, 0),
                            "tick_upper": random.randint(0, 887000),
                            "liquidity": random.randint(1000000, 10000000)
                        }
                    ]
                },
                tx_hash=f"0x{uuid.uuid4().hex}" if tx_status != "pending" else None,
                tx_status=tx_status,
                block_number=random.randint(10000000, 20000000) if tx_status == "success" else None,
                actual_performance={
                    "value_gain": random.uniform(-50, 500),
                    "fees_collected": random.uniform(10, 200),
                    "gas_used": random.randint(100000, 300000)
                } if tx_status == "success" else None,
                executed_at=round_obj.end_time if round_obj.end_time else round_obj.round_deadline,
                updated_at=datetime.utcnow()
            )
            executions_created += 1
    
    print(f"  ✓ Created {executions_created} live executions")
    print(f"\n✅ Created live executions\n")

    # Create miner participation records
    print("📅 Creating participation records...")
    participation_created = 0
    for job in jobs:
        for uid in miner_uids:
            # Create last 30 days of participation
            for days_ago in range(30):
                date = (datetime.utcnow() - timedelta(days=days_ago)).date()
                participated = random.random() > 0.2  # 80% participation rate
                
                await MinerParticipation.create(
                    job=job,
                    miner_uid=uid,
                    participation_date=date,
                    participated=participated,
                    rounds_participated=random.randint(1, 6) if participated else 0,
                    rounds_refused=random.randint(0, 1) if participated else 0
                )
                participation_created += 1
    
    print(f"  ✓ Created {participation_created} participation records")
    print(f"\n✅ Created participation data\n")

    # Summary
    print("=" * 50)
    print("✨ Test Data Creation Complete!")
    print("=" * 50)
    print(f"📊 Summary:")
    print(f"   - Jobs: {len(jobs)}")
    print(f"   - Miners: {len(miner_uids)} per job ({miners_created} total records)")
    print(f"   - Rounds: 100 per job ({rounds_created} total)")
    print(f"   - Predictions: {predictions_created}")
    print(f"   - Live Executions: {executions_created}")
    print(f"   - Participation: 30 days per miner ({participation_created} total)")
    print(f"\n🎯 Total Records: {len(jobs) + miners_created + rounds_created + predictions_created + executions_created + participation_created:,}")
    print("=" * 50)

    await Tortoise.close_connections()
    print("\n✅ Database connection closed")


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("🚀 SN98 Test Data Generator")
    print("=" * 50 + "\n")
    
    try:
        asyncio.run(create_test_data())
        print("\n✅ Success! Test data is ready for API and frontend testing.\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        raise
