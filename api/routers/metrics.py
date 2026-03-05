"""
Metrics Router

Endpoints for subnet-wide metrics and analytics.
Handles missing api.models.metrics tables gracefully by falling through
to direct DB calculations from validator tables.
"""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
import logging

from api.models.responses import (
    SubnetRevenueResponse,
    SubnetEmissionsResponse,
    TopEarnerResponse,
    PairPerformanceResponse,
    VaultRevenueResponse,
    PairJobResponse,
    JobTVLResponse,
    JobPnLResponse,
    JobAPYResponse,
    SubnetTVLResponse,
    SubnetPnLResponse,
    ErrorResponse,
)
from api.services.metrics_service import MetricsService
from api.services.metrics_calculator import MetricsCalculator
from api.services.reader_db_metrics import ReaderDBMetricsService
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from validator.models.job import Job, MinerScore, Round, RoundStatus

logger = logging.getLogger(__name__)

router = APIRouter()

# Lazy initialization of repositories
_job_repository: Optional[JobRepository] = None
_pool_data_db: Optional[PoolDataDB] = None


def get_job_repository() -> JobRepository:
    """Get or create job repository instance."""
    global _job_repository
    if _job_repository is None:
        _job_repository = JobRepository()
    return _job_repository


def get_pool_data_db() -> Optional[PoolDataDB]:
    """Get or create pool data DB instance."""
    global _pool_data_db
    if _pool_data_db is None:
        try:
            _pool_data_db = PoolDataDB()
        except Exception:
            _pool_data_db = None
    return _pool_data_db


async def _try_stored_metrics(query_fn):
    """Try to query stored metrics tables, return None if tables don't exist."""
    try:
        return await query_fn()
    except Exception as e:
        if "does not exist" in str(e):
            logger.debug(f"Stored metrics table not available: {e}")
            return None
        raise


@router.get("/subnet/revenue", response_model=SubnetRevenueResponse)
async def get_subnet_revenue(
    lookback_days: int = Query(30, description="Number of days to look back", ge=1, le=365)
):
    """Get total revenue across all vaults in the subnet."""
    try:
        # Try stored metrics first
        from api.models.metrics import JobMetrics
        latest_metrics = await _try_stored_metrics(
            lambda: JobMetrics.all().order_by("-calculated_at").limit(100)
        )

        if latest_metrics:
            job_metrics_by_id = {}
            for metric in latest_metrics:
                if metric.job_id not in job_metrics_by_id:
                    job_metrics_by_id[metric.job_id] = metric

            total_revenue_usd = sum(m.revenue_usd for m in job_metrics_by_id.values())
            vault_revenues = []
            for job_id, metric in job_metrics_by_id.items():
                job = await Job.filter(job_id=job_id).first()
                if job:
                    vault_revenues.append(VaultRevenueResponse(
                        job_id=job_id,
                        vault_address=job.sn_liquidity_manager_address,
                        pair_address=job.pair_address,
                        revenue_usd=metric.revenue_usd,
                        revenue_token0=metric.revenue_token0,
                        revenue_token1=metric.revenue_token1,
                    ))

            return SubnetRevenueResponse(
                total_revenue_usd=total_revenue_usd,
                lookback_days=lookback_days,
                vault_count=len(vault_revenues),
                vault_revenues=vault_revenues,
                updated_at=datetime.now().isoformat(),
                error=None,
            )

        # Fall back: calculate revenue from reader DB collects table
        all_jobs = await Job.all()
        vault_revenues = []
        total_revenue_usd = 0.0

        for j in all_jobs:
            try:
                rev = await ReaderDBMetricsService.get_vault_revenue(
                    j.pair_address, j.sn_liquidity_manager_address
                )
                rev0 = rev["revenue_token0"]
                rev1 = rev["revenue_token1"]
                prices = await ReaderDBMetricsService.get_token_prices(j)
                rev_usd = ReaderDBMetricsService.tokens_to_usd(
                    rev0, rev1, prices["price0"], prices["price1"]
                )
                total_revenue_usd += rev_usd
                vault_revenues.append(VaultRevenueResponse(
                    job_id=j.job_id,
                    vault_address=j.sn_liquidity_manager_address,
                    pair_address=j.pair_address,
                    revenue_usd=rev_usd,
                    revenue_token0=rev0,
                    revenue_token1=rev1,
                ))
            except Exception:
                vault_revenues.append(VaultRevenueResponse(
                    job_id=j.job_id,
                    vault_address=j.sn_liquidity_manager_address,
                    pair_address=j.pair_address,
                    revenue_usd=0.0,
                    revenue_token0=0.0,
                    revenue_token1=0.0,
                ))

        return SubnetRevenueResponse(
            total_revenue_usd=total_revenue_usd,
            lookback_days=lookback_days,
            vault_count=len(all_jobs),
            vault_revenues=vault_revenues,
            updated_at=datetime.now().isoformat(),
            error=None,
        )
    except Exception as e:
        logger.error(f"Failed to get subnet revenue: {e}")
        return SubnetRevenueResponse(
            total_revenue_usd=0.0,
            lookback_days=lookback_days,
            vault_count=0,
            vault_revenues=[],
            updated_at=datetime.now().isoformat(),
            error=str(e),
        )


