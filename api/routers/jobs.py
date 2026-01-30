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
    ErrorResponse
)
from api.services.jobs_service import JobService

router = APIRouter()


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
            metadata=job.metadata or {}
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
async def get_job_stats(job_id: str):
    """
    Get aggregated statistics for a job
    
    - **job_id**: Unique job identifier
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    stats = await JobService.get_job_stats(job)
    
    return JobStatsResponse(**stats)
