"""
Job Service

Business logic for job-related operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q
from tortoise.functions import Count

from validator.models.job import Job, Round, MinerScore, RoundStatus


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
