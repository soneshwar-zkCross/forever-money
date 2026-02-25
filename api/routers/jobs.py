"""
Jobs Router

Endpoints for job-related operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime

from api.models.responses import (
    JobListResponse,
    JobResponse,
    JobDetailResponse,
    JobStatsResponse,
    JobRevenueDetailResponse,
    PoolPriceResponse,
    AllRoundsResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.candle_service import CandleService
from validator.repositories.pool import PoolDataDB

router = APIRouter()

# Lazy initialization of pool data DB
_pool_data_db: Optional[PoolDataDB] = None


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


@router.get("/", response_model=JobListResponse)
async def list_jobs(
    is_active: Optional[bool] = Query(None, description="Filter by active status")
):
    """
    Get list of all jobs
    
    - **is_active**: Optional filter for active jobs only
    """
    jobs = await JobService.get_all_jobs(is_active=is_active)
    
    job_responses = [
        JobResponse(
            job_id=job.job_id,
            sn_liquidity_manager_address=job.sn_liquidity_manager_address,
            pair_address=job.pair_address,
            fee_rate=job.fee_rate,
            target=job.target,
            target_ratio=job.target_ratio,
            chain_id=job.chain_id,
            is_active=job.is_active,
            round_duration_seconds=job.round_duration_seconds,
            created_at=job.created_at,
            updated_at=job.updated_at,
            metadata=job.metadata if job.metadata else {"pair_name": job.job_id.replace("-", "/").upper()}
        )
        for job in jobs
    ]
    
    return JobListResponse(
        jobs=job_responses,
        total=len(job_responses)
    )


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: str):
    """
    Get detailed job information including statistics
    
    - **job_id**: Unique job identifier
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    # Get statistics
    stats = await JobService.get_job_stats(job)
    
    # Get current round
    current_round = await JobService.get_current_round(job)
    
    return JobDetailResponse(
        job_id=job.job_id,
        sn_liquidity_manager_address=job.sn_liquidity_manager_address,
        pair_address=job.pair_address,
        fee_rate=job.fee_rate,
        target=job.target,
        target_ratio=job.target_ratio,
        chain_id=job.chain_id,
        is_active=job.is_active,
        round_duration_seconds=job.round_duration_seconds,
        created_at=job.created_at,
        updated_at=job.updated_at,
        metadata=job.metadata or {},
        stats=JobStatsResponse(**stats),
        current_round=current_round
    )


@router.get("/{job_id}/stats", response_model=JobStatsResponse)
async def get_job_stats(
    job_id: str,
    include_revenue: bool = Query(True, description="Include revenue metrics")
):
    """
    Get aggregated statistics for a job

    - **job_id**: Unique job identifier
    - **include_revenue**: Include revenue metrics in response (default: True)
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    stats = await JobService.get_job_stats(job)

    # Add revenue metrics if requested
    if include_revenue:
        pool_db = get_pool_data_db()
        revenue = await JobService.get_job_revenue(job, pool_db)
        stats.update(revenue)

    return JobStatsResponse(**stats)


@router.get("/{job_id}/revenue", response_model=JobRevenueDetailResponse)
async def get_job_revenue(
    job_id: str,
    lookback_days: int = Query(30, description="Number of days to look back", ge=1, le=365)
):
    """
    Get detailed revenue metrics for a job

    - **job_id**: Unique job identifier
    - **lookback_days**: Number of days to look back for revenue calculation (default: 30)
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    pool_db = get_pool_data_db()
    revenue_detail = await JobService.get_job_revenue_detail(job, pool_db, lookback_days)

    return JobRevenueDetailResponse(**revenue_detail)


@router.get("/{job_id}/price", response_model=PoolPriceResponse)
async def get_pool_price(job_id: str):
    """
    Get pool price statistics from swap events

    - **job_id**: Unique job identifier
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    price_stats = await JobService.get_pool_price(job)

    return PoolPriceResponse(**price_stats)


@router.get("/{job_id}/rounds", response_model=AllRoundsResponse)
async def get_all_rounds(
    job_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Get all rounds (evaluation and live) with execution data for live rounds

    - **job_id**: Unique job identifier
    - **limit**: Number of rounds to return (default: 50)
    - **offset**: Pagination offset
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    rounds, total_count = await JobService.get_all_rounds_with_executions(job, limit, offset)

    return AllRoundsResponse(
        job_id=job_id,
        total_rounds=total_count,
        rounds=rounds
    )


@router.get("/{job_id}/candles")
async def get_job_candles(
    job_id: str,
    interval: int = Query(300, description="Candle interval in seconds", ge=60, le=3600),
    lookback_hours: int = Query(24, description="Hours to look back", ge=1, le=4320)
):
    """
    Get OHLCV candles built from swap events

    - **job_id**: Job identifier
    - **interval**: Candle interval in seconds (default: 300 = 5min)
    - **lookback_hours**: Hours of history to fetch (default: 24)

    Returns candlestick data for charting.
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    candles = await CandleService.build_candles_from_swaps(
        job=job,
        interval_seconds=interval,
        lookback_hours=lookback_hours
    )

    return {
        "job_id": job_id,
        "interval_seconds": interval,
        "lookback_hours": lookback_hours,
        "candles": candles,
        "total_candles": len(candles)
    }


