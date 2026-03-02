import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types based on backend models
export interface Job {
    job_id: string;
    pair_address: string;
    sn_liquidity_manager_address: string;
    fee_rate: number;
    target: string;
    target_ratio: number;
    chain_id: number;
    is_active: boolean;
    round_duration_seconds: number;
    created_at: string;
    updated_at: string;
    metadata: {
        pair_name: string;
        description: string;
    };
}

export interface MinerScore {
    miner_uid: number;
    miner_hotkey: string;
    miner_name: string | null;
    combined_score: number;
    evaluation_score: number;
    live_score: number;
    participation_days: number;
    is_eligible_for_live: boolean;
    total_evaluations: number;
    total_live_rounds: number;
}

export interface Round {
    round_id: string;
    round_number: number;
    round_type: 'evaluation' | 'live';
    status: string;
    winner_uid: number | null;
    start_time: string;
    end_time: string | null;
}

// Live Execution Interface
export interface LiveExecution {
    execution_id: string;
    round_id: string;
    round_number: number;
    job_id: string;
    vault_name: string;
    miner_uid: number;
    miner_hotkey: string;
    strategy_data: any;
    tx_hash: string | null;
    tx_status: 'pending' | 'success' | 'failed' | null;
    block_number: number | null;
    executed_at: string;
}

// Round Execution Data
export interface RoundExecutionData {
    execution_id: string;
    tx_hash: string | null;
    tx_status: string | null;
    strategy_data: any;
    actual_performance: any | null;
    executed_at: string;
}

// Round with Execution
export interface RoundWithExecution {
    round_id: string;
    round_number: number;
    round_type: 'evaluation' | 'live';
    status: string;
    winner_uid: number | null;
    winner_hotkey: string | null;
    winner_score: number | null;
    start_time: string;
    end_time: string | null;
    execution: RoundExecutionData | null;
    participants_count: number;
}

// Metrics Interfaces
export interface VaultRevenue {
    job_id: string;
    vault_address: string;
    pair_address: string;
    revenue_usd: number;
    revenue_token0: number;
    revenue_token1: number;
}

export interface SubnetRevenue {
    total_revenue_usd: number;
    lookback_days: number;
    vault_count: number;
    vault_revenues: VaultRevenue[];
    updated_at: string;
    error?: string;
}

export interface SubnetEmissions {
    total_emissions_alpha: number;
    total_emissions_usd: number;
    burn_ratio: number;
    miner_ratio: number;
    burn_alpha: number;
    burn_usd: number;
    miner_alpha: number;
    miner_usd: number;
    alpha_price_usd: number;
    vault_revenue_usd: number;
    profit_ratio: number;
    updated_at: string;
    error?: string;
}

export interface TopEarner {
    miner_uid: number;
    miner_hotkey: string;
    score: number;
    estimated_earnings_alpha: number;
    estimated_earnings_usd: number;
    score_percentage: number;
}

export interface PairJob {
    job_id: string;
    vault_address: string;
    revenue_usd: number;
    miner_count: number;
}

export interface PairPerformance {
    pair_address: string;
    vault_count: number;
    total_revenue_usd: number;
    total_revenue_token0: number;
    total_revenue_token1: number;
    total_miners: number;
    jobs: PairJob[];
}

export interface JobRevenue {
    job_id: string;
    vault_address: string;
    pair_address: string;
    revenue_usd: number;
    revenue_token0: number;
    revenue_token1: number;
    lookback_days: number;
    updated_at: string;
}

export interface CurrentPosition {
    has_position: boolean;
    lower_tick: number | null;
    upper_tick: number | null;
    lower_price: number | null;
    upper_price: number | null;
    execution_id: string | null;
    executed_at: string | null;
}

export interface PoolPrice {
    current_price: number | null;
    price_24h_ago: number | null;
    price_24h_high: number | null;
    price_24h_low: number | null;
    price_change_24h: number | null;
    price_change_24h_percent: number | null;
    volume_24h_usd: number | null;
    swap_count_24h: number;
    last_swap_timestamp: string | null;
    current_position: CurrentPosition | null;
}

