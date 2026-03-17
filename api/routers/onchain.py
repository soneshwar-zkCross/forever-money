"""
On-Chain Data Router

Endpoints for live on-chain data from Base (pool state, vault balances)
and Bittensor metagraph data.
"""
import asyncio
import logging
import math
import time
from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from validator.utils.web3 import AsyncWeb3Helper
from validator.services.price import PriceService
from validator.services.liqmanager import SnLiqManagerService
from validator.models.job import Job

logger = logging.getLogger(__name__)

# ── In-memory cache with TTL ──
_cache: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, data)
CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and entry[0] > time.time():
        return entry[1]
    return None


def _cache_get_stale(key: str) -> Any | None:
    """Return cached data even if expired (last known good value)."""
    entry = _cache.get(key)
    if entry:
        return entry[1]
    return None


def _cache_set(key: str, data: Any, ttl: int = CACHE_TTL_SECONDS):
    _cache[key] = (time.time() + ttl, data)

def _cache_expire(key: str):
    """Mark a cache entry as expired but keep it for stale fallback."""
    entry = _cache.get(key)
    if entry:
        # Set expiry to 0 so _cache_get returns None but _cache_get_stale still works
        _cache[key] = (0, entry[1])


router = APIRouter()


@router.post("/refresh/{job_id}")
async def refresh_vault_data(job_id: str):
    """Expire cached on-chain data for a job and re-fetch fresh.
    Keeps stale data as fallback in case the fresh fetch fails."""
    _cache_expire(f"pool-state:{job_id}")
    _cache_expire(f"vault-state:{job_id}")
    _cache_expire("vaults-summary")
    # Fetch fresh data now (will cache if successful, fall back to stale if not)
    pool_result = await get_pool_state(job_id)
    vault_result = await get_vault_state(job_id)
    return {
        "refreshed": True,
        "job_id": job_id,
        "pool_ok": "error" not in (pool_result or {}),
        "vault_ok": "error" not in (vault_result or {}),
    }


def _normalize_address(addr: str) -> str:
    s = (addr or "").strip().lower()
    return s if s.startswith("0x") else "0x" + s


def _sqrt_price_x96_to_price(sqrt_price_x96: int, decimals0: int = 18, decimals1: int = 18) -> float:
    """Convert sqrtPriceX96 to human-readable price (token1/token0)."""
    if sqrt_price_x96 == 0:
        return 0.0
    price = (sqrt_price_x96 / (2 ** 96)) ** 2
    # Adjust for decimal difference
    price *= 10 ** (decimals0 - decimals1)
    return price


def _tick_to_price(tick: int, decimals0: int = 18, decimals1: int = 18) -> float:
    """Convert tick to price."""
    price = 1.0001 ** tick
    price *= 10 ** (decimals0 - decimals1)
    return price


# Stablecoins — always $1.00, never need a price lookup
STABLECOIN_ADDRESSES = {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  # USDC
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",  # USDbC
}

# Known token metadata for Base chain
KNOWN_TOKENS = {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {"symbol": "USDC", "decimals": 6},
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": {"symbol": "USDbC", "decimals": 6},
    "0x4200000000000000000000000000000000000006": {"symbol": "WETH", "decimals": 18},
    "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": {"symbol": "cbBTC", "decimals": 8},
    "0xb99fbe68c8a0cc14be8c1af73dd4dfea8a76add7": {"symbol": "xTAO", "decimals": 9},
}


async def _safe_get_price(token_address: str, chain_id: int) -> float:
    """
    Get token price, returning 0.0 on failure instead of raising.
    For stablecoins, returns 1.0 immediately.
    """
    addr = _normalize_address(token_address)
    if addr in STABLECOIN_ADDRESSES:
        return 1.0
    try:
        price = await PriceService.get_token_price(token_address, chain_id)
        if price and price > 0:
            return price
    except Exception as e:
        logger.warning(f"Price fetch failed for {addr}: {e}")
    return 0.0


