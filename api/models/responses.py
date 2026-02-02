"""
Pydantic Response Models

These models define the structure of API responses.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# Job Models
class JobResponse(BaseModel):
    """Single job response"""
    job_id: str
    sn_liquidity_manager_address: str
    pair_address: str
    fee_rate: float
    target: str
    target_ratio: float
    chain_id: int
    is_active: bool
    round_duration_seconds: int
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class JobStatsResponse(BaseModel):
    """Job statistics"""
    total_rounds: int
    total_miners: int
    active_miners_24h: int
    avg_participation_rate: float
    current_round_number: int
    revenue_usd: Optional[float] = None
    revenue_token0: Optional[float] = None
    revenue_token1: Optional[float] = None
    avg_revenue_per_round: Optional[float] = None


class JobDetailResponse(JobResponse):
    """Job with statistics"""
    stats: JobStatsResponse
    current_round: Optional[Dict[str, Any]] = None


class JobListResponse(BaseModel):
    """List of jobs"""
    jobs: List[JobResponse]
    total: int


# Round Models
class RoundResponse(BaseModel):
    """Single round response"""
    round_id: str
    round_type: str
    round_number: int
    start_time: datetime
    round_deadline: datetime
    end_time: Optional[datetime] = None
    status: str
    winner_uid: Optional[int] = None
    winner_hotkey: Optional[str] = None
    winner_score: Optional[float] = None
    participants: int = 0
    duration_seconds: Optional[int] = None

    class Config:
        from_attributes = True


class RoundDetailResponse(RoundResponse):
    """Round with all scores"""
    scores: Dict[int, Dict[str, Any]] = {}


class RoundListResponse(BaseModel):
    """List of rounds"""
    job_id: str
    total_rounds: int
    rounds: List[RoundResponse]


# Miner Score Models
class MinerScoreResponse(BaseModel):
    """Miner score for leaderboard"""
    rank: int
    miner_uid: int
    miner_hotkey: str
    combined_score: float
    evaluation_score: float
    live_score: float
    participation_days: int
    is_eligible_for_live: bool
    total_evaluations: int
    total_live_rounds: int
    successful_evaluations: int
    successful_live_rounds: int
    refusals: int
    win_rate: float = 0.0
    avg_response_time_ms: Optional[float] = None
    first_seen: datetime
    last_active: datetime

    class Config:
        from_attributes = True


class LeaderboardResponse(BaseModel):
    """Leaderboard with miners"""
    job_id: str
    updated_at: datetime
    total_miners: int
    leaderboard: List[MinerScoreResponse]


# Miner Models
class MinerJobPerformance(BaseModel):
    """Miner performance on a specific job"""
    job_id: str
    pair_name: Optional[str] = None
    combined_score: float
    evaluation_score: float
    live_score: float
    rank: int
    participation_days: int
    is_eligible_for_live: bool
    total_evaluations: int
    total_live_rounds: int
    wins: int
    first_seen: datetime
    last_active: datetime


class MinerProfileResponse(BaseModel):
    """Complete miner profile"""
    miner_uid: int
    miner_hotkey: str
    total_jobs: int
    total_rounds: int
    global_win_rate: float
    jobs: List[MinerJobPerformance]
    estimated_earnings_alpha: Optional[float] = None
    estimated_earnings_usd: Optional[float] = None


class ScoreHistoryItem(BaseModel):
    """Single score history entry"""
    round_number: int
    timestamp: datetime
    round_type: str
    round_score: float
    evaluation_score: float
    live_score: float
    combined_score: float
    rank: int


class MinerPerformanceDetailResponse(BaseModel):
    """Detailed miner performance on job"""
    miner_uid: int
    miner_hotkey: str
    job_id: str
    scores: Dict[str, Any]
    score_history: List[ScoreHistoryItem]
    recent_predictions: List[Dict[str, Any]]
    participation: List[Dict[str, Any]]


# Live Execution Models
class LiveExecutionResponse(BaseModel):
    """Live execution record"""
    execution_id: str
    round_id: str
    round_number: int
    miner_uid: int
    miner_hotkey: str
    strategy_data: Dict[str, Any]
    tx_hash: Optional[str] = None
    tx_status: Optional[str] = None
    block_number: Optional[int] = None
    actual_performance: Optional[Dict[str, Any]] = None
    sn_liquidity_manager_address: str
    executed_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionListResponse(BaseModel):
    """List of live executions"""
    job_id: str
    total_executions: int
    executions: List[LiveExecutionResponse]


# Metrics Models
class VaultRevenueResponse(BaseModel):
    """Revenue for a single vault"""
    job_id: str
    vault_address: str
    pair_address: str
    revenue_usd: float
    revenue_token0: float
    revenue_token1: float


class SubnetRevenueResponse(BaseModel):
    """Subnet-wide revenue metrics"""
    total_revenue_usd: float
    lookback_days: int
    vault_count: int
    vault_revenues: List[VaultRevenueResponse]
    updated_at: str
    error: Optional[str] = None


class SubnetEmissionsResponse(BaseModel):
    """Subnet emissions breakdown"""
    total_emissions_alpha: float
    total_emissions_usd: float
    burn_ratio: float
    miner_ratio: float
    burn_alpha: float
    burn_usd: float
    miner_alpha: float
    miner_usd: float
    alpha_price_usd: float
    vault_revenue_usd: float
    profit_ratio: float
    updated_at: str
    error: Optional[str] = None


class TopEarnerResponse(BaseModel):
    """Top earning miner"""
    miner_uid: int
    miner_hotkey: str
    score: float
    estimated_earnings_alpha: float
    estimated_earnings_usd: float
    score_percentage: float


class PairJobResponse(BaseModel):
    """Job info within pair performance"""
    job_id: str
    vault_address: str
    revenue_usd: float
    miner_count: int


class PairPerformanceResponse(BaseModel):
    """Performance metrics for a trading pair"""
    pair_address: str
    vault_count: int
    total_revenue_usd: float
    total_revenue_token0: float
    total_revenue_token1: float
    total_miners: int
    jobs: List[PairJobResponse]


class JobRevenueDetailResponse(BaseModel):
    """Detailed revenue for a job"""
    job_id: str
    vault_address: str
    pair_address: str
    revenue_usd: float
    revenue_token0: float
    revenue_token1: float
    lookback_days: int
    updated_at: str


# Error Response
class ErrorResponse(BaseModel):
    """API error response"""
    error: str
    detail: Optional[str] = None
    status_code: int
