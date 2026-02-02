"""
Miners Router

Endpoints for miner-related operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    MinerProfileResponse,
    MinerPerformanceDetailResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.miners_service import MinersService
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