async def _get_token_info(w3: AsyncWeb3Helper, token_address: str) -> dict:
    """Get token symbol and decimals."""
    addr = _normalize_address(token_address)
    if addr in KNOWN_TOKENS:
        return KNOWN_TOKENS[addr]
    # Always try on-chain call — decimals MUST be correct for TVL math
    try:
        erc20 = w3.make_contract_by_name("ERC20", addr)
        symbol, decimals = await asyncio.gather(
            erc20.functions.symbol().call(),
            erc20.functions.decimals().call(),
        )
        logger.info(f"Token {addr}: symbol={symbol} decimals={decimals} (on-chain)")
        return {"symbol": symbol, "decimals": decimals}
    except Exception as e:
        logger.warning(f"Failed to get token info for {addr}, defaulting to 18 decimals: {e}")
        return {"symbol": addr[:8] + "...", "decimals": 18}


@router.get("/jobs/{job_id}/pool-state")
async def get_pool_state(job_id: str):
    """
    Get live on-chain pool state: slot0, liquidity, fee, token info, prices.
    """
    cached = _cache_get(f"pool-state:{job_id}")
    if cached:
        return cached

    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        w3 = AsyncWeb3Helper.make_web3(job.chain_id)
        pool = w3.make_contract_by_name("ICLPool", _normalize_address(job.pair_address))

        # Parallel RPC calls
        slot0, liquidity, fee_amount, token0_addr, token1_addr = await asyncio.gather(
            pool.functions.slot0().call(),
            pool.functions.liquidity().call(),
            pool.functions.fee().call(),
            pool.functions.token0().call(),
            pool.functions.token1().call(),
        )

        # Get token info
        token0_info, token1_info = await asyncio.gather(
            _get_token_info(w3, token0_addr),
            _get_token_info(w3, token1_addr),
        )

        # Get token prices
        price0, price1 = await asyncio.gather(
            _safe_get_price(token0_addr, job.chain_id),
            _safe_get_price(token1_addr, job.chain_id),
        )

        sqrt_price_x96 = slot0[0]
        current_tick = slot0[1]

        pool_price = _sqrt_price_x96_to_price(
            sqrt_price_x96,
            token0_info["decimals"],
            token1_info["decimals"],
        )

        result = {
            "job_id": job_id,
            "pool_address": job.pair_address,
            "chain_id": job.chain_id,
            "slot0": {
                "sqrt_price_x96": str(sqrt_price_x96),
                "tick": current_tick,
                "observation_index": slot0[2] if len(slot0) > 2 else None,
                "unlocked": slot0[-1] if len(slot0) > 5 else True,
            },
            "liquidity": str(liquidity),
            "fee": fee_amount,
            "pool_price": pool_price,
            "token0": {
                "address": token0_addr,
                "symbol": token0_info["symbol"],
                "decimals": token0_info["decimals"],
                "price_usd": price0,
            },
            "token1": {
                "address": token1_addr,
                "symbol": token1_info["symbol"],
                "decimals": token1_info["decimals"],
                "price_usd": price1,
            },
            "updated_at": datetime.utcnow().isoformat(),
        }
        _cache_set(f"pool-state:{job_id}", result)
        return result

    except Exception as e:
        logger.error(f"Failed to fetch pool state for {job_id}: {e}")
        stale = _cache_get_stale(f"pool-state:{job_id}")
        if stale:
            return stale
        return {
            "job_id": job_id,
            "error": str(e),
            "pool_address": job.pair_address,
            "chain_id": job.chain_id,
            "updated_at": datetime.utcnow().isoformat(),
        }