export interface JobTVL {
    job_id: string;
    tvl_token0: number;
    tvl_token1: number;
    tvl_usd: number;
    token0_price_usd: number;
    token1_price_usd: number;
    updated_at: string;
}

export interface JobPnL {
    job_id: string;
    pnl_usd: number;
    pnl_token0: number;
    pnl_token1: number;
    initial_tvl_usd: number;
    current_tvl_usd: number;
    lookback_days: number;
    updated_at: string;
}

export interface JobAPY {
    job_id: string;
    apy_percent: number;
    apy_percent_token0: number;
    apy_percent_token1: number;
    revenue_usd: number;
    revenue_token0: number;
    revenue_token1: number;
    avg_tvl_usd: number;
    avg_tvl_token0: number;
    avg_tvl_token1: number;
    lookback_days: number;
    updated_at: string;
}

export interface SubnetTVL {
    total_tvl_usd: number;
    vault_count: number;
    vault_tvls: Array<{
        job_id: string;
        vault_address: string;
        pair_address: string;
        tvl_usd: number;
        tvl_token0: number;
        tvl_token1: number;
    }>;
    updated_at: string;
}

export interface SubnetPnL {
    total_pnl_usd: number;
    vault_count: number;
    vault_pnls: Array<{
        job_id: string;
        vault_address: string;
        pair_address: string;
        pnl_usd: number;
        pnl_token0: number;
        pnl_token1: number;
    }>;
    lookback_days: number;
    updated_at: string;
}

export interface MinerWinRate {
    miner_uid: number;
    miner_hotkey: string;
    win_rate: number;
    total_wins: number;
    total_participations: number;
    job_id: string | null;
}

// API Functions
// API Functions
async function fetchJobs(): Promise<Job[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/`);
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        return data.jobs;
    } catch (error) {
        console.warn('API Error (fetchJobs):', error);
        return [];
    }
}

async function fetchLeaderboard(jobId: string, limit: number = 100): Promise<MinerScore[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/leaderboard?limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        const data = await res.json();
        return data.leaderboard;
    } catch (error) {
        console.warn('API Error (fetchLeaderboard):', error);
        return [];
    }
}

async function fetchJobStats(jobId: string): Promise<any> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchJobStats):', error);
        return {};
    }
}

async function fetchExecutions(jobId: string): Promise<LiveExecution[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/executions?limit=20`);
        if (!res.ok) throw new Error('Failed to fetch executions');
        const data = await res.json();
        return data.executions;
    } catch (error) {
        console.warn('API Error (fetchExecutions):', error);
        return [];
    }
}

async function fetchAllMiners(limit: number = 300, offset: number = 0, sortBy: string = 'uid'): Promise<{ total_miners: number; miners: MinerScore[] }> {
    try {
        const res = await fetch(`${API_BASE_URL}/miners/?limit=${limit}&offset=${offset}&sort_by=${sortBy}`);
        if (!res.ok) throw new Error('Failed to fetch miners');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchAllMiners):', error);
        return { total_miners: 0, miners: [] };
    }
}

// Metrics API Functions
async function fetchSubnetRevenue(lookbackDays: number = 30): Promise<SubnetRevenue> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/subnet/revenue?lookback_days=${lookbackDays}`);
        if (!res.ok) throw new Error('Failed to fetch subnet revenue');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchSubnetRevenue):', error);
        return {
            total_revenue_usd: 0,
            lookback_days: lookbackDays,
            vault_count: 0,
            vault_revenues: [],
            updated_at: new Date().toISOString(),
            error: 'Connection Failed'
        };
    }
}

async function fetchSubnetEmissions(): Promise<SubnetEmissions> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/subnet/emissions`);
        if (!res.ok) throw new Error('Failed to fetch subnet emissions');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchSubnetEmissions):', error);
        return {
            total_emissions_alpha: 0,
            total_emissions_usd: 0,
            burn_ratio: 0,
            miner_ratio: 0,
            burn_alpha: 0,
            burn_usd: 0,
            miner_alpha: 0,
            miner_usd: 0,
            alpha_price_usd: 0,
            vault_revenue_usd: 0,
            profit_ratio: 0,
            updated_at: new Date().toISOString(),
            error: 'Connection Failed'
        };
    }
}

