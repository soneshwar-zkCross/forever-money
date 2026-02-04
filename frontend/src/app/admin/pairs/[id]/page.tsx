'use client';

import React, { use, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    Activity,
    TrendingUp,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ExternalLink,
    Layers,
    Zap,
    RefreshCw,
} from 'lucide-react';
import { useJobs, useNetworkStats, useAllRounds, usePoolPrice, useJobAPY, useJobPnL, useJobTVL, usePoolDataStats, Job } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import PoolPriceChart from '@/components/charts/PoolPriceChart';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: roundsData } = useAllRounds(jobId, 100);
    const { data: poolPrice } = usePoolPrice(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);
    const { data: poolDataStats, refetch: refetchPoolData, isLoading: poolDataLoading, isError: poolDataError } = usePoolDataStats(jobId, 24); // Pool data from reader DB

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Sync pool data function
    const handleSyncPoolData = async () => {
        setIsSyncing(true);
        setSyncError(null);
        setSyncSuccess(false);

        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/sync-pool-data?lookback_hours=24`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to sync pool data');
            }

            const data = await response.json();

            // Invalidate and refetch queries
            queryClient.invalidateQueries({ queryKey: ['pool-data-stats', jobId] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            await refetchPoolData();

            setSyncSuccess(true);
            setTimeout(() => setSyncSuccess(false), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncError(error instanceof Error ? error.message : 'Failed to sync');
            setTimeout(() => setSyncError(null), 5000);
        } finally {
            setIsSyncing(false);
        }
    };

    const rounds = roundsData?.rounds || [];
    const liveExecutions = rounds.filter(r => r.execution !== null);

    const job = jobs?.find(j => j.job_id === jobId);
    const [token0Symbol, token1Symbol] = job?.metadata.pair_name.split('/') || ['Token0', 'Token1'];

    if (!job) {
        return (
            <AdminLayout
                title="Pair Not Found"
                description="The requested trading pair does not exist"
                icon={<Terminal size={20} />}
            >
                <div className="text-center py-20">
                    <AlertCircle size={48} className="mx-auto text-primary/20 mb-4" />
                    <p className="text-lg font-bold text-primary mb-2">Pair Not Found</p>
                    <Link href="/admin/pairs" className="text-sm text-primary hover:underline">
                        Back to Pairs
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title={job.metadata.pair_name}
            description={`Pool: ${job.sn_liquidity_manager_address.slice(0, 12)}...${job.sn_liquidity_manager_address.slice(-8)}`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-6 pb-20">
                {/* Header with Back Button */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/admin/pairs"
                        className="flex items-center space-x-2 text-sm text-primary/60 hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Pairs</span>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-black uppercase">
                            {job.is_active ? 'Active' : 'Paused'}
                        </span>
                        <a
                            href={`https://basescan.org/address/${job.sn_liquidity_manager_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-sm text-primary hover:underline"
                        >
                            <span>View on BaseScan</span>
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>

                {/* Pair Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        label="Total Miners"
                        value={stats?.total_miners?.toString() || '0'}
                        icon={<Users size={16} />}
                        color="blue"
                    />
                    <StatCard
                        label="Active (24h)"
                        value={stats?.active_miners_24h?.toString() || '0'}
                        icon={<Activity size={16} />}
                        color="green"
                    />
                    <StatCard
                        label="Total Rounds"
                        value={stats?.total_rounds?.toString() || '0'}
                        icon={<Layers size={16} />}
                        color="purple"
                    />
                </div>

                {/* Pair Performance Metrics */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark">
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                            Pair Performance
                        </h3>
                        <p className="text-xs text-primary/40 mt-1">
                            Returns and APY for {job.metadata.pair_name} over 30 days
                        </p>
                    </div>
                    <div className="p-6">
                        {/* Total Return Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Token0 Return */}
                            <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl p-6">
                                <h4 className="text-sm font-bold text-green-700 mb-3">
                                    30-Day Return ({token0Symbol})
                                </h4>
                                <div className="mb-4">
                                    <p className={`text-3xl font-black mb-1 ${(pnl?.pnl_token0 || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(pnl?.pnl_token0 || 0) >= 0 ? '+' : ''}{((pnl?.pnl_token0 || 0) / (pnl?.initial_tvl_usd || 1) * 100).toFixed(2)}%
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Annualized: {(apy?.apy_percent_token0 || 0) >= 0 ? '+' : ''}{(apy?.apy_percent_token0 || 0).toFixed(1)}% APY
                                    </p>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Revenue:</span>
                                        <span className="font-mono font-bold">{(apy?.revenue_token0 || 0).toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Avg TVL:</span>
                                        <span className="font-mono font-bold">{(apy?.avg_tvl_token0 || 0).toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Token1 Return */}
                            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-6">
                                <h4 className="text-sm font-bold text-blue-700 mb-3">
                                    30-Day Return ({token1Symbol})
                                </h4>
                                <div className="mb-4">
                                    <p className={`text-3xl font-black mb-1 ${(pnl?.pnl_token1 || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(pnl?.pnl_token1 || 0) >= 0 ? '+' : ''}{((pnl?.pnl_token1 || 0) / (pnl?.initial_tvl_usd || 1) * 100).toFixed(2)}%
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Annualized: {(apy?.apy_percent_token1 || 0) >= 0 ? '+' : ''}{(apy?.apy_percent_token1 || 0).toFixed(1)}% APY
                                    </p>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Revenue:</span>
                                        <span className="font-mono font-bold">{(apy?.revenue_token1 || 0).toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Avg TVL:</span>
                                        <span className="font-mono font-bold">{(apy?.avg_tvl_token1 || 0).toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Position Flow */}
                        <div className="bg-cream/20 rounded-xl p-6">
                            <h4 className="text-xs font-black text-primary uppercase tracking-wider mb-4">
                                Position Flow
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                {/* Initial */}
                                <div>
                                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                                        Initial
                                    </p>
                                    <div className="space-y-1">
                                        <p className="text-sm font-mono font-bold text-primary">
                                            {((tvl?.tvl_token0 || 0) - (pnl?.pnl_token0 || 0)).toFixed(4)} {token0Symbol}
                                        </p>
                                        <p className="text-sm font-mono font-bold text-primary">
                                            {((tvl?.tvl_token1 || 0) - (pnl?.pnl_token1 || 0)).toFixed(4)} {token1Symbol}
                                        </p>
                                    </div>
                                </div>

                                {/* Arrow & Fees */}
                                <div className="flex flex-col items-center">
                                    <div className="text-center mb-2">
                                        <p className="text-xs text-green-600 font-bold">
                                            +{(apy?.revenue_token0 || 0).toFixed(4)}
                                        </p>
                                        <p className="text-xs text-blue-600 font-bold">
                                            +{(apy?.revenue_token1 || 0).toFixed(4)}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-bold mt-1">
                                            APY: {(apy?.apy_percent_token0 || 0).toFixed(1)}% / {(apy?.apy_percent_token1 || 0).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="text-2xl text-primary/20">→</div>
                                </div>

                                {/* Final */}
                                <div className="md:text-right">
                                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                                        Final
                                    </p>
                                    <div className="space-y-1">
                                        <p className="text-sm font-mono font-bold text-primary">
                                            {(tvl?.tvl_token0 || 0).toFixed(4)} {token0Symbol}
                                        </p>
                                        <p className="text-sm font-mono font-bold text-primary">
                                            {(tvl?.tvl_token1 || 0).toFixed(4)} {token1Symbol}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pool Price Chart Placeholder */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                                    Pool Price & Miner Positions
                                </h3>
                                <p className="text-xs text-primary/40 mt-1">
                                    Liquidity ranges and price movements for {job.metadata.pair_name}
                                </p>
                            </div>
                            <button
                                onClick={handleSyncPoolData}
                                disabled={isSyncing}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    syncSuccess
                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                        : syncError
                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                            : 'bg-primary text-white hover:bg-primary/90 border border-primary'
                                } ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
                            >
                                <RefreshCw
                                    size={14}
                                    className={isSyncing ? 'animate-spin' : ''}
                                />
                                <span>
                                    {isSyncing
                                        ? 'Syncing...'
                                        : syncSuccess
                                            ? 'Synced!'
                                            : syncError
                                                ? 'Error'
                                                : 'Sync Pool Data'}
                                </span>
                            </button>
                        </div>
                    </div>
                    <div className="p-6">
                        {/* Sync Error Message */}
                        {syncError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-700">
                                    <span className="font-bold">Error:</span> {syncError}
                                </p>
                            </div>
                        )}

                        {/* Sync Success Message */}
                        {syncSuccess && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-xs text-green-700">
                                    <CheckCircle2 size={14} className="inline mr-1" />
                                    <span className="font-bold">Pool data synced successfully!</span>
                                </p>
                            </div>
                        )}

                        {/* Pool Data Info Banner */}
                        {poolDataLoading && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2">
                                <RefreshCw size={14} className="animate-spin text-blue-600" />
                                <p className="text-xs text-blue-700">Loading pool data from reader database...</p>
                            </div>
                        )}

                        {poolDataError && !poolDataStats && (
                            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-xs text-yellow-700">
                                    <AlertCircle size={14} className="inline mr-1" />
                                    <span className="font-bold">Pool data unavailable.</span> Showing data from swap events.
                                </p>
                            </div>
                        )}

                        {/* Price Summary Cards - Enhanced with Pool Data */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                <p className="text-xs text-primary/40 mb-1">Current Price</p>
                                <p className="text-sm font-black text-primary">
                                    {poolDataStats?.close_price
                                        ? `$${poolDataStats.close_price < 1
                                            ? poolDataStats.close_price.toFixed(4)
                                            : poolDataStats.close_price.toFixed(2)}`
                                        : poolPrice?.current_price
                                            ? `$${poolPrice.current_price < 1
                                                ? poolPrice.current_price.toFixed(4)
                                                : poolPrice.current_price.toFixed(2)}`
                                            : '-'}
                                </p>
                                {poolDataStats?.price_change_pct !== undefined && (
                                    <p className={`text-xs font-mono mt-1 ${poolDataStats.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {poolDataStats.price_change_pct >= 0 ? '+' : ''}{poolDataStats.price_change_pct.toFixed(2)}%
                                    </p>
                                )}
                                {poolDataStats && (
                                    <p className="text-[9px] text-purple-600 font-bold mt-1">Pool Data</p>
                                )}
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                <p className="text-xs text-primary/40 mb-1">24h Range</p>
                                <p className="text-sm font-black text-primary">
                                    {poolDataStats?.low_price && poolDataStats?.high_price
                                        ? `$${(poolDataStats.low_price < 1 ? poolDataStats.low_price.toFixed(4) : poolDataStats.low_price.toFixed(2))} - $${(poolDataStats.high_price < 1 ? poolDataStats.high_price.toFixed(4) : poolDataStats.high_price.toFixed(2))}`
                                        : poolPrice?.price_24h_low && poolPrice?.price_24h_high
                                            ? `$${(poolPrice.price_24h_low < 1 ? poolPrice.price_24h_low.toFixed(4) : poolPrice.price_24h_low.toFixed(2))} - $${(poolPrice.price_24h_high < 1 ? poolPrice.price_24h_high.toFixed(4) : poolPrice.price_24h_high.toFixed(2))}`
                                            : '-'}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                <p className="text-xs text-primary/40 mb-1">24h Volume</p>
                                <p className="text-sm font-black text-primary">
                                    ${poolDataStats?.volume1 ? (poolDataStats.volume1 * (poolDataStats.close_price || 0)).toFixed(0) : (poolPrice?.volume_24h_usd?.toFixed(0) || '-')}
                                </p>
                                {poolDataStats?.total_swaps !== undefined && (
                                    <p className="text-xs text-primary/40 mt-1">{poolDataStats.total_swaps} swaps</p>
                                )}
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                <p className="text-xs text-primary/40 mb-1">24h Fees</p>
                                <p className="text-sm font-black text-primary">
                                    {poolDataStats?.fees1
                                        ? `$${(poolDataStats.fees1 * (poolDataStats.close_price || 0)).toFixed(2)}`
                                        : '-'}
                                </p>
                                {poolDataStats && (
                                    <p className="text-xs text-primary/40 mt-1">
                                        {poolDataStats.fees0?.toFixed(4)} {poolDataStats.token0_symbol}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Price Chart - Full Width */}
                        <div className="mt-8">
                            <PoolPriceChart
                                jobId={jobId}
                                token0Symbol={token0Symbol}
                                token1Symbol={token1Symbol}
                                lowerPriceBound={poolPrice?.current_position?.lower_price ?? undefined}
                                upperPriceBound={poolPrice?.current_position?.upper_price ?? undefined}
                                currentPrice={poolPrice?.current_price ?? undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pair Configuration */}
            <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-cream-dark">
                    <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                        Pair Configuration
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <ConfigRow label="Pair Address" value={job.pair_address} mono />
                    <ConfigRow label="Vault Address" value={job.sn_liquidity_manager_address} mono />
                    <ConfigRow label="Fee Rate" value={`${(job.fee_rate * 100).toFixed(2)}%`} />
                    <ConfigRow label="Target Ratio" value={`${(job.target_ratio * 100).toFixed(0)}%`} />
                    <ConfigRow label="Round Duration" value={`${job.round_duration_seconds}s (${job.round_duration_seconds / 60}m)`} />
                    <ConfigRow label="Chain ID" value={job.chain_id.toString()} />
                    <ConfigRow
                        label="Created"
                        value={new Date(job.created_at).toLocaleString()}
                    />
                </div>
            </div>

            {/* All Rounds Activity */}
            <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                            Round Activity
                        </h3>
                        <p className="text-xs text-primary/40 mt-1">
                            All competition rounds • LIVE rounds show execution details
                        </p>
                    </div>
                    <div className="flex items-center space-x-4 text-xs font-mono">
                        <span className="text-primary/40">{rounds?.length || 0} total</span>
                        <span className="text-green-600">{liveExecutions?.length || 0} live</span>
                        <span className="text-gray-500">{(rounds?.length || 0) - (liveExecutions?.length || 0)} eval</span>
                    </div>
                </div>
                <div className="p-6 space-y-4 max-h-[1200px] overflow-y-auto">
                    {!rounds || rounds.length === 0 ? (
                        <div className="py-12 text-center">
                            <Zap size={48} className="mx-auto text-primary/20 mb-4" />
                            <p className="text-sm text-primary/40 mb-2">No rounds yet</p>
                            <p className="text-xs text-primary/20">
                                Waiting for validator to start running rounds
                            </p>
                        </div>
                    ) : (
                        rounds.map((round) => (
                            <RoundCard key={round.round_id} round={round} />
                        ))
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value, icon, color }: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'purple' | 'orange';
}) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
    };

    return (
        <div className="bg-white border border-cream-dark rounded-2xl p-4">
            <div className={`p-2 ${colors[color]} rounded-lg w-fit mb-3`}>
                {icon}
            </div>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-1">
                {label}
            </p>
            <p className="text-2xl font-black text-primary tracking-tight">{value}</p>
        </div>
    );
}

function ConfigRow({ label, value, mono = false }: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-cream/50 last:border-0">
            <span className="text-xs font-bold text-primary/60">{label}</span>
            <span className={`text-sm font-bold text-primary ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </span>
        </div>
    );
}

function ActivityStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
        success: {
            bg: 'bg-green-100',
            text: 'text-green-700',
            icon: <CheckCircle2 size={12} />,
        },
        pending: {
            bg: 'bg-yellow-100',
            text: 'text-yellow-700',
            icon: <Clock size={12} />,
        },
        failed: {
            bg: 'bg-red-100',
            text: 'text-red-700',
            icon: <XCircle size={12} />,
        },
    };

    const { bg, text, icon } = config[status] || config.pending;

    return (
        <span className={`${bg} ${text} px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 w-fit`}>
            {icon}
            <span>{status}</span>
        </span>
    );
}

function RoundCard({ round }: { round: any }) {
    const execution = round.execution;
    const isLive = round.round_type === 'live';
    const rebalance = execution?.actual_performance?.rebalance;
    const strategy = execution?.strategy_data;

    return (
        <div className={`rounded-xl p-4 border transition-colors ${isLive
            ? 'bg-green-50/30 border-green-200 hover:bg-green-50/50'
            : 'bg-cream/20 border-cream-dark hover:bg-cream/30'
            }`}>
            {/* Round Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${isLive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {round.round_type}
                    </span>
                    <div>
                        <p className="text-sm font-bold text-primary">
                            Round #{round.round_number}
                        </p>
                        <p className="text-xs text-primary/40">
                            {round.participants_count} participants
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    {round.end_time && (
                        <p className="text-xs text-primary/40">
                            {new Date(round.end_time).toLocaleString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Winner Info */}
            {round.winner_uid !== null && (
                <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                        Winner
                    </p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-primary">
                                UID {round.winner_uid}
                            </p>
                            <p className="text-xs font-mono text-primary/40">
                                {round.winner_hotkey?.slice(0, 20)}...
                            </p>
                        </div>
                        {round.winner_score && (
                            <div className="text-right">
                                <p className="text-sm font-mono font-bold text-primary">
                                    {round.winner_score.toFixed(2)}
                                </p>
                                <p className="text-xs text-primary/40">score</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Execution Details for LIVE rounds */}
            {isLive && execution && (
                <>
                    {/* Proposed Strategy */}
                    {strategy && (
                        <div className="bg-white rounded-lg p-3 mb-3">
                            <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                                Proposed Strategy
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-primary/40">New Range:</span>
                                    <p className="font-mono text-primary font-bold">
                                        [{strategy.lower_tick?.toLocaleString()}, {strategy.upper_tick?.toLocaleString()}]
                                    </p>
                                </div>
                                <div>
                                    <span className="text-primary/40">Liquidity:</span>
                                    <p className="font-mono text-primary">
                                        {strategy.liquidity_token0?.toFixed(2)} / {strategy.liquidity_token1?.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rebalance Executed */}
                    {rebalance && (
                        <div className="bg-white rounded-lg p-3 mb-3">
                            <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-3">
                                Rebalance Executed
                            </p>

                            {/* Position Change */}
                            <div className="space-y-2 text-xs mb-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-primary/40">Old Position:</span>
                                    <span className="font-mono text-red-600 font-bold">
                                        [{rebalance.old_lower_tick?.toLocaleString()}, {rebalance.old_upper_tick?.toLocaleString()}]
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-primary/40">New Position:</span>
                                    <span className="font-mono text-green-600 font-bold">
                                        [{rebalance.new_lower_tick?.toLocaleString()}, {rebalance.new_upper_tick?.toLocaleString()}]
                                    </span>
                                </div>
                            </div>

                            {/* Fees Collected */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
                                <p className="text-[10px] font-black text-green-700 uppercase tracking-wider mb-1">
                                    Fees Collected
                                </p>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-mono text-green-600 font-bold">
                                        {rebalance.fees_collected_0?.toFixed(4)} token0
                                    </span>
                                    <span className="font-mono text-green-600 font-bold">
                                        {rebalance.fees_collected_1?.toFixed(4)} token1
                                    </span>
                                </div>
                            </div>

                            {/* Tokens Moved */}
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div className="bg-red-50 rounded p-2">
                                    <p className="text-[9px] font-black text-red-700 uppercase mb-1">Removed</p>
                                    <p className="font-mono text-red-600 text-[10px]">
                                        {rebalance.tokens_removed_0?.toFixed(2)} t0
                                    </p>
                                    <p className="font-mono text-red-600 text-[10px]">
                                        {rebalance.tokens_removed_1?.toFixed(2)} t1
                                    </p>
                                </div>
                                <div className="bg-green-50 rounded p-2">
                                    <p className="text-[9px] font-black text-green-700 uppercase mb-1">Added</p>
                                    <p className="font-mono text-green-600 text-[10px]">
                                        {rebalance.tokens_added_0?.toFixed(2)} t0
                                    </p>
                                    <p className="font-mono text-green-600 text-[10px]">
                                        {rebalance.tokens_added_1?.toFixed(2)} t1
                                    </p>
                                </div>
                            </div>

                            {/* Impact Metrics */}
                            {execution.actual_performance && (
                                <div className="pt-3 border-t border-cream flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-primary/40">Price Impact:</span>
                                        <span className={`ml-2 font-mono font-bold ${Math.abs(execution.actual_performance.price_impact || 0) > 0.01 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {((execution.actual_performance.price_impact || 0) * 100).toFixed(3)}%
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-primary/40">Slippage:</span>
                                        <span className="ml-2 font-mono font-bold text-primary">
                                            {((execution.actual_performance.slippage || 0) * 100).toFixed(3)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Transaction */}
                    {execution.tx_hash && (
                        <div className="flex items-center justify-between text-xs bg-white rounded-lg p-3">
                            <span className="text-primary/40">Transaction:</span>
                            <a
                                href={`https://basescan.org/tx/${execution.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-primary hover:underline flex items-center space-x-1"
                            >
                                <span>{execution.tx_hash.slice(0, 16)}...</span>
                                <ExternalLink size={10} />
                            </a>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function StrategyCard({ round }: { round: any }) {
    const execution = round.execution;
    if (!execution) return null;

    const rebalance = execution.actual_performance?.rebalance;
    const strategy = execution.strategy_data;

    return (
        <div className="bg-cream/20 rounded-xl p-4 hover:bg-cream/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-sm font-bold text-primary mb-1">
                        Round #{round.round_number} • UID {round.winner_uid}
                    </p>
                    <p className="text-xs font-mono text-primary/40">
                        {round.winner_hotkey?.slice(0, 20)}...
                    </p>
                </div>
                <ActivityStatusBadge status={execution.tx_status || 'pending'} />
            </div>

            {/* Proposed Strategy */}
            {strategy && (
                <div className="bg-white rounded-lg p-3 mt-3">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                        Proposed Strategy
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-primary/40">New Range:</span>
                            <p className="font-mono text-primary font-bold">
                                [{strategy.lower_tick?.toLocaleString()}, {strategy.upper_tick?.toLocaleString()}]
                            </p>
                        </div>
                        <div>
                            <span className="text-primary/40">Liquidity:</span>
                            <p className="font-mono text-primary">
                                {strategy.liquidity_token0?.toFixed(2)} / {strategy.liquidity_token1?.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* What Actually Happened (Rebalance) */}
            {rebalance && (
                <div className="bg-white rounded-lg p-3 mt-3">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-3">
                        Rebalance Executed
                    </p>

                    {/* Position Change */}
                    <div className="space-y-2 text-xs mb-3">
                        <div className="flex items-center justify-between">
                            <span className="text-primary/40">Old Position:</span>
                            <span className="font-mono text-red-600 font-bold">
                                [{rebalance.old_lower_tick?.toLocaleString()}, {rebalance.old_upper_tick?.toLocaleString()}]
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-primary/40">New Position:</span>
                            <span className="font-mono text-green-600 font-bold">
                                [{rebalance.new_lower_tick?.toLocaleString()}, {rebalance.new_upper_tick?.toLocaleString()}]
                            </span>
                        </div>
                    </div>

                    {/* Fees Collected */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
                        <p className="text-[10px] font-black text-green-700 uppercase tracking-wider mb-1">
                            Fees Collected
                        </p>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-green-600 font-bold">
                                {rebalance.fees_collected_0?.toFixed(4)} token0
                            </span>
                            <span className="font-mono text-green-600 font-bold">
                                {rebalance.fees_collected_1?.toFixed(4)} token1
                            </span>
                        </div>
                    </div>

                    {/* Tokens Moved */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-red-50 rounded p-2">
                            <p className="text-[9px] font-black text-red-700 uppercase mb-1">Removed</p>
                            <p className="font-mono text-red-600 text-[10px]">
                                {rebalance.tokens_removed_0?.toFixed(2)} t0
                            </p>
                            <p className="font-mono text-red-600 text-[10px]">
                                {rebalance.tokens_removed_1?.toFixed(2)} t1
                            </p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                            <p className="text-[9px] font-black text-green-700 uppercase mb-1">Added</p>
                            <p className="font-mono text-green-600 text-[10px]">
                                {rebalance.tokens_added_0?.toFixed(2)} t0
                            </p>
                            <p className="font-mono text-green-600 text-[10px]">
                                {rebalance.tokens_added_1?.toFixed(2)} t1
                            </p>
                        </div>
                    </div>

                    {/* Impact Metrics */}
                    {execution.actual_performance && (
                        <div className="mt-3 pt-3 border-t border-cream flex items-center justify-between text-xs">
                            <div>
                                <span className="text-primary/40">Price Impact:</span>
                                <span className={`ml-2 font-mono font-bold ${Math.abs(execution.actual_performance.price_impact || 0) > 0.01 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {((execution.actual_performance.price_impact || 0) * 100).toFixed(3)}%
                                </span>
                            </div>
                            <div>
                                <span className="text-primary/40">Slippage:</span>
                                <span className="ml-2 font-mono font-bold text-primary">
                                    {((execution.actual_performance.slippage || 0) * 100).toFixed(3)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {execution.tx_hash && (
                <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-primary/40">Transaction:</span>
                    <a
                        href={`https://basescan.org/tx/${execution.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary hover:underline flex items-center space-x-1"
                    >
                        <span>{execution.tx_hash.slice(0, 16)}...</span>
                        <ExternalLink size={10} />
                    </a>
                </div>
            )}
        </div>
    );
}