@router.get("/jobs/{job_id}/vault-state")
async def get_vault_state(job_id: str):
    """
    Get live on-chain vault state: idle balances, in-pool positions, total TVL,
    fee split, owner, operator.
    """
    cached = _cache_get(f"vault-state:{job_id}")
    if cached:
        return cached

    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        w3 = AsyncWeb3Helper.make_web3(job.chain_id)
        vault = w3.make_contract_by_name(
            "LiquidityManager", _normalize_address(job.sn_liquidity_manager_address)
        )
        pool = w3.make_contract_by_name("ICLPool", _normalize_address(job.pair_address))

        # Get tokens first
        token0_addr, token1_addr = await asyncio.gather(
            pool.functions.token0().call(),
            pool.functions.token1().call(),
        )

        token0_info, token1_info = await asyncio.gather(
            _get_token_info(w3, token0_addr),
            _get_token_info(w3, token1_addr),
        )

        # Get vault metadata
        results = {}
        try:
            fee_split = await vault.functions.feeSplit().call()
            results["fee_split"] = fee_split
        except Exception:
            results["fee_split"] = None

        try:
            owner = await vault.functions.owner().call()
            results["owner"] = owner
        except Exception:
            results["owner"] = None

        try:
            operator = await vault.functions.operator().call()
            results["operator"] = operator
        except Exception:
            results["operator"] = None

        # ── Idle balances (tokens sitting in the vault contract, not in pool) ──
        idle0 = 0.0
        idle1 = 0.0
        vault_had_error = False
        try:
            token0_erc20 = w3.make_contract_by_name("ERC20", _normalize_address(token0_addr))
            token1_erc20 = w3.make_contract_by_name("ERC20", _normalize_address(token1_addr))
            balance0_raw, balance1_raw = await asyncio.gather(
                token0_erc20.functions.balanceOf(
                    w3.web3.to_checksum_address(job.sn_liquidity_manager_address)
                ).call(),
                token1_erc20.functions.balanceOf(
                    w3.web3.to_checksum_address(job.sn_liquidity_manager_address)
                ).call(),
            )
            idle0 = balance0_raw / (10 ** token0_info["decimals"])
            idle1 = balance1_raw / (10 ** token1_info["decimals"])
        except Exception as e:
            logger.warning(f"Vault {job_id}: idle balance fetch failed: {e}")
            vault_had_error = True

        # ── In-pool positions (vault's share of the pool) ──
        deployed0 = 0.0
        deployed1 = 0.0
        positions_list = []
        try:
            svc = SnLiqManagerService(
                chain_id=job.chain_id,
                liquidity_manager_address=job.sn_liquidity_manager_address,
                pool_address=job.pair_address,
            )
            positions = await svc.get_current_positions()
            d0 = token0_info["decimals"]
            d1 = token1_info["decimals"]
            for pos in positions:
                a0 = int(pos.allocation0) / (10 ** d0)
                a1 = int(pos.allocation1) / (10 ** d1)
                deployed0 += a0
                deployed1 += a1
                positions_list.append({
                    "tick_lower": pos.tick_lower,
                    "tick_upper": pos.tick_upper,
                    "price_lower": _tick_to_price(pos.tick_lower, d0, d1),
                    "price_upper": _tick_to_price(pos.tick_upper, d0, d1),
                    "amount0": a0,
                    "amount1": a1,
                })
        except Exception as e:
            logger.warning(f"Vault {job_id}: position fetch failed: {e}")
            vault_had_error = True

        # ── Prices ──
        price0, price1 = await asyncio.gather(
            _safe_get_price(token0_addr, job.chain_id),
            _safe_get_price(token1_addr, job.chain_id),
        )

        # Cross-derive missing price from pool price if we have one side
        try:
            slot0 = await pool.functions.slot0().call()
            pool_price = _sqrt_price_x96_to_price(
                slot0[0], token0_info["decimals"], token1_info["decimals"]
            )
            if pool_price > 0:
                if price0 == 0 and price1 > 0:
                    price0 = price1 / pool_price  # pool_price = token1/token0
                    logger.info(f"Derived price0 from pool: ${price0:.4f}")
                elif price1 == 0 and price0 > 0:
                    price1 = price0 * pool_price
                    logger.info(f"Derived price1 from pool: ${price1:.4f}")
        except Exception:
            pass

        total0 = idle0 + deployed0
        total1 = idle1 + deployed1

        logger.info(
            f"Vault {job_id}: idle={idle0:.6f}/{idle1:.6f} deployed={deployed0:.6f}/{deployed1:.6f} "
            f"prices=${price0:.4f}/${price1:.4f} "
            f"t0={token0_info['symbol']}({token0_info['decimals']}) t1={token1_info['symbol']}({token1_info['decimals']})"
        )

        idle_usd = idle0 * price0 + idle1 * price1
        deployed_usd = deployed0 * price0 + deployed1 * price1
        total_usd = idle_usd + deployed_usd

        # Sanity check — if value looks absurd, log details and zero it out
        if total_usd > 100_000_000:
            logger.warning(
                f"Vault {job_id} TVL looks wrong (${total_usd:,.2f}). "
                f"idle0={idle0} idle1={idle1} deployed0={deployed0} deployed1={deployed1} "
                f"price0={price0} price1={price1} "
                f"decimals0={token0_info['decimals']} decimals1={token1_info['decimals']}"
            )
            # Still return the data so we can debug, but flag it
            pass

        result = {
            "job_id": job_id,
            "vault_address": job.sn_liquidity_manager_address,
            "chain_id": job.chain_id,
            "token0": {
                "address": token0_addr,
                "symbol": token0_info["symbol"],
                "decimals": token0_info["decimals"],
                "idle": idle0,
                "deployed": deployed0,
                "balance": total0,
                "balance_usd": total0 * price0,
                "price_usd": price0,
            },
            "token1": {
                "address": token1_addr,
                "symbol": token1_info["symbol"],
                "decimals": token1_info["decimals"],
                "idle": idle1,
                "deployed": deployed1,
                "balance": total1,
                "balance_usd": total1 * price1,
                "price_usd": price1,
            },
            "positions": positions_list,
            "idle_value_usd": idle_usd,
            "deployed_value_usd": deployed_usd,
            "total_value_usd": total_usd,
            "fee_split": results["fee_split"],
            "owner": results["owner"],
            "operator": results["operator"],
            "updated_at": datetime.utcnow().isoformat(),
        }
        if not vault_had_error:
            _cache_set(f"vault-state:{job_id}", result)
        else:
            stale = _cache_get_stale(f"vault-state:{job_id}")
            if stale:
                logger.warning(f"Vault {job_id}: RPC errors — returning stale cached result")
                return stale
        return result

    except Exception as e:
        logger.error(f"Failed to fetch vault state for {job_id}: {e}")
        stale = _cache_get_stale(f"vault-state:{job_id}")
        if stale:
            return stale
        return {
            "job_id": job_id,
            "vault_address": job.sn_liquidity_manager_address,
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat(),
        }


