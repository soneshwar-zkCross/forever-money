"""
Metrics Service

Aggregates metrics from validator services for subnet-wide analytics.
Provides revenue, emissions, and performance metrics.
"""
import logging
import time
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta

from validator.services.revenue import RevenueService
from validator.services.emissions import EmissionsService
from validator.services.price import PriceService
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from validator.models.job import Job, MinerScore
from api.utils.bittensor_client import BittensorClient

logger = logging.getLogger(__name__)


class MetricsService:
    """Service for aggregating subnet-wide metrics."""

    # Simple in-memory cache
    _cache: Dict[str, Tuple[Any, float]] = {}
    CACHE_TTL = 60  # 60 seconds

    @classmethod
    def _get_cached(cls, key: str) -> Optional[Any]:
        """Get cached data if valid."""
        if key in cls._cache:
            data, timestamp = cls._cache[key]
            if time.time() - timestamp < cls.CACHE_TTL:
                logger.debug(f"Cache hit for {key}")
                return data
            else:
                # Expired, remove from cache
                del cls._cache[key]
        return None

    @classmethod
    def _set_cache(cls, key: str, data: Any):
        """Set cached data with current timestamp."""
        cls._cache[key] = (data, time.time())

    @classmethod
    async def get_subnet_revenue(
        cls,
        job_repository: JobRepository,
        pool_data_db: Optional[PoolDataDB] = None,
        lookback_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Get total subnet revenue across all vaults.

        Args:
            job_repository: Job repository instance
            pool_data_db: Pool data database instance
            lookback_days: Number of days to look back

        Returns:
            Dict with revenue metrics
        """
        cache_key = f"subnet_revenue_{lookback_days}"
        cached = cls._get_cached(cache_key)
        if cached is not None:
            return cached

        revenue_service = RevenueService(job_repository, pool_data_db)

        try:
            # Get total revenue across all vaults
            total_revenue_usd = await revenue_service.get_total_vault_revenue_usd(
                lookback_days=lookback_days
            )

            # Get per-vault breakdown
            active_jobs = await job_repository.get_active_jobs()
            vault_revenues = []

            for job in active_jobs:
                try:
                    # Get fees for this vault
                    vault_fees = await cls._get_vault_revenue(
                        job, pool_data_db, lookback_days
                    )
                    vault_revenues.append({
                        "job_id": job.job_id,
                        "vault_address": job.sn_liquidity_manager_address,
                        "pair_address": job.pair_address,
                        "revenue_usd": vault_fees["revenue_usd"],
                        "revenue_token0": vault_fees["revenue_token0"],
                        "revenue_token1": vault_fees["revenue_token1"],
                    })
                except Exception as e:
                    logger.warning(f"Failed to get revenue for job {job.job_id}: {e}")
                    continue

            result = {
                "total_revenue_usd": total_revenue_usd,
                "lookback_days": lookback_days,
                "vault_count": len(active_jobs),
                "vault_revenues": vault_revenues,
                "updated_at": datetime.utcnow().isoformat(),
            }

            cls._set_cache(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Failed to get subnet revenue: {e}")
            return {
                "total_revenue_usd": 0.0,
                "lookback_days": lookback_days,
                "vault_count": 0,
                "vault_revenues": [],
                "updated_at": datetime.utcnow().isoformat(),
                "error": str(e),
            }

    @classmethod
    async def _get_vault_revenue(
        cls,
        job: Job,
        pool_data_db: Optional[PoolDataDB],
        lookback_days: int,
    ) -> Dict[str, float]:
        """Get revenue for a single vault."""
        if not pool_data_db:
            return {"revenue_usd": 0.0, "revenue_token0": 0.0, "revenue_token1": 0.0}

        try:
            # Get vault fees from pool data
            vault_fees = await pool_data_db.get_miner_vault_fees(
                sn_liquidity_manager_addresses=[job.sn_liquidity_manager_address],
                start_block=0,
                end_block=999999999,
            )

            if job.sn_liquidity_manager_address not in vault_fees:
                return {"revenue_usd": 0.0, "revenue_token0": 0.0, "revenue_token1": 0.0}

            fees = vault_fees[job.sn_liquidity_manager_address]
            fee0_wei = fees.get("fee0", 0.0)
            fee1_wei = fees.get("fee1", 0.0)

            # Convert from wei to tokens
            fee0_tokens = float(fee0_wei) / 1e18
            fee1_tokens = float(fee1_wei) / 1e18

            # Simplified USD conversion (token0 = $1, token1 = $1)
            # TODO: Use actual token prices from PriceService
            revenue_usd = fee0_tokens + fee1_tokens

            return {
                "revenue_usd": revenue_usd,
                "revenue_token0": fee0_tokens,
                "revenue_token1": fee1_tokens,
            }

        except Exception as e:
            logger.error(f"Failed to get vault revenue for {job.job_id}: {e}")
            return {"revenue_usd": 0.0, "revenue_token0": 0.0, "revenue_token1": 0.0}

    @classmethod
    async def get_subnet_emissions(
        cls,
        job_repository: JobRepository,
        pool_data_db: Optional[PoolDataDB] = None,
    ) -> Dict[str, Any]:
        """
        Get subnet emissions breakdown.

        Returns:
            Dict with emissions metrics
        """
        cache_key = "subnet_emissions"
        cached = cls._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            # Initialize Bittensor client
            metagraph = BittensorClient.get_metagraph()
            subtensor = BittensorClient.get_subtensor()
            netuid = BittensorClient.get_netuid()

            # Create emissions service
            revenue_service = RevenueService(job_repository, pool_data_db)
            emissions_service = EmissionsService(
                metagraph=metagraph,
                subtensor=subtensor,
                job_repository=job_repository,
                revenue_service=revenue_service,
            )

            # Calculate emissions split
            burn_ratio, miner_ratio = await emissions_service.calculate_emissions_split()

            # Get total emissions
            total_emission_rao = sum(metagraph.emission)
            total_emission_alpha = float(total_emission_rao) / 1e9

            # Calculate emissions in Alpha
            burn_alpha = total_emission_alpha * burn_ratio
            miner_alpha = total_emission_alpha * miner_ratio

            # Get Alpha price for USD conversion
            alpha_price_usd = await PriceService.get_alpha_price_usd(subtensor, netuid)

            # Calculate USD values
            burn_usd = burn_alpha * alpha_price_usd
            miner_usd = miner_alpha * alpha_price_usd
            total_usd = total_emission_alpha * alpha_price_usd

            # Get revenue for context
            revenue_usd = await emissions_service.get_vault_revenue_usd()

            result = {
                "total_emissions_alpha": total_emission_alpha,
                "total_emissions_usd": total_usd,
                "burn_ratio": burn_ratio,
                "miner_ratio": miner_ratio,
                "burn_alpha": burn_alpha,
                "burn_usd": burn_usd,
                "miner_alpha": miner_alpha,
                "miner_usd": miner_usd,
                "alpha_price_usd": alpha_price_usd,
                "vault_revenue_usd": revenue_usd,
                "profit_ratio": miner_ratio / (revenue_usd / (total_emission_alpha * alpha_price_usd)) if revenue_usd > 0 and total_emission_alpha > 0 else 1.0,
                "updated_at": datetime.utcnow().isoformat(),
            }

            cls._set_cache(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Failed to get subnet emissions: {e}")
            return {
                "total_emissions_alpha": 0.0,
                "total_emissions_usd": 0.0,
                "burn_ratio": 1.0,
                "miner_ratio": 0.0,
                "burn_alpha": 0.0,
                "burn_usd": 0.0,
                "miner_alpha": 0.0,
                "miner_usd": 0.0,
                "alpha_price_usd": 0.0,
                "vault_revenue_usd": 0.0,
                "profit_ratio": 1.0,
                "updated_at": datetime.utcnow().isoformat(),
                "error": str(e),
            }

    @classmethod
    async def get_top_earners(
        cls,
        job_repository: JobRepository,
        pool_data_db: Optional[PoolDataDB] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Get top earning miners ranked by estimated earnings.

        Args:
            job_repository: Job repository instance
            pool_data_db: Pool data database instance
            limit: Number of top earners to return

        Returns:
            List of top earner dicts
        """
        cache_key = f"top_earners_{limit}"
        cached = cls._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            # Initialize Bittensor client
            metagraph = BittensorClient.get_metagraph()
            subtensor = BittensorClient.get_subtensor()
            netuid = BittensorClient.get_netuid()

            # Create emissions service
            revenue_service = RevenueService(job_repository, pool_data_db)
            emissions_service = EmissionsService(
                metagraph=metagraph,
                subtensor=subtensor,
                job_repository=job_repository,
                revenue_service=revenue_service,
            )

            # Get miner aggregate scores
            miner_scores = await emissions_service.get_miner_aggregate_scores()

            if not miner_scores:
                return []

            # Calculate total emissions available to miners
            burn_ratio, miner_ratio = await emissions_service.calculate_emissions_split()
            total_emission_rao = sum(metagraph.emission)
            total_emission_alpha = float(total_emission_rao) / 1e9
            miner_pool_alpha = total_emission_alpha * miner_ratio

            # Get Alpha price
            alpha_price_usd = await PriceService.get_alpha_price_usd(subtensor, netuid)

            # Calculate earnings per miner based on score proportion
            total_score = sum(miner_scores.values())
            earners = []

            for uid, score in miner_scores.items():
                if uid == 0:  # Skip burn UID
                    continue

                # Calculate earnings based on score proportion
                if total_score > 0:
                    earnings_alpha = (score / total_score) * miner_pool_alpha
                    earnings_usd = earnings_alpha * alpha_price_usd
                else:
                    earnings_alpha = 0.0
                    earnings_usd = 0.0

                # Get hotkey from metagraph
                hotkey = "unknown"
                try:
                    uid_index = metagraph.uids.tolist().index(uid)
                    hotkey = metagraph.hotkeys[uid_index]
                except (ValueError, IndexError):
                    pass

                earners.append({
                    "miner_uid": uid,
                    "miner_hotkey": hotkey,
                    "score": score,
                    "estimated_earnings_alpha": earnings_alpha,
                    "estimated_earnings_usd": earnings_usd,
                    "score_percentage": (score / total_score * 100) if total_score > 0 else 0.0,
                })

            # Sort by earnings and take top N
            earners.sort(key=lambda x: x["estimated_earnings_alpha"], reverse=True)
            top_earners = earners[:limit]

            cls._set_cache(cache_key, top_earners)
            return top_earners

        except Exception as e:
            logger.error(f"Failed to get top earners: {e}")
            return []

    @classmethod
    async def get_pair_performance(
        cls,
        job_repository: JobRepository,
        pool_data_db: Optional[PoolDataDB] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get performance metrics aggregated by pair.

        Returns:
            List of pair performance dicts
        """
        cache_key = "pair_performance"
        cached = cls._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            active_jobs = await job_repository.get_active_jobs()
            pair_stats = {}

            for job in active_jobs:
                pair_key = job.pair_address

                if pair_key not in pair_stats:
                    pair_stats[pair_key] = {
                        "pair_address": job.pair_address,
                        "vault_count": 0,
                        "total_revenue_usd": 0.0,
                        "total_revenue_token0": 0.0,
                        "total_revenue_token1": 0.0,
                        "total_miners": 0,
                        "jobs": [],
                    }

                # Get revenue for this vault
                vault_revenue = await cls._get_vault_revenue(job, pool_data_db, 30)

                # Get miner count
                miner_count = await MinerScore.filter(job=job).count()

                pair_stats[pair_key]["vault_count"] += 1
                pair_stats[pair_key]["total_revenue_usd"] += vault_revenue["revenue_usd"]
                pair_stats[pair_key]["total_revenue_token0"] += vault_revenue["revenue_token0"]
                pair_stats[pair_key]["total_revenue_token1"] += vault_revenue["revenue_token1"]
                pair_stats[pair_key]["total_miners"] += miner_count
                pair_stats[pair_key]["jobs"].append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "revenue_usd": vault_revenue["revenue_usd"],
                    "miner_count": miner_count,
                })

            # Convert to list and sort by revenue
            result = list(pair_stats.values())
            result.sort(key=lambda x: x["total_revenue_usd"], reverse=True)

            cls._set_cache(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Failed to get pair performance: {e}")
            return []
