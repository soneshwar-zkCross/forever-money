'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    LayoutDashboard,
    Trophy,
    Zap,
    Shield,
    Activity,
    RefreshCw,
    Cpu,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    TrendingUp,
    BrainCircuit,
    ChevronRight,
    Search,
    ChevronDown,
} from 'lucide-react';
import { useJobs, useLeaderboard, useNetworkStats } from '@/lib/api';

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

    // Export Logs Functionality
    const handleExportLogs = () => {
        if (!leaderboard || leaderboard.length === 0) return;

        const headers = ['Rank', 'UID', 'Hotkey', 'Combined Score', 'Evaluation Score', 'Live Score', 'Participation Days', 'Total Evals', 'Total Live Rounds', 'Status'];
        const csvContent = [
            headers.join(','),
            ...leaderboard.map((miner, index) => [
                index + 1,
                miner.miner_uid,
                miner.miner_hotkey,
                miner.combined_score,
                miner.evaluation_score,
                miner.live_score,
                miner.participation_days,
                miner.total_evaluations,
                miner.total_live_rounds,
                miner.is_eligible_for_live ? 'Live' : 'Eval'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `sn98_logs_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const headerActions = (
        <>
            <div className="relative mr-2">
                <select
                    className="appearance-none bg-white border border-cream-dark pl-4 pr-10 py-2.5 rounded-xl text-[10px] font-black text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/5 uppercase tracking-widest cursor-pointer disabled:opacity-50"
                    value={selectedJobId || ''}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    disabled={jobsLoading}
                >
                    {!jobs || jobs.length === 0 ? (
                        <option value="">{jobsLoading ? 'Loading Vaults...' : 'No Vaults Found'}</option>
                    ) : (
                        jobs.map(job => (
                            <option key={job.job_id} value={job.job_id}>{job.metadata.pair_name} Vault</option>
                        ))
                    )}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none" />
            </div>
            <button
                onClick={handleExportLogs}
                disabled={!leaderboard || leaderboard.length === 0}
                className="px-5 py-2.5 bg-white border border-cream-dark rounded-xl text-[10px] font-black text-primary shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center space-x-2 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span>Export Logs</span>
            </button>
            <button className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center space-x-2 uppercase tracking-widest">
                <RefreshCw size={12} className="animate-spin-slow" />
                <span>Sync Node</span>
            </button>
        </>
    );

    return (
        <AdminLayout
            title="Intelligence."
            description="Global Network Overview & Individual Vault Telemetry."
            icon={<LayoutDashboard size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-12 pb-20">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StatsCard
                        label="Network Miners"
                        value={statsLoading ? '...' : (stats?.active_miners_24h || 0)}
                        change="+12%"
                        isUp={true}
                        icon={<Cpu size={20} />}
                        delay="0"
                    />
                    <StatsCard
                        label="Avg Performance"
                        value={statsLoading ? '...' : `${((stats?.avg_participation_rate || 0) * 100).toFixed(1)}%`}
                        change="+2.4%"
                        isUp={true}
                        icon={<Activity size={20} />}
                        delay="100"
                    />
                    <StatsCard
                        label="Global Load"
                        value={statsLoading ? '...' : (stats?.current_round_number || 0)}
                        change="Stable"
                        isUp={true}
                        icon={<Layers size={20} />}
                        delay="200"
                    />
                    <StatsCard
                        label="Safety Status"
                        value="Healthy"
                        change="Verified"
                        isUp={true}
                        icon={<Shield size={20} />}
                        delay="300"
                    />
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    {/* Intelligence Visualization */}
                    <div className="xl:col-span-2 relative group h-[480px]">
                        <div className="absolute inset-0 bg-primary/5 rounded-[48px] blur-2xl group-hover:bg-primary/10 transition-all duration-700"></div>
                        <div className="relative bg-white h-full rounded-[48px] border border-cream-dark shadow-sm p-12 overflow-hidden flex flex-col justify-between">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-primary tracking-tight">Competitive Spread</h3>
                                    <p className="text-sm text-ink-muted/40 font-bold uppercase tracking-widest">Top 10 Miner Score Comparison</p>
                                </div>
                                <div className="flex space-x-2">
                                    <div className="flex items-center space-x-2 px-4 py-2 bg-cream/50 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Active Emission</span>
                                    </div>
                                </div>
                            </div>

                            {/* Real Graph Visualization using Leaderboard Data */}
                            <div className="flex-1 flex items-end justify-between px-4 pb-4 pt-16 relative z-10">
                                {(leaderboard?.length ? leaderboard.slice(0, 10) : Array(10).fill({ combined_score: 0 })).map((miner, i) => {
                                    const maxScore = leaderboard ? Math.max(...leaderboard.map(m => m.combined_score)) : 1;
                                    const height = miner.combined_score > 0 ? (miner.combined_score / maxScore) * 100 : 20;
                                    return (
                                        <div key={i} className="w-10 rounded-2xl bg-cream-dark hover:bg-primary transition-all duration-500 cursor-pointer group/bar relative" style={{ height: `${height}%` }}>
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-2 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-all transform translate-y-2 group-hover/bar:translate-y-0 shadow-xl z-30 whitespace-nowrap pointer-events-none">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-white/40 text-[8px] uppercase mb-0.5">UID {miner.miner_uid}</span>
                                                    <span>{miner.combined_score.toFixed(4)} pts</span>
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45 -translate-y-1"></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between pt-10 border-t border-cream-dark relative z-10">
                                <div className="flex items-center space-x-8">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-primary/20 uppercase tracking-widest">Spread Range</span>
                                        <span className="text-lg font-black text-primary">
                                            {leaderboard?.length ? (leaderboard[0].combined_score - leaderboard[Math.min(leaderboard.length - 1, 9)].combined_score).toFixed(2) : '0.00'} pts
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-primary/20 uppercase tracking-widest">Efficiency</span>
                                        <span className="text-lg font-black text-primary">High</span>
                                    </div>
                                </div>
                                <button className="flex items-center space-x-2 text-primary group/more" onClick={() => window.location.href = '/admin/leaderboard'}>
                                    <span className="text-xs font-black uppercase tracking-widest">View Full Ranks</span>
                                    <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Stats/Cards */}
                    <div className="space-y-8 h-full">
                        {/* Current Winner/Top Performer Card */}
                        <div className="bg-amber-500 p-8 rounded-[48px] text-white flex flex-col justify-between h-[224px] shadow-xl shadow-amber-500/20 group cursor-pointer hover:-translate-y-1 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md text-white">
                                    <Trophy size={24} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Top Performer</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">UID {leaderboard?.[0]?.miner_uid || '??'}</p>
                                <h4 className="text-2xl font-black tracking-tight leading-none truncate">
                                    {leaderboard?.[0]?.miner_hotkey ? `${leaderboard[0].miner_hotkey.substring(0, 12)}...` : 'Searching...'}
                                </h4>
                                <div className="flex items-center space-x-2 pt-2">
                                    <TrendingUp size={14} />
                                    <span className="text-xs font-bold leading-none">{leaderboard?.[0]?.combined_score.toFixed(4) || '0.000'} Score</span>
                                </div>
                            </div>
                        </div>

                        {/* Network Multiplier Card - Replaces Integrity Guard */}
                        <div className="bg-white p-8 rounded-[48px] border border-cream-dark shadow-sm flex flex-col justify-between h-[224px] group cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-primary/5 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                                    <Zap size={24} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary/40 bg-cream px-3 py-1 rounded-full">Protocol Config</span>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-2xl font-black text-primary tracking-tight leading-none">Emission Multiplier</h4>
                                <p className="text-xs text-ink-muted/40 font-medium tracking-wide">Current profit ratio defined by validator settings.</p>
                                <div className="flex items-center space-x-3 pt-3">
                                    <div className="px-3 py-1.5 bg-primary/5 rounded-xl text-primary font-black text-lg">1.0x</div>
                                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Optimal</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatsCard({ label, value, change, isUp, icon, delay }: { label: string, value: string | number, change: string, isUp: boolean, icon: React.ReactNode, delay: string }) {
    return (
        <div className={`bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group animate-slide-up`} style={{ animationDelay: `${delay}ms` }}>
            <div className="flex justify-between items-start mb-10">
                <div className="p-3.5 bg-cream/80 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    {icon}
                </div>
                <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    <span>{change}</span>
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-primary/20 uppercase tracking-[0.2em]">{label}</p>
                <p className="text-4xl font-black text-primary tracking-tighter">{value}</p>
            </div>
        </div>
    );
}
