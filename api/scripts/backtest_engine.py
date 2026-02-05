"""
Backtesting Engine for Mock Data Generation

Simulates multiple miners with different rebalancing strategies over historical data.
Fills the database with realistic rounds, predictions, and executions.

Inspired by TradeOff's backtesting engine but adapted for Forever Money's multi-miner system.
"""
import asyncio
import asyncpg
import os
import sys
import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal

# Add project root to path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
sys.path.insert(0, project_root)

from tortoise import Tortoise
from validator.models.job import Job, Round, RoundStatus, Prediction, LiveExecution
from validator.models.pool_events import SwapEvent


# =============================================================================
# CONFIGURATION
# =============================================================================

# Miner strategies: rebalance when price moves X% from middle of range
MINER_STRATEGIES = {
    1: {"name": "Conservative", "rebalance_threshold": 0.10},
    2: {"name": "Moderate-Conservative", "rebalance_threshold": 0.20},
    3: {"name": "Balanced", "rebalance_threshold": 0.30},
    4: {"name": "Moderate-Aggressive", "rebalance_threshold": 0.40},
    5: {"name": "Aggressive", "rebalance_threshold": 0.50},
    6: {"name": "Very Aggressive", "rebalance_threshold": 0.60},
    7: {"name": "High Risk", "rebalance_threshold": 0.70},
    8: {"name": "Extreme", "rebalance_threshold": 0.80},
    9: {"name": "Maximum", "rebalance_threshold": 0.90},
    10: {"name": "All-In", "rebalance_threshold": 1.00},
}

# Pool configurations
POOLS = {
    "0xf9d5533091B5339BC102fCE5DecFe74C09512315": {
        "id": "test_xtao_usdc_004",
        "name": "xTAO/USDC",
        "table": "base_poocl_swaps_v2",
        "token0_decimals": 6,
        "token1_decimals": 18,
        "fee_tier": 0.003,
        "initial_capital": 10000,  # USDC
        "invert_price": True,  # token0=USDC, token1=xTAO → need to invert to get USDC/xTAO
    },
    "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59": {
        "id": "usdc_weth_base",
        "name": "WETH/USDC",
        "table": "base_poocl_swaps_v2",
        "token0_decimals": 18,  # WETH is token0
        "token1_decimals": 6,   # USDC is token1
        "fee_tier": 0.0005,
        "initial_capital": 10000,  # USDC
        "invert_price": False,  # token0=WETH, token1=USDC → already gives USDC/WETH
    },
    "0x4e962bb3889bf030368f56810a9c96b83cb3e778": {
        "id": "usdc_cbbtc_base",
        "name": "cbBTC/USDC",
        "table": "base_poocl_swaps_v2",
        "token0_decimals": 6,
        "token1_decimals": 8,
        "fee_tier": 0.0005,
        "initial_capital": 10000,  # USDC
        "invert_price": True,  # token0=USDC, token1=cbBTC → need to invert to get USDC/cbBTC
    },
}

ROUND_DURATION = 15 * 60  # 15 minutes


# =============================================================================
# TICK MATH
# =============================================================================

def price_to_tick(price: float) -> int:
    """Convert price to Uniswap V3 tick"""
    return int(math.floor(math.log(price) / math.log(1.0001)))


def tick_to_price(tick: int) -> float:
    """Convert Uniswap V3 tick to price"""
    return math.pow(1.0001, tick)


# =============================================================================
# POSITION MANAGEMENT
# =============================================================================

