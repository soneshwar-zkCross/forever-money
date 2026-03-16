"""
Activity Service

Provides miner-activity analytics for a job using purely internal data
(MinerScore, Round, Prediction).  Zero external API calls.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from tortoise.functions import Avg

from validator.models.job import Job, MinerScore, Round, RoundStatus, Prediction

logger = logging.getLogger(__name__)


class ActivityService:
    """Aggregate miner-activity metrics for a single job."""

    @staticmethod
    async def get_job_activity(job_id: str) -> Dict[str, Any]:
        job = await Job.filter(job_id=job_id).first()
        if not job:
            return {}

        miner_activity = await ActivityService._miner_activity(job)
        score_stats = await ActivityService._score_stats(job)
        round_outcomes = await ActivityService._round_outcomes(job)
        win_distribution = await ActivityService._win_distribution(job)

        return {
            "job_id": job_id,
            "miner_activity": miner_activity,
            "score_stats": score_stats,
            "round_outcomes": round_outcomes,
            "win_distribution": win_distribution,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _miner_activity(job: Job) -> Dict[str, Any]:
        scores = await MinerScore.filter(job=job).all()
        total_miners = len(scores)

        cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        active_24h = sum(
            1 for s in scores if s.last_active and s.last_active.replace(tzinfo=timezone.utc) >= cutoff_24h
        )

        # Average response time from recent predictions
        avg_response_time_ms: float = 0.0
        try:
            recent_rounds = await Round.filter(job=job).order_by("-round_number").limit(10).values_list("id", flat=True)
            if recent_rounds:
                agg = await Prediction.filter(
                    round_id__in=recent_rounds, accepted=True
                ).annotate(avg_rt=Avg("response_time_ms")).values("avg_rt")
                if agg and agg[0]["avg_rt"] is not None:
                    avg_response_time_ms = round(float(agg[0]["avg_rt"]), 1)
        except Exception as e:
            logger.debug(f"Could not compute avg response time: {e}")

        return {
            "active_miners_24h": active_24h,
            "total_miners": total_miners,
            "avg_response_time_ms": avg_response_time_ms,
        }

    @staticmethod
    async def _score_stats(job: Job) -> Dict[str, Any]:
        scores = await MinerScore.filter(job=job).all()
        if not scores:
            return {
                "avg_combined_score": 0.0,
                "top_combined_score": 0.0,
                "score_distribution": {"min": 0, "q25": 0, "q50": 0, "q75": 0, "max": 0},
            }

        combined = sorted(float(s.combined_score) for s in scores)
        n = len(combined)

        def _percentile(data: List[float], p: float) -> float:
            idx = (p / 100) * (len(data) - 1)
            lo = int(idx)
            hi = min(lo + 1, len(data) - 1)
            frac = idx - lo
            return round(data[lo] * (1 - frac) + data[hi] * frac, 6)

        return {
            "avg_combined_score": round(sum(combined) / n, 6),
            "top_combined_score": round(combined[-1], 6),
            "score_distribution": {
                "min": round(combined[0], 6),
                "q25": _percentile(combined, 25),
                "q50": _percentile(combined, 50),
                "q75": _percentile(combined, 75),
                "max": round(combined[-1], 6),
            },
        }

    @staticmethod
    async def _round_outcomes(job: Job) -> Dict[str, Any]:
        rounds = await Round.filter(job=job).all()

        total = len(rounds)
        eval_rounds = sum(1 for r in rounds if r.round_type == "evaluation")
        live_rounds = sum(1 for r in rounds if r.round_type == "live")
        completed = sum(1 for r in rounds if r.status == RoundStatus.COMPLETED)
        completion_rate = round(completed / total * 100, 1) if total else 0.0

        # Average round duration (completed rounds only)
        durations: List[float] = []
        for r in rounds:
            if r.status == RoundStatus.COMPLETED and r.start_time and r.end_time:
                dur = (r.end_time - r.start_time).total_seconds()
                if dur > 0:
                    durations.append(dur)
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0.0

        # Recent winners (last 10 completed rounds with a winner)
        recent_winners: List[Dict[str, Any]] = []
        completed_rounds = sorted(
            (r for r in rounds if r.status == RoundStatus.COMPLETED and r.winner_uid is not None),
            key=lambda r: r.round_number,
            reverse=True,
        )[:10]
        for r in completed_rounds:
            recent_winners.append({
                "round_number": r.round_number,
                "round_type": r.round_type,
                "winner_uid": r.winner_uid,
            })

        return {
            "total_rounds": total,
            "eval_rounds": eval_rounds,
            "live_rounds": live_rounds,
            "completion_rate": completion_rate,
            "avg_round_duration_seconds": avg_duration,
            "recent_winners": recent_winners,
        }

    @staticmethod
    async def _win_distribution(job: Job) -> List[Dict[str, Any]]:
        """Top 5 miners by win count."""
        rounds = await Round.filter(
            job=job, status=RoundStatus.COMPLETED
        ).all()

        if not rounds:
            return []

        total_completed = len(rounds)
        wins_by_uid: Dict[int, int] = {}
        hotkey_by_uid: Dict[int, str] = {}

        for r in rounds:
            uid = r.winner_uid
            if uid is None:
                continue
            wins_by_uid[uid] = wins_by_uid.get(uid, 0) + 1

        # Resolve hotkeys from MinerScore
        uids = list(wins_by_uid.keys())
        if uids:
            scores = await MinerScore.filter(job=job, miner_uid__in=uids).all()
            for s in scores:
                hotkey_by_uid[s.miner_uid] = s.miner_hotkey

        top = sorted(wins_by_uid.items(), key=lambda x: x[1], reverse=True)[:5]
        return [
            {
                "miner_uid": uid,
                "miner_hotkey": hotkey_by_uid.get(uid, ""),
                "wins": wins,
                "win_rate": round(wins / total_completed * 100, 1) if total_completed else 0.0,
            }
            for uid, wins in top
        ]
