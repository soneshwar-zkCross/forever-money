"""
Metrics Router

Endpoints for subnet-wide metrics and analytics.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    SubnetRevenueResponse,
    SubnetEmissionsResponse,
    TopEarnerResponse,
    PairPerformanceResponse,
    VaultRevenueResponse,
    PairJobResponse,
    ErrorResponse,
)
from api.services.metrics_service import MetricsService
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB

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
