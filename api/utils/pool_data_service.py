"""
Pool Data Service

Fetches historical swap data from the reader database and provides
OHLCV candles for pool price analysis.

This connects to the reader DB that contains swap event data from Aerodrome pools.
"""
import os
import asyncpg
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


# Pool configurations (address -> config)
POOL_CONFIGS = {
    "0xf9d5533091B5339BC102fCE5DecFe74C09512315": {
        "id": "xtao-usdc-base",
        "name": "xTAO/USDC Aerodrome (Base)",
        "table_name": "base_poocl_swaps_v2",
        "token0": {"symbol": "USDC", "decimals": 6},
        "token1": {"symbol": "xTAO", "decimals": 18},
        "fee_tier": 0.003,
        "invert_price": True,
    },
    "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59": {
        "id": "weth-usdc-base",
        "name": "WETH/USDC Aerodrome (Base)",
        "table_name": "base_poocl_swaps_v2",
        "token0": {"symbol": "WETH", "decimals": 18},
        "token1": {"symbol": "USDC", "decimals": 6},
        "fee_tier": 0.0005,
        "invert_price": False,  # WETH is token0, USDC is token1, so tick already gives USDC/WETH
    },
    "0x4e962bb3889bf030368f56810a9c96b83cb3e778": {
        "id": "cbbtc-usdc-base",
        "name": "cbBTC/USDC Aerodrome (Base)",
        "table_name": "base_poocl_swaps_v2",
        "token0": {"symbol": "USDC", "decimals": 6},
        "token1": {"symbol": "cbBTC", "decimals": 8},
        "fee_tier": 0.0005,
        "invert_price": True,
    },
}