@router.get("/vaults-summary")
async def get_all_vaults_summary():
    """
    Get on-chain TVL summary for ALL active jobs in a single call.
    Reuses get_vault_state() per job so that the summary and detail pages
    always share the same cache and never show divergent numbers.
    """
    cached = _cache_get("vaults-summary")
    if cached:
        return cached

    jobs = await Job.filter(is_active=True).all()
    results = []
    any_errors = False

    for i, job in enumerate(jobs):
        # Small delay between RPC-bound vaults to avoid rate-limiting
        # (skipped when vault-state is already cached — get_vault_state returns instantly)
        if i > 0 and not _cache_get(f"vault-state:{job.job_id}"):
            await asyncio.sleep(0.5)

        try:
            vault_data = await get_vault_state(job.job_id)
        except Exception as e:
            logger.warning(f"Vault summary: get_vault_state failed for {job.job_id}: {e}")
            any_errors = True
            results.append({
                "job_id": job.job_id,
                "vault_address": job.sn_liquidity_manager_address,
                "pair_name": job.job_id.replace("_", "/").replace("-", "/").upper(),
                "total_value_usd": 0,
                "idle_value_usd": 0,
                "deployed_value_usd": 0,
                "token0": None,
                "token1": None,
            })
            continue

        if vault_data.get("error"):
            any_errors = True

        t0 = vault_data.get("token0") or {}
        t1 = vault_data.get("token1") or {}
        results.append({
            "job_id": job.job_id,
            "vault_address": job.sn_liquidity_manager_address,
            "pair_name": f"{t0.get('symbol', '?')}/{t1.get('symbol', '?')}",
            "total_value_usd": vault_data.get("total_value_usd", 0),
            "idle_value_usd": vault_data.get("idle_value_usd", 0),
            "deployed_value_usd": vault_data.get("deployed_value_usd", 0),
            "token0": {"symbol": t0.get("symbol", "?"), "balance": t0.get("balance", 0), "price_usd": t0.get("price_usd", 0)} if t0 else None,
            "token1": {"symbol": t1.get("symbol", "?"), "balance": t1.get("balance", 0), "price_usd": t1.get("price_usd", 0)} if t1 else None,
        })

    total_tvl = sum(r["total_value_usd"] for r in results)
    result = {
        "total_tvl_usd": total_tvl,
        "vaults": results,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if not any_errors:
        _cache_set("vaults-summary", result)
    else:
        stale = _cache_get_stale("vaults-summary")
        if stale:
            logger.warning("Vaults summary had RPC errors — returning stale cached result")
            return stale
        logger.warning("Vaults summary had RPC errors and no stale cache — returning partial result")
    return result


@router.get("/metagraph")
async def get_metagraph_snapshot(
    limit: int = Query(256, ge=1, le=512),
):
    """
    Get Bittensor metagraph snapshot for subnet 98.
    Returns per-UID: stake, incentive, emission, dividends, active, axon info.
    """
    cached = _cache_get(f"metagraph:{limit}")
    if cached:
        return cached

    try:
        from api.utils.bittensor_client import BittensorClient

        meta = BittensorClient.get_metagraph(refresh=False)
        netuid = BittensorClient.get_netuid()

        miners = []
        n = min(len(meta.uids), limit)

        for i in range(n):
            uid = int(meta.uids[i])
            axon = meta.axons[i]

            miners.append({
                "uid": uid,
                "hotkey": meta.hotkeys[i],
                "coldkey": meta.coldkeys[i] if hasattr(meta, 'coldkeys') else None,
                "stake": float(meta.S[i]) if hasattr(meta, 'S') else 0.0,
                "incentive": float(meta.I[i]) if hasattr(meta, 'I') else 0.0,
                "emission": float(meta.E[i]) if hasattr(meta, 'E') else 0.0,
                "dividends": float(meta.D[i]) if hasattr(meta, 'D') else 0.0,
                "consensus": float(meta.C[i]) if hasattr(meta, 'C') else 0.0,
                "trust": float(meta.TS[i]) if hasattr(meta, 'TS') else 0.0,
                "active": int(meta.active[i]) if hasattr(meta, 'active') else 0,
                "axon": {
                    "ip": axon.ip,
                    "port": axon.port,
                    "is_serving": axon.is_serving,
                    "version": axon.version,
                },
            })

        result = {
            "netuid": netuid,
            "block": int(meta.block) if hasattr(meta, 'block') else None,
            "total_neurons": len(meta.uids),
            "neurons": miners,
            "updated_at": datetime.utcnow().isoformat(),
        }
        _cache_set(f"metagraph:{limit}", result, ttl=600)  # 10 min for metagraph
        return result

    except Exception as e:
        logger.error(f"Failed to fetch metagraph: {e}")
        return {
            "netuid": 98,
            "error": str(e),
            "neurons": [],
            "updated_at": datetime.utcnow().isoformat(),
        }
