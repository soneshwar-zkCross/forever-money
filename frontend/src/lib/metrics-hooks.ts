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
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/tvl`);
                if (!res.ok) throw new Error('Failed to fetch job TVL');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useJobTVL):', error);
                return { job_id: jobId, tvl_token0: 0, tvl_token1: 0, tvl_usd: 0, token0_price_usd: 0, token1_price_usd: 0, updated_at: new Date().toISOString() };
            }
        },
        refetchInterval: 60000,
        enabled: !!jobId,
        retry: 1,
    });
}

export function useJobPnL(jobId: string, lookbackDays: number = 30) {
    return useQuery<JobPnL>({
        queryKey: ['job-pnl', jobId, lookbackDays],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/pnl?lookback_days=${lookbackDays}`);
                if (!res.ok) throw new Error('Failed to fetch job PnL');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useJobPnL):', error);
                return { job_id: jobId, pnl_usd: 0, pnl_token0: 0, pnl_token1: 0, initial_tvl_usd: 0, current_tvl_usd: 0, lookback_days: lookbackDays, updated_at: new Date().toISOString() };
            }
        },
        refetchInterval: 60000,
        enabled: !!jobId,
        retry: 1,
    });
}

export function useJobAPY(jobId: string, lookbackDays: number = 30) {
    return useQuery<JobAPY>({
        queryKey: ['job-apy', jobId, lookbackDays],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/apy?lookback_days=${lookbackDays}`);
                if (!res.ok) throw new Error('Failed to fetch job APY');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useJobAPY):', error);
                return { job_id: jobId, apy_percent: 0, revenue_usd: 0, avg_tvl_usd: 0, lookback_days: lookbackDays, updated_at: new Date().toISOString() };
            }
        },
        refetchInterval: 60000,
        enabled: !!jobId,
        retry: 1,
    });
}
//...
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
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/subnet/tvl`);
                if (!res.ok) throw new Error('Failed to fetch subnet TVL');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useSubnetTVL):', error);
                return { total_tvl_usd: 0, vault_count: 0, vault_tvls: [], updated_at: new Date().toISOString() };
            }
        },
        refetchInterval: 60000,
        retry: 1,
    });
}

export function useSubnetPnL(lookbackDays: number = 30) {
    return useQuery<SubnetPnL>({
        queryKey: ['subnet-pnl', lookbackDays],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/subnet/pnl?lookback_days=${lookbackDays}`);
                if (!res.ok) throw new Error('Failed to fetch subnet PnL');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useSubnetPnL):', error);
                return { total_pnl_usd: 0, vault_count: 0, vault_pnls: [], lookback_days: lookbackDays, updated_at: new Date().toISOString() };
            }
        },
        refetchInterval: 60000,
        retry: 1,
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
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/tvl-history?days=${days}`);
                if (!res.ok) throw new Error('Failed to fetch TVL history');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useJobTVLHistory):', error);
                return { job_id: jobId, timeframe_days: days, series: [] };
            }
        },
        refetchInterval: 300000,
        enabled: !!jobId,
        retry: 1,
    });
}

export function useSubnetMetricsHistory(days: number = 30) {
    return useQuery<{ timeframe_days: number; series: SubnetMetricsHistoryDataPoint[] }>({
        queryKey: ['subnet-metrics-history', days],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/subnet/metrics-history?days=${days}`);
                if (!res.ok) throw new Error('Failed to fetch metrics history');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useSubnetMetricsHistory):', error);
                return { timeframe_days: days, series: [] };
            }
        },
        refetchInterval: 300000,
        retry: 1,
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
            try {
                const res = await fetch(`${API_BASE_URL}/metrics/jobs/${jobId}/inventory-change`);
                if (!res.ok) throw new Error('Failed to fetch inventory change');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useInventoryChange):', error);
                return {
                    job_id: jobId,
                    initial: { balance_token0: 0, balance_token1: 0, balance_usd: 0, timestamp: '' },
                    current: { balance_token0: 0, balance_token1: 0, balance_usd: 0 },
                    change: { token0: 0, token1: 0, usd: 0, percent: 0 }
                };
            }
        },
        refetchInterval: 60000,
        enabled: !!jobId,
        retry: 1,
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
            try {
                const res = await fetch(`${API_BASE_URL}/miners/${minerUid}/job-earnings/${jobId}`);
                if (!res.ok) throw new Error('Failed to fetch miner job earnings');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useMinerJobEarnings):', error);
                return { miner_uid: minerUid, job_id: jobId, earnings_alpha: 0, earnings_usd: 0, score: 0, share_percent: 0 };
            }
        },
        refetchInterval: 60000,
        enabled: !!minerUid && !!jobId,
        retry: 1,
    });
}

export function useMinerDividends(minerUid: number) {
    return useQuery<MinerDividends>({
        queryKey: ['miner-dividends', minerUid],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/miners/${minerUid}/dividends`);
                if (!res.ok) throw new Error('Failed to fetch miner dividends');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useMinerDividends):', error);
                return { miner_uid: minerUid, current_dividends_alpha: 0, note: '' };
            }
        },
        refetchInterval: 60000,
        enabled: !!minerUid,
        retry: 1,
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
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch win rate');
                return await res.json();
            } catch (error) {
                console.warn('API Error (useMinerWinRate):', error);
                return { miner_uid: minerUid, miner_hotkey: '', win_rate: 0, total_wins: 0, total_participations: 0, job_id: jobId || null };
            }
        },
        refetchInterval: 60000,
        enabled: !!minerUid,
        retry: 1,
    });
}
