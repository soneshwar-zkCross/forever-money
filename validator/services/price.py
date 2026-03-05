import aiohttp
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

import bittensor as bt

from validator.utils.cache import async_ttl_cache

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

    # Known stablecoins (return $1.0 immediately, no API call)
    STABLECOINS = {
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  # USDC on Base
        "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",  # USDbC on Base
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC on Ethereum
        "0xdac17f958d2ee523a2206206994597c13d831ec7",  # USDT on Ethereum
    }

    # GeckoTerminal network names by chain_id (fallback when CoinGecko returns 404/429)
    GECKOTERMINAL_BASE_URL = "https://api.geckoterminal.com/api/v2"
    CHAIN_ID_TO_NETWORK: Dict[int, str] = {
        1: "eth",
        8453: "base",
        137: "polygon_pos",
        42161: "arbitrum",
        10: "optimism",
        43114: "avax",
        56: "bsc",
    }

    MAX_RETRIES = 10
    RETRY_DELAY = 10  # seconds when 429 from CoinGecko

    @staticmethod
    async def _get_json(
        url: str,
        params: dict = None,
        timeout: float = 15,
        retry_on_429: bool = True,
    ) -> Tuple[int, Optional[dict]]:
        """
        GET request.
        retry_on_429=True: on 429, sleep RETRY_DELAY and retry up to MAX_RETRIES (use for CoinGecko).
        retry_on_429=False: on 429, return (429, None) immediately (use for GeckoTerminal).
        Returns (status_code, json_data). json_data is None for non-200 responses.
        """
        if retry_on_429:
            max_attempts = PriceService.MAX_RETRIES + 1
        else:
            max_attempts = 1
        for attempt in range(max_attempts):
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, params=params, timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    if response.status == 429:
                        if retry_on_429 and attempt < PriceService.MAX_RETRIES:
                            logger.warning(
                                f"Rate limited (429) on {url}, retrying in "
                                f"{PriceService.RETRY_DELAY}s "
                                f"({attempt + 1}/{PriceService.MAX_RETRIES})"
                            )
                            await asyncio.sleep(PriceService.RETRY_DELAY)
                            continue
                        return response.status, None
                    if response.status == 200:
                        return response.status, await response.json()
                    return response.status, None
        return 429, None

    @staticmethod
    @async_ttl_cache(ttl=2.0)
    async def get_tao_price_usd() -> float:
        """
        Get current price of TAO (Bittensor) token in USD from Coingecko.
        On 429, retries with delay. No GeckoTerminal (TAO is not contract-based).

        Returns:
            TAO price in USD, or 1.0 as fallback
        """
        url = f"{PriceService.BASE_URL}/simple/price"
        params = {
            "ids": PriceService.COINGECKO_TAO_ID,
            "vs_currencies": "usd",
        }
        try:
            status, data = await PriceService._get_json(
                url, params=params, timeout=10, retry_on_429=True
            )
            if status == 200:
                tao_price = data.get(PriceService.COINGECKO_TAO_ID, {}).get("usd", 1.0)
                return float(tao_price)
            else:
                logger.warning(f"Coingecko API returned status {status}")
        except asyncio.TimeoutError:
            logger.warning("Timeout fetching TAO price from Coingecko")
        except Exception as e:
            logger.error(f"Failed to fetch TAO price: {e}")

    @staticmethod
    @async_ttl_cache(ttl=2.0)
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
    @async_ttl_cache(ttl=2.0)
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
    @async_ttl_cache(ttl=2.0)
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
            RuntimeError: On fetch failure (timeout, HTTP error, no prices).

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

        # 1) Try CoinGecko (retries on 429 with delay)
        try:
            status, data = await PriceService._get_json(
                url, params=params, retry_on_429=False
            )
            if status == 200:
                prices = data.get("prices") or []
                if not prices:
                    raise RuntimeError(
                        f"No prices returned for {token_address} on {platform}"
                    )
                prices.sort(key=lambda p: p[0])
                _, last_price = prices[-1]
                return float(last_price)
            if status not in (404, 429):
                raise RuntimeError(
                    f"CoinGecko returned status {status} "
                    f"for {token_address} on {platform}"
                )
        except asyncio.TimeoutError as e:
            raise RuntimeError(
                f"Timeout fetching token price for {token_address} "
                f"(chain_id={chain_id})"
            ) from e
        except (ValueError, RuntimeError):
            raise

        # 2) 404 or 429 from CoinGecko → try GeckoTerminal (no delay, no retry on 429)
        logger.info(
            f"CoinGecko {status} for {token_address} on {platform}, "
            f"trying GeckoTerminal"
        )
        try:
            return await PriceService._get_token_price_geckoterminal(addr, chain_id)
        except Exception:
            pass

        # 3) GeckoTerminal failed → try CoinGecko again (with retry on 429)
        logger.info(
            f"GeckoTerminal failed for {token_address}, retrying CoinGecko"
        )
        status2, data2 = await PriceService._get_json(
            url, params=params, retry_on_429=True
        )
        if status2 == 200:
            prices = data2.get("prices") or []
            if not prices:
                raise RuntimeError(
                    f"No prices returned for {token_address} on {platform}"
                )
            prices.sort(key=lambda p: p[0])
            _, last_price = prices[-1]
            return float(last_price)
        raise RuntimeError(
            f"Could not get token price for {token_address} "
            f"(CoinGecko status={status2}, GeckoTerminal failed)"
        )

    @staticmethod
    async def _get_token_price_geckoterminal(
        token_address: str, chain_id: int
    ) -> float:
        """
        Get token price in USD from GeckoTerminal.
        Does not retry on 429 so caller can fall back to CoinGecko.

        Raises:
            ValueError: If chain_id has no GeckoTerminal network mapping.
            RuntimeError: On fetch failure or missing price data.
        """
        network = PriceService.CHAIN_ID_TO_NETWORK.get(chain_id)
        if not network:
            raise ValueError(
                f"chain_id={chain_id} not in CHAIN_ID_TO_NETWORK"
            )

        url = (
            f"{PriceService.GECKOTERMINAL_BASE_URL}/simple/networks/{network}"
            f"/token_price/{token_address}"
        )

        status, data = await PriceService._get_json(
            url, timeout=15, retry_on_429=False
        )
        if status != 200:
            raise RuntimeError(
                f"GeckoTerminal returned status {status} "
                f"for {token_address} on {network}"
            )

        token_prices = (
            data.get("data", {})
            .get("attributes", {})
            .get("token_prices", {})
        )
        price_str = token_prices.get(token_address)
        if not price_str:
            raise RuntimeError(
                f"No price returned from GeckoTerminal for {token_address} on {network}"
            )
        return float(price_str)