@router.get("/subnet/emissions", response_model=SubnetEmissionsResponse)
async def get_subnet_emissions():
    """Get subnet emissions breakdown."""
    try:
        # Try stored snapshots first
        from api.models.metrics import SubnetMetricsSnapshot
        latest_snapshot = await _try_stored_metrics(
            lambda: SubnetMetricsSnapshot.all().order_by("-snapshot_time").first()
        )

        if latest_snapshot:
            return SubnetEmissionsResponse(
                total_emissions_alpha=latest_snapshot.total_emissions_alpha,
                total_emissions_usd=latest_snapshot.total_emissions_usd,
                burn_ratio=latest_snapshot.burn_ratio,
                miner_ratio=latest_snapshot.miner_ratio,
                burn_alpha=latest_snapshot.total_emissions_alpha * latest_snapshot.burn_ratio,
                burn_usd=latest_snapshot.total_emissions_usd * latest_snapshot.burn_ratio,
                miner_alpha=latest_snapshot.total_emissions_alpha * latest_snapshot.miner_ratio,
                miner_usd=latest_snapshot.total_emissions_usd * latest_snapshot.miner_ratio,
                alpha_price_usd=latest_snapshot.alpha_price_usd,
                vault_revenue_usd=latest_snapshot.total_revenue_usd,
                profit_ratio=latest_snapshot.profit_ratio,
                updated_at=latest_snapshot.snapshot_time.isoformat(),
                error=None,
            )

        # Fall back to calculating from Bittensor
        try:
            job_repo = get_job_repository()
            pool_db = get_pool_data_db()
            result = await MetricsService.get_subnet_emissions(
                job_repository=job_repo,
                pool_data_db=pool_db,
            )
            return SubnetEmissionsResponse(**result)
        except Exception as calc_err:
            logger.warning(f"Emissions calculation failed: {calc_err}")
            # Return zero-value response
            return SubnetEmissionsResponse(
                total_emissions_alpha=0.0,
                total_emissions_usd=0.0,
                burn_ratio=0.0,
                miner_ratio=0.0,
                burn_alpha=0.0,
                burn_usd=0.0,
                miner_alpha=0.0,
                miner_usd=0.0,
                alpha_price_usd=0.0,
                vault_revenue_usd=0.0,
                profit_ratio=0.0,
                updated_at=datetime.now().isoformat(),
                error=str(calc_err),
            )
    except Exception as e:
        logger.error(f"Failed to get subnet emissions: {e}")
        return SubnetEmissionsResponse(
            total_emissions_alpha=0.0,
            total_emissions_usd=0.0,
            burn_ratio=0.0,
            miner_ratio=0.0,
            burn_alpha=0.0,
            burn_usd=0.0,
            miner_alpha=0.0,
            miner_usd=0.0,
            alpha_price_usd=0.0,
            vault_revenue_usd=0.0,
            profit_ratio=0.0,
            updated_at=datetime.now().isoformat(),
            error=str(e),
        )


