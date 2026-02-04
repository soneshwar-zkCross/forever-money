"""
Executions Router

Endpoints for live execution operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    ExecutionListResponse,
    LiveExecutionResponse,
    ErrorResponse
)
from api.services.jobs_service import JobService
from api.services.executions_service import ExecutionsService
from api.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from validator.models.job import MinerScore

router = APIRouter()


@router.get("/{job_id}/executions", response_model=ExecutionListResponse)
async def get_executions(
    job_id: str,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    tx_status: Optional[str] = Query(None, regex="^(pending|success|failed)$")
):
    """
    Get live execution history for a job
    
    - **job_id**: Job identifier
    - **limit**: Number of results
    - **offset**: Pagination offset
    - **tx_status**: Filter by transaction status
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    executions, total_count = await ExecutionsService.get_executions(
        job=job,
        limit=limit,
        offset=offset,
        tx_status=tx_status
    )

    # Build execution responses with miner hotkey lookups
    execution_responses = []
    vault_name = job.metadata.get("pair_name", "Unknown Vault") if job.metadata else "Unknown Vault"

    for e in executions:
        # Get miner hotkey from MinerScore
        miner_score = await MinerScore.filter(job=job, miner_uid=e.miner_uid).first()
        miner_hotkey = miner_score.miner_hotkey if miner_score else f"UNKNOWN_UID_{e.miner_uid}"

        execution_responses.append(
            LiveExecutionResponse(
                execution_id=e.execution_id,
                round_id=e.round.round_id,
                round_number=e.round.round_number,
                job_id=job.job_id,
                vault_name=vault_name,
                miner_uid=e.miner_uid,
                miner_hotkey=miner_hotkey,
                strategy_data=e.strategy_data or {},
                tx_hash=e.tx_hash,
                tx_status=e.tx_status,
                block_number=None,  # Not stored in LiveExecution model
                actual_performance=e.actual_performance,
                sn_liquidity_manager_address=e.sn_liquidity_manager_address,
                executed_at=e.executed_at,
                updated_at=e.updated_at
            )
        )
    
    return ExecutionListResponse(
        job_id=job_id,
        total_executions=total_count,
        executions=execution_responses
    )


@router.get("/executions/{execution_id}", response_model=LiveExecutionResponse)
async def get_execution_details(execution_id: str):
    """
    Get detailed execution information

    - **execution_id**: Execution identifier
    """
    execution = await ExecutionsService.get_execution_by_id(execution_id)

    if not execution:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")

    # Get miner hotkey from MinerScore
    await execution.fetch_related('job')
    miner_score = await MinerScore.filter(job=execution.job, miner_uid=execution.miner_uid).first()
    miner_hotkey = miner_score.miner_hotkey if miner_score else f"UNKNOWN_UID_{execution.miner_uid}"

    vault_name = execution.job.metadata.get("pair_name", "Unknown Vault") if execution.job.metadata else "Unknown Vault"

    return LiveExecutionResponse(
        execution_id=execution.execution_id,
        round_id=execution.round.round_id,
        round_number=execution.round.round_number,
        job_id=execution.job.job_id,
        vault_name=vault_name,
        miner_uid=execution.miner_uid,
        miner_hotkey=miner_hotkey,
        strategy_data=execution.strategy_data or {},
        tx_hash=execution.tx_hash,
        tx_status=execution.tx_status,
        block_number=None,  # Not stored in LiveExecution model
        actual_performance=execution.actual_performance,
        sn_liquidity_manager_address=execution.sn_liquidity_manager_address,
        executed_at=execution.executed_at,
        updated_at=execution.updated_at
    )
