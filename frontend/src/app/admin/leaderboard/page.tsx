'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Trophy,
    Medal,
    TrendingUp,
    ChevronDown,
    ExternalLink,
    Search,
    Filter,
    DollarSign
} from 'lucide-react';
import { useJobs, useLeaderboard, useTopEarners } from '@/lib/api';

export default function LeaderboardPage() {
    const { data: jobs, isLoading: jobsLoading } = useJobs();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    // Auto-select first job if none selected
    React.useEffect(() => {
        if (jobs && jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].job_id);
        }
    }, [jobs, selectedJobId]);

    const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(selectedJobId || '');
    const { data: topEarners } = useTopEarners(100); // Get top 100 earners

    // Helper function to get earnings for a miner UID
    const getEarnings = (uid: number) => {
        return topEarners?.find(e => e.miner_uid === uid);
    };

    const headerActions = (
        <div className="relative">
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
    );

    return (
        <AdminLayout
            title="Leaderboard"
            description="Top performing validator nodes for the network."
            icon={<Trophy size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Miner Table */}
                <div className="bg-white rounded-[48px] border border-cream-dark shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-cream flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <h4 className="text-lg font-black text-primary tracking-tight uppercase">Participants Pool</h4>
                            <span className="px-3 py-1 bg-cream rounded-full text-[10px] font-black text-primary/40 uppercase tracking-widest">
                                {leaderboard?.length || 0} Nodes
                            </span>
                        </div>
                        <div className="flex space-x-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" />
                                <input
                                    type="text"
                                    placeholder="Search Hotkey..."
                                    className="pl-10 pr-4 py-2.5 bg-cream/30 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/5 transition-all w-64"
                                />
                            </div>
                            <button className="p-2.5 bg-cream/30 text-primary/40 hover:text-primary rounded-xl transition-all">
                                <Filter size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-cream/20 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">
                                    <th className="px-10 py-5">Rank</th>
                                    <th className="px-10 py-5">Miner Identity</th>
                                    <th className="px-10 py-5 text-center">Score</th>
                                    <th className="px-10 py-5 text-center">Est. Earnings</th>
                                    <th className="px-10 py-5 text-center">Status</th>
                                    <th className="px-10 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream/50">
                                {leaderboard?.map((miner, idx) => (
                                    <tr key={miner.miner_uid} className="hover:bg-cream/10 transition-colors group">
                                        <td className="px-10 py-6">
                                            <span className="text-sm font-black text-primary/20 group-hover:text-primary transition-colors">#{idx + 1}</span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-primary tracking-tight">{miner.miner_hotkey.substring(0, 16)}...</span>
                                                <span className="text-[10px] font-bold text-ink-muted/40 uppercase tracking-widest">UID {miner.miner_uid} • {miner.participation_days} Days Active</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-sm font-black text-primary tracking-tighter">{miner.combined_score.toFixed(4)}</span>
                                                <div className="flex space-x-2">
                                                    <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">Eval: {miner.evaluation_score.toFixed(2)}</span>
                                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Live: {miner.live_score.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            {(() => {
                                                const earnings = getEarnings(miner.miner_uid);
                                                return earnings ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="text-sm font-black text-green-600 tracking-tighter flex items-center">
                                                            <DollarSign size={12} />
                                                            {earnings.estimated_earnings_usd.toFixed(2)}
                                                        </span>
                                                        <span className="text-[8px] font-black text-primary/40 uppercase tracking-tighter">
                                                            {earnings.estimated_earnings_alpha.toFixed(4)} α
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-medium text-primary/20">-</span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${miner.is_eligible_for_live ? 'bg-green-50 text-green-600' : 'bg-cream text-primary/20'}`}>
                                                {miner.is_eligible_for_live ? 'Eligible' : 'Observation'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <button className="p-2 text-primary/20 hover:text-primary hover:bg-cream rounded-lg transition-all">
                                                <ExternalLink size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {leaderboardLoading && (
                        <div className="p-20 flex flex-col items-center justify-center text-primary/20 space-y-4">
                            <TrendingUp size={48} className="animate-pulse" />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Synchronizing Subnet Telemetry...</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
