"""
Rounds Service

Business logic for round-related operations.
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from tortoise.expressions import Q

from validator.models.job import Job, Round, RoundStatus, RoundType, Prediction


class RoundsService:
    """Service for round operations"""

    @staticmethod
    async def get_rounds(
        job: Job,
        limit: int = 50,
        offset: int = 0,
        round_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get rounds for a job with filtering
        
        Returns: (rounds_list, total_count)
        """
        query = Round.filter(job=job)
        
        if round_type:
            query = query.filter(round_type=RoundType(round_type))
        
        if status:
            query = query.filter(status=RoundStatus(status))
        
        # Get total count
        total_count = await query.count()
        
        # Get paginated results
        rounds = await query.order_by("-round_number").offset(offset).limit(limit)
        
        #Build response
        result = []
        for round_obj in rounds:
            # Calculate duration if ended
            duration_seconds = None
            if round_obj.end_time:
                duration_seconds = int((round_obj.end_time - round_obj.start_time).total_seconds())
            
            # Get participant count from performance_data
            participants = len(round_obj.performance_data.get("scores", {})) if round_obj.performance_data else 0
            
            # Get winner info
            winner_info = await RoundsService._get_winner_info(round_obj)
            
            result.append({
                "round_id": round_obj.round_id,
                "round_type": round_obj.round_type.value,
                "round_number": round_obj.round_number,
                "start_time": round_obj.start_time,
                "round_deadline": round_obj.round_deadline,
                "end_time": round_obj.end_time,
                "status": round_obj.status.value,
                "winner_uid": winner_info.get("uid"),
                "winner_hotkey": winner_info.get("hotkey"),
                "winner_score": winner_info.get("score"),
                "participants": participants,
                "duration_seconds": duration_seconds,
            })
        
        return result, total_count

    @staticmethod
    async def get_current_round(job: Job) -> Optional[Dict[str, Any]]:
        """Get current active round"""
        round_obj = await Round.filter(
            job=job,
            status=RoundStatus.ACTIVE
        ).first()
        
        if not round_obj:
            return None
        
        # Calculate timings
        now = datetime.utcnow()
        time_remaining = max(0, int((round_obj.round_deadline - now).total_seconds()))
        total_duration = (round_obj.round_deadline - round_obj.start_time).total_seconds()
        elapsed = (now - round_obj.start_time).total_seconds()
        progress_percent = min(100, (elapsed / total_duration * 100)) if total_duration > 0 else 0
        
        return {
            "round_id": round_obj.round_id,
            "round_type": round_obj.round_type.value,
            "round_number": round_obj.round_number,
            "start_time": round_obj.start_time,
            "round_deadline": round_obj.round_deadline,
            "status": round_obj.status.value,
            "time_remaining_seconds": time_remaining,
            "progress_percent": progress_percent,
        }

    @staticmethod
    async def get_round_details(round_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed round information including all scores"""
        round_obj = await Round.filter(round_id=round_id).first()
        
        if not round_obj:
            return None
        
        # Calculate duration
        duration_seconds = None
        if round_obj.end_time:
            duration_seconds = int((round_obj.end_time - round_obj.start_time).total_seconds())
        
        # Get winner info
        winner_info = await RoundsService._get_winner_info(round_obj)
        
        # Get all scores
        scores = round_obj.performance_data.get("scores", {}) if round_obj.performance_data else {}
        
        return {
            "round_id": round_obj.round_id,
            "round_type": round_obj.round_type.value,
            "round_number": round_obj.round_number,
            "start_time": round_obj.start_time,
            "round_deadline": round_obj.round_deadline,
            "end_time": round_obj.end_time,
            "status": round_obj.status.value,
            "winner_uid": winner_info.get("uid"),
            "winner_hotkey": winner_info.get("hotkey"),
            "winner_score": winner_info.get("score"),
            "participants": len(scores),
            "duration_seconds": duration_seconds,
            "scores": scores,
        }

    @staticmethod
    async def _get_winner_info(round_obj: Round) -> Dict[str, Any]:
        """Get winner information from round"""
        if not round_obj.winner_uid or not round_obj.performance_data:
            return {}
        
        scores = round_obj.performance_data.get("scores", {})
        winner_data = scores.get(str(round_obj.winner_uid), {})
        
        return {
            "uid": round_obj.winner_uid,
            "hotkey": winner_data.get("hotkey"),
            "score": winner_data.get("score"),
        }
