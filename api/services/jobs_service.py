"""
Job Service

Business logic for job-related operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q
from tortoise.functions import Count
import logging

from validator.models.job import Job, Round, MinerScore, RoundStatus, LiveExecution, Prediction
from validator.models.pool_events import SwapEvent, CollectEvent
from validator.repositories.pool import PoolDataDB
from api.utils.address import normalize_evt_address
from api.utils.pool_data_service import POOL_CONFIGS

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
            # Fallback: try computing revenue from reader DB collects table
            try:
                from api.services.reader_db_metrics import ReaderDBMetricsService
                rev = await ReaderDBMetricsService.get_vault_revenue(
                    job.pair_address, job.sn_liquidity_manager_address
                )
                if rev["revenue_token0"] > 0 or rev["revenue_token1"] > 0:
                    total_rounds = await Round.filter(job=job).count()
                    prices = await ReaderDBMetricsService.get_token_prices(job)
                    revenue_usd = ReaderDBMetricsService.tokens_to_usd(
                        rev["revenue_token0"], rev["revenue_token1"],
                        prices["price0"], prices["price1"],
                    )
                    return {
                        "revenue_usd": revenue_usd,
                        "revenue_token0": rev["revenue_token0"],
                        "revenue_token1": rev["revenue_token1"],
                        "avg_revenue_per_round": revenue_usd / total_rounds if total_rounds > 0 else 0.0,
                    }
            except Exception as fb_err:
                logger.debug(f"Reader DB revenue fallback failed: {fb_err}")

            logger.warning("PoolDataDB not available, returning 0 revenue")
            return {
                "revenue_usd": 0.0,
                "revenue_token0": 0.0,
                "revenue_token1": 0.0,
                "avg_revenue_per_round": 0.0,
            }

        try:
            # Query CollectEvent directly with BOTH vault owner AND pool address
            # to avoid cross-pool fee contamination.
            vault_addr = normalize_evt_address(job.sn_liquidity_manager_address)
            pool_addr = normalize_evt_address(job.pair_address)

            collects = await CollectEvent.filter(
                owner=vault_addr,
                evt_address=pool_addr,
            )

            if not collects:
                logger.info(
                    f"Revenue [{job.job_id}]: no CollectEvents for "
                    f"vault={vault_addr[:12]}... pool={pool_addr[:12]}..."
                )
                return {
                    "revenue_usd": 0.0,
                    "revenue_token0": 0.0,
                    "revenue_token1": 0.0,
                    "avg_revenue_per_round": 0.0,
                }

            fee0_wei = sum(abs(float(c.amount0)) for c in collects)
            fee1_wei = sum(abs(float(c.amount1)) for c in collects)

            # The reader DB normalises all amounts to 18 decimals
            fee0_tokens = float(fee0_wei) / 1e18
            fee1_tokens = float(fee1_wei) / 1e18

            # Convert to USD using actual token prices
            from api.services.reader_db_metrics import ReaderDBMetricsService
            prices = await ReaderDBMetricsService.get_token_prices(job)
            revenue_usd = ReaderDBMetricsService.tokens_to_usd(
                fee0_tokens, fee1_tokens, prices["price0"], prices["price1"]
            )

            logger.info(
                f"Revenue [{job.job_id}]: "
                f"fee0_raw={float(fee0_wei):.0f} fee1_raw={float(fee1_wei):.0f} "
                f"fee0_tok={fee0_tokens:.6f} fee1_tok={fee1_tokens:.6f} "
                f"p0=${prices['price0']:.4f} p1=${prices['price1']:.4f} "
                f"rev_usd=${revenue_usd:.2f}"
            )

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
            logger.error(f"Failed to get job revenue for {job.job_id}: {e}", exc_info=True)
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

    @staticmethod
    async def get_current_position(job: Job) -> Dict[str, Any]:
        """
        Get the current active liquidity position from the latest live execution.

        Returns tick range and converted price range.
        """
        try:
            # Get the most recent live execution
            latest_execution = await LiveExecution.filter(
                job=job,
                tx_status="SUCCESS"
            ).order_by("-executed_at").first()

            if not latest_execution or not latest_execution.strategy_data:
                return {
                    "has_position": False,
                    "lower_tick": None,
                    "upper_tick": None,
                    "lower_price": None,
                    "upper_price": None,
                }

            lower_tick = latest_execution.strategy_data.get("lower_tick")
            upper_tick = latest_execution.strategy_data.get("upper_tick")

            if lower_tick is None or upper_tick is None:
                return {
                    "has_position": False,
                    "lower_tick": None,
                    "upper_tick": None,
                    "lower_price": None,
                    "upper_price": None,
                }

            # Convert ticks to prices using formula: price = 1.0001^tick
            # This gives the price of token1 in terms of token0
            lower_price = 1.0001 ** lower_tick
            upper_price = 1.0001 ** upper_tick

            # For xTAO/USDC inverted price (xTAO price in USDC)
            # We need to invert: 1 / (token1/token0) = token0/token1
            # But actually for most pairs we want token1/token0
            # The tick price represents how much token0 per token1
            # So 1.0001^tick * 10^(decimals0 - decimals1)

            # For simplicity, return raw tick-based prices
            # The frontend can adjust based on pair configuration

            return {
                "has_position": True,
                "lower_tick": int(lower_tick),
                "upper_tick": int(upper_tick),
                "lower_price": lower_price,
                "upper_price": upper_price,
                "execution_id": latest_execution.execution_id,
                "executed_at": latest_execution.executed_at,
            }

        except Exception as e:
            logger.error(f"Failed to get current position for {job.job_id}: {e}")
            return {
                "has_position": False,
                "lower_tick": None,
                "upper_tick": None,
                "lower_price": None,
                "upper_price": None,
            }

    @staticmethod
    def _get_pool_cfg(pair_address: str) -> dict:
        """Look up POOL_CONFIGS by pair_address (handles 0x prefix)."""
        key = pair_address.strip().lower()
        if not key.startswith("0x"):
            key = "0x" + key
        return POOL_CONFIGS.get(key, {
            "token0": {"symbol": "Token0", "decimals": 18},
            "token1": {"symbol": "Token1", "decimals": 18},
            "fee_tier": 0.003,
            "invert_price": False,
        })

    @staticmethod
    async def get_pool_price(job: Job) -> Dict[str, Any]:
        """
        Get pool price statistics from swap events.

        Args:
            job: Job instance

        Returns:
            Dict with price statistics
        """
        _null_price = {
            "current_price": None,
            "price_24h_ago": None,
            "price_24h_high": None,
            "price_24h_low": None,
            "price_change_24h": None,
            "price_change_24h_percent": None,
            "volume_24h_usd": None,
            "swap_count_24h": 0,
            "last_swap_timestamp": None,
        }

        try:
            # FIX: normalize address (strip 0x) to match reader DB format
            normalized_addr = normalize_evt_address(job.pair_address)
            cfg = JobService._get_pool_cfg(job.pair_address)
            dec0 = cfg["token0"]["decimals"]
            dec1 = cfg["token1"]["decimals"]
            decimal_adj = 10 ** (dec0 - dec1)

            def tick_to_price(tick_val):
                p = (1.0001 ** int(tick_val)) * decimal_adj
                if cfg.get("invert_price"):
                    return 1.0 / p if p > 0 else 0.0
                return p

            # Get swap events for last 24 hours
            twenty_four_hours_ago = int((datetime.utcnow() - timedelta(hours=24)).timestamp())

            swaps_24h = await SwapEvent.filter(
                evt_address=normalized_addr,
                evt_block_time__gte=twenty_four_hours_ago
            ).order_by("evt_block_time")

            if not swaps_24h:
                # Try reader DB fallback
                try:
                    from api.services.reader_db_metrics import ReaderDBMetricsService
                    stats = await ReaderDBMetricsService.get_price_stats_24h(job.pair_address)
                    if stats.get("current_price") is not None:
                        vol = await ReaderDBMetricsService.get_volume_24h(job.pair_address)
                        current_position = await JobService.get_current_position(job)
                        return {
                            "current_price": stats["current_price"],
                            "price_24h_ago": stats["open_price"],
                            "price_24h_high": stats["high_price"],
                            "price_24h_low": stats["low_price"],
                            "price_change_24h": (stats["current_price"] - stats["open_price"]) if stats["open_price"] else None,
                            "price_change_24h_percent": stats["price_change_percent"],
                            "volume_24h_usd": vol["volume_token1"],
                            "swap_count_24h": stats["swap_count"],
                            "last_swap_timestamp": None,
                            "current_position": current_position,
                        }
                except Exception as fb_err:
                    logger.debug(f"Reader DB fallback failed for price: {fb_err}")

                current_position = await JobService.get_current_position(job)
                return {**_null_price, "current_position": current_position}

            # Use tick-based pricing (more accurate than amount ratios)
            ticks = [int(s.tick) for s in swaps_24h]

            current_price = tick_to_price(ticks[-1])
            price_24h_ago = tick_to_price(ticks[0])

            if cfg.get("invert_price"):
                price_high = tick_to_price(min(ticks))
                price_low = tick_to_price(max(ticks))
            else:
                price_high = tick_to_price(max(ticks))
                price_low = tick_to_price(min(ticks))

            price_change = current_price - price_24h_ago
            price_change_percent = (price_change / price_24h_ago * 100) if price_24h_ago != 0 else 0

            # Calculate volume with proper decimals
            # Reader DB normalises all amounts to 18 decimals
            volume_24h = sum(abs(float(s.amount1)) / 1e18 for s in swaps_24h)

            # Get current position
            current_position = await JobService.get_current_position(job)

            return {
                "current_price": current_price,
                "price_24h_ago": price_24h_ago,
                "price_24h_high": price_high,
                "price_24h_low": price_low,
                "price_change_24h": price_change,
                "price_change_24h_percent": price_change_percent,
                "volume_24h_usd": volume_24h,
                "swap_count_24h": len(swaps_24h),
                "last_swap_timestamp": datetime.fromtimestamp(swaps_24h[-1].evt_block_time) if swaps_24h else None,
                "current_position": current_position,
            }

        except Exception as e:
            logger.error(f"Failed to get pool price for {job.job_id}: {e}")
            # Still try to get current position even if price calc fails
            current_position = await JobService.get_current_position(job)
            return {**_null_price, "current_position": current_position}

    @staticmethod
    async def get_all_rounds_with_executions(
        job: Job,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[Dict[str, Any]], int]:
        """
        Get all rounds (evaluation and live) with execution data for live rounds.

        Args:
            job: Job instance
            limit: Number of rounds to return
            offset: Pagination offset

        Returns:
            Tuple of (rounds_list, total_count)
        """
        try:
            # Get total count (only completed rounds)
            total_count = await Round.filter(
                job=job,
                status=RoundStatus.COMPLETED
            ).count()

            # Get rounds ordered by most recent first (only completed rounds with winners)
            rounds = await Round.filter(
                job=job,
                status=RoundStatus.COMPLETED
            ).order_by("-round_number").offset(offset).limit(limit)

            result = []
            for round_obj in rounds:
                # Get miner hotkey if there's a winner
                miner_hotkey = None
                if round_obj.winner_uid is not None:
                    miner_score = await MinerScore.filter(
                        job=job,
                        miner_uid=round_obj.winner_uid
                    ).first()
                    miner_hotkey = miner_score.miner_hotkey if miner_score else f"UNKNOWN_UID_{round_obj.winner_uid}"

                # Get predictions for this round
                predictions = await Prediction.filter(round=round_obj).all()
                predictions_data = []
                for pred in predictions:
                    predictions_data.append({
                        "miner_uid": pred.miner_uid,
                        "miner_hotkey": pred.miner_hotkey,
                        "accepted": pred.accepted,
                        "prediction_data": pred.prediction_data,
                        "submitted_at": pred.submitted_at,
                    })

                # Get execution data if it's a live round
                execution_data = None
                executions_list = []
                if round_obj.round_type.value == "live":
                    executions = await LiveExecution.filter(round=round_obj).all()
                    for execution in executions:
                        exec_data = {
                            "execution_id": execution.execution_id,
                            "miner_uid": execution.miner_uid,
                            "tx_hash": execution.tx_hash,
                            "tx_status": execution.tx_status,
                            "strategy_data": execution.strategy_data,
                            "actual_performance": execution.actual_performance,
                            "executed_at": execution.executed_at,
                        }
                        executions_list.append(exec_data)
                        # Keep first execution for backwards compat
                        if execution_data is None:
                            execution_data = exec_data

                # Get winner score from performance_data
                winner_score = None
                if round_obj.winner_uid is not None and round_obj.performance_data:
                    scores = round_obj.performance_data.get("scores", {})
                    winner_data = scores.get(str(round_obj.winner_uid), {})
                    winner_score = winner_data.get("score") if isinstance(winner_data, dict) else None

                result.append({
                    "round_id": round_obj.round_id,
                    "round_number": round_obj.round_number,
                    "round_type": round_obj.round_type.value,
                    "status": round_obj.status.value,
                    "winner_uid": round_obj.winner_uid,
                    "winner_hotkey": miner_hotkey,
                    "winner_score": float(winner_score) if winner_score is not None else None,
                    "start_time": round_obj.start_time,
                    "end_time": round_obj.end_time,
                    "execution": execution_data,
                    "executions": executions_list,  # All executions for this round
                    "predictions": predictions_data,  # All predictions for this round
                    "participants_count": len(predictions),
                })

            return result, total_count

        except Exception as e:
            logger.error(f"Failed to get rounds for {job.job_id}: {e}")
            return [], 0
