import aiohttp
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional
import bittensor as bt
import asyncio

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SQLite price-cache helpers (5-min TTL)
# Wrapped in try/except so the validator still works without the metrics DB.
# ---------------------------------------------------------------------------
PRICE_CACHE_TTL = timedelta(minutes=5)

def _resolve_pool_tokens_from_config(pool_address: str) -> Optional[tuple]:
    """Resolve token0/token1 addresses from POOL_CONFIGS (no RPC call)."""
    try:
        from api.utils.pool_data_service import POOL_CONFIGS
        cfg = POOL_CONFIGS.get(pool_address.lower())
        if not cfg:
            return None
        t0_addr = cfg["token0"].get("address")
        t1_addr = cfg["token1"].get("address")
        if t0_addr and t1_addr:
            return (t0_addr.lower(), t1_addr.lower())
    except Exception:
        pass
    return None


async def _get_cached_price(price_key: str) -> Optional[float]:
    """Return cached price if fresh (< 5 min old), else None."""
    try:
        from api.models.metrics import CachedPrice

        row = await CachedPrice.filter(price_key=price_key).first()
        if row and (datetime.utcnow() - row.fetched_at) < PRICE_CACHE_TTL:
            logger.debug(f"Price cache HIT: {price_key}={row.price_usd}")
            return row.price_usd
    except Exception:
        pass  # metrics DB unavailable — fall through to live fetch
    return None


async def _set_cached_price(
    price_key: str, price_usd: float, source: str = "coingecko"
) -> None:
    """Upsert a price row in the cache."""
    try:
        from api.models.metrics import CachedPrice

        await CachedPrice.update_or_create(
            defaults={"price_usd": price_usd, "source": source},
            price_key=price_key,
        )
        logger.debug(f"Price cache SET: {price_key}={price_usd}")
    except Exception:
        pass  # best-effort