@router.get("/top-earners", response_model=List[TopEarnerResponse])
async def get_top_earners(
    limit: int = Query(10, description="Number of top earners to return", ge=1, le=100)
):
    """Get top earning miners ranked by score from the miner_scores table."""
    try:
        # Try stored miner metrics first
        from api.models.metrics import MinerMetrics
        miner_metrics = await _try_stored_metrics(
            lambda: MinerMetrics.all().order_by("-estimated_earnings_alpha").limit(limit)
        )

        if miner_metrics:
            total_score_sum = sum(m.total_score for m in miner_metrics)
            return [
                TopEarnerResponse(
                    miner_uid=m.miner_uid,
                    miner_hotkey=m.miner_hotkey,
                    score=m.total_score,
                    estimated_earnings_alpha=m.estimated_earnings_alpha,
                    estimated_earnings_usd=m.estimated_earnings_usd,
                    score_percentage=m.total_score / total_score_sum if total_score_sum > 0 else 0.0,
                )
                for m in miner_metrics
            ]

        # Fall back: calculate from rounds winners + miner_scores (pure DB)
        logger.info("Calculating top earners from rounds winners + miner_scores")

        # Get win counts from completed rounds (real performance data)
        from tortoise.functions import Count
        conn = MinerScore._meta.db  # type: ignore
        if conn is None:
            from tortoise import Tortoise
            conn = Tortoise.get_connection("default")

        win_rows = await conn.execute_query(
            "SELECT winner_uid, COUNT(*) as wins FROM rounds "
            "WHERE winner_uid IS NOT NULL AND status='completed' AND winner_uid != 0 "
            "GROUP BY winner_uid ORDER BY wins DESC LIMIT $1",
            [limit],
        )

        if win_rows[1]:
            # Build results from win data + miner_scores for hotkeys
            results = []
            total_wins = sum(r["wins"] for r in win_rows[1])

            for row in win_rows[1]:
                uid = row["winner_uid"]
                wins = row["wins"]
                # Get hotkey from miner_scores
                score = await MinerScore.filter(miner_uid=uid).first()
                hotkey = score.miner_hotkey if score else f"UID_{uid}"

                results.append(
                    TopEarnerResponse(
                        miner_uid=uid,
                        miner_hotkey=hotkey,
                        score=float(wins),
                        estimated_earnings_alpha=0.0,
                        estimated_earnings_usd=0.0,
                        score_percentage=wins / total_wins if total_wins > 0 else 0.0,
                    )
                )
            return results

        # Final fallback: use miner_scores directly
        all_scores = await MinerScore.all().order_by("-combined_score").limit(limit)
        total_score_sum = sum(float(s.combined_score) for s in all_scores) or 1.0

        return [
            TopEarnerResponse(
                miner_uid=s.miner_uid,
                miner_hotkey=s.miner_hotkey,
                score=float(s.combined_score),
                estimated_earnings_alpha=0.0,
                estimated_earnings_usd=0.0,
                score_percentage=float(s.combined_score) / total_score_sum if total_score_sum != 0 else 0.0,
            )
            for s in all_scores
        ]
    except Exception as e:
        logger.error(f"Failed to get top earners: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get top earners: {str(e)}")


