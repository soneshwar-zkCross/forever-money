"""
Metrics Snapshot Background Task

Periodically stores metrics snapshots for historical tracking and charts.
Runs in the API process without modifying validator code.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from tortoise.exceptions import IntegrityError

from validator.models.job import Job
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from api.services.metrics_calculator import MetricsCalculator
from api.models.metrics import JobMetrics, SubnetMetricsSnapshot, VaultBalanceSnapshot

logger = logging.getLogger(__name__)


async def snapshot_all_metrics(interval_seconds: int = 300):
    """
    Store metrics snapshots for all active jobs.
    
    Runs continuously in the background, storing:
    - Job metrics (TVL, revenue, APY)
    - Initial vault balances (for inventory change tracking)
    - Subnet-wide aggregates
    
    Args:
        interval_seconds: Seconds between snapshots (default: 300 = 5 minutes)
    """
    logger.info(f"Starting metrics snapshot task (interval: {interval_seconds}s)")
    
    while True:
        try:
            await _snapshot_iteration()
        except Exception as e:
            logger.error(f"Error in metrics snapshot iteration: {e}", exc_info=True)
        
        await asyncio.sleep(interval_seconds)


async def _snapshot_iteration():
    """Single snapshot iteration"""
    start_time = datetime.utcnow()
    
    # Get active jobs
    job_repo = JobRepository()
    pool_db = PoolDataDB()
    active_jobs = await job_repo.get_active_jobs()
    
    if not active_jobs:
        logger.debug("No active jobs to snapshot")
        return
    
    logger.info(f"Snapshotting metrics for {len(active_jobs)} active jobs")
    
    # Track subnet-wide aggregates
    total_tvl_usd = 0.0
    total_revenue_usd = 0.0
    
    # Snapshot each job
    for job in active_jobs:
        try:
            # Check for initial snapshot (for inventory change tracking)
            await _ensure_initial_snapshot(job)
            
            # Calculate and store current metrics
            job_metrics = await MetricsCalculator.calculate_and_store_job_metrics(
                job, pool_db
            )
            
            # Aggregate for subnet snapshot
            total_tvl_usd += job_metrics.tvl_usd or 0.0
            total_revenue_usd += job_metrics.revenue_usd or 0.0
            
            logger.debug(
                f"Stored metrics for {job.job_id}: "
                f"TVL=${job_metrics.tvl_usd:.2f}, "
                f"Revenue=${job_metrics.revenue_usd:.2f}"
            )
            
        except Exception as e:
            logger.error(f"Failed to snapshot job {job.job_id}: {e}")
            continue
    
    # Store subnet-wide snapshot
    try:
        await _store_subnet_snapshot(
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            vault_count=len(active_jobs)
        )
    except Exception as e:
        logger.error(f"Failed to store subnet snapshot: {e}")
    
    duration = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        f"Snapshot complete: {len(active_jobs)} jobs, "
        f"total TVL=${total_tvl_usd:.2f}, took {duration:.2f}s"
    )


async def _ensure_initial_snapshot(job: Job):
    """
    Ensure an initial balance snapshot exists for inventory change tracking.
    
    Creates a snapshot the first time we see a job.
    """
    # Check if initial snapshot already exists
    initial = await VaultBalanceSnapshot.filter(
        job_id=job.job_id,
        snapshot_type="initial"
    ).first()
    
    if initial:
        return  # Already have initial snapshot
    
    # First time seeing this job - create initial snapshot
    try:
        tvl = await MetricsCalculator.calculate_job_tvl(job)
        
        await VaultBalanceSnapshot.create(
            job_id=job.job_id,
            timestamp=datetime.utcnow(),
            balance_token0=tvl["tvl_token0"],
            balance_token1=tvl["tvl_token1"],
            balance_usd=tvl["tvl_usd"],
            snapshot_type="initial",
            metadata={
                "vault_address": job.sn_liquidity_manager_address,
                "pair_address": job.pair_address,
                "token0_price": tvl["token0_price_usd"],
                "token1_price": tvl["token1_price_usd"],
            }
        )
        
        logger.info(f"Created initial snapshot for job {job.job_id}: TVL=${tvl['tvl_usd']:.2f}")
        
    except IntegrityError:
        # Race condition - another process created it
        logger.debug(f"Initial snapshot already exists for {job.job_id}")
    except Exception as e:
        logger.error(f"Failed to create initial snapshot for {job.job_id}: {e}")


async def _store_subnet_snapshot(
    total_tvl_usd: float,
    total_revenue_usd: float,
    vault_count: int
):
    """Store subnet-wide metrics snapshot"""
    try:
        # Get emissions data from BittensorClient
        from api.utils.bittensor_client import BittensorClient
        
        metagraph = BittensorClient.get_metagraph()
        if metagraph:
            total_emissions_alpha = metagraph.total_emission
        else:
            total_emissions_alpha = 0.0
        
        await SubnetMetricsSnapshot.create(
            snapshot_time=datetime.utcnow(),
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            total_emissions_alpha=total_emissions_alpha,
            total_emissions_usd=0.0,  # TODO: Calculate from alpha price
            burn_ratio=0.0,  # TODO: Get from EmissionsService
            miner_ratio=0.0,  # TODO: Get from EmissionsService
            profit_ratio=0.0,  # TODO: Calculate
            metadata={
                "vault_count": vault_count,
                "snapshot_source": "api_background_task"
            }
        )
        
        logger.debug(f"Stored subnet snapshot: TVL=${total_tvl_usd:.2f}")
        
    except Exception as e:
        logger.error(f"Failed to store subnet snapshot: {e}")
