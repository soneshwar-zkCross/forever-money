# Bittensor Testnet Setup Guide

> **Quick guide to run the SN98 validator on testnet for testing and data generation**

This guide shows how to set up and run the validator on Bittensor's testnet to generate real data for API and frontend testing.

---

## Prerequisites

- Python 3.9+
- PostgreSQL database
- Bittensor testnet faucet access
- Archive node RPC endpoint (for historical data)

---

## Step 1: Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Bittensor (if not already installed)
pip install bittensor
```

---

## Step 2: Create Testnet Wallet

### Option A: Create New Wallet

```bash
# Create coldkey
btcli wallet new_coldkey --wallet.name testwallet

# Create hotkey
btcli wallet new_hotkey --wallet.name testwallet --wallet.hotkey testhotkey
```

### Option B: Use Existing Wallet

If you already have a wallet, note the path (usually `~/.bittensor/wallets`).

### Get Testnet TAO

1. Join Bittensor Discord: https://discord.gg/bittensor
2. Go to #testnet-faucet channel
3. Request testnet TAO: `/faucet-request <your-hotkey-address>`
4. Wait for testnet TAO to arrive (check with `btcli wallet balance`)

---

## Step 3: Configure Environment Variables

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with testnet settings:

```env
# Bittensor Network Configuration
NETUID=98
SUBTENSOR_NETWORK=test  # Use 'test' for testnet
SUBTENSOR_CHAIN_ENDPOINT=wss://test.finney.opentensor.ai:443/

# RPC Endpoints (use public testnet endpoints)
MAINNET_RPC=https://eth-sepolia.public.blastapi.io  # Ethereum Sepolia testnet
BASE_RPC=https://base-sepolia-rpc.publicnode.com     # Base Sepolia testnet

# Chain ID (Base Sepolia testnet)
CHAIN_ID=84532

# Database Configuration (Jobs Database)
JOBS_POSTGRES_HOST=localhost
JOBS_POSTGRES_PORT=5432
JOBS_POSTGRES_DB=sn98_jobs_test
JOBS_POSTGRES_USER=sn98_user
JOBS_POSTGRES_PASSWORD=your_password

# Pool Events Database (same as Jobs for testing)
POOL_EVENTS_POSTGRES_HOST=localhost
POOL_EVENTS_POSTGRES_PORT=5432
POOL_EVENTS_POSTGRES_DB=sn98_jobs_test
POOL_EVENTS_POSTGRES_USER=sn98_user
POOL_EVENTS_POSTGRES_PASSWORD=your_password

# Executor Bot (optional for testing, can use mock)
EXECUTOR_BOT_URL=http://localhost:9000
EXECUTOR_BOT_API_KEY=test_key_123

# Backtesting Configuration
REBALANCE_CHECK_INTERVAL=50  # Blocks between rebalance checks

# Miner Configuration (for testing)
MINER_VERSION=1.0.0

# Logging
LOG_LEVEL=INFO
```

---

## Step 4: Set Up PostgreSQL Database

### Create Test Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE sn98_jobs_test;

# Create user (if needed)
CREATE USER sn98_user WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sn98_jobs_test TO sn98_user;

# Exit
\q
```

### Initialize Database Schema

The database schema will be auto-created when the validator starts (Tortoise ORM will create tables).

---

## Step 5: Create Test Job Configuration

Create a test job for a testnet pool. For testing purposes, we'll use a simple configuration:

```bash
# Create jobs directory if it doesn't exist
mkdir -p jobs_config

# Create a test job config
cat > jobs_config/test_job.json << 'EOF'
{
  "job_id": "test_eth_usdc_001",
  "sn_liquditiy_manager_address": "0x0000000000000000000000000000000000000001",
  "pair_address": "0x0000000000000000000000000000000000000002",
  "fee_rate": 0.03,
  "target": "PoL",
  "target_ratio": 0.5,
  "chain_id": 84532,
  "is_active": true,
  "round_duration_seconds": 300,
  "metadata": {
    "pair_name": "TEST-ETH/USDC",
    "description": "Test job for development"
  }
}
EOF
```

---

## Step 6: Run Validator in Test Mode

### Start Validator

```bash
# Run validator with testnet configuration
python -m validator.validator \
  --wallet.name testwallet \
  --wallet.hotkey testhotkey \
  --subtensor.network test \
  --netuid 98 \
  --logging.debug
```

### Expected Output

You should see:
```
INFO     | Initializing validator...
INFO     | Connecting to subtensor network: test
INFO     | Wallet: testwallet/testhotkey
INFO     | Initializing databases...
INFO     | Database connected successfully
INFO     | Starting round orchestrator...
INFO     | Loaded 1 active jobs
INFO     | Starting evaluation round for job: test_eth_usdc_001
```

---

## Step 7: Generate Test Data

### Option A: RunValidator Normally

Let the validator run for a few hours. It will:
1. Query miners for strategies (if any miners are registered)
2. Run backtests
3. Score predictions
4. Create round records in the database

### Option B: Create Mock Data (Recommended for Initial Testing)

Create a script to populate the database with test data:

