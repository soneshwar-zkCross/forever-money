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


@router.get("/{uid}/vaults")
async def get_miner_vaults(uid: int):
    """
    Get all vaults (positions across pairs) for a miner.

    Shows the miner's participation and performance across different trading pairs.
    Each vault represents the miner's position/performance on a specific pair.

    - **uid**: Miner UID

    Returns list of vaults with pair info, scores, and performance metrics.
    """
    try:
        # Get all miner scores (one per job/pair)
        from validator.models.job import MinerScore, Job

        miner_scores = await MinerScore.filter(miner_uid=uid).prefetch_related('job').all()

        if not miner_scores:
            return {
                "miner_uid": uid,
                "total_vaults": 0,
                "vaults": []
            }

        vaults = []
        for score in miner_scores:
            job = score.job

            # Get pool data DB for revenue calculation
            pool_db = get_pool_data_db()

            # Calculate revenue for this job
            revenue_data = await JobService.get_job_revenue(job, pool_db)

            # Build vault data
            vault = {
                "vault_id": f"vault_{uid}_{job.job_id}",
                "job_id": job.job_id,
                "pair_name": job.metadata.get("pair_name", "Unknown") if job.metadata else "Unknown",
                "pair_address": job.pair_address,

                # Miner performance
                "combined_score": float(score.combined_score),
                "evaluation_score": float(score.evaluation_score),
                "live_score": float(score.live_score),
                "is_eligible_for_live": score.is_eligible_for_live,

                # Participation stats
                "total_evaluations": score.total_evaluations,
                "total_live_rounds": score.total_live_rounds,
                "participation_days": score.participation_days,

                # Job config
                "is_active": job.is_active,
                "fee_rate": job.fee_rate,
                "target_ratio": job.target_ratio,

                # Revenue metrics (estimated share)
                "revenue_usd": revenue_data.get("revenue_usd", 0),
                "revenue_token0": revenue_data.get("revenue_token0", 0),
                "revenue_token1": revenue_data.get("revenue_token1", 0),
            }

            vaults.append(vault)

        # Sort by combined score descending
        vaults.sort(key=lambda x: x["combined_score"], reverse=True)

        return {
            "miner_uid": uid,
            "miner_hotkey": miner_scores[0].miner_hotkey if miner_scores else None,
            "total_vaults": len(vaults),
            "active_vaults": sum(1 for v in vaults if v["is_eligible_for_live"]),
            "vaults": vaults
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get miner vaults: {str(e)}")
