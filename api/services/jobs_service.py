"""
Job Service

Business logic for job-related operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q
from tortoise.functions import Count
import logging

from validator.models.job import Job, Round, MinerScore, RoundStatus
from validator.repositories.pool import PoolDataDB

logger = logging.getLogger(__name__)


class JobService:
    """Service for job operations"""

    @staticmethod
    async def get_all_jobs(is_active: Optional[bool] = None) -> List[Job]:
        """Get all jobs with optional filter by active status"""
        query = Job.all()
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at")

    @staticmethod
    async def get_job_by_id(job_id: str) -> Optional[Job]:
        """Get job by ID"""
        return await Job.filter(job_id=job_id).first()

    @staticmethod
    async def get_job_stats(job: Job) -> Dict[str, Any]:
        """Get aggregated statistics for a job"""
        # Total rounds
        total_rounds = await Round.filter(job=job).count()
        
        # Total miners (distinct)
        total_miners = await MinerScore.filter(job=job).count()
        
        # Active miners in last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        active_miners_24h = await MinerScore.filter(
            job=job,
            last_active__gte=yesterday
        ).count()
        
        # Average participation rate
        if total_miners > 0:
            # Get average participation from recent rounds
            recent_rounds = await Round.filter(
                job=job,
                status=RoundStatus.COMPLETED
            ).order_by("-round_number").limit(10)
            
            if recent_rounds:
                avg_participants = sum(
                    len(r.performance_data.get("scores", {})) for r in recent_rounds
                ) / len(recent_rounds)
                avg_participation_rate = avg_participants / total_miners if total_miners > 0 else 0
            else:
                avg_participation_rate = 0
        else:
            avg_participation_rate = 0
        
        # Current round number
        latest_round = await Round.filter(job=job).order_by("-round_number").first()
        current_round_number = latest_round.round_number if latest_round else 0
        
        return {
            "total_rounds": total_rounds,
            "total_miners": total_miners,
            "active_miners_24h": active_miners_24h,
            "avg_participation_rate": avg_participation_rate,
            "current_round_number": current_round_number,
        }

    @staticmethod
    async def get_current_round(job: Job) -> Optional[Dict[str, Any]]:
        """Get current active round for a job"""
        current_round = await Round.filter(
            job=job,
            status=RoundStatus.ACTIVE
        ).first()

        if not current_round:
            return None

        # Calculate time remaining
        now = datetime.utcnow()
        time_remaining = (current_round.round_deadline - now).total_seconds()

        # Calculate progress
        total_duration = (current_round.round_deadline - current_round.start_time).total_seconds()
        elapsed = (now - current_round.start_time).total_seconds()
        progress_percent = min(100, (elapsed / total_duration * 100)) if total_duration > 0 else 0

        return {
            "round_id": current_round.round_id,
            "round_type": current_round.round_type.value,
            "round_number": current_round.round_number,
            "start_time": current_round.start_time,
            "round_deadline": current_round.round_deadline,
            "status": current_round.status.value,
            "time_remaining_seconds": max(0, int(time_remaining)),
            "progress_percent": progress_percent,
        }

    @staticmethod
    async def get_job_revenue(
        job: Job,
        pool_data_db: Optional[PoolDataDB] = None,
        lookback_days: int = 30,
    ) -> Dict[str, float]:
        """
        Get revenue metrics for a job.

        Args:
            job: Job instance
            pool_data_db: Pool data database instance
            lookback_days: Number of days to look back

        Returns:
            Dict with revenue metrics
        """
        if not pool_data_db:
            logger.warning("PoolDataDB not available, returning 0 revenue")
            return {
                "revenue_usd": 0.0,
                "revenue_token0": 0.0,
                "revenue_token1": 0.0,
                "avg_revenue_per_round": 0.0,
            }

        try:
            # Get vault fees from pool data
            vault_fees = await pool_data_db.get_miner_vault_fees(
                sn_liquditiy_manager_addresses=[job.sn_liquidity_manager_address],
                start_block=0,
                end_block=999999999,
            )

            if job.sn_liquidity_manager_address not in vault_fees:
                return {
                    "revenue_usd": 0.0,
                    "revenue_token0": 0.0,
                    "revenue_token1": 0.0,
                    "avg_revenue_per_round": 0.0,
                }

            fees = vault_fees[job.sn_liquidity_manager_address]
            fee0_wei = fees.get("fee0", 0.0)
            fee1_wei = fees.get("fee1", 0.0)

            # Convert from wei to tokens
            fee0_tokens = float(fee0_wei) / 1e18
            fee1_tokens = float(fee1_wei) / 1e18

            # Simplified USD conversion (token0 = $1, token1 = $1)
            # TODO: Use actual token prices from PriceService
            revenue_usd = fee0_tokens + fee1_tokens

            # Calculate average revenue per round
            total_rounds = await Round.filter(job=job).count()
            avg_revenue_per_round = revenue_usd / total_rounds if total_rounds > 0 else 0.0

            return {
                "revenue_usd": revenue_usd,
                "revenue_token0": fee0_tokens,
                "revenue_token1": fee1_tokens,
                "avg_revenue_per_round": avg_revenue_per_round,
            }

        except Exception as e:
            logger.error(f"Failed to get job revenue for {job.job_id}: {e}")
            return {
                "revenue_usd": 0.0,
                "revenue_token0": 0.0,
                "revenue_token1": 0.0,
                "avg_revenue_per_round": 0.0,
            }

    @staticmethod
    async def get_job_revenue_detail(
        job: Job,
        pool_data_db: Optional[PoolDataDB] = None,
        lookback_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Get detailed revenue breakdown for a job.

        Args:
            job: Job instance
            pool_data_db: Pool data database instance
            lookback_days: Number of days to look back

        Returns:
            Dict with detailed revenue metrics
        """
        revenue = await JobService.get_job_revenue(job, pool_data_db, lookback_days)

        return {
            "job_id": job.job_id,
            "vault_address": job.sn_liquidity_manager_address,
            "pair_address": job.pair_address,
            "revenue_usd": revenue["revenue_usd"],
            "revenue_token0": revenue["revenue_token0"],
            "revenue_token1": revenue["revenue_token1"],
            "lookback_days": lookback_days,
            "updated_at": datetime.utcnow().isoformat(),
        }