class MinerPosition:
    """Represents a miner's liquidity position"""

    def __init__(
        self,
        miner_uid: int,
        strategy: Dict[str, Any],
        lower_tick: int,
        upper_tick: int,
        entry_price: float,
        liquidity_amount: float,
        entry_time: int
    ):
        self.miner_uid = miner_uid
        self.strategy = strategy
        self.lower_tick = lower_tick
        self.upper_tick = upper_tick
        self.lower_price = tick_to_price(lower_tick)
        self.upper_price = tick_to_price(upper_tick)
        self.entry_price = entry_price
        self.liquidity_amount = liquidity_amount
        self.entry_time = entry_time
        self.fees_earned = 0.0
        self.time_in_range = 0
        self.time_out_of_range = 0
        self.rebalance_count = 0

    def is_in_range(self, price: float) -> bool:
        """Check if current price is in position range"""
        return self.lower_price <= price <= self.upper_price

    def distance_from_center(self, price: float) -> float:
        """Calculate price distance from range center as percentage"""
        center = (self.lower_price + self.upper_price) / 2
        return abs(price - center) / center

    def should_rebalance(self, price: float) -> bool:
        """Check if position should be rebalanced based on strategy"""
        distance = self.distance_from_center(price)
        threshold = self.strategy["rebalance_threshold"]
        return distance >= threshold

    def calculate_value(self, current_price: float, decimal_adjustment: float) -> float:
        """Calculate current position value"""
        if current_price < self.lower_price or current_price > self.upper_price:
            # Out of range - simplified value calculation
            return self.liquidity_amount
        else:
            # In range - position maintains value with some IL
            price_change = abs(current_price - self.entry_price) / self.entry_price
            il_factor = 1 - (price_change * 0.1)  # Simplified IL approximation
            return self.liquidity_amount * il_factor

    def create_rebalanced_position(
        self,
        current_price: float,
        new_entry_time: int
    ) -> 'MinerPosition':
        """Create new position after rebalancing"""
        # Random range width between 15-30%
        range_width = random.uniform(0.15, 0.30)

        new_lower_price = current_price * (1 - range_width)
        new_upper_price = current_price * (1 + range_width)

        new_lower_tick = price_to_tick(new_lower_price)
        new_upper_tick = price_to_tick(new_upper_price)

        # Maintain liquidity value (with small gas cost)
        current_value = self.calculate_value(current_price, 1.0)
        gas_cost = current_value * 0.001  # 0.1% gas cost
        new_liquidity = current_value - gas_cost

        new_position = MinerPosition(
            miner_uid=self.miner_uid,
            strategy=self.strategy,
            lower_tick=new_lower_tick,
            upper_tick=new_upper_tick,
            entry_price=current_price,
            liquidity_amount=new_liquidity,
            entry_time=new_entry_time
        )
        new_position.fees_earned = self.fees_earned
        new_position.rebalance_count = self.rebalance_count + 1

        return new_position


# =============================================================================
# BACKTESTING ENGINE
# =============================================================================