async function fetchTopEarners(limit: number = 10): Promise<TopEarner[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/top-earners?limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch top earners');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchTopEarners):', error);
        return [];
    }
}

async function fetchPairPerformance(): Promise<PairPerformance[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/pairs/performance`);
        if (!res.ok) throw new Error('Failed to fetch pair performance');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchPairPerformance):', error);
        return [];
    }
}


// ...
async function fetchJobRevenue(jobId: string, lookbackDays: number = 30): Promise<JobRevenue> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/revenue?lookback_days=${lookbackDays}`);
        if (!res.ok) throw new Error('Failed to fetch job revenue');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchJobRevenue):', error);
        return {
            job_id: jobId,
            vault_address: '',
            pair_address: '',
            revenue_usd: 0,
            revenue_token0: 0,
            revenue_token1: 0,
            lookback_days: lookbackDays,
            updated_at: new Date().toISOString()
        };
    }
}
// ...
async function fetchJobPnL(jobId: string, lookbackDays: number = 30): Promise<JobPnL> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/pnl?lookback_days=${lookbackDays}`);
        if (!res.ok) throw new Error('Failed to fetch job PnL');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchJobPnL):', error);
        return {
            job_id: jobId,
            pnl_usd: 0,
            pnl_token0: 0,
            pnl_token1: 0,
            initial_tvl_usd: 0,
            current_tvl_usd: 0,
            lookback_days: lookbackDays,
            updated_at: new Date().toISOString()
        };
    }
}

async function fetchJobAPY(jobId: string, lookbackDays: number = 30): Promise<JobAPY> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/apy?lookback_days=${lookbackDays}`);
        if (!res.ok) throw new Error('Failed to fetch job APY');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchJobAPY):', error);
        return {
            job_id: jobId,
            apy_percent: 0,
            apy_percent_token0: 0,
            apy_percent_token1: 0,
            revenue_usd: 0,
            revenue_token0: 0,
            revenue_token1: 0,
            avg_tvl_usd: 0,
            avg_tvl_token0: 0,
            avg_tvl_token1: 0,
            lookback_days: lookbackDays,
            updated_at: new Date().toISOString()
        };
    }
}
//...
async function fetchSubnetPnL(lookbackDays: number = 30): Promise<SubnetPnL> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/subnet/pnl?lookback_days=${lookbackDays}`);
        if (!res.ok) throw new Error('Failed to fetch subnet PnL');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchSubnetPnL):', error);
        return {
            total_pnl_usd: 0,
            vault_count: 0,
            vault_pnls: [],
            lookback_days: lookbackDays,
            updated_at: new Date().toISOString()
        };
    }
}

async function fetchPoolPrice(jobId: string): Promise<PoolPrice> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/price`);
        if (!res.ok) throw new Error('Failed to fetch pool price');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchPoolPrice):', error);
        return {
            current_price: null,
            price_24h_ago: null,
            price_24h_high: null,
            price_24h_low: null,
            price_change_24h: null,
            price_change_24h_percent: null,
            volume_24h_usd: null,
            swap_count_24h: 0,
            last_swap_timestamp: null,
            current_position: null
        };
    }
}

