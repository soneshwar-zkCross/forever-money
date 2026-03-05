"""
Miners Router

Endpoints for miner-related operations.
"""
import logging
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query

from api.models.responses import (
    MinerProfileResponse,
    MinerPerformanceDetailResponse,
    MinerWinRateResponse,
    ErrorResponse
)
from api.models.metrics import MinerMetrics
from api.services.jobs_service import JobService
from api.services.miners_service import MinersService
from api.services.metrics_calculator import MetricsCalculator
from api.services.identity_service import IdentityService
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from validator.models.job import MinerScore, Round, RoundStatus, RoundType, Prediction, LiveExecution

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_pair_name(job) -> str:
    """Extract pair name from job metadata, falling back to job_id."""
    if job.metadata and job.metadata.get("pair_name"):
        return job.metadata["pair_name"]
    # Derive from job_id: "weth-usdc" → "WETH/USDC"
    if job.job_id and "-" in job.job_id:
        parts = job.job_id.split("-", 1)
        return f"{parts[0].upper()}/{parts[1].upper()}"
    return job.job_id or "Unknown"

# Lazy initialization of repositories
_job_repository: Optional[JobRepository] = None
_pool_data_db: Optional[PoolDataDB] = None


def get_job_repository() -> JobRepository:
    """Get or create job repository instance."""
    global _job_repository
    if _job_repository is None:
        _job_repository = JobRepository()
    return _job_repository


def get_pool_data_db() -> Optional[PoolDataDB]:
    """Get or create pool data DB instance."""
    global _pool_data_db
    if _pool_data_db is None:
        try:
            _pool_data_db = PoolDataDB()
        except Exception:
            # Pool DB might not be available in all environments
            _pool_data_db = None
    return _pool_data_db


def _is_recently_active(dt: Optional[datetime], cutoff: datetime) -> bool:
    """Compare datetimes safely, handling naive vs aware mismatch."""
    if dt is None:
        return False
    # Make both aware (UTC) for comparison
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=timezone.utc)
    return dt >= cutoff


