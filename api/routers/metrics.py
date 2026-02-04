"""
Metrics Router

Endpoints for subnet-wide metrics and analytics.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

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
from api.models.metrics import (
    JobMetrics,
    MinerMetrics,
    PairMetrics,
    SubnetMetricsSnapshot,
    VaultBalanceSnapshot,
)
from api.services.metrics_service import MetricsService
from api.services.metrics_calculator import MetricsCalculator
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from validator.models.job import Job

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
            # Pool DB might not be available in all environments
            _pool_data_db = None
    return _pool_data_db


@router.get("/subnet/revenue", response_model=SubnetRevenueResponse)
async def get_subnet_revenue(
    lookback_days: int = Query(30, description="Number of days to look back", ge=1, le=365)
):
    """
    Get total revenue across all vaults in the subnet.

    - **lookback_days**: Number of days to look back for revenue calculation (default: 30)

    Returns subnet-wide revenue metrics with per-vault breakdown.
    """
    try:
        # Try to get data from stored metrics first (for mock data)
        latest_metrics = await JobMetrics.all().order_by("-calculated_at").limit(100)

        if latest_metrics:
            # Aggregate from stored metrics
            job_metrics_by_id = {}
            for metric in latest_metrics:
                if metric.job_id not in job_metrics_by_id:
                    job_metrics_by_id[metric.job_id] = metric

            total_revenue_usd = sum(m.revenue_usd for m in job_metrics_by_id.values())

            vault_revenues = []
            for job_id, metric in job_metrics_by_id.items():
                # Get job details
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

        # Fall back to calculating from validator services
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()

        result = await MetricsService.get_subnet_revenue(
            job_repository=job_repo,
            pool_data_db=pool_db,
            lookback_days=lookback_days,
        )

        # Convert to response model
        vault_revenues = [
            VaultRevenueResponse(**vault) for vault in result["vault_revenues"]
        ]

        return SubnetRevenueResponse(
            total_revenue_usd=result["total_revenue_usd"],
            lookback_days=result["lookback_days"],
            vault_count=result["vault_count"],
            vault_revenues=vault_revenues,
            updated_at=result["updated_at"],
            error=result.get("error"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subnet revenue: {str(e)}")


@router.get("/subnet/emissions", response_model=SubnetEmissionsResponse)
async def get_subnet_emissions():
    """
    Get subnet emissions breakdown.

    Returns emissions split between burn (UID 0) and active miners,
    including Alpha amounts, USD values, and burn/miner ratios.
    """
    try:
        # Try to get data from stored subnet snapshots first (for mock data)
        latest_snapshot = await SubnetMetricsSnapshot.all().order_by("-snapshot_time").first()

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

        # Fall back to calculating from validator services
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()

        result = await MetricsService.get_subnet_emissions(
            job_repository=job_repo,
            pool_data_db=pool_db,
        )

        return SubnetEmissionsResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subnet emissions: {str(e)}")


@router.get("/top-earners", response_model=List[TopEarnerResponse])
async def get_top_earners(
    limit: int = Query(10, description="Number of top earners to return", ge=1, le=100)
):
    """
    Get top earning miners ranked by estimated earnings.

    - **limit**: Number of top earners to return (default: 10, max: 100)

    Returns list of miners with their estimated earnings in Alpha and USD,
    based on their score contribution to the network.
    """
    try:
        # Try to get data from stored miner metrics first (for mock data)
        miner_metrics = await MinerMetrics.all().order_by("-estimated_earnings_alpha").limit(limit)

        if miner_metrics:
            # Calculate total score for percentage
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

        # Fall back to calculating from validator services
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()

        earners = await MetricsService.get_top_earners(
            job_repository=job_repo,
            pool_data_db=pool_db,
            limit=limit,
        )

        return [TopEarnerResponse(**earner) for earner in earners]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get top earners: {str(e)}")


@router.get("/pairs/performance", response_model=List[PairPerformanceResponse])
async def get_pair_performance():
    """
    Get performance metrics aggregated by trading pair.

    Returns revenue and miner statistics for each pair,
    sorted by total revenue (descending).
    """
    try:
        # Try to get data from stored pair metrics first (for mock data)
        pair_metrics = await PairMetrics.all().order_by("-total_revenue_usd")

        if pair_metrics:
            result = []
            for pair_metric in pair_metrics:
                # Get job details from breakdown
                jobs = []
                if pair_metric.job_breakdown:
                    for job_id, breakdown in pair_metric.job_breakdown.items():
                        job = await Job.filter(job_id=job_id).first()
                        if job:
                            # Count miners for this job
                            from validator.models.job import MinerScore
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
                        total_revenue_token0=0.0,  # Not stored in PairMetrics
                        total_revenue_token1=0.0,  # Not stored in PairMetrics
                        total_miners=pair_metric.total_miners,
                        jobs=jobs,
                    )
                )

            return result

        # Fall back to calculating from validator services
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()

        pairs = await MetricsService.get_pair_performance(
            job_repository=job_repo,
            pool_data_db=pool_db,
        )

        # Convert to response model
        result = []
        for pair in pairs:
            jobs = [PairJobResponse(**job) for job in pair["jobs"]]
            result.append(
                PairPerformanceResponse(
                    pair_address=pair["pair_address"],
                    vault_count=pair["vault_count"],
                    total_revenue_usd=pair["total_revenue_usd"],
                    total_revenue_token0=pair["total_revenue_token0"],
                    total_revenue_token1=pair["total_revenue_token1"],
                    total_miners=pair["total_miners"],
                    jobs=jobs,
                )
            )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pair performance: {str(e)}")


@router.get("/jobs/{job_id}/tvl", response_model=JobTVLResponse)
async def get_job_tvl(job_id: str):
    """
    Get current TVL (Total Value Locked) for a specific job/vault.

    - **job_id**: Job identifier

    Returns current token balances and USD value locked in the vault.
    Uses stored metrics if available, otherwise calculates on-chain.
    """
    try:
        from api.models.metrics import JobMetrics
        from datetime import datetime

        job = await Job.filter(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        # Try to get latest stored metrics first (for test/mock data)
        latest_metric = await JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()

        if latest_metric:
            return JobTVLResponse(
                job_id=job_id,
                tvl_token0=latest_metric.tvl_token0,
                tvl_token1=latest_metric.tvl_token1,
                tvl_usd=latest_metric.tvl_usd,
                token0_price_usd=latest_metric.token0_price_usd,
                token1_price_usd=latest_metric.token1_price_usd,
                updated_at=latest_metric.calculated_at.isoformat(),
            )

        # Fall back to on-chain calculation if no stored metrics
        tvl_data = await MetricsCalculator.calculate_job_tvl(job)
        return JobTVLResponse(
            job_id=job_id,
            tvl_token0=tvl_data["tvl_token0"],
            tvl_token1=tvl_data["tvl_token1"],
            tvl_usd=tvl_data["tvl_usd"],
            token0_price_usd=tvl_data["token0_price_usd"],
            token1_price_usd=tvl_data["token1_price_usd"],
            updated_at=datetime.now().isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get TVL: {str(e)}")


@router.get("/jobs/{job_id}/pnl", response_model=JobPnLResponse)
async def get_job_pnl(
    job_id: str,
    lookback_days: int = Query(30, description="Number of days to calculate PnL over", ge=1, le=365)
):
    """
    Get PnL (Profit & Loss) for a specific job/vault.

    - **job_id**: Job identifier
    - **lookback_days**: Number of days to calculate PnL over (default: 30)

    Returns PnL calculated as: Current TVL - Initial TVL over the period.
    Uses stored metrics if available.
    """
    try:
        from api.models.metrics import JobMetrics
        from datetime import datetime, timedelta

        job = await Job.filter(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        # Try to get stored metrics
        cutoff = datetime.now() - timedelta(days=lookback_days)
        initial_metric = await JobMetrics.filter(
            job_id=job_id,
            calculated_at__gte=cutoff
        ).order_by("calculated_at").first()

        latest_metric = await JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()

        if initial_metric and latest_metric:
            pnl_usd = latest_metric.tvl_usd - initial_metric.tvl_usd
            pnl_token0 = latest_metric.tvl_token0 - initial_metric.tvl_token0
            pnl_token1 = latest_metric.tvl_token1 - initial_metric.tvl_token1

            return JobPnLResponse(
                job_id=job_id,
                pnl_usd=pnl_usd,
                pnl_token0=pnl_token0,
                pnl_token1=pnl_token1,
                initial_tvl_usd=initial_metric.tvl_usd,
                current_tvl_usd=latest_metric.tvl_usd,
                lookback_days=lookback_days,
                updated_at=latest_metric.calculated_at.isoformat(),
            )

        # Fall back to calculation
        pool_db = get_pool_data_db()
        pnl_data = await MetricsCalculator.calculate_job_pnl(job, pool_db, lookback_days)

        return JobPnLResponse(
            job_id=job_id,
            pnl_usd=pnl_data["pnl_usd"],
            pnl_token0=pnl_data["pnl_token0"],
            pnl_token1=pnl_data["pnl_token1"],
            initial_tvl_usd=pnl_data["initial_tvl_usd"],
            current_tvl_usd=pnl_data["current_tvl_usd"],
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get PnL: {str(e)}")


@router.get("/jobs/{job_id}/apy", response_model=JobAPYResponse)
async def get_job_apy(
    job_id: str,
    lookback_days: int = Query(30, description="Number of days to calculate APY over", ge=1, le=365)
):
    """
    Get APY (Annual Percentage Yield) for a specific job/vault.

    - **job_id**: Job identifier
    - **lookback_days**: Number of days to calculate APY over (default: 30)

    Returns annualized yield based on: (Revenue / Average TVL) * (365 / days) * 100
    Uses stored metrics if available.
    """
    try:
        from api.models.metrics import JobMetrics
        from datetime import datetime

        job = await Job.filter(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        # Get latest stored metric
        latest_metric = await JobMetrics.filter(job_id=job_id).order_by("-calculated_at").first()

        if latest_metric:
            # Calculate token-level APY from stored metrics
            apy_percent_token0 = (latest_metric.revenue_token0 / latest_metric.tvl_token0 * 365.0 / lookback_days * 100.0) if latest_metric.tvl_token0 > 0 else 0.0
            apy_percent_token1 = (latest_metric.revenue_token1 / latest_metric.tvl_token1 * 365.0 / lookback_days * 100.0) if latest_metric.tvl_token1 > 0 else 0.0

            return JobAPYResponse(
                job_id=job_id,
                apy_percent=latest_metric.apy_percent,
                apy_percent_token0=apy_percent_token0,
                apy_percent_token1=apy_percent_token1,
                revenue_usd=latest_metric.revenue_usd,
                revenue_token0=latest_metric.revenue_token0,
                revenue_token1=latest_metric.revenue_token1,
                avg_tvl_usd=latest_metric.tvl_usd,
                avg_tvl_token0=latest_metric.tvl_token0,
                avg_tvl_token1=latest_metric.tvl_token1,
                lookback_days=lookback_days,
                updated_at=latest_metric.calculated_at.isoformat(),
            )

        # Fall back to calculation
        pool_db = get_pool_data_db()
        apy_data = await MetricsCalculator.calculate_job_apy(job, pool_db, lookback_days)

        return JobAPYResponse(
            job_id=job_id,
            apy_percent=apy_data["apy_percent"],
            apy_percent_token0=apy_data["apy_percent_token0"],
            apy_percent_token1=apy_data["apy_percent_token1"],
            revenue_usd=apy_data["revenue_usd"],
            revenue_token0=apy_data["revenue_token0"],
            revenue_token1=apy_data["revenue_token1"],
            avg_tvl_usd=apy_data["avg_tvl_usd"],
            avg_tvl_token0=apy_data["avg_tvl_token0"],
            avg_tvl_token1=apy_data["avg_tvl_token1"],
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get APY: {str(e)}")


@router.get("/subnet/tvl", response_model=SubnetTVLResponse)
async def get_subnet_tvl():
    """
    Get total TVL (Total Value Locked) across all vaults in the subnet.

    Returns total TVL in USD with per-vault breakdown.
    Uses stored metrics if available.
    """
    try:
        from api.models.metrics import JobMetrics
        from datetime import datetime

        job_repo = get_job_repository()
        active_jobs = await job_repo.get_active_jobs()

        total_tvl_usd = 0.0
        vault_tvls = []

        for job in active_jobs:
            # Try to get latest stored metric first
            latest_metric = await JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()

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
            else:
                # Fall back to calculation
                tvl_data = await MetricsCalculator.calculate_job_tvl(job)
                total_tvl_usd += tvl_data["tvl_usd"]
                vault_tvls.append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "pair_address": job.pair_address,
                    "tvl_usd": tvl_data["tvl_usd"],
                    "tvl_token0": tvl_data["tvl_token0"],
                    "tvl_token1": tvl_data["tvl_token1"],
                })

        return SubnetTVLResponse(
            total_tvl_usd=total_tvl_usd,
            vault_count=len(active_jobs),
            vault_tvls=vault_tvls,
            updated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subnet TVL: {str(e)}")


@router.get("/subnet/pnl", response_model=SubnetPnLResponse)
async def get_subnet_pnl(
    lookback_days: int = Query(30, description="Number of days to calculate PnL over", ge=1, le=365)
):
    """
    Get total PnL (Profit & Loss) across all vaults in the subnet.

    - **lookback_days**: Number of days to calculate PnL over (default: 30)

    Returns total PnL in USD with per-vault breakdown.
    Uses stored metrics if available.
    """
    try:
        from api.models.metrics import JobMetrics
        from datetime import datetime, timedelta

        job_repo = get_job_repository()
        active_jobs = await job_repo.get_active_jobs()

        total_pnl_usd = 0.0
        vault_pnls = []

        cutoff = datetime.now() - timedelta(days=lookback_days)

        for job in active_jobs:
            # Try to get stored metrics
            initial_metric = await JobMetrics.filter(
                job_id=job.job_id,
                calculated_at__gte=cutoff
            ).order_by("calculated_at").first()

            latest_metric = await JobMetrics.filter(job_id=job.job_id).order_by("-calculated_at").first()

            if initial_metric and latest_metric:
                pnl_usd = latest_metric.tvl_usd - initial_metric.tvl_usd
                pnl_token0 = latest_metric.tvl_token0 - initial_metric.tvl_token0
                pnl_token1 = latest_metric.tvl_token1 - initial_metric.tvl_token1

                total_pnl_usd += pnl_usd
                vault_pnls.append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "pair_address": job.pair_address,
                    "pnl_usd": pnl_usd,
                    "pnl_token0": pnl_token0,
                    "pnl_token1": pnl_token1,
                })
            else:
                # Fall back to calculation
                pool_db = get_pool_data_db()
                pnl_data = await MetricsCalculator.calculate_job_pnl(job, pool_db, lookback_days)
                total_pnl_usd += pnl_data["pnl_usd"]

                vault_pnls.append({
                    "job_id": job.job_id,
                    "vault_address": job.sn_liquidity_manager_address,
                    "pair_address": job.pair_address,
                    "pnl_usd": pnl_data["pnl_usd"],
                    "pnl_token0": pnl_data["pnl_token0"],
                    "pnl_token1": pnl_data["pnl_token1"],
                })

        return SubnetPnLResponse(
            total_pnl_usd=total_pnl_usd,
            vault_count=len(active_jobs),
            vault_pnls=vault_pnls,
            lookback_days=lookback_days,
            updated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subnet PnL: {str(e)}")


@router.get("/jobs/{job_id}/tvl-history")
async def get_job_tvl_history(
    job_id: str,
    days: int = Query(7, ge=1, le=365, description="Number of days of history")
):
    """
    Get TVL history for charts.
    
    - **job_id**: Job identifier
    - **days**: Number of days of history to return (default: 7)
    
    Returns time-series data points for TVL and revenue.
    """
    try:
        from datetime import datetime, timedelta
        from api.models.metrics import JobMetrics
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        metrics = await JobMetrics.filter(
            job_id=job_id,
            calculated_at__gte=cutoff
        ).order_by("calculated_at")
        
        return {
            "job_id": job_id,
            "timeframe_days": days,
            "series": [
                {
                    "timestamp": m.calculated_at.isoformat(),
                    "tvl_usd": m.tvl_usd,
                    "revenue_usd": m.revenue_usd,
                    "apy_percent": m.apy_percent
                }
                for m in metrics
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get TVL history: {str(e)}")


@router.get("/subnet/metrics-history")
async def get_subnet_metrics_history(
    days: int = Query(30, ge=1, le=365, description="Number of days of history")
):
    """
    Get subnet-wide historical metrics for charts.
    
    - **days**: Number of days of history to return (default: 30)
    
    Returns time-series data points for subnet TVL, revenue, and emissions.
    """
    try:
        from datetime import datetime, timedelta
        from api.models.metrics import SubnetMetricsSnapshot
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        snapshots = await SubnetMetricsSnapshot.filter(
            snapshot_time__gte=cutoff
        ).order_by("snapshot_time")
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics history: {str(e)}")


@router.get("/jobs/{job_id}/inventory-change")
async def get_job_inventory_change(job_id: str):
    """
    Get initial vs current inventory for a job/vault.
    
    - **job_id**: Job identifier
    
    Returns initial balance snapshot and current balance with change calculations.
    """
    try:
        from api.models.metrics import VaultBalanceSnapshot
        
        # Get initial snapshot
        initial = await VaultBalanceSnapshot.filter(
            job_id=job_id,
            snapshot_type="initial"
        ).first()
        
        if not initial:
            return {
                "error": "No initial snapshot available",
                "note": "Initial snapshot will be created once the metrics snapshot job detects this vault"
            }
        
        # Get current TVL from on-chain
        job = await Job.filter(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get inventory change: {str(e)}")
