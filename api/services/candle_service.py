"""
Candle Service

Builds OHLCV candles from swap events and reader database.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from validator.models.pool_events import SwapEvent
from validator.models.job import Job
from api.utils.pool_data_service import PoolDataService
import logging

logger = logging.getLogger(__name__)


class CandleService:
    """Service for building candles from swap events"""

    @staticmethod
    async def build_candles_from_swaps(
        job: Job,
        interval_seconds: int = 300,  # 5 minutes default
        lookback_hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Build OHLCV candles from swap events.

        Args:
            job: Job instance
            interval_seconds: Candle interval in seconds (default: 300 = 5min)
            lookback_hours: How many hours to look back (default: 24)

        Returns:
            List of candle dictionaries with OHLCV data
        """
        try:
            # Get swap events for the last N hours
            cutoff_time = int((datetime.utcnow() - timedelta(hours=lookback_hours)).timestamp())

            swaps = await SwapEvent.filter(
                evt_address=job.pair_address,
                evt_block_time__gte=cutoff_time
            ).order_by("evt_block_time").all()

            if not swaps:
                logger.warning(f"No swap events found for job {job.job_id}")
                return []

            # Build candles
            candle_map: Dict[int, Dict[str, Any]] = {}

            for swap in swaps:
                # Calculate price from amounts
                amount0 = float(swap.amount0)
                amount1 = float(swap.amount1)

                if amount0 == 0:
                    continue

                price = abs(amount1 / amount0)

                # Get bucket timestamp
                bucket = (swap.evt_block_time // interval_seconds) * interval_seconds

                if bucket not in candle_map:
                    # Create new candle
                    candle_map[bucket] = {
                        "timestamp": bucket,
                        "open": price,
                        "high": price,
                        "low": price,
                        "close": price,
                        "volume": abs(amount1),
                        "trades": 1,
                    }
                else:
                    # Update existing candle
                    candle = candle_map[bucket]
                    candle["high"] = max(candle["high"], price)
                    candle["low"] = min(candle["low"], price)
                    candle["close"] = price
                    candle["volume"] += abs(amount1)
                    candle["trades"] += 1

            # Convert to sorted list
            candles = sorted(candle_map.values(), key=lambda c: c["timestamp"])

            logger.info(f"Built {len(candles)} candles from {len(swaps)} swaps for job {job.job_id}")
            return candles

        except Exception as e:
            logger.error(f"Failed to build candles for job {job.job_id}: {e}")
            return []

    @staticmethod
    async def fetch_candles_from_reader_db(
        job: Job,
        interval_seconds: int = 300,
        lookback_hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Fetch OHLCV candles from reader database (historical swap data).

        This method queries the swap events database for historical pool data
        and returns formatted candles with price, volume, and liquidity info.

        Args:
            job: Job instance with pair_address
            interval_seconds: Candle interval in seconds (default: 300 = 5min)
            lookback_hours: How many hours to look back (default: 24)

        Returns:
            List of candle dictionaries with OHLCV data
        """
        try:
            # Initialize pool service with job's pair address
            pool_service = PoolDataService(pool_address=job.pair_address)

            # Calculate time range
            end_ts = int(datetime.utcnow().timestamp())
            start_ts = int((datetime.utcnow() - timedelta(hours=lookback_hours)).timestamp())

            # Fetch candles from reader DB
            candles = await pool_service.get_candles(
                start_ts=start_ts,
                end_ts=end_ts,
                bucket_seconds=interval_seconds
            )

            # Close connection
            await pool_service.close()

            logger.info(f"Fetched {len(candles)} candles from reader DB for job {job.job_id} (pool: {job.pair_address})")
            return candles

        except Exception as e:
            logger.error(f"Failed to fetch candles from reader DB for job {job.job_id}: {e}")
            return []

    @staticmethod
    async def get_pool_stats_from_reader_db(
        job: Job,
        lookback_hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Get aggregated pool statistics from reader database.

        Args:
            job: Job instance
            lookback_hours: How many hours to look back (default: 24)

        Returns:
            Dictionary with pool stats (volume, fees, price changes, etc.)
        """
        try:
            # Initialize pool service with job's pair address
            pool_service = PoolDataService(pool_address=job.pair_address)

            # Calculate time range
            end_ts = int(datetime.utcnow().timestamp())
            start_ts = int((datetime.utcnow() - timedelta(hours=lookback_hours)).timestamp())

            # Fetch stats
            stats = await pool_service.get_pool_stats(start_ts=start_ts, end_ts=end_ts)

            # Close connection
            await pool_service.close()

            logger.info(f"Fetched pool stats from reader DB for job {job.job_id} (pool: {job.pair_address})")
            return stats

        except Exception as e:
            logger.error(f"Failed to fetch pool stats from reader DB for job {job.job_id}: {e}")
            return {}