async function fetchAllRounds(jobId: string, limit: number = 50, offset: number = 0): Promise<{ job_id: string; total_rounds: number; rounds: RoundWithExecution[] }> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/rounds?limit=${limit}&offset=${offset}`);
        if (!res.ok) throw new Error('Failed to fetch rounds');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchAllRounds):', error);
        return { job_id: jobId, total_rounds: 0, rounds: [] };
    }
}

async function fetchJobTVL(jobId: string): Promise<JobTVL> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/tvl`);
        if (!res.ok) throw new Error('Failed to fetch job TVL');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchJobTVL):', error);
        return {
            job_id: jobId,
            tvl_token0: 0,
            tvl_token1: 0,
            tvl_usd: 0,
            token0_price_usd: 0,
            token1_price_usd: 0,
            updated_at: new Date().toISOString()
        };
    }
}





async function fetchSubnetTVL(): Promise<SubnetTVL> {
    try {
        const res = await fetch(`${API_BASE_URL}/metrics/subnet/tvl`);
        if (!res.ok) throw new Error('Failed to fetch subnet TVL');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchSubnetTVL):', error);
        return {
            total_tvl_usd: 0,
            vault_count: 0,
            vault_tvls: [],
            updated_at: new Date().toISOString()
        };
    }
}



async function fetchMinerWinRate(uid: number, jobId?: string): Promise<MinerWinRate> {
    try {
        const url = jobId
            ? `${API_BASE_URL}/miners/${uid}/win-rate?job_id=${jobId}`
            : `${API_BASE_URL}/miners/${uid}/win-rate`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch miner win rate');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchMinerWinRate):', error);
        return {
            miner_uid: uid,
            miner_hotkey: '',
            win_rate: 0,
            total_wins: 0,
            total_participations: 0,
            job_id: jobId || null
        };
    }
}

// Hooks
export function useJobs() {
    return useQuery({
        queryKey: ['jobs'],
        queryFn: fetchJobs,
        staleTime: 5 * 60 * 1000,
    });
}