@router.get("/pairs/performance", response_model=List[PairPerformanceResponse])
async def get_pair_performance():
    """Get performance metrics aggregated by trading pair (from DB)."""
    try:
        # Try stored pair metrics first
        from api.models.metrics import PairMetrics
        pair_metrics = await _try_stored_metrics(
            lambda: PairMetrics.all().order_by("-total_revenue_usd")
        )

        if pair_metrics:
            result = []
            for pair_metric in pair_metrics:
                jobs = []
                if pair_metric.job_breakdown:
                    for job_id, breakdown in pair_metric.job_breakdown.items():
                        job = await Job.filter(job_id=job_id).first()
                        if job:
                            miner_count = await MinerScore.filter(job=job).distinct().count()
                            jobs.append(PairJobResponse(
                                job_id=job_id,
                                vault_address=job.sn_liquidity_manager_address,
                                revenue_usd=breakdown.get("revenue", 0),
                                miner_count=miner_count,
                            ))

                result.append(
                    PairPerformanceResponse(
                        pair_address=pair_metric.pair_address,
                        vault_count=pair_metric.active_jobs_count,
                        total_revenue_usd=pair_metric.total_revenue_usd,
                        total_revenue_token0=0.0,
                        total_revenue_token1=0.0,
                        total_miners=pair_metric.total_miners,
                        jobs=jobs,
                    )
                )
            return result

        # Fall back: calculate directly from Job + MinerScore + reader DB
        logger.info("Calculating pair performance from validator tables + reader DB")
        all_jobs = await Job.all()
        pair_stats = {}

        for job in all_jobs:
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

            miner_count = await MinerScore.filter(job=job).count()

            # Get real revenue from reader DB
            job_rev_usd = 0.0
            try:
                rev = await ReaderDBMetricsService.get_vault_revenue(
                    job.pair_address, job.sn_liquidity_manager_address
                )
                prices = await ReaderDBMetricsService.get_token_prices(job)
                job_rev_usd = ReaderDBMetricsService.tokens_to_usd(
                    rev["revenue_token0"], rev["revenue_token1"],
                    prices["price0"], prices["price1"],
                )
                pair_stats[pair_key]["total_revenue_usd"] += job_rev_usd
                pair_stats[pair_key]["total_revenue_token0"] += rev["revenue_token0"]
                pair_stats[pair_key]["total_revenue_token1"] += rev["revenue_token1"]
            except Exception:
                pass

            pair_stats[pair_key]["vault_count"] += 1
            pair_stats[pair_key]["total_miners"] += miner_count
            pair_stats[pair_key]["jobs"].append(PairJobResponse(
                job_id=job.job_id,
                vault_address=job.sn_liquidity_manager_address,
                revenue_usd=job_rev_usd,
                miner_count=miner_count,
            ))

        result = sorted(pair_stats.values(), key=lambda x: x["total_miners"], reverse=True)
        return [
            PairPerformanceResponse(
                pair_address=p["pair_address"],
                vault_count=p["vault_count"],
                total_revenue_usd=p["total_revenue_usd"],
                total_revenue_token0=p["total_revenue_token0"],
                total_revenue_token1=p["total_revenue_token1"],
                total_miners=p["total_miners"],
                jobs=p["jobs"],
            )
            for p in result
        ]
    except Exception as e:
        logger.error(f"Failed to get pair performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pair performance: {str(e)}")


