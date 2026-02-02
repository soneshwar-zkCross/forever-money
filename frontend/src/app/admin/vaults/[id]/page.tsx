'use client';

import React, { use } from 'react';
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
} from 'lucide-react';
import { useJobs, useNetworkStats, useExecutions, Job } from '@/lib/api';
import Link from 'next/link';

export default function VaultDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: executions } = useExecutions(jobId);

    const job = jobs?.find(j => j.job_id === jobId);

    if (!job) {
        return (
            <AdminLayout
                title="Vault Not Found"
                description="The requested vault does not exist"
                icon={<Terminal size={20} />}
            >
                <div className="text-center py-20">
                    <AlertCircle size={48} className="mx-auto text-primary/20 mb-4" />
                    <p className="text-lg font-bold text-primary mb-2">Vault Not Found</p>
                    <Link href="/admin/jobs" className="text-sm text-primary hover:underline">
                        Back to Vaults
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            title={job.metadata.pair_name}
            description={`Vault: ${job.sn_liquidity_manager_address.slice(0, 12)}...${job.sn_liquidity_manager_address.slice(-8)}`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-6 pb-20">
                {/* Header with Back Button */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/admin/jobs"
                        className="flex items-center space-x-2 text-sm text-primary/60 hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Vaults</span>
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

                {/* Vault Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <StatCard
                        label="Participation"
                        value={`${((stats?.avg_participation_rate || 0) * 100).toFixed(0)}%`}
                        icon={<TrendingUp size={16} />}
                        color="orange"
                    />
                </div>

                {/* Pool Price Chart Placeholder */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark">
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                            Pool Price & Miner Positions
                        </h3>
                        <p className="text-xs text-primary/40 mt-1">
                            Liquidity ranges and price movements for {job.metadata.pair_name}
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="bg-cream/20 rounded-xl p-8 text-center">
                            <TrendingUp size={48} className="mx-auto text-primary/20 mb-4" />
                            <p className="text-sm font-bold text-primary mb-2">Pool Chart Visualization</p>
                            <p className="text-xs text-primary/40 mb-4 max-w-md mx-auto">
                                This will display the pool's price history with overlaid miner position ranges.
                                Integration with pool data and miner predictions coming soon.
                            </p>
                            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-6">
                                <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                    <p className="text-xs text-primary/40 mb-1">Current Price</p>
                                    <p className="text-sm font-black text-primary">-</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                    <p className="text-xs text-primary/40 mb-1">24h Range</p>
                                    <p className="text-sm font-black text-primary">-</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-cream-dark">
                                    <p className="text-xs text-primary/40 mb-1">Active Positions</p>
                                    <p className="text-sm font-black text-primary">{stats?.active_miners_24h || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vault Configuration */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark">
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                            Vault Configuration
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

                {/* Activity Log */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                                Vault Activity Log
                            </h3>
                            <p className="text-xs text-primary/40 mt-1">
                                All executions, rounds, and events for this vault
                            </p>
                        </div>
                        <span className="text-xs text-primary/40 font-mono">
                            {executions?.length || 0} total executions
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-cream/20">
                                <tr className="text-[10px] font-black text-primary/40 uppercase tracking-wider">
                                    <th className="px-6 py-3 text-left">Type</th>
                                    <th className="px-6 py-3 text-left">Round</th>
                                    <th className="px-6 py-3 text-left">Miner</th>
                                    <th className="px-6 py-3 text-left">Hotkey</th>
                                    <th className="px-6 py-3 text-left">TX Hash</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                    <th className="px-6 py-3 text-left">Block</th>
                                    <th className="px-6 py-3 text-left">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream/50">
                                {!executions || executions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <Zap size={32} className="mx-auto text-primary/20 mb-2" />
                                            <p className="text-sm text-primary/40">No executions yet</p>
                                            <p className="text-xs text-primary/20 mt-1">
                                                Waiting for rounds to complete and miners to execute strategies
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    executions.map((exec) => (
                                        <tr key={exec.execution_id} className="hover:bg-cream/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase">
                                                    Live
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-primary">
                                                #{exec.round_number}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-primary">
                                                UID {exec.miner_uid}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-primary/60">
                                                {exec.miner_hotkey.slice(0, 12)}...
                                            </td>
                                            <td className="px-6 py-4">
                                                {exec.tx_hash ? (
                                                    <a
                                                        href={`https://basescan.org/tx/${exec.tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-mono text-primary/60 hover:text-primary flex items-center space-x-1"
                                                    >
                                                        <span>{exec.tx_hash.slice(0, 10)}...</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-primary/20">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <ActivityStatusBadge status={exec.tx_status || 'pending'} />
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-primary/60">
                                                {exec.block_number || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-primary/40">
                                                {new Date(exec.executed_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Strategy Data */}
                {executions && executions.length > 0 && (
                    <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-cream-dark">
                            <h3 className="text-sm font-black text-primary uppercase tracking-wider">
                                Recent Strategies
                            </h3>
                            <p className="text-xs text-primary/40 mt-1">
                                Miner position ranges and rebalance strategies
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            {executions.slice(0, 3).map((exec) => (
                                <StrategyCard key={exec.execution_id} execution={exec} />
                            ))}
                        </div>
                    </div>
                )}
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

function StrategyCard({ execution }: { execution: any }) {
    return (
        <div className="bg-cream/20 rounded-xl p-4 hover:bg-cream/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-sm font-bold text-primary mb-1">
                        Round #{execution.round_number} • UID {execution.miner_uid}
                    </p>
                    <p className="text-xs font-mono text-primary/40">
                        {execution.miner_hotkey.slice(0, 20)}...
                    </p>
                </div>
                <ActivityStatusBadge status={execution.tx_status || 'pending'} />
            </div>

            {execution.strategy_data && (
                <div className="bg-white rounded-lg p-3 mt-3">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider mb-2">
                        Strategy Data
                    </p>
                    <pre className="text-xs font-mono text-primary/60 overflow-x-auto">
                        {JSON.stringify(execution.strategy_data, null, 2).slice(0, 200)}...
                    </pre>
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