```bash
# Create test data script
cat > scripts/create_test_data.py << 'EOF'
"""
Create test data for development
"""
import asyncio
from datetime import datetime, timedelta
from tortoise import Tortoise
import random

async def create_test_data():
    # Initialize database
    await Tortoise.init(
        db_url="postgres://sn98_user:your_password@localhost:5432/sn98_jobs_test",
        modules={'models': ['validator.models.job']}
    )
    await Tortoise.generate_schemas()

    from validator.models.job import Job, Round, MinerScore, Prediction, RoundType, RoundStatus

    # Create test job
    job = await Job.create(
        job_id="test_eth_usdc_001",
        sn_liquditiy_manager_address="0x0000000000000000000000000000000000000001",
        pair_address="0x0000000000000000000000000000000000000002",
        fee_rate=0.03,
        target="PoL",
        target_ratio=0.5,
        chain_id=84532,
        is_active=True,
        round_duration_seconds=300,
        metadata={"pair_name": "TEST-ETH/USDC"}
    )
    print(f"Created job: {job.job_id}")

    # Create test miners
    miner_uids = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30]
    for uid in miner_uids:
        score = await MinerScore.create(
            job=job,
            miner_uid=uid,
            miner_hotkey=f"5F{'x'*46}{uid:02d}",
            combined_score=random.uniform(1000, 10000),
            evaluation_score=random.uniform(800, 9000),
            live_score=random.uniform(1200, 11000),
            participation_days=random.randint(1, 14),
            is_eligible_for_live=(random.randint(1, 14) >= 7),
            total_evaluations=random.randint(50, 200),
            total_live_rounds=random.randint(5, 30),
            successful_evaluations=random.randint(45, 195),
            successful_live_rounds=random.randint(3, 28),
            refusals=random.randint(0, 5)
        )
        print(f"Created miner score: UID {uid}, score {score.combined_score:.2f}")

    # Create test rounds
    base_time = datetime.utcnow() - timedelta(hours=24)
    for i in range(20):
        round_start = base_time + timedelta(minutes=i * 15)
        round_deadline = round_start + timedelta(minutes=5)
        round_end = round_deadline + timedelta(seconds=30)
        
        winner_uid = random.choice(miner_uids)
        
        # Create performance data
        scores_dict = {}
        for uid in random.sample(miner_uids, random.randint(5, 10)):
            scores_dict[str(uid)] = {
                "hotkey": f"5F{'x'*46}{uid:02d}",
                "score": random.uniform(1000, 10000),
                "accepted": True
            }
        
        round_obj = await Round.create(
            job=job,
            round_type=RoundType.EVALUATION if i % 5 != 0 else RoundType.LIVE,
            round_number=i + 1,
            start_time=round_start,
            round_deadline=round_deadline,
            end_time=round_end,
            status=RoundStatus.COMPLETED,
            winner_uid=winner_uid,
            performance_data={"scores": scores_dict}
        )
        print(f"Created round {round_obj.round_number}: winner UID {winner_uid}")

    print(f"\n✅ Created test data:")
    print(f"   - 1 job")
    print(f"   - {len(miner_uids)} miners")
    print(f"   - 20 rounds")

    await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(create_test_data())
EOF

# Run test data script
python scripts/create_test_data.py
```

---

## Step 8: Verify Data

### Check Database

```bash
# Connect to database
psql -U sn98_user -d sn98_jobs_test

# Check tables
\dt

# Count records
SELECT 'jobs' as table_name, COUNT(*) FROM jobs
UNION ALL
SELECT 'rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'minerscore', COUNT(*) FROM minerscore;
```

Expected output:
```
 table_name | count 
------------+-------
 jobs       |     1
 rounds     |    20
 minerscore |    10
```

---

## Step 9: Test the API

### Start the API Server

```bash
# Copy .env for API
cp .env api/.env

# Start API
cd api
python main.py
```

### Test Endpoints

```bash
# Get all jobs
curl http://localhost:8000/api/jobs

# Get leaderboard
curl http://localhost:8000/api/jobs/test_eth_usdc_001/leaderboard

# Get rounds
curl http://localhost:8000/api/jobs/test_eth_usdc_001/rounds

# Open interactive docs
open http://localhost:8000/docs
```

---

## Step 10: Monitor Validator

### View Logs

```bash
# Tail validator logs
tail -f validator.log

# Or use debug mode
python -m validator.validator --logging.debug
```

### Check Metagraph

```bash
# Check registered neurons on testnet
btcli subnet list --subtensor.network test --netuid 98

# Check your validator status
btcli wallet overview --wallet.name testwallet --subtensor.network test
```

---

## Troubleshooting

### Issue: No miners responding

**Solution**: For testing, miners may not be registered on testnet. Use mock data script or register a test miner.

### Issue: Database connection error

**Solution**: 
1. Check PostgreSQL is running: `pg_ctl status`
2. Verify credentials in `.env`
3. Ensure database exists: `psql -l | grep sn98`

### Issue: RPC endpoint errors

**Solution**: Use public testnet endpoints:
- Ethereum Sepolia: `https://eth-sepolia.public.blastapi.io`
- Base Sepolia: `https://base-sepolia-rpc.publicnode.com`

### Issue: Testnet TAO not arriving

**Solution**: 
1. Wait 5-10 minutes
2. Check Discord #testnet-faucet for status
3. Verify you used correct hotkey address

---

## Next Steps

Once validator is running with data:

1. ✅ **Test API**: Verify all endpoints return data
2. ✅ **Start Frontend**: Begin Next.js development
3. ✅ **Real-time Testing**: Add WebSocket for live updates
4. ✅ **Integration**: Connect frontend to API

---

## Production Considerations

When moving to mainnet:

1. Change `SUBTENSOR_NETWORK=finney`
2. Use mainnet RPC endpoints (Base L2 mainnet)
3. Set up proper database backups
4. Use production-grade infrastructure
5. Implement proper security (API keys, rate limiting)

---

## Resources

- **Bittensor Docs**: https://docs.bittensor.com
- **Testnet Faucet**: Discord #testnet-faucet
- **RPC Endpoints**: https://chainlist.org (search for Sepolia/Base)
- **Block Explorer**: https://sepolia.basescan.org

---

**Ready to test!** 🚀

Run the validator, generate/create test data, and start building the frontend with real API responses.
