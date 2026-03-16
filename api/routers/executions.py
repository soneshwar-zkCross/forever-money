"""
Executions Router

Endpoints for live execution operations.
"""
import logging
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
from api.models.metrics import TxStatusCache

logger = logging.getLogger(__name__)

router = APIRouter()


async def _resolve_pending_tx(tx_hash: str, chain_id: int) -> tuple[str, Optional[int]]:
    """
    Check on-chain receipt for a pending tx. Returns (status, block_number).
    Caches result in the local metrics DB so we only hit RPC once per tx.
    """
    if not tx_hash:
        return "pending", None

    # Check local cache first
    cached = await TxStatusCache.filter(tx_hash=tx_hash).first()
    if cached:
        return cached.tx_status, cached.block_number

    # Hit RPC (single call, will be cached for next time)
    try:
        from validator.utils.web3 import AsyncWeb3Helper
        w3 = AsyncWeb3Helper.make_web3(chain_id)
        receipt = await w3.web3.eth.get_transaction_receipt(tx_hash)
        if receipt is not None:
            status = "success" if receipt.get("status") == 1 else "failed"
            block_number = receipt.get("blockNumber")
            gas_used = receipt.get("gasUsed")
            # Cache it so we never hit RPC for this tx again
            try:
                await TxStatusCache.create(
                    tx_hash=tx_hash,
                    tx_status=status,
                    block_number=block_number,
                    gas_used=gas_used,
                )
            except Exception:
                pass  # duplicate key is fine
            return status, block_number
    except Exception as e:
        logger.debug(f"RPC check failed for {tx_hash}: {e}")

    return "pending", None


async def _resolve_pending_txs_batch(
    executions: list, chain_id: int
) -> dict[str, tuple[str, Optional[int]]]:
    """
    Batch-resolve all pending tx hashes. Checks cache first, then hits RPC
    only for uncached hashes (sequentially to avoid 429).
    Returns dict of tx_hash -> (status, block_number).
    """
    pending_hashes = [
        e.tx_hash for e in executions
        if e.tx_status == "pending" and e.tx_hash
    ]
    if not pending_hashes:
        return {}

    unique_hashes = list(set(pending_hashes))
    results: dict[str, tuple[str, Optional[int]]] = {}

    # Check cache for all at once
    cached = await TxStatusCache.filter(tx_hash__in=unique_hashes).all()
    for c in cached:
        results[c.tx_hash] = (c.tx_status, c.block_number)

    # RPC only for uncached (sequentially to avoid 429)
    uncached = [h for h in unique_hashes if h not in results]
    if uncached:
        try:
            from validator.utils.web3 import AsyncWeb3Helper
            w3 = AsyncWeb3Helper.make_web3(chain_id)
            for tx_hash in uncached:
                try:
                    receipt = await w3.web3.eth.get_transaction_receipt(tx_hash)
                    if receipt is not None:
                        status = "success" if receipt.get("status") == 1 else "failed"
                        block_number = receipt.get("blockNumber")
                        gas_used = receipt.get("gasUsed")
                        try:
                            await TxStatusCache.create(
                                tx_hash=tx_hash,
                                tx_status=status,
                                block_number=block_number,
                                gas_used=gas_used,
                            )
                        except Exception:
                            pass
                        results[tx_hash] = (status, block_number)
                except Exception as e:
                    logger.debug(f"RPC check failed for {tx_hash}: {e}")
        except Exception as e:
            logger.debug(f"Web3 init failed: {e}")

    return results


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

    # Batch-resolve all pending tx statuses from on-chain (cached)
    tx_resolutions = await _resolve_pending_txs_batch(executions, job.chain_id)

    for e in executions:
        # Get miner hotkey from MinerScore
        miner_score = await MinerScore.filter(job=job, miner_uid=e.miner_uid).first()
        miner_hotkey = miner_score.miner_hotkey if miner_score else f"UNKNOWN_UID_{e.miner_uid}"

        # Use batch-resolved status
        resolved_status = e.tx_status
        resolved_block = None
        if e.tx_status == "pending" and e.tx_hash and e.tx_hash in tx_resolutions:
            resolved_status, resolved_block = tx_resolutions[e.tx_hash]

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
                tx_status=resolved_status,
                block_number=resolved_block,
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

    resolved_status = execution.tx_status
    resolved_block = None
    if execution.tx_status == "pending" and execution.tx_hash:
        resolved_status, resolved_block = await _resolve_pending_tx(
            execution.tx_hash, execution.job.chain_id
        )

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
        tx_status=resolved_status,
        block_number=resolved_block,
        actual_performance=execution.actual_performance,
        sn_liquidity_manager_address=execution.sn_liquidity_manager_address,
        executed_at=execution.executed_at,
        updated_at=execution.updated_at
    )
