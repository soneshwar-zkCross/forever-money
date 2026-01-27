"""
Rounds Router

Endpoints for round-related operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    RoundListResponse,
    RoundResponse,
    RoundDetailResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.rounds_service import RoundsService
from api.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter()


@router.get("/{job_id}/rounds", response_model=RoundListResponse)
async def get_rounds(
    job_id: str,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    round_type: Optional[str] = Query(None, regex="^(evaluation|live)$"),
    status: Optional[str] = Query(None, regex="^(pending|active|completed|failed)$")
):
    """
    Get round history for a job
    
    - **job_id**: Job identifier
    - **limit**: Number of results
    - **offset**: Pagination offset
    - **round_type**: Filter by evaluation or live
    - **status**: Filter by round status
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    rounds, total_count = await RoundsService.get_rounds(
        job=job,
        limit=limit,
        offset=offset,
        round_type=round_type,
        status=status
    )
    
    round_responses = [RoundResponse(**r) for r in rounds]
    
    return RoundListResponse(
        job_id=job_id,
        total_rounds=total_count,
        rounds=round_responses
    )


@router.get("/{job_id}/rounds/current")
async def get_current_round(job_id: str):
    """
    Get current active round for a job
    
    - **job_id**: Job identifier
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    current_round = await RoundsService.get_current_round(job)
    
    if not current_round:
        return {"message": "No active round", "current_round": None}
    
    return {"current_round": current_round}


@router.get("/rounds/{round_id}", response_model=RoundDetailResponse)
async def get_round_details(round_id: str):
    """
    Get detailed round information including all scores
    
    - **round_id**: Round identifier
    """
    round_data = await RoundsService.get_round_details(round_id)
    
    if not round_data:
        raise HTTPException(status_code=404, detail=f"Round {round_id} not found")
    
    return RoundDetailResponse(**round_data)