@router.get("/jobs/{job_id}/tvl", response_model=JobTVLResponse)
async def get_job_tvl(job_id: str):
    """Get current TVL for a specific job/vault."""
    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Tier 1: stored metrics (from background snapshot task)
    try:
        from api.models.metrics import JobMetrics
        latest_metric = await _try_stored_metrics(
            lambda: JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()
        )

        if latest_metric and (latest_metric.tvl_usd or 0) > 0:
            logger.debug(f"TVL [{job_id}]: served from stored metrics (${latest_metric.tvl_usd:.2f})")
            return JobTVLResponse(
                job_id=job_id,
                tvl_token0=latest_metric.tvl_token0,
                tvl_token1=latest_metric.tvl_token1,
                tvl_usd=latest_metric.tvl_usd,
                token0_price_usd=latest_metric.token0_price_usd,
                token1_price_usd=latest_metric.token1_price_usd,
                updated_at=latest_metric.calculated_at.isoformat(),
            )
    except Exception as e:
        logger.debug(f"TVL [{job_id}]: stored metrics failed: {e}")

    # Tier 2: on-chain calculation (Web3 RPC)
    try:
        tvl_data = await MetricsCalculator.calculate_job_tvl(job)
        if tvl_data["tvl_token0"] > 0 or tvl_data["tvl_token1"] > 0:
            logger.debug(f"TVL [{job_id}]: served from on-chain calc (${tvl_data['tvl_usd']:.2f})")
            return JobTVLResponse(
                job_id=job_id,
                tvl_token0=tvl_data["tvl_token0"],
                tvl_token1=tvl_data["tvl_token1"],
                tvl_usd=tvl_data["tvl_usd"],
                token0_price_usd=tvl_data.get("token0_price_usd", 0.0),
                token1_price_usd=tvl_data.get("token1_price_usd", 0.0),
                updated_at=datetime.now().isoformat(),
            )
    except Exception as e:
        logger.debug(f"TVL [{job_id}]: on-chain calc failed: {e}")

    # Tier 3: approximate TVL from mints - burns in reader DB
    try:
        tvl_approx = await ReaderDBMetricsService.get_pool_tvl_approx(job.pair_address, job.sn_liquidity_manager_address)
        prices = await ReaderDBMetricsService.get_token_prices(job)
        tvl_usd = ReaderDBMetricsService.tokens_to_usd(
            tvl_approx["tvl_token0"], tvl_approx["tvl_token1"],
            prices["price0"], prices["price1"],
        )
        logger.info(
            f"TVL [{job_id}]: reader DB approx: "
            f"t0={tvl_approx['tvl_token0']:.6f} t1={tvl_approx['tvl_token1']:.6f} "
            f"p0=${prices['price0']:.4f} p1=${prices['price1']:.4f} "
            f"tvl=${tvl_usd:.2f}"
        )
        return JobTVLResponse(
            job_id=job_id,
            tvl_token0=tvl_approx["tvl_token0"],
            tvl_token1=tvl_approx["tvl_token1"],
            tvl_usd=tvl_usd,
            token0_price_usd=prices["price0"],
            token1_price_usd=prices["price1"],
            updated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        logger.warning(f"TVL [{job_id}]: all fallbacks exhausted: {e}")
        return JobTVLResponse(
            job_id=job_id,
            tvl_token0=0.0,
            tvl_token1=0.0,
            tvl_usd=0.0,
            token0_price_usd=0.0,
            token1_price_usd=0.0,
            updated_at=datetime.now().isoformat(),
        )


@router.get("/jobs/{job_id}/pnl", response_model=JobPnLResponse)
async def get_job_pnl(
    job_id: str,
    lookback_days: int = Query(30, ge=1, le=365)
):
    """Get PnL for a specific job/vault."""
    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        from api.models.metrics import JobMetrics
        cutoff = datetime.now() - timedelta(days=lookback_days)
        initial_metric = await _try_stored_metrics(
            lambda: JobMetrics.filter(job_id=job_id, calculated_at__gte=cutoff).order_by("calculated_at").first()
        )
        latest_metric = await _try_stored_metrics(
            lambda: JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()
        )

        if initial_metric and latest_metric:
            return JobPnLResponse(
                job_id=job_id,
                pnl_usd=latest_metric.tvl_usd - initial_metric.tvl_usd,
                pnl_token0=latest_metric.tvl_token0 - initial_metric.tvl_token0,
                pnl_token1=latest_metric.tvl_token1 - initial_metric.tvl_token1,
                initial_tvl_usd=initial_metric.tvl_usd,
                current_tvl_usd=latest_metric.tvl_usd,
                lookback_days=lookback_days,
                updated_at=latest_metric.calculated_at.isoformat(),
            )
    except Exception:
        pass

    # Fallback: use vault revenue from collects as a proxy for PnL
    try:
        rev = await ReaderDBMetricsService.get_vault_revenue(
            job.pair_address, job.sn_liquidity_manager_address
        )
        tvl_approx = await ReaderDBMetricsService.get_pool_tvl_approx(job.pair_address, job.sn_liquidity_manager_address)
        pnl0 = rev["revenue_token0"]
        pnl1 = rev["revenue_token1"]
        prices = await ReaderDBMetricsService.get_token_prices(job)

        pnl_usd = ReaderDBMetricsService.tokens_to_usd(pnl0, pnl1, prices["price0"], prices["price1"])
        tvl_token0 = tvl_approx["tvl_token0"]
        tvl_token1 = tvl_approx["tvl_token1"]
        tvl_usd = ReaderDBMetricsService.tokens_to_usd(tvl_token0, tvl_token1, prices["price0"], prices["price1"])

        return JobPnLResponse(
            job_id=job_id,
            pnl_usd=pnl_usd,
            pnl_token0=pnl0,
            pnl_token1=pnl1,
            initial_tvl_usd=tvl_usd,
            current_tvl_usd=tvl_usd + pnl_usd,
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )
    except Exception:
        return JobPnLResponse(
            job_id=job_id,
            pnl_usd=0.0,
            pnl_token0=0.0,
            pnl_token1=0.0,
            initial_tvl_usd=0.0,
            current_tvl_usd=0.0,
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )


@router.get("/jobs/{job_id}/apy", response_model=JobAPYResponse)
async def get_job_apy(
    job_id: str,
    lookback_days: int = Query(30, ge=1, le=365)
):
    """Get APY for a specific job/vault."""
    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        from api.models.metrics import JobMetrics
        latest_metric = await _try_stored_metrics(
            lambda: JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()
        )

        if latest_metric:
            apy_token0 = (latest_metric.revenue_token0 / latest_metric.tvl_token0 * 365.0 / lookback_days * 100.0) if latest_metric.tvl_token0 > 0 else 0.0
            apy_token1 = (latest_metric.revenue_token1 / latest_metric.tvl_token1 * 365.0 / lookback_days * 100.0) if latest_metric.tvl_token1 > 0 else 0.0

            return JobAPYResponse(
                job_id=job_id,
                apy_percent=latest_metric.apy_percent,
                apy_percent_token0=apy_token0,
                apy_percent_token1=apy_token1,
                revenue_usd=latest_metric.revenue_usd,
                revenue_token0=latest_metric.revenue_token0,
                revenue_token1=latest_metric.revenue_token1,
                avg_tvl_usd=latest_metric.tvl_usd,
                avg_tvl_token0=latest_metric.tvl_token0,
                avg_tvl_token1=latest_metric.tvl_token1,
                lookback_days=lookback_days,
                updated_at=latest_metric.calculated_at.isoformat(),
            )
    except Exception:
        pass

    # Fallback: calculate APY from reader DB (collects / mints-burns)
    try:
        apy_data = await ReaderDBMetricsService.calculate_apy(
            job.pair_address, job.sn_liquidity_manager_address, lookback_days
        )
        prices = await ReaderDBMetricsService.get_token_prices(job)
        return JobAPYResponse(
            job_id=job_id,
            apy_percent=apy_data["apy_percent"],
            apy_percent_token0=apy_data["apy_token0"],
            apy_percent_token1=apy_data["apy_token1"],
            revenue_usd=ReaderDBMetricsService.tokens_to_usd(
                apy_data["revenue_token0"], apy_data["revenue_token1"],
                prices["price0"], prices["price1"],
            ),
            revenue_token0=apy_data["revenue_token0"],
            revenue_token1=apy_data["revenue_token1"],
            avg_tvl_usd=ReaderDBMetricsService.tokens_to_usd(
                apy_data["tvl_token0"], apy_data["tvl_token1"],
                prices["price0"], prices["price1"],
            ),
            avg_tvl_token0=apy_data["tvl_token0"],
            avg_tvl_token1=apy_data["tvl_token1"],
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )
    except Exception:
        return JobAPYResponse(
            job_id=job_id,
            apy_percent=0.0,
            apy_percent_token0=0.0,
            apy_percent_token1=0.0,
            revenue_usd=0.0,
            revenue_token0=0.0,
            revenue_token1=0.0,
            avg_tvl_usd=0.0,
            avg_tvl_token0=0.0,
            avg_tvl_token1=0.0,
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )


@router.get("/subnet/tvl", response_model=SubnetTVLResponse)
async def get_subnet_tvl():
    """Get total TVL across all vaults in the subnet."""
    try:
        all_jobs = await Job.all()
        total_tvl_usd = 0.0
        vault_tvls = []

        for job in all_jobs:
            try:
                from api.models.metrics import JobMetrics
                latest_metric = await _try_stored_metrics(
                    lambda: JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()
                )
                if latest_metric:
                    total_tvl_usd += latest_metric.tvl_usd
                    vault_tvls.append({
                        "job_id": job.job_id,
                        "vault_address": job.sn_liquidity_manager_address,
                        "pair_address": job.pair_address,
                        "tvl_usd": latest_metric.tvl_usd,
                        "tvl_token0": latest_metric.tvl_token0,
                        "tvl_token1": latest_metric.tvl_token1,
                    })
                    continue
            except Exception:
                pass

            # No stored metrics - try reader DB approximation
            try:
                tvl_approx = await ReaderDBMetricsService.get_pool_tvl_approx(job.pair_address, job.sn_liquidity_manager_address)
                t0 = tvl_approx["tvl_token0"]
                t1 = tvl_approx["tvl_token1"]
                approx_usd = t0 + t1
                total_tvl_usd += approx_usd
                vault_tvls.append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "pair_address": job.pair_address,
                    "tvl_usd": approx_usd,
                    "tvl_token0": t0,
                    "tvl_token1": t1,
                })
            except Exception:
                vault_tvls.append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "pair_address": job.pair_address,
                    "tvl_usd": 0.0,
                    "tvl_token0": 0.0,
                    "tvl_token1": 0.0,
                })

        return SubnetTVLResponse(
            total_tvl_usd=total_tvl_usd,
            vault_count=len(all_jobs),
            vault_tvls=vault_tvls,
            updated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subnet TVL: {str(e)}")


@router.get("/subnet/pnl", response_model=SubnetPnLResponse)
async def get_subnet_pnl(
    lookback_days: int = Query(30, ge=1, le=365)
):
    """Get total PnL across all vaults in the subnet."""
    all_jobs = await Job.all()
    vault_pnls = []
    total_pnl_usd = 0.0

    for j in all_jobs:
        try:
            rev = await ReaderDBMetricsService.get_vault_revenue(
                j.pair_address, j.sn_liquidity_manager_address
            )
            pnl0 = rev["revenue_token0"]
            pnl1 = rev["revenue_token1"]
            prices = await ReaderDBMetricsService.get_token_prices(j)
            pnl_usd = ReaderDBMetricsService.tokens_to_usd(pnl0, pnl1, prices["price0"], prices["price1"])
            total_pnl_usd += pnl_usd
            vault_pnls.append({
                "job_id": j.job_id,
                "vault_address": j.sn_liquidity_manager_address,
                "pair_address": j.pair_address,
                "pnl_usd": pnl_usd,
                "pnl_token0": pnl0,
                "pnl_token1": pnl1,
            })
        except Exception:
            vault_pnls.append({
                "job_id": j.job_id,
                "vault_address": j.sn_liquidity_manager_address,
                "pair_address": j.pair_address,
                "pnl_usd": 0.0,
                "pnl_token0": 0.0,
                "pnl_token1": 0.0,
            })

    return SubnetPnLResponse(
        total_pnl_usd=total_pnl_usd,
        vault_count=len(all_jobs),
        vault_pnls=vault_pnls,
        lookback_days=lookback_days,
        updated_at=datetime.now().isoformat(),
    )


@router.get("/jobs/{job_id}/tvl-history")
async def get_job_tvl_history(
    job_id: str,
    days: int = Query(7, ge=1, le=365)
):
    """Get TVL history for charts."""
    try:
        from api.models.metrics import JobMetrics
        cutoff = datetime.utcnow() - timedelta(days=days)
        metrics = await _try_stored_metrics(
            lambda: JobMetrics.filter(job_id=job_id, calculated_at__gte=cutoff).order_by("calculated_at")
        )

        if metrics:
            return {
                "job_id": job_id,
                "timeframe_days": days,
                "series": [
                    {
                        "timestamp": m.calculated_at.isoformat(),
                        "tvl_usd": m.tvl_usd,
                        "revenue_usd": m.revenue_usd,
                        "apy_percent": m.apy_percent,
                        "pnl_usd": m.pnl_usd,
                    }
                    for m in metrics
                ]
            }
    except Exception:
        pass

    return {"job_id": job_id, "timeframe_days": days, "series": []}


@router.get("/subnet/metrics-history")
async def get_subnet_metrics_history(
    days: int = Query(30, ge=1, le=365)
):
    """Get subnet-wide historical metrics for charts."""
    try:
        from api.models.metrics import SubnetMetricsSnapshot
        cutoff = datetime.utcnow() - timedelta(days=days)
        snapshots = await _try_stored_metrics(
            lambda: SubnetMetricsSnapshot.filter(snapshot_time__gte=cutoff).order_by("snapshot_time")
        )

        if snapshots:
            return {
                "timeframe_days": days,
                "series": [
                    {
                        "timestamp": s.snapshot_time.isoformat(),
                        "tvl_usd": s.total_tvl_usd,
                        "revenue_usd": s.total_revenue_usd,
                        "emissions_alpha": s.total_emissions_alpha,
                        "pnl_usd": s.total_pnl_usd
                    }
                    for s in snapshots
                ]
            }
    except Exception:
        pass

    return {"timeframe_days": days, "series": []}


@router.get("/jobs/{job_id}/inventory-change")
async def get_job_inventory_change(job_id: str):
    """Get initial vs current inventory for a job/vault."""
    job = await Job.filter(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        from api.models.metrics import VaultBalanceSnapshot
        initial = await _try_stored_metrics(
            lambda: VaultBalanceSnapshot.filter(job_id=job_id, snapshot_type="initial").first()
        )

        if not initial:
            return {
                "error": "No initial snapshot available",
                "note": "Initial snapshot will be created once the metrics snapshot job detects this vault"
            }

        current_tvl = await MetricsCalculator.calculate_job_tvl(job)

        return {
            "job_id": job_id,
            "initial": {
                "balance_token0": initial.balance_token0,
                "balance_token1": initial.balance_token1,
                "balance_usd": initial.balance_usd,
                "timestamp": initial.timestamp.isoformat()
            },
            "current": {
                "balance_token0": current_tvl["tvl_token0"],
                "balance_token1": current_tvl["tvl_token1"],
                "balance_usd": current_tvl["tvl_usd"]
            },
            "change": {
                "token0": current_tvl["tvl_token0"] - initial.balance_token0,
                "token1": current_tvl["tvl_token1"] - initial.balance_token1,
                "usd": current_tvl["tvl_usd"] - initial.balance_usd,
                "percent": ((current_tvl["tvl_usd"] - initial.balance_usd) / initial.balance_usd * 100) if initial.balance_usd > 0 else 0.0
            }
        }
    except HTTPException:
        raise
    except Exception:
        return {
            "error": "No initial snapshot available",
            "note": "Metrics tables not available in this environment"
        }