class PoolDataService:
    """Service for fetching pool data from reader database"""

    def __init__(self, pool_address: str, reader_db_url: Optional[str] = None):
        """
        Initialize with pool address and reader DB connection URL.

        Args:
            pool_address: Pool address to fetch data for
            reader_db_url: PostgreSQL connection string for reader database
        """
        self.reader_db_url = reader_db_url or os.getenv("READER_DB_URL")
        if not self.reader_db_url:
            raise ValueError("READER_DB_URL environment variable not set")

        self.pool = None
        self.pool_address = pool_address.lower()

        # Get pool config or use default
        self.config = POOL_CONFIGS.get(
            self.pool_address,
            {
                "id": "unknown",
                "name": "Unknown Pool",
                "table_name": "base_poocl_swaps_v2",
                "token0": {"symbol": "Token0", "decimals": 18},
                "token1": {"symbol": "Token1", "decimals": 18},
                "fee_tier": 0.003,
                "invert_price": False,
            }
        )

        # Decimal adjustment for price calculation
        self.decimal_adjustment = 10 ** (
            self.config["token0"]["decimals"] - self.config["token1"]["decimals"]
        )

    async def connect(self):
        """Create connection pool to reader database"""
        if not self.pool:
            self.pool = await asyncpg.create_pool(
                self.reader_db_url,
                ssl="require",
                min_size=1,
                max_size=5
            )
            logger.info("Connected to reader database")

    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Closed reader database connection")

    def _normalize_amount(self, amount: str, decimals: int) -> float:
        """Normalize raw amount by token decimals"""
        try:
            raw = float(amount)
            return raw / (10 ** decimals)
        except (ValueError, TypeError):
            return 0.0

    def _adjust_price(self, raw_tick_price: float) -> float:
        """
        Adjust tick price for token decimal differences.
        Raw tick price = token1/token0 in raw units
        Adjusted price = token1/token0 in normalized units
        """
        adjusted = raw_tick_price * self.decimal_adjustment
        # Invert if needed (for xTAO/USDC display)
        if self.config["invert_price"]:
            return 1 / adjusted if adjusted > 0 else 0
        return adjusted

    async def get_candles(
        self,
        start_ts: int,
        end_ts: int,
        bucket_seconds: int = 300
    ) -> List[Dict[str, Any]]:
        """
        Get OHLCV candles with gap-filling.

        Args:
            start_ts: Start timestamp (Unix seconds)
            end_ts: End timestamp (Unix seconds)
            bucket_seconds: Candle interval in seconds (default: 300 = 5min)

        Returns:
            List of candle dictionaries with OHLCV data
        """
        await self.connect()

        pool_address = self.pool_address.replace("0x", "")
        table_name = self.config["table_name"]

        # Optimized query - removed LOWER() and simplified calculations
        query = f"""
            WITH bucketed AS (
                SELECT
                    (FLOOR(evt_block_time::bigint / $1) * $1) as bucket_ts,
                    tick,
                    amount0,
                    amount1,
                    liquidity,
                    evt_block_time::bigint as ts
                FROM "{table_name}"
                WHERE evt_address = $2
                    AND evt_block_time::bigint >= $3
                    AND evt_block_time::bigint <= $4
            )
            SELECT
                bucket_ts::text,
                COUNT(*)::int as swap_count,
                MIN(tick)::int as min_tick,
                MAX(tick)::int as max_tick,
                (array_agg(tick ORDER BY ts ASC))[1]::int as open_tick,
                (array_agg(tick ORDER BY ts DESC))[1]::int as close_tick,
                SUM(ABS(amount0::numeric))::text as volume0,
                SUM(ABS(amount1::numeric))::text as volume1,
                SUM(CASE WHEN amount0::numeric > 0 THEN ABS(amount0::numeric) ELSE 0 END)::text as input_volume0,
                SUM(CASE WHEN amount1::numeric > 0 THEN ABS(amount1::numeric) ELSE 0 END)::text as input_volume1,
                AVG(liquidity::numeric)::text as avg_liquidity
            FROM bucketed
            GROUP BY bucket_ts
            ORDER BY bucket_ts ASC
        """

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, bucket_seconds, pool_address, start_ts, end_ts)

            raw_candles = []
            for row in rows:
                # Calculate prices from ticks (faster to do client-side)
                open_price = pow(1.0001, row["open_tick"]) * self.decimal_adjustment
                close_price = pow(1.0001, row["close_tick"]) * self.decimal_adjustment
                high_price = pow(1.0001, row["max_tick"]) * self.decimal_adjustment
                low_price = pow(1.0001, row["min_tick"]) * self.decimal_adjustment

                # Invert if needed
                if self.config["invert_price"]:
                    open_price = 1 / open_price if open_price > 0 else 0
                    close_price = 1 / close_price if close_price > 0 else 0
                    high_price = 1 / low_price if low_price > 0 else 0
                    low_price = 1 / high_price if high_price > 0 else 0

                vol0 = self._normalize_amount(row["volume0"], self.config["token0"]["decimals"])
                vol1 = self._normalize_amount(row["volume1"], self.config["token1"]["decimals"])
                input_vol0 = self._normalize_amount(row["input_volume0"], self.config["token0"]["decimals"])
                input_vol1 = self._normalize_amount(row["input_volume1"], self.config["token1"]["decimals"])

                candle = {
                    "timestamp": int(row["bucket_ts"]),
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume0": vol0,
                    "volume1": vol1,
                    "fees0": input_vol0 * self.config["fee_tier"],
                    "fees1": input_vol1 * self.config["fee_tier"],
                    "swap_count": int(row["swap_count"]),
                    "avg_liquidity": float(row["avg_liquidity"]),
                }
                raw_candles.append(candle)

            # Forward-fill gaps
            filled_candles = self._fill_gaps(raw_candles, start_ts, end_ts, bucket_seconds)

            logger.info(f"Fetched {len(filled_candles)} candles from reader DB ({len(raw_candles)} raw)")
            return filled_candles

        except Exception as e:
            logger.error(f"Failed to fetch candles from reader DB: {e}")
            return []

    def _fill_gaps(
        self,
        raw_candles: List[Dict[str, Any]],
        start_ts: int,
        end_ts: int,
        bucket_seconds: int
    ) -> List[Dict[str, Any]]:
        """Forward-fill gaps in candle data"""
        if not raw_candles:
            return []

        candle_map = {c["timestamp"]: c for c in raw_candles}
        filled = []
        last_candle = raw_candles[0]

        aligned_start = (start_ts // bucket_seconds) * bucket_seconds
        aligned_end = (end_ts // bucket_seconds) * bucket_seconds

        for ts in range(aligned_start, aligned_end + bucket_seconds, bucket_seconds):
            if ts in candle_map:
                candle = candle_map[ts]
                filled.append(candle)
                last_candle = candle
            else:
                # Forward-fill: use last close price, zero volume
                filled.append({
                    "timestamp": ts,
                    "open": last_candle["close"],
                    "high": last_candle["close"],
                    "low": last_candle["close"],
                    "close": last_candle["close"],
                    "volume0": 0,
                    "volume1": 0,
                    "fees0": 0,
                    "fees1": 0,
                    "swap_count": 0,
                    "avg_liquidity": last_candle["avg_liquidity"],
                })

        return filled

    async def get_pool_stats(
        self,
        start_ts: int,
        end_ts: int
    ) -> Dict[str, Any]:
        """
        Get aggregated pool statistics for time period.

        Args:
            start_ts: Start timestamp (Unix seconds)
            end_ts: End timestamp (Unix seconds)

        Returns:
            Dictionary with pool statistics
        """
        await self.connect()

        pool_address = self.pool_address.replace("0x", "")
        table_name = self.config["table_name"]

        # Optimized query - return ticks instead of computing prices
        query = f"""
            SELECT
                COUNT(*)::int as total_swaps,
                SUM(ABS(amount0::numeric))::text as total_volume0,
                SUM(ABS(amount1::numeric))::text as total_volume1,
                SUM(CASE WHEN amount0::numeric > 0 THEN ABS(amount0::numeric) ELSE 0 END)::text as input_volume0,
                SUM(CASE WHEN amount1::numeric > 0 THEN ABS(amount1::numeric) ELSE 0 END)::text as input_volume1,
                (array_agg(tick ORDER BY evt_block_time::bigint ASC))[1]::int as open_tick,
                (array_agg(tick ORDER BY evt_block_time::bigint DESC))[1]::int as close_tick,
                MAX(tick)::int as high_tick,
                MIN(tick)::int as low_tick
            FROM "{table_name}"
            WHERE evt_address = $1
                AND evt_block_time::bigint >= $2
                AND evt_block_time::bigint <= $3
        """

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, pool_address, start_ts, end_ts)

            if not row:
                return {}

            # Calculate prices from ticks (client-side calculation is faster)
            open_price = pow(1.0001, row["open_tick"]) * self.decimal_adjustment
            close_price = pow(1.0001, row["close_tick"]) * self.decimal_adjustment
            high_price = pow(1.0001, row["high_tick"]) * self.decimal_adjustment
            low_price = pow(1.0001, row["low_tick"]) * self.decimal_adjustment

            # Invert if needed
            if self.config["invert_price"]:
                open_price = 1 / open_price if open_price > 0 else 0
                close_price = 1 / close_price if close_price > 0 else 0
                high_price = 1 / low_price if low_price > 0 else 0
                low_price = 1 / high_price if high_price > 0 else 0

            volume0 = self._normalize_amount(row["total_volume0"], self.config["token0"]["decimals"])
            volume1 = self._normalize_amount(row["total_volume1"], self.config["token1"]["decimals"])
            input_volume0 = self._normalize_amount(row["input_volume0"], self.config["token0"]["decimals"])
            input_volume1 = self._normalize_amount(row["input_volume1"], self.config["token1"]["decimals"])

            price_change_pct = ((close_price - open_price) / open_price * 100) if open_price > 0 else 0

            return {
                "start_ts": start_ts,
                "end_ts": end_ts,
                "total_swaps": int(row["total_swaps"] or 0),
                "volume0": volume0,
                "volume1": volume1,
                "fees0": input_volume0 * self.config["fee_tier"],
                "fees1": input_volume1 * self.config["fee_tier"],
                "open_price": open_price,
                "close_price": close_price,
                "high_price": high_price,
                "low_price": low_price,
                "price_change_pct": price_change_pct,
                "token0_symbol": self.config["token0"]["symbol"],
                "token1_symbol": self.config["token1"]["symbol"],
            }

        except Exception as e:
            logger.error(f"Failed to fetch pool stats from reader DB: {e}")
            return {}

    async def get_latest_price(self) -> Optional[float]:
        """
        Get the most recent price from swap data.

        Returns:
            Latest price or None if no data
        """
        await self.connect()

        pool_address = self.pool_address.replace("0x", "")
        table_name = self.config["table_name"]

        query = f"""
            SELECT tick
            FROM "{table_name}"
            WHERE LOWER(evt_address) = $1
            ORDER BY evt_block_time::bigint DESC
            LIMIT 1
        """

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, pool_address)

            if not row:
                return None

            raw_tick_price = 1.0001 ** int(row["tick"])
            return self._adjust_price(raw_tick_price)

        except Exception as e:
            logger.error(f"Failed to fetch latest price from reader DB: {e}")
            return None
