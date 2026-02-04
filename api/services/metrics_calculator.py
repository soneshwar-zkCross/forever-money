"""
Metrics Calculator Service

Calculates metrics on-the-fly by reading validator data without modifying validator code.
Optionally stores snapshots in separate metrics tables for historical tracking.
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta

from validator.models.job import Job, Round, MinerScore, RoundStatus
from validator.repositories.pool import PoolDataDB
from validator.repositories.job import JobRepository
from validator.services.revenue import RevenueService
from validator.services.emissions import EmissionsService
from validator.services.price import PriceService
from validator.utils.web3 import AsyncWeb3Helper

from api.models.metrics import (
    MetricsSnapshot,
    JobMetrics,
    MinerMetrics,
    PairMetrics,
)

logger = logging.getLogger(__name__)


def _normalize_address(addr: str) -> str:
    """Return lowercase address with 0x prefix."""
    s = (addr or "").strip().lower()
    return s if s.startswith("0x") else "0x" + s


async def _resolve_pool_tokens(
    chain_id: int, pair_address: str
) -> Optional[Tuple[str, str]]:
    """Resolve token0 and token1 addresses from a pool contract."""
    try:
        w3 = AsyncWeb3Helper.make_web3(chain_id)
        pool = w3.make_contract_by_name("ICLPool", _normalize_address(pair_address))
        token0, token1 = await asyncio.gather(
            pool.functions.token0().call(),
            pool.functions.token1().call(),
        )
        return (token0, token1)
    except Exception as e:
        logger.debug(
            f"Pool {pair_address} not accessible (likely test data): {e}"
        )
        return None


async def _get_vault_balances(
    w3_helper: AsyncWeb3Helper,
    vault_address: str,
) -> Dict[str, float]:
    """Get current token balances from vault contract."""
    try:
        vault = w3_helper.make_contract_by_name(
            "SNLiquidityManager", _normalize_address(vault_address)
        )

        token0_balance = await vault.functions.balance0().call()
        token1_balance = await vault.functions.balance1().call()

        return {
            "token0_balance": float(token0_balance) / 1e18,
            "token1_balance": float(token1_balance) / 1e18,
        }
    except Exception as e:
        logger.debug(f"Vault {vault_address} not accessible (likely test data): {e}")
        return {
            "token0_balance": 0.0,
            "token1_balance": 0.0,
        }


class MetricsCalculator:
    """
    Calculates metrics on-the-fly without modifying validator code.

    Reads from validator's tables and services, writes to separate metrics tables.
    """

    @staticmethod
    async def calculate_job_tvl(job: Job) -> Dict[str, float]:
        """
        Calculate current TVL for a job by reading vault balances.

        Args:
            job: Job instance

        Returns:
            Dict with tvl_token0, tvl_token1, tvl_usd, token0_price_usd, token1_price_usd
        """
        try:
            # Resolve pool tokens
            tokens = await _resolve_pool_tokens(job.chain_id, job.pair_address)
            if not tokens:
                logger.warning(f"Could not resolve tokens for job {job.job_id}")
                return {
                    "tvl_token0": 0.0,
                    "tvl_token1": 0.0,
                    "tvl_usd": 0.0,
                    "token0_price_usd": 1.0,
                    "token1_price_usd": 1.0,
                }

            token0, token1 = tokens

            # Get current token prices
            price0 = await PriceService.get_token_price(token0, job.chain_id)
            price1 = await PriceService.get_token_price(token1, job.chain_id)

            # Get vault balances
            w3 = AsyncWeb3Helper.make_web3(job.chain_id)
            balances = await _get_vault_balances(w3, job.sn_liquidity_manager_address)

            tvl_token0 = balances["token0_balance"]
            tvl_token1 = balances["token1_balance"]
            tvl_usd = tvl_token0 * price0 + tvl_token1 * price1

            return {
                "tvl_token0": tvl_token0,
                "tvl_token1": tvl_token1,
                "tvl_usd": tvl_usd,
                "token0_price_usd": price0,
                "token1_price_usd": price1,
            }

        except Exception as e:
            logger.error(f"Failed to calculate TVL for job {job.job_id}: {e}")
            return {
                "tvl_token0": 0.0,
                "tvl_token1": 0.0,
                "tvl_usd": 0.0,
                "token0_price_usd": 1.0,
                "token1_price_usd": 1.0,
            }

    @staticmethod
    async def calculate_job_pnl(
        job: Job,
        pool_data_db: Optional[PoolDataDB] = None,
        lookback_days: int = 30,
    ) -> Dict[str, float]:
        """
        Calculate PnL for a job over a time period.

        PnL = Current TVL - Initial TVL (within lookback period)

        Args:
            job: Job instance
            pool_data_db: Optional pool data DB
            lookback_days: Number of days to look back

        Returns:
            Dict with pnl_usd, pnl_token0, pnl_token1, initial_tvl_usd, current_tvl_usd
        """
        try:
            # Get current TVL
            current_tvl_data = await MetricsCalculator.calculate_job_tvl(job)
            current_tvl_usd = current_tvl_data["tvl_usd"]
            current_token0 = current_tvl_data["tvl_token0"]
            current_token1 = current_tvl_data["tvl_token1"]

            # Get initial TVL from oldest completed round in lookback period
            cutoff_date = datetime.utcnow() - timedelta(days=lookback_days)
            initial_round = (
                await Round.filter(
                    job=job,
                    status=RoundStatus.COMPLETED,
                    created_at__gte=cutoff_date,
                )
                .order_by("round_number")
                .first()
            )

            if not initial_round:
                # No historical data, PnL = 0
                return {
                    "pnl_usd": 0.0,
                    "pnl_token0": 0.0,
                    "pnl_token1": 0.0,
                    "initial_tvl_usd": current_tvl_usd,
                    "current_tvl_usd": current_tvl_usd,
                }

            # Try to get TVL from stored metrics first
            initial_metrics = (
                await JobMetrics.filter(
                    job_id=job.job_id,
                    calculated_at__gte=cutoff_date,
                )
                .order_by("calculated_at")
                .first()
            )

            if initial_metrics:
                initial_tvl_usd = initial_metrics.tvl_usd
                initial_token0 = initial_metrics.tvl_token0
                initial_token1 = initial_metrics.tvl_token1
            else:
                # No stored metrics, assume initial TVL same as current (conservative)
                initial_tvl_usd = current_tvl_usd
                initial_token0 = current_token0
                initial_token1 = current_token1

            # Calculate PnL
            pnl_usd = current_tvl_usd - initial_tvl_usd
            pnl_token0 = current_token0 - initial_token0
            pnl_token1 = current_token1 - initial_token1

            return {
                "pnl_usd": pnl_usd,
                "pnl_token0": pnl_token0,
                "pnl_token1": pnl_token1,
                "initial_tvl_usd": initial_tvl_usd,
                "current_tvl_usd": current_tvl_usd,
            }

        except Exception as e:
            logger.error(f"Failed to calculate PnL for job {job.job_id}: {e}")
            return {
                "pnl_usd": 0.0,
                "pnl_token0": 0.0,
                "pnl_token1": 0.0,
                "initial_tvl_usd": 0.0,
                "current_tvl_usd": 0.0,
            }

    @staticmethod
    async def calculate_job_apy(
        job: Job,
        pool_data_db: Optional[PoolDataDB] = None,
        lookback_days: int = 30,
    ) -> Dict[str, float]:
        """
        Calculate APY for a job.

        APY = (Revenue / Average TVL) * (365 / days) * 100

        Args:
            job: Job instance
            pool_data_db: Optional pool data DB
            lookback_days: Number of days to calculate over

        Returns:
            Dict with apy_percent, revenue_usd, avg_tvl_usd
        """
        try:
            if not pool_data_db:
                return {
                    "apy_percent": 0.0,
                    "revenue_usd": 0.0,
                    "avg_tvl_usd": 0.0,
                }

            # Get revenue from RevenueService
            revenue_service = RevenueService(
                job_repository=JobRepository(), pool_data_db=pool_data_db
            )

            # Get total fees for this vault
            vault_fees = await pool_data_db.get_miner_vault_fees(
                sn_liquidity_manager_addresses=[job.sn_liquidity_manager_address],
                start_block=0,
                end_block=999999999,
            )

            vault_key = _normalize_address(job.sn_liquidity_manager_address).replace(
                "0x", ""
            )
            if vault_key not in vault_fees:
                return {
                    "apy_percent": 0.0,
                    "revenue_usd": 0.0,
                    "avg_tvl_usd": 0.0,
                }

            fees = vault_fees[vault_key]
            fee0_tokens = float(fees.get("fee0", 0.0)) / 1e18
            fee1_tokens = float(fees.get("fee1", 0.0)) / 1e18

            # Get token prices
            tokens = await _resolve_pool_tokens(job.chain_id, job.pair_address)
            if not tokens:
                return {
                    "apy_percent": 0.0,
                    "revenue_usd": 0.0,
                    "avg_tvl_usd": 0.0,
                }

            token0, token1 = tokens
            price0 = await PriceService.get_token_price(token0, job.chain_id)
            price1 = await PriceService.get_token_price(token1, job.chain_id)

            revenue_usd = fee0_tokens * price0 + fee1_tokens * price1

            # Get average TVL from stored metrics or current TVL
            cutoff_date = datetime.utcnow() - timedelta(days=lookback_days)
            recent_metrics = await JobMetrics.filter(
                job_id=job.job_id,
                calculated_at__gte=cutoff_date,
            ).all()

            if recent_metrics:
                avg_tvl_usd = sum(m.tvl_usd for m in recent_metrics) / len(
                    recent_metrics
                )
                avg_tvl_token0 = sum(m.tvl_token0 for m in recent_metrics) / len(
                    recent_metrics
                )
                avg_tvl_token1 = sum(m.tvl_token1 for m in recent_metrics) / len(
                    recent_metrics
                )
            else:
                # Use current TVL as approximation
                current_tvl = await MetricsCalculator.calculate_job_tvl(job)
                avg_tvl_usd = current_tvl["tvl_usd"]
                avg_tvl_token0 = current_tvl["tvl_token0"]
                avg_tvl_token1 = current_tvl["tvl_token1"]

            # Calculate APY (USD)
            if avg_tvl_usd > 0:
                apy_percent = (
                    (revenue_usd / avg_tvl_usd) * (365.0 / lookback_days) * 100.0
                )
            else:
                apy_percent = 0.0

            # Calculate APY (Token0)
            if avg_tvl_token0 > 0:
                apy_percent_token0 = (
                    (fee0_tokens / avg_tvl_token0) * (365.0 / lookback_days) * 100.0
                )
            else:
                apy_percent_token0 = 0.0

            # Calculate APY (Token1)
            if avg_tvl_token1 > 0:
                apy_percent_token1 = (
                    (fee1_tokens / avg_tvl_token1) * (365.0 / lookback_days) * 100.0
                )
            else:
                apy_percent_token1 = 0.0

            return {
                "apy_percent": apy_percent,
                "apy_percent_token0": apy_percent_token0,
                "apy_percent_token1": apy_percent_token1,
                "revenue_usd": revenue_usd,
                "revenue_token0": fee0_tokens,
                "revenue_token1": fee1_tokens,
                "avg_tvl_usd": avg_tvl_usd,
                "avg_tvl_token0": avg_tvl_token0,
                "avg_tvl_token1": avg_tvl_token1,
            }

        except Exception as e:
            logger.error(f"Failed to calculate APY for job {job.job_id}: {e}")
            return {
                "apy_percent": 0.0,
                "revenue_usd": 0.0,
                "avg_tvl_usd": 0.0,
            }

    @staticmethod
    async def calculate_and_store_job_metrics(
        job: Job,
        pool_data_db: Optional[PoolDataDB] = None,
    ) -> JobMetrics:
        """
        Calculate all metrics for a job and store snapshot.

        Args:
            job: Job instance
            pool_data_db: Optional pool data DB

        Returns:
            JobMetrics instance
        """
        try:
            # Calculate all metrics
            tvl_data = await MetricsCalculator.calculate_job_tvl(job)
            pnl_data = await MetricsCalculator.calculate_job_pnl(
                job, pool_data_db, lookback_days=30
            )
            apy_data = await MetricsCalculator.calculate_job_apy(
                job, pool_data_db, lookback_days=30
            )

            # Get round count
            round_count = await Round.filter(job=job).count()
            last_round = await Round.filter(job=job).order_by("-round_number").first()
            last_round_number = last_round.round_number if last_round else 0

            # Get revenue
            if pool_data_db:
                vault_fees = await pool_data_db.get_miner_vault_fees(
                    sn_liquidity_manager_addresses=[job.sn_liquidity_manager_address],
                    start_block=0,
                    end_block=999999999,
                )
                vault_key = _normalize_address(job.sn_liquidity_manager_address).replace(
                    "0x", ""
                )
                fees = vault_fees.get(vault_key, {"fee0": 0.0, "fee1": 0.0})
                revenue_token0 = float(fees.get("fee0", 0.0)) / 1e18
                revenue_token1 = float(fees.get("fee1", 0.0)) / 1e18
                revenue_usd = (
                    revenue_token0 * tvl_data["token0_price_usd"]
                    + revenue_token1 * tvl_data["token1_price_usd"]
                )
            else:
                revenue_token0 = 0.0
                revenue_token1 = 0.0
                revenue_usd = 0.0

            # Create snapshot
            metrics = await JobMetrics.create(
                job_id=job.job_id,
                tvl_token0=tvl_data["tvl_token0"],
                tvl_token1=tvl_data["tvl_token1"],
                tvl_usd=tvl_data["tvl_usd"],
                token0_price_usd=tvl_data["token0_price_usd"],
                token1_price_usd=tvl_data["token1_price_usd"],
                revenue_token0=revenue_token0,
                revenue_token1=revenue_token1,
                revenue_usd=revenue_usd,
                pnl_token0=pnl_data["pnl_token0"],
                pnl_token1=pnl_data["pnl_token1"],
                pnl_usd=pnl_data["pnl_usd"],
                apy_percent=apy_data["apy_percent"],
                round_count=round_count,
                last_round_number=last_round_number,
            )

            logger.info(f"Stored metrics for job {job.job_id}: TVL=${tvl_data['tvl_usd']:.2f}, PnL=${pnl_data['pnl_usd']:.2f}, APY={apy_data['apy_percent']:.2f}%")

            return metrics

        except Exception as e:
            logger.error(
                f"Failed to calculate and store metrics for job {job.job_id}: {e}"
            )
            raise

    @staticmethod
    async def calculate_miner_win_rate(miner_uid: int, job_id: Optional[str] = None) -> float:
        """
        Calculate win rate for a miner.

        Args:
            miner_uid: Miner UID
            job_id: Optional job ID to filter by

        Returns:
            Win rate as percentage (0-100)
        """
        try:
            # Get all completed rounds where miner participated
            query = Round.filter(
                status=RoundStatus.COMPLETED,
                predictions__miner_uid=miner_uid,
            )

            if job_id:
                query = query.filter(job__job_id=job_id)

            total_participations = await query.count()

            if total_participations == 0:
                return 0.0

            # Count wins
            wins = await query.filter(winner_uid=miner_uid).count()

            win_rate = (wins / total_participations) * 100.0

            return win_rate

        except Exception as e:
            logger.error(f"Failed to calculate win rate for miner {miner_uid}: {e}")
            return 0.0