class PriceService:
    """Service to fetch token prices, including TWAP Alpha Price."""

    BASE_URL = "https://api.coingecko.com/api/v3"
    COINGECKO_TAO_ID = "bittensor"  # Bittensor TAO on Coingecko
    COINGECKO_ALPHA_ID = "forevermoney"  # Alpha on Coingecko

    # CoinGecko asset platform IDs by chain_id (for /coins/{id}/contract/{addr}/market_chart)
    CHAIN_ID_TO_PLATFORM: Dict[int, str] = {
        1: "ethereum",
        8453: "base",
        137: "polygon-pos",
        42161: "arbitrum-one",
        10: "optimistic-ethereum",
        43114: "avalanche",
        56: "binance-smart-chain",
    }

    # Known stablecoins (USD-pegged, price = $1.0)
    STABLECOINS: set = {
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  # USDC on Base
    }

    @staticmethod
    async def _get_price_from_swaps(token_address: str) -> Optional[float]:
        """
        Derive a token's USD price from the latest swap tick in our own DB.

        Uses POOL_CONFIGS to find a pool containing this token, reads the
        latest SwapEvent tick, and converts to USD.  For tokens paired with
        a non-USD token (e.g. BID/WETH), resolves the intermediary first.

        Returns None if no swap data is available.
        """
        try:
            from api.utils.pool_data_service import POOL_CONFIGS
            from validator.models.pool_events import SwapEvent
            from api.utils.address import normalize_evt_address

            addr_low = token_address.lower()

            # Stablecoins are always $1
            if addr_low in PriceService.STABLECOINS:
                return 1.0

            # Find a pool that contains this token
            for pool_addr, cfg in POOL_CONFIGS.items():
                t0_dec = cfg["token0"]["decimals"]
                t1_dec = cfg["token1"]["decimals"]

                is_token0 = False
                is_token1 = False
                other_is_usd = False

                # Resolve token addresses from pool contract (cached)
                pool_tokens = _resolve_pool_tokens_from_config(pool_addr)
                if not pool_tokens:
                    continue
                pool_t0_addr, pool_t1_addr = pool_tokens

                if pool_t0_addr == addr_low:
                    is_token0 = True
                    other_is_usd = pool_t1_addr in PriceService.STABLECOINS
                elif pool_t1_addr == addr_low:
                    is_token1 = True
                    other_is_usd = pool_t0_addr in PriceService.STABLECOINS

                if not is_token0 and not is_token1:
                    continue

                # Get latest swap tick
                evt_addr = normalize_evt_address(pool_addr)
                swap = await SwapEvent.filter(
                    evt_address=evt_addr
                ).order_by("-evt_block_time").first()
                if not swap:
                    continue

                decimal_adj = 10 ** (t0_dec - t1_dec)
                # raw_price = price of token0 in terms of token1
                raw_price = (1.0001 ** int(swap.tick)) * decimal_adj

                if other_is_usd:
                    # One side is USDC — we can get USD price directly.
                    # raw_price = token0 priced in token1 (Uniswap math).
                    # invert_price is a display flag only; doesn't affect USD calc.
                    if is_token0:
                        # token1 is USDC → raw_price = token0 in USD
                        usd_price = raw_price
                    else:
                        # token0 is USDC → 1/raw_price = token1 in USD
                        if raw_price > 0:
                            usd_price = 1.0 / raw_price
                        else:
                            continue
                    logger.debug(
                        f"Swap-derived price for {addr_low[:10]}...: ${usd_price:.4f} "
                        f"(pool {pool_addr[:10]}...)"
                    )
                    return usd_price
                else:
                    # Neither side is USDC — need intermediary price
                    # e.g., BID/WETH pool: get BID in WETH, then WETH in USD
                    other_addr = pool_t1_addr if is_token0 else pool_t0_addr
                    other_usd = await PriceService._get_price_from_swaps(other_addr)
                    if other_usd is None:
                        continue

                    if is_token0:
                        usd_price = raw_price * other_usd
                    else:
                        usd_price = (1.0 / raw_price) * other_usd if raw_price > 0 else 0.0

                    logger.debug(
                        f"Swap-derived price for {addr_low[:10]}...: ${usd_price:.4f} "
                        f"(via {other_addr[:10]}...)"
                    )
                    return usd_price

        except Exception as e:
            logger.debug(f"Swap-derived pricing failed for {token_address}: {e}")

        return None

    @staticmethod
    async def get_tao_price_usd() -> float:
        """
        Get current price of TAO (Bittensor) token in USD from Coingecko.

        Returns:
            TAO price in USD, or 1.0 as fallback
        """
        # --- cache check ---
        cached = await _get_cached_price("tao_usd")
        if cached is not None:
            return cached

        try:
            async with aiohttp.ClientSession() as session:
                url = f"{PriceService.BASE_URL}/simple/price"
                params = {
                    "ids": PriceService.COINGECKO_TAO_ID,
                    "vs_currencies": "usd",
                }
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        tao_price = data.get(PriceService.COINGECKO_TAO_ID, {}).get("usd", 1.0)
                        price = float(tao_price)
                        await _set_cached_price("tao_usd", price, source="coingecko")
                        return price
                    else:
                        logger.warning(f"Coingecko API returned status {response.status}")
        except asyncio.TimeoutError:
            logger.warning("Timeout fetching TAO price from Coingecko")
        except Exception as e:
            logger.error(f"Failed to fetch TAO price: {e}")

    @staticmethod
    async def get_alpha_price_tao(subtensor: bt.Subtensor, netuid: int) -> float:
        """
        Get Alpha price in TAO (how many TAO per 1 Alpha).

        Uses subtensor subnet info: alpha_to_tao(1) = TAO/Alpha spot ratio.

        Returns:
            Alpha price in TAO (TAO per 1 Alpha)
        """
        # --- cache check ---
        cached = await _get_cached_price("alpha_tao")
        if cached is not None:
            return cached

        try:
            subnet_info = subtensor.subnet(netuid)
            alpha_price_tao = subnet_info.alpha_to_tao(1)
            price = float(alpha_price_tao)
            await _set_cached_price("alpha_tao", price, source="bittensor_rpc")
            return price
        except Exception as e:
            logger.error(f"Failed to fetch Alpha price (TAO): {e}")

    @staticmethod
    async def get_alpha_price_usd(subtensor: bt.Subtensor, netuid: int) -> float:
        """
        Get Alpha price in USD using tao_price_usd and alpha_price_tao.

        Alpha (USD) = alpha_price_tao * tao_price_usd
        i.e. (TAO per Alpha) * (USD per TAO) = USD per Alpha.

        Returns:
            Alpha price in USD
        """
        try:
            tao_price_usd = await PriceService.get_tao_price_usd()
            alpha_price_tao = await PriceService.get_alpha_price_tao(subtensor, netuid)
            alpha_price_usd = alpha_price_tao * tao_price_usd      
            return alpha_price_usd
        except Exception as e:
            logger.error(f"Failed to fetch Alpha price (USD): {e}")

    @staticmethod
    async def get_token_price(token_address: str, chain_id: int = 8453) -> float:
        """
        Get current token price in USD.

        Resolution order:
          1. Known stablecoins → $1.0
          2. SQLite cache (5-min TTL)
          3. Swap-derived price from local DB (tick data)
          4. CoinGecko API (last resort)

        Raises:
            ValueError: On invalid args (unknown chain_id, empty token_address).
            RuntimeError: On fetch failure (all sources exhausted).

        Returns:
            Token price in USD.
        """
        platform = PriceService.CHAIN_ID_TO_PLATFORM.get(chain_id)
        if not platform:
            raise ValueError(
                f"chain_id={chain_id} not in CHAIN_ID_TO_PLATFORM"
            )

        raw = (token_address or "").strip()
        if not raw:
            raise ValueError("empty token_address")
        low = raw.lower()
        addr = low if low.startswith("0x") else "0x" + low

        # 1. Known stablecoins
        if addr in PriceService.STABLECOINS:
            return 1.0

        cache_key = f"{addr}:{chain_id}"

        # 2. SQLite cache check
        cached = await _get_cached_price(cache_key)
        if cached is not None:
            return cached

        # 3. Swap-derived price (local DB, zero external calls)
        swap_price = await PriceService._get_price_from_swaps(addr)
        if swap_price is not None and swap_price > 0:
            await _set_cached_price(cache_key, swap_price, source="swap_tick")
            return swap_price

        # 4. CoinGecko fallback
        url = (
            f"{PriceService.BASE_URL}/coins/{platform}/contract/{addr}/market_chart"
        )
        params = {"vs_currency": "usd", "days": "1"}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, params=params, timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status != 200:
                        raise RuntimeError(
                            f"CoinGecko returned status {response.status} "
                            f"for {token_address} on {platform}"
                        )
                    data = await response.json()
        except asyncio.TimeoutError as e:
            logger.warning(
                f"Timeout fetching token price for {token_address} (chain_id={chain_id})"
            )
            raise RuntimeError(
                f"Timeout fetching token price for {token_address} "
                f"(chain_id={chain_id})"
            ) from e
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch token price for {token_address}: {e}")
            raise

        prices = data.get("prices") or []
        if not prices:
            raise RuntimeError(
                f"No prices returned for {token_address} on {platform}"
            )

        # prices = [[timestamp_ms, price], ...]; use latest (last) price
        prices.sort(key=lambda p: p[0])
        _, last_price = prices[-1]
        price = float(last_price)
        await _set_cached_price(cache_key, price, source="coingecko")
        return price
