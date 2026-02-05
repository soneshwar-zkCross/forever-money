import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// =============================================================================
// NEW METRICS HOOKS
// =============================================================================

// Job TVL, PnL, APY Interfaces
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
    revenue_usd: number;
    avg_tvl_usd: number;
    lookback_days: number;
    updated_at: string;
}

export function useJobTVL(jobId: string) {
    return useQuery<JobTVL>({
        queryKey: ['job-tvl', jobId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/tvl`);
            if (!res.ok) throw new Error('Failed to fetch job TVL');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!jobId,
    });
}

export function useJobPnL(jobId: string, lookbackDays: number = 30) {
    return useQuery<JobPnL>({
        queryKey: ['job-pnl', jobId, lookbackDays],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/pnl?lookback_days=${lookbackDays}`);
            if (!res.ok) throw new Error('Failed to fetch job PnL');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!jobId,
    });
}

export function useJobAPY(jobId: string, lookbackDays: number = 30) {
    return useQuery<JobAPY>({
        queryKey: ['job-apy', jobId, lookbackDays],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/apy?lookback_days=${lookbackDays}`);
            if (!res.ok) throw new Error('Failed to fetch job APY');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!jobId,
    });
}

// Subnet-wide TVL & PnL
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

export function useSubnetTVL() {
    return useQuery<SubnetTVL>({
        queryKey: ['subnet-tvl'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/subnet/tvl`);
            if (!res.ok) throw new Error('Failed to fetch subnet TVL');
            return res.json();
        },
        refetchInterval: 60000,
    });
}

export function useSubnetPnL(lookbackDays: number = 30) {
    return useQuery<SubnetPnL>({
        queryKey: ['subnet-pnl', lookbackDays],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/subnet/pnl?lookback_days=${lookbackDays}`);
            if (!res.ok) throw new Error('Failed to fetch subnet PnL');
            return res.json();
        },
        refetchInterval: 60000,
    });
}

// Historical Chart Data
export interface MetricsHistoryDataPoint {
    timestamp: string;
    tvl_usd: number;
    revenue_usd: number;
    apy_percent?: number;
}

export interface SubnetMetricsHistoryDataPoint {
    timestamp: string;
    tvl_usd: number;
    revenue_usd: number;
    emissions_alpha: number;
    pnl_usd: number;
}

export function useJobTVLHistory(jobId: string, days: number = 7) {
    return useQuery<{ job_id: string; timeframe_days: number; series: MetricsHistoryDataPoint[] }>({
        queryKey: ['job-tvl-history', jobId, days],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/tvl-history?days=${days}`);
            if (!res.ok) throw new Error('Failed to fetch TVL history');
            return res.json();
        },
        refetchInterval: 300000,
        enabled: !!jobId,
    });
}

export function useSubnetMetricsHistory(days: number = 30) {
    return useQuery<{ timeframe_days: number; series: SubnetMetricsHistoryDataPoint[] }>({
        queryKey: ['subnet-metrics-history', days],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/subnet/metrics-history?days=${days}`);
            if (!res.ok) throw new Error('Failed to fetch metrics history');
            return res.json();
        },
        refetchInterval: 300000,
    });
}

// Inventory Change
export interface InventoryChange {
    job_id: string;
    initial: {
        balance_token0: number;
        balance_token1: number;
        balance_usd: number;
        timestamp: string;
    };
    current: {
        balance_token0: number;
        balance_token1: number;
        balance_usd: number;
    };
    change: {
        token0: number;
        token1: number;
        usd: number;
        percent: number;
    };
}

export function useInventoryChange(jobId: string) {
    return useQuery<InventoryChange>({
        queryKey: ['inventory-change', jobId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/inventory-change`);
            if (!res.ok) throw new Error('Failed to fetch inventory change');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!jobId,
    });
}

// Miner Earnings & Dividends
export interface MinerJobEarnings {
    miner_uid: number;
    job_id: string;
    earnings_alpha: number;
    earnings_usd: number;
    score: number;
    share_percent: number;
}

export interface MinerDividends {
    miner_uid: number;
    current_dividends_alpha: number;
    note: string;
}

export function useMinerJobEarnings(minerUid: number, jobId: string) {
    return useQuery<MinerJobEarnings>({
        queryKey: ['miner-job-earnings', minerUid, jobId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/miners/${minerUid}/job-earnings/${jobId}`);
            if (!res.ok) throw new Error('Failed to fetch miner job earnings');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!minerUid && !!jobId,
    });
}

export function useMinerDividends(minerUid: number) {
    return useQuery<MinerDividends>({
        queryKey: ['miner-dividends', minerUid],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/miners/${minerUid}/dividends`);
            if (!res.ok) throw new Error('Failed to fetch miner dividends');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!minerUid,
    });
}

// Win Rate
export interface MinerWinRate {
    miner_uid: number;
    miner_hotkey: string;
    win_rate: number;
    total_wins: number;
    total_participations: number;
    job_id: string | null;
}

export function useMinerWinRate(minerUid: number, jobId?: string) {
    const url = jobId
        ? `${API_BASE_URL}/miners/${minerUid}/win-rate?job_id=${jobId}`
        : `${API_BASE_URL}/miners/${minerUid}/win-rate`;
    
    return useQuery<MinerWinRate>({
        queryKey: ['miner-win-rate', minerUid, jobId],
        queryFn: async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch win rate');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: !!minerUid,
    });
}