@router.get("/")
async def list_all_miners(
    limit: int = Query(300, ge=1, le=300, description="Max miners to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    sort_by: str = Query("combined", description="Sort by: combined, evaluation, live, uid"),
):
    """
    List all miners across all jobs.

    Serves from local SQLite cache first (instant), falls back to live
    reader DB when cache is empty.
    """
    sort_map = {
        "combined": "-combined_score",
        "evaluation": "-evaluation_score",
        "live": "-live_score",
        "uid": "miner_uid",
    }
    order = sort_map.get(sort_by, "-combined_score")

    active_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # --- Try cache first (local SQLite) ---
    latest_snapshot = await MinerMetrics.all().order_by("-snapshot_time").first()

    if latest_snapshot and latest_snapshot.snapshot_time:
        snapshot_time = latest_snapshot.snapshot_time
        cached_miners = await MinerMetrics.filter(
            snapshot_time=snapshot_time
        ).order_by(order)

        # Batch-fetch last_active from live MinerScore table
        last_active_map: dict = {}
        for r in await MinerScore.all().values("miner_uid", "last_active"):
            uid = r["miner_uid"]
            la = r["last_active"]
            if uid not in last_active_map or (la and la > last_active_map[uid]):
                last_active_map[uid] = la

        total_count = len(cached_miners)
        page = cached_miners[offset:offset + limit]

        result = []
        for m in page:
            last_active_dt = last_active_map.get(m.miner_uid)
            result.append({
                "miner_uid": m.miner_uid,
                "miner_hotkey": m.miner_hotkey,
                "miner_name": m.miner_name,
                "combined_score": m.combined_score,
                "evaluation_score": m.evaluation_score,
                "live_score": m.live_score,
                "participation_days": m.participation_days,
                "is_eligible_for_live": m.is_eligible_for_live,
                "total_evaluations": m.total_evaluations,
                "total_live_rounds": m.total_live_rounds,
                "last_active": last_active_dt.isoformat() if last_active_dt else None,
                "is_active": _is_recently_active(last_active_dt, active_cutoff),
            })

        return {
            "total_miners": total_count,
            "miners": result,
            "last_synced": snapshot_time.isoformat(),
            "source": "cache",
        }

    # --- Fallback: live reader DB ---
    # Aggregate stats across ALL jobs for each miner_uid
    all_scores = await MinerScore.all().prefetch_related("job")

    aggregated: dict = {}
    for score in all_scores:
        uid = score.miner_uid
        if uid not in aggregated:
            aggregated[uid] = {
                "miner_uid": uid,
                "miner_hotkey": score.miner_hotkey,
                "combined_score": 0.0,
                "evaluation_score": 0.0,
                "live_score": 0.0,
                "participation_days": 0,
                "is_eligible_for_live": False,
                "total_evaluations": 0,
                "total_live_rounds": 0,
                "last_active": None,
            }

        agg = aggregated[uid]
        # Scores: take the max across jobs (best performance)
        agg["combined_score"] = max(agg["combined_score"], float(score.combined_score))
        agg["evaluation_score"] = max(agg["evaluation_score"], float(score.evaluation_score))
        agg["live_score"] = max(agg["live_score"], float(score.live_score))
        # Counts: sum across all jobs
        agg["total_evaluations"] += score.total_evaluations
        agg["total_live_rounds"] += score.total_live_rounds
        agg["participation_days"] += score.participation_days
        # Eligible if eligible in ANY job
        if score.is_eligible_for_live:
            agg["is_eligible_for_live"] = True
        # last_active: most recent across jobs
        if score.last_active:
            if agg["last_active"] is None or score.last_active > agg["last_active"]:
                agg["last_active"] = score.last_active

    total_count = len(aggregated)

    # Sort
    sort_key_map = {
        "combined": lambda m: -m["combined_score"],
        "evaluation": lambda m: -m["evaluation_score"],
        "live": lambda m: -m["live_score"],
        "uid": lambda m: m["miner_uid"],
    }
    miners_list = sorted(aggregated.values(), key=sort_key_map.get(sort_by, sort_key_map["combined"]))
    page = miners_list[offset:offset + limit]

    identities = await IdentityService.get_all_identities()

    result = []
    for m in page:
        last_active_dt = m["last_active"]
        result.append({
            **m,
            "miner_name": IdentityService.get_name_for_uid(m["miner_uid"], identities),
            "last_active": last_active_dt.isoformat() if last_active_dt else None,
            "is_active": _is_recently_active(last_active_dt, active_cutoff),
        })

    return {
        "total_miners": total_count,
        "miners": result,
        "last_synced": None,
        "source": "live",
    }


@router.get("/{uid}", response_model=MinerProfileResponse)
async def get_miner_profile(
    uid: int,
    include_earnings: bool = Query(True, description="Include earnings estimation")
):
    """
    Get miner profile across all jobs

    - **uid**: Miner UID
    - **include_earnings**: Include estimated earnings in response (default: True)
    """
    profile = await MinersService.get_miner_profile(uid)

    if not profile:
        raise HTTPException(status_code=404, detail=f"Miner {uid} not found")

    # Add earnings if requested
    if include_earnings:
        job_repo = get_job_repository()
        pool_db = get_pool_data_db()
        earnings = await MinersService.get_miner_earnings(uid, job_repo, pool_db)
        profile.update(earnings)

    # Resolve on-chain identity name
    identities = await IdentityService.get_all_identities()
    profile["miner_name"] = IdentityService.get_name_for_uid(uid, identities)

    return MinerProfileResponse(**profile)


@router.get("/{uid}/jobs/{job_id}", response_model=MinerPerformanceDetailResponse)
async def get_miner_performance(uid: int, job_id: str):
    """
    Get detailed miner performance on a specific job
    
    - **uid**: Miner UID
    - **job_id**: Job identifier
    """
    job = await JobService.get_job_by_id(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    performance = await MinersService.get_miner_performance(job, uid)
    
    if not performance:
        raise HTTPException(
            status_code=404,
            detail=f"Miner {uid} has no performance data for job {job_id}"
        )
    
    return MinerPerformanceDetailResponse(**performance)


@router.get("/{uid}/win-rate", response_model=MinerWinRateResponse)
async def get_miner_win_rate(
    uid: int,
    job_id: Optional[str] = Query(None, description="Filter by specific job (optional)")
):
    """
    Get win rate for a miner.

    - **uid**: Miner UID
    - **job_id**: Optional job ID to filter by specific job

    Returns win rate as percentage, total wins, and total participations.
    """
    try:
        # Calculate win rate
        win_rate = await MetricsCalculator.calculate_miner_win_rate(uid, job_id)

        # Get miner hotkey
        miner_score = await MinerScore.filter(miner_uid=uid).first()
        if not miner_score:
            raise HTTPException(status_code=404, detail=f"Miner {uid} not found")

        # Count wins and participations
        from validator.models.job import Round, RoundStatus

        query = Round.filter(
            status=RoundStatus.COMPLETED,
            predictions__miner_uid=uid,
        )

        if job_id:
            query = query.filter(job__job_id=job_id)

        total_participations = await query.count()
        total_wins = await query.filter(winner_uid=uid).count()

        return MinerWinRateResponse(
            miner_uid=uid,
            miner_hotkey=miner_score.miner_hotkey,
            win_rate=win_rate,
            total_wins=total_wins,
            total_participations=total_participations,
            job_id=job_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate win rate: {str(e)}")


@router.get("/{uid}/job-earnings/{job_id}")
async def get_miner_job_earnings(uid: int, job_id: str):
    """
    Get miner earnings for a specific job.
    
    - **uid**: Miner UID
    - **job_id**: Job identifier
    
    Returns estimated earnings in Alpha and USD for this specific job.
    """
    try:
        from api.services.miner_earnings_service import MinerEarningsService
        
        earnings = await MinerEarningsService.calculate_miner_job_earnings(uid, job_id)
        
        return {
            "miner_uid": uid,
            "job_id": job_id,
            **earnings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate job earnings: {str(e)}")


@router.get("/{uid}/dividends")
async def get_miner_dividends(uid: int):
    """
    Get current dividend balance for a miner from metagraph.

    - **uid**: Miner UID

    Returns current dividend balance in Alpha (not total historic earnings).
    """
    try:
        from api.services.miner_earnings_service import MinerEarningsService

        dividends = await MinerEarningsService.get_current_dividends(uid)

        return {
            "miner_uid": uid,
            "current_dividends_alpha": dividends,
            "note": "This is the current dividend balance, not total earnings history"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dividends: {str(e)}")


@router.get("/{uid}/score-history")
async def get_miner_score_history(uid: int):
    """
    Get score history for a miner across all jobs.

    Reads MinerScore.score_history JSON field and merges/sorts by timestamp.

    - **uid**: Miner UID
    """
    try:
        miner_scores = await MinerScore.filter(miner_uid=uid).prefetch_related("job").all()

        if not miner_scores:
            raise HTTPException(status_code=404, detail=f"Miner {uid} not found")

        all_data_points = []

        for score in miner_scores:
            history = score.score_history
            if not history:
                continue

            entries = history.get("history", []) if isinstance(history, dict) else []
            for entry in entries:
                all_data_points.append({
                    "timestamp": entry.get("timestamp", ""),
                    "combined_score": entry.get("combined_score", 0.0),
                    "evaluation_score": entry.get("evaluation_score", 0.0),
                    "live_score": entry.get("live_score", 0.0),
                    "round_type": entry.get("round_type", ""),
                    "rank": entry.get("rank"),
                })

        # Sort by timestamp
        all_data_points.sort(key=lambda x: x["timestamp"])

        return {
            "miner_uid": uid,
            "data_points": all_data_points,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get score history for miner {uid}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get score history: {str(e)}")


@router.get("/{uid}/metrics-history")
async def get_miner_metrics_history(
    uid: int,
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
):
    """
    Get historical metrics for a miner from the MinerMetrics table.

    - **uid**: Miner UID
    - **days**: Number of days to look back (default: 30)
    """
    try:
        from api.models.metrics import MinerMetrics

        cutoff = datetime.utcnow() - timedelta(days=days)
        metrics = await MinerMetrics.filter(
            miner_uid=uid,
            calculated_at__gte=cutoff,
        ).order_by("calculated_at")

        return {
            "miner_uid": uid,
            "timeframe_days": days,
            "series": [
                {
                    "timestamp": m.calculated_at.isoformat(),
                    "earnings_alpha": m.estimated_earnings_alpha,
                    "earnings_usd": m.estimated_earnings_usd,
                    "total_score": m.total_score,
                    "win_rate": m.win_rate,
                }
                for m in metrics
            ],
        }

    except Exception as e:
        logger.error(f"Failed to get metrics history for miner {uid}: {e}")
        return {
            "miner_uid": uid,
            "timeframe_days": days,
            "series": [],
        }


@router.get("/{uid}/vaults")
async def get_miner_vaults(uid: int):
    """
    Get all vaults (positions across pairs) for a miner.

    Shows the miner's participation and performance across different trading pairs.
    Each vault represents the miner's position/performance on a specific pair.

    - **uid**: Miner UID

    Returns list of vaults with pair info, scores, and performance metrics.
    """
    try:
        # Get all miner scores (one per job/pair)
        from validator.models.job import MinerScore, Job

        miner_scores = await MinerScore.filter(miner_uid=uid).prefetch_related('job').all()

        if not miner_scores:
            return {
                "miner_uid": uid,
                "total_vaults": 0,
                "vaults": []
            }

        vaults = []
        for score in miner_scores:
            job = score.job

            # Get pool data DB for revenue calculation
            pool_db = get_pool_data_db()

            # Calculate revenue for this job
            revenue_data = await JobService.get_job_revenue(job, pool_db)

            # Build vault data
            vault = {
                "vault_id": f"vault_{uid}_{job.job_id}",
                "job_id": job.job_id,
                "pair_name": _resolve_pair_name(job),
                "pair_address": job.pair_address,

                # Miner performance
                "combined_score": float(score.combined_score),
                "evaluation_score": float(score.evaluation_score),
                "live_score": float(score.live_score),
                "is_eligible_for_live": score.is_eligible_for_live,

                # Participation stats
                "total_evaluations": score.total_evaluations,
                "total_live_rounds": score.total_live_rounds,
                "participation_days": score.participation_days,

                # Job config
                "is_active": job.is_active,
                "fee_rate": job.fee_rate,
                "target_ratio": job.target_ratio,

                # Revenue metrics (estimated share)
                "revenue_usd": revenue_data.get("revenue_usd", 0),
                "revenue_token0": revenue_data.get("revenue_token0", 0),
                "revenue_token1": revenue_data.get("revenue_token1", 0),
            }

            vaults.append(vault)

        # Sort by combined score descending
        vaults.sort(key=lambda x: x["combined_score"], reverse=True)

        return {
            "miner_uid": uid,
            "miner_hotkey": miner_scores[0].miner_hotkey if miner_scores else None,
            "total_vaults": len(vaults),
            "active_vaults": sum(1 for v in vaults if v["is_eligible_for_live"]),
            "vaults": vaults
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get miner vaults: {str(e)}")


async def _resolve_pool_token_info(job) -> dict:
    """
    Resolve token0/token1 symbols and decimals for a pool.
    Returns {token0_symbol, token1_symbol, token0_decimals, token1_decimals}.
    Falls back to pair_name order if resolution fails.
    """
    pair_name = _resolve_pair_name(job)
    parts = pair_name.split("/")
    first_sym = parts[0].strip() if len(parts) > 0 else "T0"
    second_sym = parts[1].strip() if len(parts) > 1 else "T1"

    # Known token addresses on Base → (symbol, decimals)
    KNOWN_TOKENS = {
        "0x4200000000000000000000000000000000000006": ("WETH", 18),
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": ("USDC", 6),
        "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": ("USDbC", 6),
        "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": ("cbBTC", 8),
        "0xa1832f7f413e6be05b0f9a191e0ceb5d69817e27": ("BID", 18),
        "0x020897115f97e2aa031de9b30c9c88e1015c3064": ("xTAO", 18),
    }

    # Default decimals by symbol name
    SYMBOL_DECIMALS = {
        "USDC": 6, "USDT": 6, "USDbC": 6, "DAI": 18,
        "WETH": 18, "WBTC": 8, "cbBTC": 8,
        "BID": 18, "xTAO": 18, "TAO": 18,
    }

    try:
        from api.services.metrics_calculator import _resolve_pool_tokens, _normalize_address
        tokens = await _resolve_pool_tokens(job.chain_id, job.pair_address)
        if tokens:
            addr0 = _normalize_address(tokens[0])
            addr1 = _normalize_address(tokens[1])
            info0 = KNOWN_TOKENS.get(addr0)
            info1 = KNOWN_TOKENS.get(addr1)

            sym0 = info0[0] if info0 else "T0"
            sym1 = info1[0] if info1 else "T1"
            dec0 = info0[1] if info0 else 18
            dec1 = info1[1] if info1 else 18

            return {
                "token0_symbol": sym0,
                "token1_symbol": sym1,
                "token0_decimals": dec0,
                "token1_decimals": dec1,
            }
    except Exception as e:
        logger.debug(f"Could not resolve pool tokens for {job.job_id}: {e}")

    # Fallback: use pair name order, guess decimals from symbol
    return {
        "token0_symbol": first_sym,
        "token1_symbol": second_sym,
        "token0_decimals": SYMBOL_DECIMALS.get(first_sym.upper(), 18),
        "token1_decimals": SYMBOL_DECIMALS.get(second_sym.upper(), 18),
    }


@router.get("/{uid}/jobs/{job_id}/activity")
async def get_miner_vault_activity(uid: int, job_id: str):
    """
    Get round history, execution log, latest strategy, and summary
    for a specific miner on a specific job.

    All data comes from internal tables — no external API calls.
    """
    try:
        from validator.models.job import Job

        job = await Job.filter(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        # --- Round History ---
        rounds = await Round.filter(
            job=job,
            status=RoundStatus.COMPLETED,
        ).order_by("-round_number").limit(50)

        round_history = []
        eval_rounds = 0
        live_rounds = 0
        rounds_won = 0
        all_scores_list = []

        for r in rounds:
            perf = r.performance_data or {}
            scores = perf.get("scores", {})
            miner_score = scores.get(str(uid))
            is_winner = r.winner_uid == uid
            if is_winner:
                rounds_won += 1

            rt = str(r.round_type.value) if hasattr(r.round_type, 'value') else str(r.round_type)
            if rt == "evaluation":
                eval_rounds += 1
            else:
                live_rounds += 1

            if miner_score is not None:
                all_scores_list.append(miner_score)

            duration = None
            if r.start_time and r.end_time:
                duration = int((r.end_time - r.start_time).total_seconds())

            round_history.append({
                "round_number": r.round_number,
                "round_type": rt,
                "miner_score": miner_score,
                "winner_uid": r.winner_uid,
                "is_winner": is_winner,
                "all_scores": scores,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
                "duration_seconds": duration,
            })

        # --- Execution Log ---
        executions = await LiveExecution.filter(
            job=job,
            miner_uid=uid,
        ).order_by("-executed_at").limit(50).prefetch_related("round")

        execution_log = []
        failed_executions = 0
        for ex in executions:
            strategy = ex.strategy_data or {}
            positions = strategy.get("positions", [])
            error_msg = None

            if ex.tx_status == "failed":
                failed_executions += 1
                perf = ex.actual_performance or {}
                error_msg = perf.get("error") or strategy.get("error")

            execution_log.append({
                "round_number": ex.round.round_number if ex.round else None,
                "tx_status": ex.tx_status,
                "tx_hash": ex.tx_hash,
                "error": error_msg,
                "positions": positions,
                "executed_at": ex.executed_at.isoformat() if ex.executed_at else None,
            })

        # --- Recent Strategies (from last 50 predictions with data) ---
        recent_predictions = await Prediction.filter(
            job=job,
            miner_uid=uid,
            accepted=True,
        ).order_by("-submitted_at").limit(50)

        recent_strategies = []
        for pred in recent_predictions:
            pd = pred.prediction_data
            if not pd:
                continue

            # prediction_data can be:
            # 1. A list of rebalance steps [{old_positions, new_positions, inventory, block, price}, ...]
            # 2. A dict with keys like {positions, inventory, ...}
            steps = pd if isinstance(pd, list) else [pd]

            for step in steps:
                if not isinstance(step, dict):
                    continue
                positions = step.get("new_positions") or step.get("positions") or []
                inventory = step.get("inventory")
                entry = {
                    "positions": positions,
                    "inventory": inventory,
                    "block": step.get("block"),
                    "price": step.get("price"),
                    "submitted_at": pred.submitted_at.isoformat() if pred.submitted_at else None,
                    "round_id": str(pred.round_id) if pred.round_id else None,
                }
                recent_strategies.append(entry)

        # Also pull positions from LiveExecution strategy_data as a fallback
        if not recent_strategies:
            for ex in executions:
                strategy = ex.strategy_data or {}
                positions = strategy.get("positions", [])
                if positions:
                    recent_strategies.append({
                        "positions": positions,
                        "inventory": None,
                        "block": None,
                        "price": None,
                        "submitted_at": ex.executed_at.isoformat() if ex.executed_at else None,
                        "round_id": None,
                    })

        latest_strategy = recent_strategies[0] if recent_strategies else None

        # --- Pool Token Info ---
        pool_tokens = await _resolve_pool_token_info(job)

        # --- Summary ---
        total_rounds = len(round_history)
        avg_score = (sum(all_scores_list) / len(all_scores_list)) if all_scores_list else 0.0
        best_score = max(all_scores_list) if all_scores_list else 0.0

        summary = {
            "total_rounds": total_rounds,
            "eval_rounds": eval_rounds,
            "live_rounds": live_rounds,
            "rounds_won": rounds_won,
            "avg_score": avg_score,
            "best_score": best_score,
            "total_executions": len(execution_log),
            "failed_executions": failed_executions,
        }

        return {
            "miner_uid": uid,
            "job_id": job_id,
            "pool_tokens": pool_tokens,
            "round_history": round_history,
            "execution_log": execution_log,
            "latest_strategy": latest_strategy,
            "recent_strategies": recent_strategies[:50],
            "summary": summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get vault activity for miner {uid} job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get vault activity: {str(e)}")
