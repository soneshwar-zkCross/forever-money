"""
Miners Service

Business logic for miner-related operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q

from validator.models.job import Job, MinerScore, Prediction, MinerParticipation


class MinersService:
    """Service for miner operations"""

    @staticmethod
    async def get_miner_profile(miner_uid: int) -> Optional[Dict[str, Any]]:
        """Get miner profile across all jobs"""
        # Get all miner scores
        scores = await MinerScore.filter(miner_uid=miner_uid).prefetch_related('job')
        
        if not scores:
            return None
        
        # Get miner hotkey from first score
        miner_hotkey = scores[0].miner_hotkey
        
        # Calculate global stats
        total_jobs = len(scores)
        total_rounds = sum(s.total_evaluations + s.total_live_rounds for s in scores)
        total_wins = sum(s.successful_evaluations + s.successful_live_rounds for s in scores)
        global_win_rate = total_wins / total_rounds if total_rounds > 0 else 0
        
        # Build per-job performance
        jobs = []
        for score in scores:
            jobs.append({
                "job_id": score.job.job_id,
                "pair_name": score.job.metadata.get("pair_name") if score.job.metadata else None,
                "combined_score": float(score.combined_score),
                "evaluation_score": float(score.evaluation_score),
                "live_score": float(score.live_score),
                "rank": 0,  # Would need to calculate
                "participation_days": score.participation_days,
                "is_eligible_for_live": score.is_eligible_for_live,
                "total_evaluations": score.total_evaluations,
                "total_live_rounds": score.total_live_rounds,
                "wins": score.successful_evaluations + score.successful_live_rounds,
                "first_seen": score.first_seen,
                "last_active": score.last_active,
            })
        
        return {
            "miner_uid": miner_uid,
            "miner_hotkey": miner_hotkey,
            "total_jobs": total_jobs,
            "total_rounds": total_rounds,
            "global_win_rate": global_win_rate,
            "jobs": jobs,
        }

    @staticmethod
    async def get_miner_performance(job: Job, miner_uid: int) -> Optional[Dict[str, Any]]:
        """Get detailed miner performance on a specific job"""
        # Get miner score
        score = await MinerScore.filter(job=job, miner_uid=miner_uid).first()
        
        if not score:
            return None
        
        # Get rank
        higher_scores = await MinerScore.filter(
           job=job,
            combined_score__gt=score.combined_score
        ).count()
        rank = higher_scores + 1
        
        # Calculate percentile
        total_miners = await MinerScore.filter(job=job).count()
        percentile = ((total_miners - rank) / total_miners * 100) if total_miners > 0 else 0
        
        # Build scores dict
        scores_dict = {
            "combined_score": float(score.combined_score),
            "evaluation_score": float(score.evaluation_score),
            "live_score": float(score.live_score),
            "rank": rank,
            "percentile": percentile,
        }
        
        # Get score history
        score_history = score.score_history.get("history", []) if score.score_history else []
        
        # Get recent predictions
        recent_predictions = await MinersService._get_recent_predictions(job, miner_uid)
        
        # Get participation history
        participation = await MinersService._get_participation_history(job, miner_uid)
        
        return {
            "miner_uid": miner_uid,
            "miner_hotkey": score.miner_hotkey,
            "job_id": job.job_id,
            "scores": scores_dict,
            "score_history": score_history,
            "recent_predictions": recent_predictions,
            "participation": participation,
        }

    @staticmethod
    async def _get_recent_predictions(job: Job, miner_uid: int, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent predictions for a miner"""
        predictions = await Prediction.filter(
            job=job,
            miner_uid=miner_uid,
            accepted=True
        ).order_by("-submitted_at").limit(limit).prefetch_related('round')
        
        result = []
        for pred in predictions:
            # Count rebalances from prediction_data
            rebalance_count = len(pred.prediction_data) if pred.prediction_data else 0
            
            # Calculate average position width
            avg_position_width = 0
            if pred.prediction_data and len(pred.prediction_data) > 0:
                widths = []
                for rebalance in pred.prediction_data:
                    new_positions = rebalance.get("new_positions", [])
                    for pos in new_positions:
                        width = pos.get("tick_upper", 0) - pos.get("tick_lower", 0)
                        widths.append(width)
                avg_position_width = sum(widths) / len(widths) if widths else 0
            
            result.append({
                "round_id": pred.round.round_id,
                "round_number": pred.round.round_number,
                "round_type": pred.round.round_type.value,
                "accepted": pred.accepted,
                "refusal_reason": pred.refusal_reason,
                "response_time_ms": pred.response_time_ms,
                "simulated_performance": pred.simulated_performance or {},
                "rebalance_count": rebalance_count,
                "avg_position_width_ticks": avg_position_width,
                "submitted_at": pred.submitted_at,
            })
        
        return result

    @staticmethod
    async def _get_participation_history(job: Job, miner_uid: int, days: int = 30) -> List[Dict[str, Any]]:
        """Get participation history for last N days"""
        start_date = datetime.utcnow().date() - timedelta(days=days)
        
        participation_records = await MinerParticipation.filter(
            job=job,
            miner_uid=miner_uid,
            participation_date__gte=start_date
        ).order_by("-participation_date")
        
        return [
            {
                "date": str(p.participation_date),
                "participated": p.participated,
                "rounds_participated": p.rounds_participated,
                "rounds_refused": p.rounds_refused,
            }
            for p in participation_records
        ]
