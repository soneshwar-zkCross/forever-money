"""
Job Service

Business logic for job-related operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from tortoise.expressions import Q
from tortoise.functions import Count
import logging

from validator.models.job import Job, Round, MinerScore, RoundStatus, LiveExecution
from validator.models.pool_events import SwapEvent
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
    async def get_pool_price(job: Job) -> Dict[str, Any]:
        """
        Get pool price statistics from swap events.

        Args:
            job: Job instance

        Returns:
            Dict with price statistics
        """
        try:
            # Get swap events for last 24 hours
            twenty_four_hours_ago = int((datetime.utcnow() - timedelta(hours=24)).timestamp())

            swaps_24h = await SwapEvent.filter(
                evt_address=job.pair_address,
                evt_block_time__gte=twenty_four_hours_ago
            ).order_by("evt_block_time")

            if not swaps_24h:
                current_position = await JobService.get_current_position(job)
                return {
                    "current_price": None,
                    "price_24h_ago": None,
                    "price_24h_high": None,
                    "price_24h_low": None,
                    "price_change_24h": None,
                    "price_change_24h_percent": None,
                    "volume_24h_usd": None,
                    "swap_count_24h": 0,
                    "last_swap_timestamp": None,
                    "current_position": current_position,
                }

            # Calculate prices from amount0/amount1 ratios
            prices = []
            for swap in swaps_24h:
                amount0 = float(swap.amount0)
                amount1 = float(swap.amount1)

                # Simple price calculation: |amount1 / amount0|
                if amount0 != 0:
                    price = abs(amount1 / amount0)
                    prices.append(price)

            if not prices:
                current_position = await JobService.get_current_position(job)
                return {
                    "current_price": None,
                    "price_24h_ago": None,
                    "price_24h_high": None,
                    "price_24h_low": None,
                    "price_change_24h": None,
                    "price_change_24h_percent": None,
                    "volume_24h_usd": None,
                    "swap_count_24h": len(swaps_24h),
                    "last_swap_timestamp": datetime.fromtimestamp(swaps_24h[-1].evt_block_time) if swaps_24h else None,
                    "current_position": current_position,
                }

            current_price = prices[-1]
            price_24h_ago = prices[0]
            price_high = max(prices)
            price_low = min(prices)
            price_change = current_price - price_24h_ago
            price_change_percent = (price_change / price_24h_ago * 100) if price_24h_ago != 0 else 0

            # Calculate volume (simplified)
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
            return {
                "current_price": None,
                "price_24h_ago": None,
                "price_24h_high": None,
                "price_24h_low": None,
                "price_change_24h": None,
                "price_change_24h_percent": None,
                "volume_24h_usd": None,
                "swap_count_24h": 0,
                "last_swap_timestamp": None,
                "current_position": current_position,
            }

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

                # Get execution data if it's a live round
                execution_data = None
                if round_obj.round_type.value == "live":
                    execution = await LiveExecution.filter(round=round_obj).first()
                    if execution:
                        execution_data = {
                            "execution_id": execution.execution_id,
                            "tx_hash": execution.tx_hash,
                            "tx_status": execution.tx_status,
                            "strategy_data": execution.strategy_data,
                            "actual_performance": execution.actual_performance,
                            "executed_at": execution.executed_at,
                        }

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
                    "participants_count": len(round_obj.performance_data.get("scores", {})) if round_obj.performance_data else 0,
                })

            return result, total_count

        except Exception as e:
            logger.error(f"Failed to get rounds for {job.job_id}: {e}")
            return [], 0
