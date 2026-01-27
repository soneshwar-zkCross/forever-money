"""
Leaderboard Service

Business logic for leaderboard operations.
"""
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q
from tortoise.functions import Count

from validator.models.job import Job, MinerScore, Prediction, MinerParticipation


class LeaderboardService:
    """Service for leaderboard operations"""

    @staticmethod
    async def get_leaderboard(
        job: Job,
        limit: int = 50,
        offset: int = 0,
        eligible_only: bool = False,
        sort_by: str = "combined"
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get ranked miners for a job
        
        Returns: (miners_list, total_count)
        """
        # Build query
        query = MinerScore.filter(job=job)
        
        if eligible_only:
            query = query.filter(is_eligible_for_live=True)
        
        # Sorting
        if sort_by == "evaluation":
            query = query.order_by("-evaluation_score")
        elif sort_by == "live":
            query = query.order_by("-live_score")
        else:  # combined (default)
            query = query.order_by("-combined_score")
        
        # Get total count
        total_count = await query.count()
        
        # Get paginated results
        miners = await query.offset(offset).limit(limit)
        
        # Build response with ranks and calculated fields
        result = []
        for rank, miner in enumerate(miners, start=offset + 1):
            # Calculate win rate
            win_rate = (
                miner.successful_evaluations / miner.total_evaluations
                if miner.total_evaluations > 0
                else 0
            )
            
            # Get average response time (would need to query predictions)
            avg_response_time = await LeaderboardService._get_avg_response_time(
                job, miner.miner_uid
            )
            
            result.append({
                "rank": rank,
                "miner_uid": miner.miner_uid,
                "miner_hotkey": miner.miner_hotkey,
                "combined_score": float(miner.combined_score),
                "evaluation_score": float(miner.evaluation_score),
                "live_score": float(miner.live_score),
                "participation_days": miner.participation_days,
                "is_eligible_for_live": miner.is_eligible_for_live,
                "total_evaluations": miner.total_evaluations,
                "total_live_rounds": miner.total_live_rounds,
                "successful_evaluations": miner.successful_evaluations,
                "successful_live_rounds": miner.successful_live_rounds,
                "refusals": miner.refusals,
                "win_rate": win_rate,
                "avg_response_time_ms": avg_response_time,
                "first_seen": miner.first_seen,
                "last_active": miner.last_active,
            })
        
        return result, total_count

    @staticmethod
    async def _get_avg_response_time(job: Job, miner_uid: int) -> Optional[float]:
        """Calculate average response time for a miner"""
        # Get recent predictions with response times
        predictions = await Prediction.filter(
            job=job,
            miner_uid=miner_uid,
            accepted=True,
            response_time_ms__isnull=False
        ).order_by("-submitted_at").limit(20)
        
        if not predictions:
            return None
        
        total_time = sum(p.response_time_ms for p in predictions if p.response_time_ms)
        count = len([p for p in predictions if p.response_time_ms])
        
        return total_time / count if count > 0 else None

    @staticmethod
    async def get_top_miners(job: Job, n: int = 10) -> List[Dict[str, Any]]:
        """Get top N miners for a job"""
        miners, _ = await LeaderboardService.get_leaderboard(
            job=job,
            limit=n,
            offset=0,
            eligible_only=False,
            sort_by="combined"
        )
        return miners
