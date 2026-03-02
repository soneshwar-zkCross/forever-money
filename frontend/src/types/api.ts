/**
 * Type definitions matching the backend API responses
 */

export interface Job {
    job_id: string
    sn_liquditiy_manager_address: string
    pair_address: string
    fee_rate: number
    target: string
    target_ratio: number
    chain_id: number
    is_active: boolean
    round_duration_seconds: number
    created_at: string
    updated_at: string
    metadata: {
        pair_name?: string
        description?: string
        [key: string]: any
    }
}

export interface JobStats {
    total_rounds: number
    total_miners: number
    active_miners_24h: number
    avg_participation_rate: number
    current_round_number: number
}

export interface JobDetail extends Job {
    stats: JobStats
    current_round?: CurrentRound
}

export interface CurrentRound {
    round_id: string
    round_type: 'evaluation' | 'live'
    round_number: number
    start_time: string
    round_deadline: string
    status: 'pending' | 'active' | 'completed' | 'failed'
    time_remaining_seconds: number
    progress_percent: number
}

export interface Round {
    round_id: string
    round_type: 'evaluation' | 'live'
    round_number: number
    start_time: string
    round_deadline: string
    end_time?: string
    status: 'pending' | 'active' | 'completed' | 'failed'
    winner_uid?: number
    winner_hotkey?: string
    winner_score?: number
    participants: number
    duration_seconds?: number
}

export interface MinerScore {
    rank: number
    miner_uid: number
    miner_hotkey: string
    miner_name?: string
    combined_score: number
    evaluation_score: number
    live_score: number
    participation_days: number
    is_eligible_for_live: boolean
    total_evaluations: number
    total_live_rounds: number
    successful_evaluations: number
    successful_live_rounds: number
    refusals: number
    win_rate: number
    avg_response_time_ms?: number
    first_seen: string
    last_active: string
}

export interface Leaderboard {
    job_id: string
    updated_at: string
    total_miners: number
    leaderboard: MinerScore[]
}

export interface MinerJobPerformance {
    job_id: string
    pair_name?: string
    combined_score: number
    evaluation_score: number
    live_score: number
    rank: number
    participation_days: number
    is_eligible_for_live: boolean
    total_evaluations: number
    total_live_rounds: number
    wins: number
    first_seen: string
    last_active: string
}

export interface MinerProfile {
    miner_uid: number
    miner_hotkey: string
    total_jobs: number
    total_rounds: number
    global_win_rate: number
    jobs: MinerJobPerformance[]
}

export interface LiveExecution {
    execution_id: string
    round_id: string
    round_number: number
    miner_uid: number
    miner_hotkey: string
    strategy_data: any
    tx_hash?: string
    tx_status?: 'pending' | 'success' | 'failed'
    block_number?: number
    actual_performance?: any
    executed_at: string
    updated_at: string
}

export interface ApiError {
    error: string
    detail?: string
    status_code: number
}
