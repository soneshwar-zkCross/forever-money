'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    LayoutDashboard,
    Database,
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Zap,
    Terminal,
    Cpu,
    HardDrive,
    TrendingUp,
    Users,
    Layers,
    RefreshCw,
    ChevronRight,
} from 'lucide-react';
import {
    useJobs,
    useLeaderboard,
    useNetworkStats,
    useSubnetEmissions,
    useExecutions,
    useSubnetTVL,
    useSubnetPnL
} from '@/lib/api';

export default function DashboardPage() {
    const { data: jobs, isLoading: jobsLoading } = useJobs();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    // Auto-select first job using useEffect to avoid render-phase state updates
    React.useEffect(() => {
        if (jobs && jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].job_id);
        }
    }, [jobs, selectedJobId]);

    const { data: stats, isLoading: statsLoading } = useNetworkStats(selectedJobId || '');
    const { data: leaderboard } = useLeaderboard(selectedJobId || '');
    const { data: emissions, isLoading: emissionsLoading } = useSubnetEmissions();
    const { data: executions } = useExecutions(selectedJobId || '');
    const { data: subnetTVL } = useSubnetTVL();
    const { data: subnetPnL } = useSubnetPnL(30);

    const activeJobs = jobs?.filter(j => j.is_active) || [];
    const totalMiners = stats?.total_miners || 0;
    const activeMiners = stats?.active_miners_24h || 0;

    return (
        <AdminLayout
            title="Validator Dashboard"
            description="Real-time validator monitoring and debugging console"
            icon={<LayoutDashboard size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {/* System Status Bar */}
                <div className="bg-white border border-cream-dark rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <StatusIndicator
                                label="API"
                                status="online"
                                detail="Healthy"
                            />
                            <StatusIndicator
                                label="Database"
                                status={jobs ? "online" : "offline"}
                                detail={`${jobs?.length || 0} jobs`}
                            />
                            <StatusIndicator
                                label="Metagraph"
                                status={emissions ? "online" : "syncing"}
                                detail={emissionsLoading ? "Syncing..." : "Synced"}
                            />
                            <StatusIndicator
                                label="Emissions"
                                status={emissions && emissions.miner_ratio > 0 ? "online" : "offline"}
                                detail={`${((emissions?.burn_ratio || 0) * 100).toFixed(0)}% burn`}
                            />
                        </div>
                        <div className="text-xs text-primary/40 font-mono">
                            Last updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Critical Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <MetricCard
                        label="Active Pairs"
                        value={activeJobs.length.toString()}
                        change={`${jobs?.length || 0} total`}
                        icon={<Layers size={16} />}
                        trend="neutral"
                    />
                    <MetricCard
                        label="Active Miners (24h)"
                        value={activeMiners.toString()}
                        change={`${totalMiners} total registered`}
                        icon={<Users size={16} />}
                        trend={activeMiners > 0 ? "up" : "neutral"}
                    />

                    <MetricCard
                        label="Total TVL"
                        value={`$${(subnetTVL?.total_tvl_usd || 0).toLocaleString()}`}
                        change={`${subnetTVL?.vault_count || 0} pairs`}
                        icon={<Database size={16} />}
                        trend="up"
                    />
                    <MetricCard
                        label="PnL (30d)"
                        value={`$${(subnetPnL?.total_pnl_usd || 0).toLocaleString()}`}
                        change={`Across ${subnetPnL?.vault_count || 0} pairs`}
                        icon={<TrendingUp size={16} />}
                        trend={subnetPnL && subnetPnL.total_pnl_usd > 0 ? "up" : subnetPnL && subnetPnL.total_pnl_usd < 0 ? "down" : "neutral"}
                    />
                    <MetricCard
                        label="Subnet Emissions"
                        value={`${emissions?.total_emissions_alpha.toFixed(2) || '0'} α`}
                        change={`$${emissions?.total_emissions_usd.toFixed(2) || '0'}`}
                        icon={<TrendingUp size={16} />}
                        trend={emissions && emissions.miner_ratio > 0 ? "up" : "neutral"}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pair Status */}
                    <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                            <h3 className="text-sm font-black text-primary uppercase tracking-wider">Pair Status</h3>
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-primary/40 font-mono">{activeJobs.length} active</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                            {jobsLoading ? (
                                <div className="text-center py-8 text-primary/40 text-sm">Loading pairs...</div>
                            ) : activeJobs.length === 0 ? (
                                <div className="text-center py-8 space-y-2">
                                    <AlertCircle size={32} className="mx-auto text-orange-500" />
                                    <p className="text-sm font-bold text-primary">No Active Pairs</p>
                                    <p className="text-xs text-primary/40">Start validator to create jobs</p>
                                </div>
                            ) : (
                                activeJobs.map(job => (
                                    <VaultStatusRow
                                        key={job.job_id}
                                        jobId={job.job_id}
                                        name={job.metadata.pair_name}
                                        address={job.sn_liquidity_manager_address}
                                        status="active"
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Emissions Debug */}
                    <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                            <h3 className="text-sm font-black text-primary uppercase tracking-wider">Emissions Breakdown</h3>
                            <span className="text-xs text-primary/40 font-mono">
                                Ratio: {emissions?.profit_ratio.toFixed(2) || '0.00'}x
                            </span>
                        </div>
                        <div className="p-6 space-y-4">
                            {emissionsLoading ? (
                                <div className="text-center py-8 text-primary/40 text-sm">Loading emissions...</div>
                            ) : !emissions ? (
                                <div className="text-center py-8 text-primary/40 text-sm">No emissions data</div>
                            ) : (
                                <>
                                    <DebugRow label="Total Emissions" value={`${emissions.total_emissions_alpha.toFixed(4)} α`} subtext={`$${emissions.total_emissions_usd.toFixed(2)} USD`} />
                                    <DebugRow label="Miner Allocation" value={`${emissions.miner_alpha.toFixed(4)} α`} subtext={`${(emissions.miner_ratio * 100).toFixed(1)}% of total`} />
                                    <DebugRow label="Burn (UID 0)" value={`${emissions.burn_alpha.toFixed(4)} α`} subtext={`${(emissions.burn_ratio * 100).toFixed(1)}% of total`} />
                                    <DebugRow label="Alpha Price" value={`$${emissions.alpha_price_usd.toFixed(4)}`} subtext="Current market price" />
                                    <DebugRow label="Vault Revenue (30d)" value={`$${emissions.vault_revenue_usd.toFixed(2)}`} subtext="Total subnet revenue" />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">Recent Executions</h3>
                        <div className="flex items-center space-x-2">
                            <RefreshCw size={14} className="text-primary/40" />
                            <span className="text-xs text-primary/40 font-mono">Auto-refresh: 5s</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-cream/20">
                                <tr className="text-[10px] font-black text-primary/40 uppercase tracking-wider">
                                    <th className="px-6 py-3 text-left">Vault</th>
                                    <th className="px-6 py-3 text-left">Round</th>
                                    <th className="px-6 py-3 text-left">Miner UID</th>
                                    <th className="px-6 py-3 text-left">Hotkey</th>
                                    <th className="px-6 py-3 text-left">TX Hash</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                    <th className="px-6 py-3 text-left">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream/50">
                                {!executions || executions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-primary/40">
                                            No executions yet. Waiting for rounds to complete...
                                        </td>
                                    </tr>
                                ) : (
                                    executions.slice(0, 10).map((exec) => (
                                        <tr key={exec.execution_id} className="hover:bg-cream/10 transition-colors">
                                            <td className="px-6 py-3">
                                                <Link
                                                    href={`/admin/pairs/${exec.job_id}`}
                                                    className="text-sm font-bold text-primary hover:text-primary/70 transition-colors flex items-center space-x-1"
                                                >
                                                    <span>{exec.vault_name}</span>
                                                    <ChevronRight size={12} />
                                                </Link>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-mono text-primary">#{exec.round_number}</td>
                                            <td className="px-6 py-3 text-sm font-bold text-primary">{exec.miner_uid}</td>
                                            <td className="px-6 py-3 text-xs font-mono text-primary/60">
                                                {exec.miner_hotkey.slice(0, 12)}...
                                            </td>
                                            <td className="px-6 py-3 text-xs font-mono text-primary/60">
                                                {exec.tx_hash ? (
                                                    <a
                                                        href={`https://basescan.org/tx/${exec.tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:text-primary transition-colors flex items-center space-x-1"
                                                    >
                                                        <span>{exec.tx_hash.slice(0, 10)}...</span>
                                                        <ChevronRight size={12} />
                                                    </a>
                                                ) : (
                                                    <span className="text-primary/20">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3">
                                                <StatusBadge status={exec.tx_status || 'pending'} />
                                            </td>
                                            <td className="px-6 py-3 text-xs text-primary/40 font-mono">
                                                {new Date(exec.executed_at).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Miner Leaderboard Summary */}
                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
                        <h3 className="text-sm font-black text-primary uppercase tracking-wider">Top Miners</h3>
                        <a
                            href="/admin/leaderboard"
                            className="text-xs text-primary hover:underline font-bold flex items-center space-x-1"
                        >
                            <span>View Full Leaderboard</span>
                            <ChevronRight size={12} />
                        </a>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-cream/20">
                                <tr className="text-[10px] font-black text-primary/40 uppercase tracking-wider">
                                    <th className="px-6 py-3 text-left">Rank</th>
                                    <th className="px-6 py-3 text-left">UID</th>
                                    <th className="px-6 py-3 text-left">Hotkey</th>
                                    <th className="px-6 py-3 text-right">Combined Score</th>
                                    <th className="px-6 py-3 text-right">Eval Score</th>
                                    <th className="px-6 py-3 text-right">Live Score</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream/50">
                                {!leaderboard || leaderboard.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-primary/40">
                                            No miners yet. Waiting for predictions...
                                        </td>
                                    </tr>
                                ) : (
                                    leaderboard.slice(0, 5).map((miner, idx) => (
                                        <tr key={miner.miner_uid} className="hover:bg-cream/10 transition-colors">
                                            <td className="px-6 py-3 text-sm font-black text-primary">#{idx + 1}</td>
                                            <td className="px-6 py-3 text-sm font-bold text-primary">{miner.miner_uid}</td>
                                            <td className="px-6 py-3 text-xs font-mono text-primary/60">
                                                {miner.miner_hotkey.slice(0, 16)}...
                                            </td>
                                            <td className="px-6 py-3 text-sm font-bold text-primary text-right">
                                                {miner.combined_score.toFixed(4)}
                                            </td>
                                            <td className="px-6 py-3 text-xs text-green-600 text-right font-mono">
                                                {miner.evaluation_score.toFixed(4)}
                                            </td>
                                            <td className="px-6 py-3 text-xs text-blue-600 text-right font-mono">
                                                {miner.live_score.toFixed(4)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <StatusBadge status={miner.is_eligible_for_live ? 'success' : 'pending'} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusIndicator({ label, status, detail }: { label: string, status: 'online' | 'offline' | 'syncing', detail: string }) {
    const colors = {
        online: 'bg-green-500',
        offline: 'bg-red-500',
        syncing: 'bg-yellow-500'
    };

    return (
        <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${colors[status]} ${status === 'online' ? 'animate-pulse' : ''}`}></div>
            <div>
                <p className="text-xs font-black text-primary uppercase tracking-wider">{label}</p>
                <p className="text-[10px] text-primary/40 font-mono">{detail}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, change, icon, trend }: {
    label: string;
    value: string;
    change: string;
    icon: React.ReactNode;
    trend: 'up' | 'down' | 'neutral';
}) {
    const trendColors = {
        up: 'text-green-600',
        down: 'text-red-600',
        neutral: 'text-primary/40'
    };

    return (
        <div className="bg-white border border-cream-dark rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-cream rounded-lg text-primary/40">
                    {icon}
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-black text-primary tracking-tight">{value}</p>
                <p className={`text-xs font-mono ${trendColors[trend]}`}>{change}</p>
            </div>
        </div>
    );
}

function VaultStatusRow({ jobId, name, address, status }: {
    jobId: string;
    name: string;
    address: string;
    status: 'active' | 'paused' | 'error';
}) {
    const statusColors = {
        active: 'bg-green-500',
        paused: 'bg-yellow-500',
        error: 'bg-red-500'
    };

    return (
        <Link href={`/admin/pairs/${jobId}`} className="block">
            <div className="flex items-center justify-between p-3 bg-cream/20 rounded-xl hover:bg-cream/40 transition-colors cursor-pointer group">
                <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${statusColors[status]}`}></div>
                    <div>
                        <p className="text-sm font-bold text-primary group-hover:text-primary/80">{name}</p>
                        <p className="text-[10px] font-mono text-primary/40">{address.slice(0, 12)}...{address.slice(-8)}</p>
                    </div>
                </div>
                <ChevronRight size={16} className="text-primary/20 group-hover:text-primary/40 transition-colors" />
            </div>
        </Link>
    );
}

function DebugRow({ label, value, subtext }: { label: string; value: string; subtext: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-cream/50 last:border-0">
            <div>
                <p className="text-xs font-bold text-primary">{label}</p>
                <p className="text-[10px] text-primary/40">{subtext}</p>
            </div>
            <p className="text-sm font-mono font-bold text-primary">{value}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        success: 'bg-green-100 text-green-700',
        pending: 'bg-yellow-100 text-yellow-700',
        failed: 'bg-red-100 text-red-700',
    };

    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
}
