"""
On-Chain Data Router

Endpoints for live on-chain data from Base (pool state, vault balances)
and Bittensor metagraph data.
"""
import asyncio
import logging
import math
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from validator.utils.web3 import AsyncWeb3Helper
from validator.services.price import PriceService
from validator.services.liqmanager import SnLiqManagerService
from validator.models.job import Job

logger = logging.getLogger(__name__)

router = APIRouter()


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


# Known token metadata for Base chain
KNOWN_TOKENS = {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {"symbol": "USDC", "decimals": 6},
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": {"symbol": "USDbC", "decimals": 6},
    "0x4200000000000000000000000000000000000006": {"symbol": "WETH", "decimals": 18},
    "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": {"symbol": "cbBTC", "decimals": 8},
    "0xb99fbe68c8a0cc14be8c1af73dd4dfea8a76add7": {"symbol": "xTAO", "decimals": 9},
}


async def _get_token_info(w3: AsyncWeb3Helper, token_address: str) -> dict:
    """Get token symbol and decimals."""
    addr = _normalize_address(token_address)
    if addr in KNOWN_TOKENS:
        return KNOWN_TOKENS[addr]
    try:
        erc20 = w3.make_contract_by_name("ERC20", addr)
        symbol, decimals = await asyncio.gather(
            erc20.functions.symbol().call(),
            erc20.functions.decimals().call(),
        )
        return {"symbol": symbol, "decimals": decimals}
    except Exception:
        return {"symbol": addr[:8] + "...", "decimals": 18}


@router.get("/jobs/{job_id}/pool-state")
async def get_pool_state(job_id: str):
    """
    Get live on-chain pool state: slot0, liquidity, fee, token info, prices.
    """
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
            PriceService.get_token_price(token0_addr, job.chain_id),
            PriceService.get_token_price(token1_addr, job.chain_id),
        )

        sqrt_price_x96 = slot0[0]
        current_tick = slot0[1]

        pool_price = _sqrt_price_x96_to_price(
            sqrt_price_x96,
            token0_info["decimals"],
            token1_info["decimals"],
        )

        return {
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

    except Exception as e:
        logger.error(f"Failed to fetch pool state for {job_id}: {e}")
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
            logger.debug(f"Could not fetch idle balances: {e}")

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
            logger.debug(f"Could not fetch in-pool positions: {e}")

        # ── Prices ──
        price0, price1 = await asyncio.gather(
            PriceService.get_token_price(token0_addr, job.chain_id),
            PriceService.get_token_price(token1_addr, job.chain_id),
        )

        total0 = idle0 + deployed0
        total1 = idle1 + deployed1
        idle_usd = idle0 * price0 + idle1 * price1
        deployed_usd = deployed0 * price0 + deployed1 * price1
        total_usd = idle_usd + deployed_usd

        return {
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

    except Exception as e:
        logger.error(f"Failed to fetch vault state for {job_id}: {e}")
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
    Returns idle + deployed balances per vault so the pairs list page
    can show real TVL without N separate RPC round-trips.
    """
    jobs = await Job.filter(is_active=True).all()
    results = []

    for job in jobs:
        entry: dict = {
            "job_id": job.job_id,
            "vault_address": job.sn_liquidity_manager_address,
            "pair_name": job.metadata.get("pair_name", job.target) if job.metadata else job.target,
            "total_value_usd": 0,
            "idle_value_usd": 0,
            "deployed_value_usd": 0,
            "token0": None,
            "token1": None,
        }
        try:
            w3 = AsyncWeb3Helper.make_web3(job.chain_id)
            pool = w3.make_contract_by_name("ICLPool", _normalize_address(job.pair_address))

            token0_addr, token1_addr = await asyncio.gather(
                pool.functions.token0().call(),
                pool.functions.token1().call(),
            )
            token0_info, token1_info = await asyncio.gather(
                _get_token_info(w3, token0_addr),
                _get_token_info(w3, token1_addr),
            )

            # Idle balances (tokens in vault contract)
            idle0 = 0.0
            idle1 = 0.0
            try:
                t0_erc20 = w3.make_contract_by_name("ERC20", _normalize_address(token0_addr))
                t1_erc20 = w3.make_contract_by_name("ERC20", _normalize_address(token1_addr))
                b0, b1 = await asyncio.gather(
                    t0_erc20.functions.balanceOf(w3.web3.to_checksum_address(job.sn_liquidity_manager_address)).call(),
                    t1_erc20.functions.balanceOf(w3.web3.to_checksum_address(job.sn_liquidity_manager_address)).call(),
                )
                idle0 = b0 / (10 ** token0_info["decimals"])
                idle1 = b1 / (10 ** token1_info["decimals"])
            except Exception:
                pass

            # Deployed in pool
            deployed0 = 0.0
            deployed1 = 0.0
            try:
                svc = SnLiqManagerService(
                    chain_id=job.chain_id,
                    liquidity_manager_address=job.sn_liquidity_manager_address,
                    pool_address=job.pair_address,
                )
                positions = await svc.get_current_positions()
                for pos in positions:
                    deployed0 += int(pos.allocation0) / (10 ** token0_info["decimals"])
                    deployed1 += int(pos.allocation1) / (10 ** token1_info["decimals"])
            except Exception:
                pass

            # Prices
            price0, price1 = await asyncio.gather(
                PriceService.get_token_price(token0_addr, job.chain_id),
                PriceService.get_token_price(token1_addr, job.chain_id),
            )

            total0 = idle0 + deployed0
            total1 = idle1 + deployed1
            idle_usd = idle0 * price0 + idle1 * price1
            deployed_usd = deployed0 * price0 + deployed1 * price1

            entry["total_value_usd"] = idle_usd + deployed_usd
            entry["idle_value_usd"] = idle_usd
            entry["deployed_value_usd"] = deployed_usd
            entry["token0"] = {"symbol": token0_info["symbol"], "balance": total0, "price_usd": price0}
            entry["token1"] = {"symbol": token1_info["symbol"], "balance": total1, "price_usd": price1}

        except Exception as e:
            logger.debug(f"Vault summary failed for {job.job_id}: {e}")

        results.append(entry)

    total_tvl = sum(r["total_value_usd"] for r in results)
    return {
        "total_tvl_usd": total_tvl,
        "vaults": results,
        "updated_at": datetime.utcnow().isoformat(),
    }


@router.get("/metagraph")
async def get_metagraph_snapshot(
    limit: int = Query(256, ge=1, le=512),
):
    """
    Get Bittensor metagraph snapshot for subnet 98.
    Returns per-UID: stake, incentive, emission, dividends, active, axon info.
    """
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

        return {
            "netuid": netuid,
            "block": int(meta.block) if hasattr(meta, 'block') else None,
            "total_neurons": len(meta.uids),
            "neurons": miners,
            "updated_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to fetch metagraph: {e}")
        return {
            "netuid": 98,
            "error": str(e),
            "neurons": [],
            "updated_at": datetime.utcnow().isoformat(),
        }