export function useLeaderboard(jobId: string, limit: number = 100) {
    return useQuery({
        queryKey: ['leaderboard', jobId, limit],
        queryFn: () => fetchLeaderboard(jobId, limit),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useAllMiners(limit: number = 300, offset: number = 0, sortBy: string = 'uid') {
    return useQuery({
        queryKey: ['all-miners', limit, offset, sortBy],
        queryFn: () => fetchAllMiners(limit, offset, sortBy),
        staleTime: 2 * 60 * 1000,
    });
}

export function useNetworkStats(jobId: string) {
    return useQuery({
        queryKey: ['network-stats', jobId],
        queryFn: () => fetchJobStats(jobId),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useExecutions(jobId: string) {
    return useQuery({
        queryKey: ['executions', jobId],
        queryFn: () => fetchExecutions(jobId),
        enabled: !!jobId,
        staleTime: 5000,
        refetchInterval: 5000, // Refresh every 5s for live feed feel
    });
}

// Metrics Hooks
export function useSubnetRevenue(lookbackDays: number = 30) {
    return useQuery({
        queryKey: ['subnet-revenue', lookbackDays],
        queryFn: () => fetchSubnetRevenue(lookbackDays),
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000, // Refresh every 60s
    });
}

export function useSubnetEmissions() {
    return useQuery({
        queryKey: ['subnet-emissions'],
        queryFn: fetchSubnetEmissions,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 60000, // Refresh every 60s
    });
}

export function useTopEarners(limit: number = 10) {
    return useQuery({
        queryKey: ['top-earners', limit],
        queryFn: () => fetchTopEarners(limit),
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000, // Refresh every 60s
    });
}

export function usePairPerformance() {
    return useQuery({
        queryKey: ['pair-performance'],
        queryFn: fetchPairPerformance,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000, // Refresh every 60s
    });
}

export function useJobRevenue(jobId: string, lookbackDays: number = 30) {
    return useQuery({
        queryKey: ['job-revenue', jobId, lookbackDays],
        queryFn: () => fetchJobRevenue(jobId, lookbackDays),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function usePoolPrice(jobId: string) {
    return useQuery({
        queryKey: ['pool-price', jobId],
        queryFn: () => fetchPoolPrice(jobId),
        enabled: !!jobId,
        staleTime: 30 * 1000,
        refetchInterval: 30000,
        retry: 1,
    });
}

export function useAllRounds(jobId: string, limit: number = 50, offset: number = 0) {
    return useQuery({
        queryKey: ['all-rounds', jobId, limit, offset],
        queryFn: () => fetchAllRounds(jobId, limit, offset),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useJobTVL(jobId: string) {
    return useQuery({
        queryKey: ['job-tvl', jobId],
        queryFn: () => fetchJobTVL(jobId),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useJobPnL(jobId: string, lookbackDays: number = 30) {
    return useQuery({
        queryKey: ['job-pnl', jobId, lookbackDays],
        queryFn: () => fetchJobPnL(jobId, lookbackDays),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useJobAPY(jobId: string, lookbackDays: number = 30) {
    return useQuery({
        queryKey: ['job-apy', jobId, lookbackDays],
        queryFn: () => fetchJobAPY(jobId, lookbackDays),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useSubnetTVL() {
    return useQuery({
        queryKey: ['subnet-tvl'],
        queryFn: fetchSubnetTVL,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useSubnetPnL(lookbackDays: number = 30) {
    return useQuery({
        queryKey: ['subnet-pnl', lookbackDays],
        queryFn: () => fetchSubnetPnL(lookbackDays),
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useMinerWinRate(uid: number, jobId?: string) {
    return useQuery({
        queryKey: ['miner-win-rate', uid, jobId],
        queryFn: () => fetchMinerWinRate(uid, jobId),
        enabled: !!uid,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

// Miner Score History

export interface ScoreHistoryDataPoint {
    timestamp: string;
    combined_score: number;
    evaluation_score: number;
    live_score: number;
    round_type: string;
    rank: number | null;
}

export interface MinerScoreHistoryResponse {
    miner_uid: number;
    data_points: ScoreHistoryDataPoint[];
}

async function fetchMinerScoreHistory(uid: number): Promise<MinerScoreHistoryResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/miners/${uid}/score-history`);
        if (!res.ok) throw new Error('Failed to fetch miner score history');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchMinerScoreHistory):', error);
        return { miner_uid: uid, data_points: [] };
    }
}

export function useMinerScoreHistory(uid: number) {
    return useQuery({
        queryKey: ['miner-score-history', uid],
        queryFn: () => fetchMinerScoreHistory(uid),
        enabled: !!uid,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

// Miner Metrics History

export interface MinerMetricsDataPoint {
    timestamp: string;
    earnings_alpha: number;
    earnings_usd: number;
    total_score: number;
    win_rate: number;
}

export interface MinerMetricsHistoryResponse {
    miner_uid: number;
    timeframe_days: number;
    series: MinerMetricsDataPoint[];
}

async function fetchMinerMetricsHistory(uid: number, days: number = 30): Promise<MinerMetricsHistoryResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/miners/${uid}/metrics-history?days=${days}`);
        if (!res.ok) throw new Error('Failed to fetch miner metrics history');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchMinerMetricsHistory):', error);
        return { miner_uid: uid, timeframe_days: days, series: [] };
    }
}

export function useMinerMetricsHistory(uid: number, days: number = 30) {
    return useQuery({
        queryKey: ['miner-metrics-history', uid, days],
        queryFn: () => fetchMinerMetricsHistory(uid, days),
        enabled: !!uid,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

// Pool Data Hooks (from reader database)

export interface PoolDataStats {
    start_ts: number;
    end_ts: number;
    total_swaps: number;
    volume0: number;
    volume1: number;
    fees0: number;
    fees1: number;
    open_price: number;
    close_price: number;
    high_price: number;
    low_price: number;
    price_change_pct: number;
    token0_symbol: string;
    token1_symbol: string;
}

async function fetchPoolDataStats(jobId: string, lookbackHours: number = 24): Promise<PoolDataStats> {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/pool-data/stats?lookback_hours=${lookbackHours}`);
        if (!res.ok) throw new Error('Failed to fetch pool data stats');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchPoolDataStats):', error);
        return {
            start_ts: 0,
            end_ts: 0,
            total_swaps: 0,
            volume0: 0,
            volume1: 0,
            fees0: 0,
            fees1: 0,
            open_price: 0,
            close_price: 0,
            high_price: 0,
            low_price: 0,
            price_change_pct: 0,
            token0_symbol: 'T0',
            token1_symbol: 'T1'
        };
    }
}

export function usePoolDataStats(jobId: string, lookbackHours: number = 24) {
    return useQuery({
        queryKey: ['pool-data-stats', jobId, lookbackHours],
        queryFn: () => fetchPoolDataStats(jobId, lookbackHours),
        enabled: !!jobId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000, // Refresh every 60s
        retry: 1, // Only retry once since pool data might not be available
    });
}

async function syncPoolData(jobId: string, lookbackHours: number = 24) {
    try {
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/sync-pool-data?lookback_hours=${lookbackHours}`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to sync pool data');
        return await res.json();
    } catch (error) {
        console.warn('API Error (syncPoolData):', error);
        return { status: 'failed' };
    }
}

export function useSyncPoolData() {
    return {
        syncPoolData,
    };
}

// Miner Profile

export interface MinerJobPerformance {
    job_id: string;
    pair_name: string | null;
    combined_score: number;
    evaluation_score: number;
    live_score: number;
    rank: number;
    participation_days: number;
    is_eligible_for_live: boolean;
    total_evaluations: number;
    total_live_rounds: number;
    wins: number;
    first_seen: string;
    last_active: string;
}

export interface MinerProfile {
    miner_uid: number;
    miner_hotkey: string;
    miner_name: string | null;
    total_jobs: number;
    total_rounds: number;
    global_win_rate: number;
    jobs: MinerJobPerformance[];
    estimated_earnings_alpha: number | null;
    estimated_earnings_usd: number | null;
}

async function fetchMinerProfile(uid: number): Promise<MinerProfile> {
    try {
        const res = await fetch(`${API_BASE_URL}/miners/${uid}`);
        if (!res.ok) throw new Error('Failed to fetch miner profile');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchMinerProfile):', error);
        return {
            miner_uid: uid,
            miner_hotkey: '',
            total_jobs: 0,
            total_rounds: 0,
            global_win_rate: 0,
            jobs: [],
            estimated_earnings_alpha: null,
            estimated_earnings_usd: null,
        };
    }
}

export function useMinerProfile(uid: number) {
    return useQuery({
        queryKey: ['miner-profile', uid],
        queryFn: () => fetchMinerProfile(uid),
        enabled: !!uid,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}

// Miner Vaults

export interface MinerVault {
    vault_id: string;
    job_id: string;
    pair_name: string;
    pair_address: string;
    combined_score: number;
    evaluation_score: number;
    live_score: number;
    is_eligible_for_live: boolean;
    total_evaluations: number;
    total_live_rounds: number;
    participation_days: number;
    is_active: boolean;
    fee_rate: number;
    target_ratio: number;
    revenue_usd: number;
    revenue_token0: number;
    revenue_token1: number;
}

export interface MinerVaultsResponse {
    miner_uid: number;
    miner_hotkey: string | null;
    total_vaults: number;
    active_vaults: number;
    vaults: MinerVault[];
}

async function fetchMinerVaults(uid: number): Promise<MinerVaultsResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/miners/${uid}/vaults`);
        if (!res.ok) throw new Error('Failed to fetch miner vaults');
        return await res.json();
    } catch (error) {
        console.warn('API Error (fetchMinerVaults):', error);
        return {
            miner_uid: uid,
            miner_hotkey: null,
            total_vaults: 0,
            active_vaults: 0,
            vaults: []
        };
    }
}

export function useMinerVaults(uid: number) {
    return useQuery({
        queryKey: ['miner-vaults', uid],
        queryFn: () => fetchMinerVaults(uid),
        enabled: !!uid,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 60000,
        retry: 1,
    });
}