class BacktestEngine:
    """Simulates multiple miners over historical data"""

    def __init__(self, pool_address: str, pool_config: Dict[str, Any]):
        self.pool_address = pool_address.lower()
        self.pool_config = pool_config
        self.reader_db_url = os.getenv("READER_DB_URL")
        self.reader_pool = None
        self.decimal_adjustment = 10 ** (
            pool_config["token0_decimals"] - pool_config["token1_decimals"]
        )

    async def connect_reader_db(self):
        """Connect to reader database"""
        if not self.reader_pool:
            self.reader_pool = await asyncpg.create_pool(
                self.reader_db_url,
                ssl="require",
                min_size=1,
                max_size=5
            )
            print(f"✅ Connected to reader database")

    async def close_reader_db(self):
        """Close reader database connection"""
        if self.reader_pool:
            await self.reader_pool.close()
            self.reader_pool = None

    async def fetch_historical_candles(
        self,
        start_ts: int,
        end_ts: int,
        bucket_seconds: int = 300
    ) -> List[Dict[str, Any]]:
        """Fetch historical candles from reader DB"""
        await self.connect_reader_db()

        pool_address = self.pool_address.replace("0x", "")
        table_name = self.pool_config["table"]

        query = f"""
            WITH bucketed AS (
                SELECT
                    (FLOOR(evt_block_time::bigint / $1) * $1) as bucket_ts,
                    tick,
                    amount0,
                    amount1,
                    evt_block_time::bigint as ts
                FROM "{table_name}"
                WHERE evt_address = $2
                    AND evt_block_time::bigint >= $3
                    AND evt_block_time::bigint <= $4
            )
            SELECT
                bucket_ts::text,
                (array_agg(tick ORDER BY ts ASC))[1]::int as open_tick,
                (array_agg(tick ORDER BY ts DESC))[1]::int as close_tick,
                MIN(tick)::int as low_tick,
                MAX(tick)::int as high_tick,
                SUM(ABS(amount0::numeric))::text as volume0,
                SUM(ABS(amount1::numeric))::text as volume1,
                COUNT(*)::int as swap_count
            FROM bucketed
            GROUP BY bucket_ts
            ORDER BY bucket_ts ASC
        """

        async with self.reader_pool.acquire() as conn:
            rows = await conn.fetch(query, bucket_seconds, pool_address, start_ts, end_ts)

        candles = []
        for row in rows:
            open_price = pow(1.0001, row["open_tick"]) * self.decimal_adjustment
            close_price = pow(1.0001, row["close_tick"]) * self.decimal_adjustment
            high_price = pow(1.0001, row["high_tick"]) * self.decimal_adjustment
            low_price = pow(1.0001, row["low_tick"]) * self.decimal_adjustment

            # Invert for display if needed (token1/token0 -> token0/token1)
            if self.pool_config.get("invert_price", True):
                open_price = 1 / open_price if open_price > 0 else 0
                close_price = 1 / close_price if close_price > 0 else 0
                high_price = 1 / low_price if low_price > 0 else 0
                low_price = 1 / high_price if high_price > 0 else 0

            candles.append({
                "timestamp": int(row["bucket_ts"]),
                "open": open_price,
                "close": close_price,
                "high": high_price,
                "low": low_price,
                "volume0": float(row["volume0"]) / (10 ** self.pool_config["token0_decimals"]),
                "volume1": float(row["volume1"]) / (10 ** self.pool_config["token1_decimals"]),
                "swap_count": row["swap_count"],
            })

        print(f"📊 Fetched {len(candles)} historical candles")
        return candles

    def initialize_miners(self, starting_price: float) -> Dict[int, MinerPosition]:
        """Initialize all miners with starting positions"""
        miners = {}
        initial_capital = self.pool_config["initial_capital"]

        for miner_uid, strategy in MINER_STRATEGIES.items():
            # Initial range: ±30% from starting price
            lower_price = starting_price * 0.7
            upper_price = starting_price * 1.3

            lower_tick = price_to_tick(lower_price)
            upper_tick = price_to_tick(upper_price)

            miners[miner_uid] = MinerPosition(
                miner_uid=miner_uid,
                strategy=strategy,
                lower_tick=lower_tick,
                upper_tick=upper_tick,
                entry_price=starting_price,
                liquidity_amount=initial_capital,
                entry_time=0
            )

        return miners

    def calculate_fees_for_candle(
        self,
        miner: MinerPosition,
        candle: Dict[str, Any],
        current_price: float
    ) -> float:
        """Estimate fees earned in this candle"""
        if not miner.is_in_range(current_price):
            return 0.0

        # Simplified fee calculation
        volume_usd = (candle["volume0"] + candle["volume1"] * current_price)
        total_fees = volume_usd * self.pool_config["fee_tier"]

        # Assume miner captures 1-5% of fees based on concentration
        range_width = (miner.upper_price - miner.lower_price) / current_price
        concentration_bonus = 1 / max(0.2, range_width)
        capture_rate = min(0.05, 0.01 * concentration_bonus)

        return total_fees * capture_rate

    async def run_simulation(
        self,
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """Run full backtest simulation"""
        print(f"\n🚀 Starting backtest for {self.pool_config['name']}")
        print(f"   Lookback: {lookback_days} days")

        # Calculate time range
        end_ts = int(datetime.utcnow().timestamp())
        start_ts = end_ts - (lookback_days * 24 * 3600)

        # Fetch historical data
        candles = await self.fetch_historical_candles(start_ts, end_ts, 300)

        if len(candles) < 10:
            print(f"❌ Insufficient data: {len(candles)} candles")
            return None

        # Initialize miners
        starting_price = candles[0]["close"]
        print(f"💰 Starting price: ${starting_price:.4f}")
        print(f"👥 Initializing {len(MINER_STRATEGIES)} miners...")

        miners = self.initialize_miners(starting_price)

        # Track rounds
        rounds = []
        round_start_idx = 0
        round_number = 1

        # Simulate through candles
        print(f"⏳ Simulating {len(candles)} candles...")

        for i, candle in enumerate(candles):
            current_price = candle["close"]
            timestamp = candle["timestamp"]

            # Update each miner
            for miner_uid, miner in miners.items():
                # Track time in/out of range
                if miner.is_in_range(current_price):
                    miner.time_in_range += 300  # 5 minutes
                    # Calculate fees
                    fees = self.calculate_fees_for_candle(miner, candle, current_price)
                    miner.fees_earned += fees
                else:
                    miner.time_out_of_range += 300

                # Check if rebalance needed
                if miner.should_rebalance(current_price):
                    miners[miner_uid] = miner.create_rebalanced_position(
                        current_price,
                        timestamp
                    )

            # Create rounds every ROUND_DURATION (15 min = 3 candles)
            if (i - round_start_idx) >= 3 and i > 0:
                round_candles = candles[round_start_idx:i+1]
                round_data = self.create_round_data(
                    round_number,
                    round_candles,
                    miners,
                    timestamp
                )
                rounds.append(round_data)

                round_number += 1
                round_start_idx = i + 1

        print(f"✅ Simulation complete: {len(rounds)} rounds generated")

        await self.close_reader_db()

        return {
            "pool_address": self.pool_address,
            "pool_id": self.pool_config["id"],
            "starting_price": starting_price,
            "final_price": candles[-1]["close"],
            "total_candles": len(candles),
            "total_rounds": len(rounds),
            "rounds": rounds,
            "miners": {uid: self.miner_to_dict(m) for uid, m in miners.items()}
        }

    def create_round_data(
        self,
        round_number: int,
        round_candles: List[Dict[str, Any]],
        miners: Dict[int, MinerPosition],
        end_time: int
    ) -> Dict[str, Any]:
        """Create round data with predictions and executions"""
        start_time = round_candles[0]["timestamp"]
        opening_price = round_candles[0]["open"]
        closing_price = round_candles[-1]["close"]

        # Determine round type (alternating between evaluation and live)
        round_type = "live" if round_number % 2 == 0 else "evaluation"

        # Create predictions for all miners
        predictions = []
        executions = []

        for miner_uid, miner in miners.items():
            prediction = {
                "miner_uid": miner_uid,
                "miner_hotkey": f"{'5' + str(miner_uid).zfill(47)}",
                "accepted": True,
                "prediction_data": {
                    "strategy": miner.strategy,
                    "target_ratio": 0.5,
                    "opening_price": opening_price,
                    "liquidity_amount": miner.liquidity_amount,
                    "lower_price_bound": miner.lower_price,
                    "upper_price_bound": miner.upper_price,
                },
                "submitted_at": datetime.fromtimestamp(start_time).isoformat() + "Z"
            }
            predictions.append(prediction)

            # For live rounds, create executions
            if round_type == "live":
                was_in_range = miner.is_in_range(closing_price)
                execution = {
                    "execution_id": f"exec_{self.pool_config['id']}_round_{round_number}_{miner_uid}",
                    "miner_uid": miner_uid,
                    "tx_hash": f"0x{'a' * 54}{str(miner_uid).zfill(4)}{str(round_number).zfill(4)}",
                    "tx_status": "success" if was_in_range else "failed",
                    "strategy_data": prediction["prediction_data"],
                    "actual_performance": {
                        "success": was_in_range,
                        "error": None if was_in_range else "Price moved out of range",
                        "fees_earned": miner.fees_earned / round_number if was_in_range else 0,
                        "final_price": closing_price,
                        "opening_price": opening_price,
                        "time_in_range": 300 if was_in_range else 0,
                    },
                    "executed_at": datetime.fromtimestamp(end_time).isoformat() + "Z"
                }
                executions.append(execution)

        # Calculate scores and determine winner
        scores = {}
        for pred in predictions:
            miner_uid = pred["miner_uid"]
            miner = miners[miner_uid]

            # Score based on fees, time in range, and capital efficiency
            base_score = random.uniform(0.6, 0.9)
            threshold_bonus = (1 - miner.strategy["rebalance_threshold"]) * 0.1
            final_score = min(base_score + threshold_bonus, 1.0)

            scores[str(miner_uid)] = {
                "score": final_score,
                "accepted": True,
                "prediction_data": pred["prediction_data"]
            }

        winner_uid = int(max(scores.items(), key=lambda x: x[1]["score"])[0])
        winner_score = scores[str(winner_uid)]["score"]

        return {
            "round_id": f"{self.pool_config['id']}_round_{round_number}",
            "round_number": round_number,
            "round_type": round_type,
            "status": "completed",
            "winner_uid": winner_uid,
            "winner_hotkey": f"{'5' + str(winner_uid).zfill(47)}",
            "winner_score": winner_score,
            "start_time": datetime.fromtimestamp(start_time).isoformat() + "Z",
            "end_time": datetime.fromtimestamp(end_time).isoformat() + "Z",
            "execution": executions[0] if executions and executions[0]["miner_uid"] == winner_uid else None,
            "executions": executions,
            "predictions": predictions,
            "participants_count": len(predictions),
            "performance_data": {"scores": scores}
        }

    def miner_to_dict(self, miner: MinerPosition) -> Dict[str, Any]:
        """Convert miner position to dictionary"""
        return {
            "miner_uid": miner.miner_uid,
            "strategy": miner.strategy,
            "lower_price": miner.lower_price,
            "upper_price": miner.upper_price,
            "liquidity_amount": miner.liquidity_amount,
            "fees_earned": miner.fees_earned,
            "time_in_range": miner.time_in_range,
            "time_out_of_range": miner.time_out_of_range,
            "rebalance_count": miner.rebalance_count,
        }


# =============================================================================
# DATABASE PERSISTENCE
# =============================================================================

async def clean_database():
    """Clean all existing data"""
    print("\n🧹 Cleaning database...")

    await SwapEvent.all().delete()
    await LiveExecution.all().delete()
    await Prediction.all().delete()
    await Round.all().delete()
    # Don't delete Jobs - they're configured

    print("✅ Database cleaned")


async def persist_simulation_results(job: Job, results: Dict[str, Any]):
    """Save simulation results to database"""
    print(f"\n💾 Persisting {results['total_rounds']} rounds to database...")

    for round_data in results["rounds"]:
        # Create round
        start_dt = datetime.fromisoformat(round_data["start_time"].replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(round_data["end_time"].replace("Z", "+00:00"))
        # Deadline is 15 minutes after start
        deadline_dt = start_dt + timedelta(minutes=15)
        # Mock block number based on round number
        start_block = 20000000 + (round_data["round_number"] * 50)

        round_obj = await Round.create(
            round_id=round_data["round_id"],
            job=job,
            round_number=round_data["round_number"],
            round_type=round_data["round_type"],
            status=RoundStatus.COMPLETED,
            winner_uid=round_data.get("winner_uid"),
            winner_hotkey=round_data.get("winner_hotkey"),
            winner_score=Decimal(str(round_data.get("winner_score", 0))),
            start_time=start_dt,
            start_block=start_block,
            round_deadline=deadline_dt,
            end_time=end_dt,
            performance_data=round_data.get("performance_data", {})
        )

        # Create predictions
        for pred_data in round_data["predictions"]:
            prediction_id = f"{round_data['round_id']}_miner_{pred_data['miner_uid']}"
            await Prediction.create(
                prediction_id=prediction_id,
                round=round_obj,
                job=job,
                miner_uid=pred_data["miner_uid"],
                miner_hotkey=pred_data["miner_hotkey"],
                accepted=pred_data["accepted"],
                prediction_data=pred_data["prediction_data"],
                submitted_at=datetime.fromisoformat(pred_data["submitted_at"].replace("Z", "+00:00"))
            )

        # Create executions for live rounds
        if round_data["round_type"] == "live":
            for exec_data in round_data["executions"]:
                await LiveExecution.create(
                    execution_id=exec_data["execution_id"],
                    round=round_obj,
                    job=job,
                    miner_uid=exec_data["miner_uid"],
                    miner_hotkey=f"{'5' + str(exec_data['miner_uid']).zfill(47)}",
                    tx_hash=exec_data["tx_hash"],
                    tx_status=exec_data["tx_status"],
                    strategy_data=exec_data["strategy_data"],
                    actual_performance=exec_data["actual_performance"],
                    sn_liquidity_manager_address=job.sn_liquidity_manager_address,
                    executed_at=datetime.fromisoformat(exec_data["executed_at"].replace("Z", "+00:00"))
                )

    print(f"✅ Persisted {results['total_rounds']} rounds with predictions and executions")


# =============================================================================
# MAIN
# =============================================================================

async def main():
    """Run backtesting and fill database"""
    print("=" * 80)
    print("FOREVER MONEY BACKTESTING ENGINE")
    print("=" * 80)

    # Initialize Tortoise
    db_url = os.getenv("DB_URL", "postgres://sn98_user:testpass123@localhost:5432/sn98_jobs_test")
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgres://", 1)

    await Tortoise.init(
        db_url=db_url,
        modules={'models': ['validator.models.job', 'validator.models.pool_events']}
    )
    await Tortoise.generate_schemas()

    # Clean database first
    await clean_database()

    # Run backtest for each pool
    for pool_address, pool_config in POOLS.items():
        print(f"\n{'=' * 80}")
        print(f"Processing {pool_config['name']}")
        print(f"{'=' * 80}")

        # Get job
        job = await Job.filter(pair_address=pool_address).first()
        if not job:
            print(f"⚠️  Job not found for {pool_address}, skipping...")
            continue

        # Run simulation
        engine = BacktestEngine(pool_address, pool_config)
        results = await engine.run_simulation(lookback_days=30)  # 30 days of data

        if results:
            # Persist to database
            await persist_simulation_results(job, results)

            # Print summary
            print(f"\n📊 Summary for {pool_config['name']}:")
            print(f"   Starting price: ${results['starting_price']:.4f}")
            print(f"   Final price: ${results['final_price']:.4f}")
            print(f"   Total rounds: {results['total_rounds']}")
            print(f"   Total candles: {results['total_candles']}")

    # Close connections
    await Tortoise.close_connections()

    print("\n" + "=" * 80)
    print("✅ BACKTEST COMPLETE - DATABASE FILLED WITH MOCK DATA")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
