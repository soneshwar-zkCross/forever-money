"""
Leaderboard Router

Endpoints for leaderboard operations.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime

from api.models.responses import (
    LeaderboardResponse,
    MinerScoreResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.leaderboard_service import LeaderboardService
from api.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter()


@router.get("/{job_id}/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    job_id: str,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    eligible_only: bool = Query(False, description="Show only live-eligible miners"),
    sort_by: str = Query("combined", regex="^(combined|evaluation|live)$", description="Sort by score type")
):
    """
    Get ranked leaderboard for a job
    
    - **job_id**: Unique job identifier
    - **limit**: Number of results (max 100)
    - **offset**: Pagination offset
    - **eligible_only**: Filter for live-eligible miners
    - **sort_by**: Sort by combined, evaluation, or live score
    """
    # Get job
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    # Get leaderboard
    miners, total_count = await LeaderboardService.get_leaderboard(
        job=job,
        limit=limit,
        offset=offset,
        eligible_only=eligible_only,
        sort_by=sort_by
    )
    
    # Convert to response models
    miner_responses = [
        MinerScoreResponse(**miner)
        for miner in miners
    ]
    
    return LeaderboardResponse(
        job_id=job_id,
        updated_at=datetime.utcnow(),
        total_miners=total_count,
        leaderboard=miner_responses
    )


@router.get("/{job_id}/leaderboard/top", response_model=list[MinerScoreResponse])
async def get_top_miners(
    job_id: str,
    n: int = Query(10, ge=1, le=50, description="Number of top miners to return")
):
    """
    Get top N miners for a job
    
    - **job_id**: Unique job identifier
    - **n**: Number of top miners (max 50)
    """
    # Get job
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    # Get top miners
    top_miners = await LeaderboardService.get_top_miners(job=job, n=n)
    
    return [MinerScoreResponse(**miner) for miner in top_miners]
