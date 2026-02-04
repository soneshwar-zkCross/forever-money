"""
Miners Router

Endpoints for miner-related operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    MinerProfileResponse,
    MinerPerformanceDetailResponse,
    MinerWinRateResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.miners_service import MinersService
from api.services.metrics_calculator import MetricsCalculator
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from validator.models.job import MinerScore

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


@router.get("/{uid}", response_model=MinerProfileResponse)
async def get_miner_profile(
    uid: int,
    include_earnings: bool = Query(True, description="Include earnings estimation")
):
    """
    Get miner profile across all jobs

    - **uid**: Miner UID
    - **include_earnings**: Include estimated earnings in response (default: True)
    """
    profile = await MinersService.get_miner_profile(uid)

    if not profile:
        raise HTTPException(status_code=404, detail=f"Miner {uid} not found")

    # Add earnings if requested
    if include_earnings:
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()
        earnings = await MinersService.get_miner_earnings(uid, job_repo, pool_db)
        profile.update(earnings)

    return MinerProfileResponse(**profile)


@router.get("/{uid}/jobs/{job_id}", response_model=MinerPerformanceDetailResponse)
async def get_miner_performance(uid: int, job_id: str):
    """
    Get detailed miner performance on a specific job
    
    - **uid**: Miner UID
    - **job_id**: Job identifier
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    performance = await MinersService.get_miner_performance(job, uid)
    
    if not performance:
        raise HTTPException(
            status_code=404,
            detail=f"Miner {uid} has no performance data for job {job_id}"
        )
    
    return MinerPerformanceDetailResponse(**performance)


@router.get("/{uid}/win-rate", response_model=MinerWinRateResponse)
async def get_miner_win_rate(
    uid: int,
    job_id: Optional[str] = Query(None, description="Filter by specific job (optional)")
):
    """
    Get win rate for a miner.

    - **uid**: Miner UID
    - **job_id**: Optional job ID to filter by specific job

    Returns win rate as percentage, total wins, and total participations.
    """
    try:
        # Calculate win rate
        win_rate = await MetricsCalculator.calculate_miner_win_rate(uid, job_id)

        # Get miner hotkey
        miner_score = await MinerScore.filter(miner_uid=uid).first()
        if not miner_score:
            raise HTTPException(status_code=404, detail=f"Miner {uid} not found")

        # Count wins and participations
        from validator.models.job import Round, RoundStatus

        query = Round.filter(
            status=RoundStatus.COMPLETED,
            predictions__miner_uid=uid,
        )

        if job_id:
            query = query.filter(job__job_id=job_id)

        total_participations = await query.count()
        total_wins = await query.filter(winner_uid=uid).count()

        return MinerWinRateResponse(
            miner_uid=uid,
            miner_hotkey=miner_score.miner_hotkey,
            win_rate=win_rate,
            total_wins=total_wins,
            total_participations=total_participations,
            job_id=job_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate win rate: {str(e)}")


@router.get("/{uid}/job-earnings/{job_id}")
async def get_miner_job_earnings(uid: int, job_id: str):
    """
    Get miner earnings for a specific job.
    
    - **uid**: Miner UID
    - **job_id**: Job identifier
    
    Returns estimated earnings in Alpha and USD for this specific job.
    """
    try:
        from api.services.miner_earnings_service import MinerEarningsService
        
        earnings = await MinerEarningsService.calculate_miner_job_earnings(uid, job_id)
        
        return {
            "miner_uid": uid,
            "job_id": job_id,
            **earnings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate job earnings: {str(e)}")


@router.get("/{uid}/dividends")
async def get_miner_dividends(uid: int):
    """
    Get current dividend balance for a miner from metagraph.
    
    - **uid**: Miner UID
    
    Returns current dividend balance in Alpha (not total historic earnings).
    """
    try:
        from api.services.miner_earnings_service import MinerEarningsService
        
        dividends = await MinerEarningsService.get_current_dividends(uid)
        
        return {
            "miner_uid": uid,
            "current_dividends_alpha": dividends,
            "note": "This is the current dividend balance, not total earnings history"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dividends: {str(e)}")
