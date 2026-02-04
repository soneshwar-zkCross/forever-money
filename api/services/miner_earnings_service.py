"""
Miner Earnings Service

Calculates per-job earnings and tracks dividend payouts.
"""
import logging
from typing import Dict, Optional
from datetime import datetime

from validator.models.job import Job, MinerScore
from api.utils.bittensor_client import BittensorClient
from api.utils.price_service import PriceService

logger = logging.getLogger(__name__)


class MinerEarningsService:
    """Service for calculating miner earnings"""
    
    @staticmethod
    async def calculate_miner_job_earnings(
        miner_uid: int,
        job_id: str
    ) -> Dict[str, float]:
        """
        Calculate miner earnings for a specific job.
        
        Args:
            miner_uid: Miner UID
            job_id: Job ID
            
        Returns:
            Dict with earnings_alpha, earnings_usd, score, share_percent
        """
        # Get miner's score on this job
        miner_score = await MinerScore.filter(
            miner_uid=miner_uid,
            job_id=job_id
        ).first()
        
        if not miner_score:
            return {
                "earnings_alpha": 0.0,
                "earnings_usd": 0.0,
                "score": 0.0,
                "share_percent": 0.0
            }
        
        # Get total emissions allocated to this job
        # Simplified: assume equal weight across all jobs
        total_jobs = await Job.filter(is_active=True).count()
        job_weight = 1.0 / total_jobs if total_jobs > 0 else 0.0
        
        metagraph = BittensorClient.get_metagraph()
        if metagraph:
            total_emissions = metagraph.total_emission
        else:
            total_emissions = 0.0
        
        job_emissions = total_emissions * job_weight
        
        # Get miner's share based on score
        all_scores = await MinerScore.filter(job_id=job_id).all()
        total_score = sum(m.combined_score for m in all_scores)
        miner_share = miner_score.combined_score / total_score if total_score > 0 else 0.0
        
        earnings_alpha = job_emissions * miner_share
        
        # Convert to USD
        # TODO: Get alpha price from PriceService when available
        alpha_price = 1.0  # Placeholder
        earnings_usd = earnings_alpha * alpha_price
        
        return {
            "earnings_alpha": earnings_alpha,
            "earnings_usd": earnings_usd,
            "score": miner_score.combined_score,
            "share_percent": miner_share * 100
        }
    
    @staticmethod
    async def get_current_dividends(miner_uid: int) -> float:
        """
        Get current dividend balance from metagraph.
        
        Args:
            miner_uid: Miner UID
            
        Returns:
            Current dividend balance in Alpha
        """
        metagraph = BittensorClient.get_metagraph()
        if not metagraph:
            logger.warning("Metagraph not available")
            return 0.0
        
        if miner_uid >= len(metagraph.dividends):
            logger.warning(f"Invalid miner UID: {miner_uid}")
            return 0.0
        
        return float(metagraph.dividends[miner_uid])