@router.get("/{job_id}/pool-data/candles")
async def get_pool_data_candles(
    job_id: str,
    interval: int = Query(300, description="Candle interval in seconds", ge=60, le=3600),
    lookback_hours: int = Query(24, description="Hours to look back", ge=1, le=4320)
):
    """
    Get OHLCV candles from reader database (historical swap data)

    This endpoint fetches candles from the external swap events database
    which contains historical pool data.

    - **job_id**: Job identifier
    - **interval**: Candle interval in seconds (default: 300 = 5min)
    - **lookback_hours**: Hours of history to fetch (default: 24)

    Returns candlestick data with price, volume, fees, and liquidity.
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    candles = await CandleService.fetch_candles_from_reader_db(
        job=job,
        interval_seconds=interval,
        lookback_hours=lookback_hours
    )

    return {
        "job_id": job_id,
        "interval_seconds": interval,
        "lookback_hours": lookback_hours,
        "source": "reader_database",
        "candles": candles,
        "total_candles": len(candles)
    }


@router.get("/{job_id}/pool-data/stats")
async def get_pool_data_stats(
    job_id: str,
    lookback_hours: int = Query(24, description="Hours to look back", ge=1, le=4320)
):
    """
    Get aggregated pool statistics from reader database (CACHED)

    Returns cached pool statistics from job metadata. To refresh the cache,
    use the POST /jobs/{job_id}/sync-pool-data endpoint.

    - **job_id**: Job identifier
    - **lookback_hours**: Hours of history (ignored, uses cached data)

    Returns pool statistics for the specified time period.
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Return cached data from job metadata
    if job.metadata and "pool_data" in job.metadata:
        pool_data = job.metadata["pool_data"]
        return {
            "job_id": job_id,
            "lookback_hours": pool_data.get("lookback_hours", 24),
            "source": "cached",
            "last_sync": pool_data.get("last_sync"),
            "start_ts": int(datetime.utcnow().timestamp()) - (pool_data.get("lookback_hours", 24) * 3600),
            "end_ts": int(datetime.utcnow().timestamp()),
            "total_swaps": pool_data.get("total_swaps", 0),
            "volume0": pool_data.get("volume_24h_token0", 0),
            "volume1": pool_data.get("volume_24h_token1", 0),
            "fees0": pool_data.get("fees_24h_token0", 0),
            "fees1": pool_data.get("fees_24h_token1", 0),
            "open_price": pool_data.get("current_price", 0),
            "close_price": pool_data.get("current_price", 0),
            "high_price": pool_data.get("high_price_24h", 0),
            "low_price": pool_data.get("low_price_24h", 0),
            "price_change_pct": pool_data.get("price_change_pct", 0),
            "token0_symbol": pool_data.get("token0_symbol", "Token0"),
            "token1_symbol": pool_data.get("token1_symbol", "Token1"),
        }

    # No cached data available
    raise HTTPException(
        status_code=503,
        detail="Pool data not cached. Use POST /jobs/{job_id}/sync-pool-data to fetch data."
    )

    return {
        "job_id": job_id,
        "lookback_hours": lookback_hours,
        "source": "reader_database",
        **stats
    }


@router.post("/{job_id}/sync-pool-data")
async def sync_pool_data(
    job_id: str,
    lookback_hours: int = Query(24, description="Hours to sync", ge=1, le=4320)
):
    """
    Sync pool data from reader database to cache/metadata

    This endpoint fetches the latest pool statistics from the reader database
    and updates the job's metadata with current pool information.

    - **job_id**: Job identifier
    - **lookback_hours**: Hours of data to sync (default: 24)

    Returns synced pool data.
    """
    job = await JobService.get_job_by_id(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Fetch stats from reader DB
    stats = await CandleService.get_pool_stats_from_reader_db(
        job=job,
        lookback_hours=lookback_hours
    )

    if not stats:
        raise HTTPException(
            status_code=503,
            detail="Failed to fetch pool data from reader database"
        )

    # Update job metadata with pool data
    if job.metadata is None:
        job.metadata = {}

    job.metadata.update({
        "pool_data": {
            "last_sync": datetime.utcnow().isoformat(),
            "lookback_hours": lookback_hours,
            "current_price": stats.get("close_price"),
            "price_change_pct": stats.get("price_change_pct"),
            "volume_24h_token0": stats.get("volume0"),
            "volume_24h_token1": stats.get("volume1"),
            "fees_24h_token0": stats.get("fees0"),
            "fees_24h_token1": stats.get("fees1"),
            "total_swaps": stats.get("total_swaps"),
            "token0_symbol": stats.get("token0_symbol"),
            "token1_symbol": stats.get("token1_symbol"),
        }
    })

    await job.save()

    return {
        "job_id": job_id,
        "synced": True,
        "sync_time": datetime.utcnow().isoformat(),
        "pool_data": job.metadata["pool_data"]
    }
