"""
Miners Router

Endpoints for miner-related operations.
"""
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    MinerProfileResponse,
    MinerPerformanceDetailResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.miners_service import MinersService

router = APIRouter()


@router.get("/{uid}", response_model=MinerProfileResponse)
async def get_miner_profile(uid: int):
    """
    Get miner profile across all jobs
    
    - **uid**: Miner UID
    """
    profile = await MinersService.get_miner_profile(uid)
    
    if not profile:
        raise HTTPException(status_code=404, detail=f"Miner {uid} not found")
    
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
