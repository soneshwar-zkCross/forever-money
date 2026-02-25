"""
Reader DB Metrics Service

Calculates real metrics directly from the reader database tables:
  - swaps (SwapEvent)
  - collects (CollectEvent)
  - mints (MintEvent)
  - burns (BurnEvent)

These tables store addresses WITHOUT the 0x prefix.
"""
import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

from api.utils.address import normalize_evt_address
from api.utils.pool_data_service import POOL_CONFIGS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Simple TTL cache
# ---------------------------------------------------------------------------
_cache: Dict[str, tuple] = {}  # key -> (value, expires_at)


def _get_cached(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and entry[1] > time.time():
        return entry[0]
    return None


def _set_cached(key: str, value: Any, ttl: int = 30):
    _cache[key] = (value, time.time() + ttl)


def _get_pool_config(pair_address: str) -> dict:
    """Look up pool config by address (handles 0x prefix)."""
    addr = pair_address.strip().lower()
    if not addr.startswith("0x"):
        addr = "0x" + addr
    return POOL_CONFIGS.get(addr, {
        "token0": {"symbol": "Token0", "decimals": 18},
        "token1": {"symbol": "Token1", "decimals": 18},
        "fee_tier": 0.003,
        "invert_price": False,
    })


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class ReaderDBMetricsService:
    """
    Calculates real metrics from the reader DB pool-event tables
    (swaps, collects, mints, burns) using Tortoise ORM queries.
    """

    # ------------------------------------------------------------------
    # Price
    # ------------------------------------------------------------------
    @staticmethod
    async def get_latest_price(pair_address: str) -> Optional[float]:
        """Get the most recent price from the swaps table."""
        cache_key = f"price:{pair_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import SwapEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)

        swap = await SwapEvent.filter(
            evt_address=addr
        ).order_by("-evt_block_time").first()

        if not swap:
            return None

        decimal_adj = 10 ** (
            config["token0"]["decimals"] - config["token1"]["decimals"]
        )
        raw_price = (1.0001 ** int(swap.tick)) * decimal_adj
        if config.get("invert_price"):
            raw_price = 1.0 / raw_price if raw_price > 0 else 0.0

        _set_cached(cache_key, raw_price, ttl=30)
        return raw_price

    @staticmethod
    async def get_price_stats_24h(pair_address: str) -> Dict[str, Any]:
        """Get 24h price statistics from swaps."""
        cache_key = f"price_stats:{pair_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import SwapEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)
        decimal_adj = 10 ** (
            config["token0"]["decimals"] - config["token1"]["decimals"]
        )

        cutoff = int((datetime.utcnow() - timedelta(hours=24)).timestamp())

        swaps = await SwapEvent.filter(
            evt_address=addr,
            evt_block_time__gte=cutoff,
        ).order_by("evt_block_time")

        if not swaps:
            return {
                "current_price": None,
                "high_price": None,
                "low_price": None,
                "open_price": None,
                "price_change_percent": None,
                "swap_count": 0,
            }

        def tick_to_price(tick_val):
            p = (1.0001 ** int(tick_val)) * decimal_adj
            if config.get("invert_price"):
                return 1.0 / p if p > 0 else 0.0
            return p

        ticks = [int(s.tick) for s in swaps]

        if config.get("invert_price"):
            # When inverting, max tick -> lowest price
            high_price = tick_to_price(min(ticks))
            low_price = tick_to_price(max(ticks))
        else:
            high_price = tick_to_price(max(ticks))
            low_price = tick_to_price(min(ticks))

        open_price = tick_to_price(ticks[0])
        current_price = tick_to_price(ticks[-1])

        change_pct = (
            ((current_price - open_price) / open_price * 100)
            if open_price else 0.0
        )

        result = {
            "current_price": current_price,
            "high_price": high_price,
            "low_price": low_price,
            "open_price": open_price,
            "price_change_percent": change_pct,
            "swap_count": len(swaps),
        }
        _set_cached(cache_key, result, ttl=30)
        return result

    # ------------------------------------------------------------------
    # Volume
    # ------------------------------------------------------------------
    @staticmethod
    async def get_volume_24h(pair_address: str) -> Dict[str, float]:
        """Get 24h trading volume from swaps."""
        cache_key = f"volume:{pair_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import SwapEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)
        dec0 = config["token0"]["decimals"]
        dec1 = config["token1"]["decimals"]

        cutoff = int((datetime.utcnow() - timedelta(hours=24)).timestamp())

        swaps = await SwapEvent.filter(
            evt_address=addr,
            evt_block_time__gte=cutoff,
        )

        vol0 = sum(abs(float(s.amount0)) for s in swaps) / (10 ** dec0)
        vol1 = sum(abs(float(s.amount1)) for s in swaps) / (10 ** dec1)

        result = {"volume_token0": vol0, "volume_token1": vol1}
        _set_cached(cache_key, result, ttl=30)
        return result

    # ------------------------------------------------------------------
    # Fees (derived from swap input volume)
    # ------------------------------------------------------------------
    @staticmethod
    async def get_fees_24h(pair_address: str) -> Dict[str, float]:
        """Estimate 24h fees as input_volume * fee_tier."""
        cache_key = f"fees:{pair_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import SwapEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)
        dec0 = config["token0"]["decimals"]
        dec1 = config["token1"]["decimals"]
        fee_tier = config.get("fee_tier", 0.003)

        cutoff = int((datetime.utcnow() - timedelta(hours=24)).timestamp())

        swaps = await SwapEvent.filter(
            evt_address=addr,
            evt_block_time__gte=cutoff,
        )

        # Input volume: amount > 0 means tokens flowing into the pool
        input0 = sum(float(s.amount0) for s in swaps if float(s.amount0) > 0) / (10 ** dec0)
        input1 = sum(float(s.amount1) for s in swaps if float(s.amount1) > 0) / (10 ** dec1)

        result = {
            "fees_token0": input0 * fee_tier,
            "fees_token1": input1 * fee_tier,
        }
        _set_cached(cache_key, result, ttl=30)
        return result

    # ------------------------------------------------------------------
    # Vault revenue (from collects table)
    # ------------------------------------------------------------------
    @staticmethod
    async def get_vault_revenue(
        pair_address: str,
        vault_address: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        Get total fee revenue from the collects table.

        If vault_address is provided, filter by owner = vault_address.
        Otherwise sum all collects for the pool.
        """
        cache_key = f"revenue:{pair_address}:{vault_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import CollectEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)
        dec0 = config["token0"]["decimals"]
        dec1 = config["token1"]["decimals"]

        filters = {"evt_address": addr}
        if vault_address:
            filters["owner"] = normalize_evt_address(vault_address)

        collects = await CollectEvent.filter(**filters)

        rev0 = sum(abs(float(c.amount0)) for c in collects) / (10 ** dec0)
        rev1 = sum(abs(float(c.amount1)) for c in collects) / (10 ** dec1)

        result = {"revenue_token0": rev0, "revenue_token1": rev1}
        _set_cached(cache_key, result, ttl=60)
        return result

    # ------------------------------------------------------------------
    # TVL approximation (net mints - burns)
    # ------------------------------------------------------------------
    @staticmethod
    async def get_pool_tvl_approx(
        pair_address: str,
        vault_address: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        Approximate TVL from net liquidity: sum(mints) - sum(burns).

        If vault_address is provided, only counts that vault's deposits/withdrawals
        (filtered by the `owner` field on mint/burn events).
        """
        cache_key = f"tvl:{pair_address}:{vault_address}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        from validator.models.pool_events import MintEvent, BurnEvent
        addr = normalize_evt_address(pair_address)
        config = _get_pool_config(pair_address)
        dec0 = config["token0"]["decimals"]
        dec1 = config["token1"]["decimals"]

        mint_filters: Dict[str, Any] = {"evt_address": addr}
        burn_filters: Dict[str, Any] = {"evt_address": addr}
        if vault_address:
            norm_vault = normalize_evt_address(vault_address)
            mint_filters["owner"] = norm_vault
            burn_filters["owner"] = norm_vault

        mints = await MintEvent.filter(**mint_filters)
        burns = await BurnEvent.filter(**burn_filters)

        mint0 = sum(abs(float(m.amount0)) for m in mints) / (10 ** dec0)
        mint1 = sum(abs(float(m.amount1)) for m in mints) / (10 ** dec1)
        burn0 = sum(abs(float(b.amount0)) for b in burns) / (10 ** dec0)
        burn1 = sum(abs(float(b.amount1)) for b in burns) / (10 ** dec1)

        net0 = max(0.0, mint0 - burn0)
        net1 = max(0.0, mint1 - burn1)

        result = {"tvl_token0": net0, "tvl_token1": net1}
        _set_cached(cache_key, result, ttl=60)
        return result

    # ------------------------------------------------------------------
    # Token prices (cached helper)
    # ------------------------------------------------------------------
    @staticmethod
    async def get_token_prices(job) -> Dict[str, float]:
        """
        Get USD prices for a job's token0 and token1.

        Returns {"price0": float, "price1": float}.
        Falls back to 0.0 if prices unavailable.
        """
        cache_key = f"token_prices:{job.job_id}"
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

        price0, price1 = 0.0, 0.0
        try:
            from api.services.metrics_calculator import MetricsCalculator
            tvl_data = await MetricsCalculator.calculate_job_tvl(job)
            price0 = tvl_data.get("token0_price_usd", 0.0)
            price1 = tvl_data.get("token1_price_usd", 0.0)
        except Exception as e:
            logger.warning(f"Could not get token prices for {job.job_id}: {e}")

        result = {"price0": price0, "price1": price1}
        _set_cached(cache_key, result, ttl=60)
        return result

    @staticmethod
    def tokens_to_usd(
        amount0: float, amount1: float, price0: float, price1: float
    ) -> float:
        """Convert token amounts to USD using prices."""
        return amount0 * price0 + amount1 * price1

    # ------------------------------------------------------------------
    # APY
    # ------------------------------------------------------------------
    @staticmethod
    async def calculate_apy(
        pair_address: str,
        vault_address: Optional[str] = None,
        lookback_days: int = 30,
    ) -> Dict[str, float]:
        """
        Calculate APY = (revenue / tvl) * (365 / days) * 100.

        Uses collects for revenue and mints-burns for TVL.
        """
        revenue = await ReaderDBMetricsService.get_vault_revenue(
            pair_address, vault_address
        )
        tvl = await ReaderDBMetricsService.get_pool_tvl_approx(
            pair_address, vault_address
        )

        rev0 = revenue["revenue_token0"]
        rev1 = revenue["revenue_token1"]
        tvl0 = tvl["tvl_token0"]
        tvl1 = tvl["tvl_token1"]

        apy0 = (rev0 / tvl0 * 365.0 / lookback_days * 100.0) if tvl0 > 0 else 0.0
        apy1 = (rev1 / tvl1 * 365.0 / lookback_days * 100.0) if tvl1 > 0 else 0.0

        # Blended APY (average of both token APYs)
        apy_blend = (apy0 + apy1) / 2.0 if (apy0 > 0 or apy1 > 0) else 0.0

        return {
            "apy_percent": apy_blend,
            "apy_token0": apy0,
            "apy_token1": apy1,
            "revenue_token0": rev0,
            "revenue_token1": rev1,
            "tvl_token0": tvl0,
            "tvl_token1": tvl1,
        }
