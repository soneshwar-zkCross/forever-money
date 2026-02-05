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
import { useJobs, useNetworkStats, useLeaderboard, useJobAPY, useJobPnL, useJobTVL, useJobRevenue } from '@/lib/api';
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

// Mock Data for fallback/demo purposes
const MOCK_JOBS = [
    {
        job_id: 'job_link_usdc',
        pair_address: '0x...LINK',
        fee_rate: 0.05,
        target: 'LINK/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'LINK/USDC', description: 'Chainlink / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolLINK',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_xaut_usdt',
        pair_address: '0x...XAUT',
        fee_rate: 0.2,
        target: 'XAUT/USDT',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 3600,
        metadata: { pair_name: 'XAUT/USDT', description: 'Tether Gold / USDT Vault' },
        sn_liquidity_manager_address: '0xMockPoolXAUT',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_xsn_usdc',
        pair_address: '0x...xSN',
        fee_rate: 0.1,
        target: 'xSN/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'xSN/USDC', description: 'xSN / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolxSN',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_sol_usdc',
        pair_address: '0x...SOL',
        fee_rate: 0.15,
        target: 'SOL/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 300,
        metadata: { pair_name: 'SOL/USDC', description: 'Solana / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolSOL',
        target_ratio: 0.4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_arb_usdc',
        pair_address: '0x...ARB',
        fee_rate: 0.05,
        target: 'ARB/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 900,
        metadata: { pair_name: 'ARB/USDC', description: 'Arbitrum / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolARB',
        target_ratio: 0.6,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);

    // Fetch miners for this specific job to show their vaults
    const { data: miners, isLoading: leaderboardLoading } = useLeaderboard(jobId);

    // Fallback to MOCK_JOBS if not found in API response
    const job = jobs?.find(j => j.job_id === jobId) || MOCK_JOBS.find(j => j.job_id === jobId);
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
            title={`${token0Symbol} / ${token1Symbol} | Aerodrome | Base`}
            description={`Pool — ${job.sn_liquidity_manager_address.slice(0, 12)}...${job.sn_liquidity_manager_address.slice(-8)}`}
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
                        <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-black uppercase">
                            <span>{job.is_active ? 'Active' : 'Paused'}</span>
                            <span className="opacity-20">|</span>
                            <span>{stats?.total_miners || 0}</span>
                        </div>
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


                {/* High Density Metric Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MiniStatBox label="TVL (USD)" value={`$${((tvl?.tvl_usd || 0) / 1000000).toFixed(1)}M`} />
                    <MiniStatBox label="Fees Earned (USD)" value={`$${((pnl?.pnl_usd || 0) / 1000).toFixed(0)}k`} />
                    <MiniStatBox label={`APY ${token0Symbol} / ${token1Symbol}`} value={`${(apy?.apy_percent_token0 || 0).toFixed(1)}% / ${(apy?.apy_percent_token1 || 0).toFixed(1)}%`} />
                    <MiniStatBox label="APY (USD)" value={`${(apy?.apy_percent || 0).toFixed(1)}%`} />
                    <MiniStatBox label="Benchmark Market" value="22.5%" />
                    <MiniStatBox label="Active Vault Jobs" value={stats?.total_miners?.toString() || '0'} />
                </div>

                {/* Performance Chart Section */}
                <div className="bg-white p-8 rounded-[32px] border border-cream-dark shadow-sm font-mono text-primary flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                            <span className="text-[13px] font-black uppercase tracking-tight">
                                {token0Symbol}/{token1Symbol} Price | TVL | Fees Earned
                            </span>
                            <span className="text-[10px] uppercase opacity-30 font-bold mt-1">Performance Over Time</span>
                        </div>
                        <div className="flex items-center space-x-4 text-[10px] font-black uppercase bg-cream/20 px-4 py-2 rounded-xl">
                            <span className="opacity-40">TF:</span>
                            <button className="hover:text-blue-600 transition-colors">1D</button>
                            <span>|</span>
                            <button className="hover:text-blue-600 transition-colors">7D</button>
                            <span>|</span>
                            <button className="text-blue-600">30D</button>
                            <span>|</span>
                            <button className="hover:text-blue-600 transition-colors">All</button>
                        </div>
                    </div>

                    <div className="border-t border-dashed border-primary/10 mb-8" />

                    <div className="h-64 w-full mb-6 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={Array.from({ length: 30 }, (_, i) => ({ day: i, value: (tvl?.tvl_usd || 1000000) * (0.9 + Math.random() * 0.2) }))}>
                                <YAxis hide domain={['auto', 'auto']} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white px-2 py-1 border border-cream-dark text-[10px] shadow-sm">
                                                    ${(payload[0].value as number).toLocaleString()}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={false}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>

                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[9px] font-black opacity-20 uppercase tracking-widest -translate-x-4">
                            USD
                        </div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-black opacity-20 uppercase tracking-widest translate-y-4">
                            Time
                        </div>
                    </div>

                    <div className="border-t border-dashed border-primary/10 pt-4 text-[10px] font-bold text-primary/40 flex justify-between uppercase">
                        <span>DATA SOURCE: HYPERLIQUID</span>
                        <div className="flex items-center space-x-1 font-black">
                            <span>{job.round_duration_seconds / 60}M CYCLES</span>
                        </div>
                    </div>
                </div>

                {/* Active Vaults Table (List View) */}
                <div className="bg-white rounded-[32px] border border-cream-dark shadow-sm font-mono text-primary overflow-hidden">
                    <div className="p-8 border-b border-cream flex items-center justify-between bg-cream/5">
                        <div className="flex flex-col">
                            <h3 className="text-[13px] font-black uppercase tracking-tight">Active Vaults</h3>
                            <span className="text-[10px] uppercase opacity-30 font-bold mt-1">Live Execution Records</span>
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">
                            {miners?.length || 0} ACTIVE
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-cream-dark/50 bg-cream/10">
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap">Vault No.</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap">Miner</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">TVL</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">Fees USD</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">Fees {token0Symbol}</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">Fees {token1Symbol}</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">APY {token0Symbol}</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">APY {token1Symbol}</th>
                                    <th className="px-6 py-4 text-[9px] font-black uppercase text-primary/40 tracking-widest whitespace-nowrap text-right">APY (USD)</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream/50">
                                {leaderboardLoading ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={10} className="px-6 py-4"><div className="h-4 bg-cream rounded" /></td>
                                        </tr>
                                    ))
                                ) : (
                                    miners?.map((miner, i) => (
                                        <tr
                                            key={miner.miner_uid}
                                            className="hover:bg-cream/20 transition-colors group cursor-pointer"
                                            onClick={() => { }} // Navigate to individual vault page
                                        >
                                            <td className="px-6 py-4 text-xs font-bold text-primary/60">Vault #{miner.miner_uid}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-black text-primary">{miner.miner_hotkey.substring(0, 8)}...</div>
                                                <div className="text-[9px] font-bold text-primary/30 uppercase">UID: {miner.miner_uid}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">${(135000).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">${(72350 - (i * 1000)).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">{(1100587).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">{(4.7689).toFixed(4)}</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">32.5%</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">15.2%</td>
                                            <td className="px-6 py-4 text-right text-xs font-bold text-blue-600">14%</td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/admin/miners/${miner.miner_uid}?pair=${jobId}`}
                                                    className="text-blue-600 hover:underline text-xs font-black flex items-center justify-end"
                                                >
                                                    <span>→</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pair Configuration remains as reference */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden mt-12">
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
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}


function MiniStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-4 rounded-2xl border border-cream-dark shadow-sm font-mono flex flex-col justify-between h-full hover:bg-cream/5 transition-colors">
            <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest mb-2 leading-tight">
                {label}
            </span>
            <span className="text-sm font-black text-primary tracking-tight">
                {value}
            </span>
        </div>
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
    const predictions = round.predictions || [];
    const executions = round.executions || [];

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



            {/* All Miner Predictions */}
            {predictions.length > 0 && (
                <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-3">
                        Miner Predictions ({predictions.length})
                    </p>
                    <div className="space-y-2">
                        {predictions.map((pred: any, idx: number) => {
                            const predData = pred.prediction_data;
                            const strategyInfo = predData?.strategy || {};
                            const execution = executions.find((e: any) => e.miner_uid === pred.miner_uid);
                            const action = strategyInfo.action || strategyInfo.name || (predData?.should_rebalance ? 'REBALANCE' : 'HOLD');

                            return (
                                <div
                                    key={idx}
                                    className="p-3 rounded-lg border bg-gray-50 border-gray-200"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <p className="text-xs font-bold text-primary">
                                                    Miner UID {pred.miner_uid}
                                                    {idx === 0 && (
                                                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded">
                                                            Initial Entry
                                                        </span>
                                                    )}
                                                </p>
                                                {execution && (
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${execution.tx_status === 'success'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {execution.tx_status}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-mono text-primary/40">
                                                Vault: vault_{pred.miner_uid}_{round.round_id?.split('_')[0]}_{round.round_id?.split('_')[1]}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end space-y-2">
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${action === 'REBALANCE' || action?.toUpperCase().includes('REBALANCE')
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                {action}
                                            </span>
                                            {execution?.tx_hash && (
                                                <a
                                                    href={`https://basescan.org/tx/${execution.tx_hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-[9px] text-primary/40 hover:text-primary hover:underline flex items-center space-x-1"
                                                >
                                                    <span>{execution.tx_hash.slice(0, 8)}...</span>
                                                    <ExternalLink size={8} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                        <div>
                                            <span className="text-primary/40">Range:</span>
                                            <p className="font-mono text-primary font-bold">
                                                ${predData?.lower_price_bound?.toFixed(4)} - ${predData?.upper_price_bound?.toFixed(4)}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-primary/40">Liquidity:</span>
                                            <p className="font-mono text-primary font-bold">
                                                ${predData?.liquidity_amount?.toFixed(0)}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-primary/40">Threshold:</span>
                                            <p className="font-mono text-primary font-bold">
                                                {(strategyInfo.rebalance_threshold * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                    </div>

                                    {execution?.actual_performance && (
                                        <div className="mt-2 pt-2 border-t border-gray-200 text-[10px]">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-primary/40">Success:</span>
                                                    <span className={`ml-2 font-bold ${execution.actual_performance.success ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                        {execution.actual_performance.success ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                                {execution.actual_performance.error && (
                                                    <span className="text-red-600 text-[9px]">
                                                        {execution.actual_performance.error}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
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
                        Round #{round.round_number} Execution Details
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
