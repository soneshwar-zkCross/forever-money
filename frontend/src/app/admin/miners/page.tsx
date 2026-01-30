'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Users,
    Activity,
    Shield,
    Cpu,
    Search,
    Filter,
    Grid,
    List,
    ChevronDown,
    MoreHorizontal
} from 'lucide-react';
import { useJobs, useLeaderboard } from '@/lib/api';

export default function MinersPage() {
    const { data: jobs } = useJobs();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Auto-select first job if none selected
    React.useEffect(() => {
        if (jobs && jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].job_id);
        }
    }, [jobs, selectedJobId]);

    const { data: miners, isLoading } = useLeaderboard(selectedJobId || '');

    const headerActions = (
        <div className="flex items-center space-x-3">
            <div className="relative">
                <select
                    className="appearance-none bg-white border border-cream-dark pl-4 pr-10 py-2.5 rounded-xl text-[10px] font-black text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/5 uppercase tracking-widest cursor-pointer disabled:opacity-50"
                    value={selectedJobId || ''}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    disabled={!jobs}
                >
                    {!jobs || jobs.length === 0 ? (
                        <option value="">{!jobs ? 'Loading Vaults...' : 'No Vaults Found'}</option>
                    ) : (
                        jobs.map(job => (
                            <option key={job.job_id} value={job.job_id}>{job.metadata.pair_name} Vault</option>
                        ))
                    )}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none" />
            </div>

            <div className="flex bg-cream p-1 rounded-xl border border-cream-dark">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-primary/30 hover:text-primary'}`}
                >
                    <Grid size={16} />
                </button>
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-primary/30 hover:text-primary'}`}
                >
                    <List size={16} />
                </button>
            </div>
        </div>
    );

    return (
        <AdminLayout
            title="Miners"
            description="Manage and monitor active validator nodes across the subnet."
            icon={<Users size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Search and Filters */}
                <div className="flex items-center justify-between">
                    <div className="relative group">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by hotkey, UID or score..."
                            className="bg-white border border-cream-dark pl-12 pr-6 py-3.5 rounded-2xl text-[13px] font-bold text-primary w-[400px] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all"
                        />
                    </div>
                </div>

                {/* Main Views */}
                {isLoading ? (
                    <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-8 animate-pulse">
                        <div className="h-10 bg-cream/50 rounded-xl mb-4 w-full"></div>
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-cream/30 rounded-xl mb-3 w-full"></div>)}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {miners?.map(miner => (
                            <div key={miner.miner_uid} className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group flex flex-col justify-between">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all">
                                            <Cpu size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest">UID {miner.miner_uid}</p>
                                            <h4 className="text-sm font-black text-primary tracking-tight truncate w-32">{miner.miner_hotkey.substring(0, 10)}...</h4>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${miner.is_eligible_for_live ? 'bg-green-50 text-green-600' : 'bg-cream text-primary/20'}`}>
                                        {miner.is_eligible_for_live ? 'Live' : 'Eval'}
                                    </span>
                                </div>

                                {/* Scores Grid */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-primary/5 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Combined</p>
                                        <p className="text-sm font-black text-primary">{miner.combined_score.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-green-500/60 uppercase tracking-widest mb-1">Eval</p>
                                        <p className="text-sm font-black text-green-600">{miner.evaluation_score.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest mb-1">Live</p>
                                        <p className="text-sm font-black text-blue-600">{miner.live_score.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-cream/30 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Days</p>
                                        <p className="text-sm font-black text-primary">{miner.participation_days}</p>
                                    </div>
                                    <div className="bg-cream/30 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Evals</p>
                                        <p className="text-sm font-black text-primary">{miner.total_evaluations}</p>
                                    </div>
                                    <div className="bg-cream/30 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Live Rnds</p>
                                        <p className="text-sm font-black text-primary">{miner.total_live_rounds}</p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-4 border-t border-cream">
                                    <div className="flex items-center space-x-2">
                                        <Activity size={14} className={miner.is_eligible_for_live ? 'text-green-500' : 'text-primary/20'} />
                                        <span className="text-[10px] font-bold text-ink-muted/40 uppercase tracking-widest">
                                            {miner.is_eligible_for_live ? 'Live Eligible' : 'In Evaluation'}
                                        </span>
                                    </div>
                                    <button className="text-primary/20 hover:text-primary transition-colors">
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Comprehensive List View */
                    <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[1200px]">
                                <thead>
                                    <tr className="bg-cream/20 text-[9px] font-black text-primary/30 uppercase tracking-[0.15em]">
                                        <th className="px-6 py-5 sticky left-0 bg-cream/20">Miner</th>
                                        <th className="px-4 py-5 text-center">UID</th>
                                        <th className="px-4 py-5 text-center">Combined Score</th>
                                        <th className="px-4 py-5 text-center">Eval Score</th>
                                        <th className="px-4 py-5 text-center">Live Score</th>
                                        <th className="px-4 py-5 text-center">Participation</th>
                                        <th className="px-4 py-5 text-center">Total Evals</th>
                                        <th className="px-4 py-5 text-center">Live Rounds</th>
                                        <th className="px-4 py-5 text-center">Status</th>
                                        <th className="px-6 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream/50">
                                    {miners?.map((miner, idx) => (
                                        <tr key={miner.miner_uid} className="hover:bg-cream/10 transition-colors group">
                                            {/* Miner Identity */}
                                            <td className="px-6 py-5 sticky left-0 bg-white group-hover:bg-cream/10 transition-colors">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-cream rounded-xl flex items-center justify-center text-primary/30 group-hover:bg-primary group-hover:text-white transition-all text-xs font-black">
                                                        #{idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-primary tracking-tight">{miner.miner_hotkey.substring(0, 16)}...</p>
                                                        <p className="text-[10px] font-bold text-primary/30">Hotkey</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* UID */}
                                            <td className="px-4 py-5 text-center">
                                                <span className="text-sm font-black text-primary">{miner.miner_uid}</span>
                                            </td>

                                            {/* Combined Score */}
                                            <td className="px-4 py-5 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-base font-black text-primary">{miner.combined_score.toFixed(4)}</span>
                                                    <div className="w-16 h-1.5 bg-cream rounded-full overflow-hidden mt-1">
                                                        <div
                                                            className="h-full bg-primary rounded-full"
                                                            style={{ width: `${Math.min((miner.combined_score / (miners?.[0]?.combined_score || 1)) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Eval Score */}
                                            <td className="px-4 py-5 text-center">
                                                <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-xs font-black">
                                                    {miner.evaluation_score.toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Live Score */}
                                            <td className="px-4 py-5 text-center">
                                                <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black">
                                                    {miner.live_score.toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Participation Days */}
                                            <td className="px-4 py-5 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-black text-primary">{miner.participation_days}</span>
                                                    <span className="text-[9px] font-bold text-primary/30 uppercase">Days</span>
                                                </div>
                                            </td>

                                            {/* Total Evaluations */}
                                            <td className="px-4 py-5 text-center">
                                                <span className="text-sm font-black text-primary">{miner.total_evaluations}</span>
                                            </td>

                                            {/* Live Rounds */}
                                            <td className="px-4 py-5 text-center">
                                                <span className="text-sm font-black text-primary">{miner.total_live_rounds}</span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-5 text-center">
                                                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${miner.is_eligible_for_live ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
                                                    {miner.is_eligible_for_live ? 'Live Ready' : 'Evaluating'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-5 text-right">
                                                <button className="p-2 text-primary/20 hover:text-primary hover:bg-cream rounded-xl transition-all">
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer */}
                        <div className="px-8 py-5 border-t border-cream bg-cream/10 flex items-center justify-between">
                            <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
                                Showing {miners?.length || 0} miners for selected vault
                            </p>
                            <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-bold text-primary/30">Legend:</span>
                                <span className="flex items-center space-x-1 text-[9px] font-bold text-green-600">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span>Live Ready</span>
                                </span>
                                <span className="flex items-center space-x-1 text-[9px] font-bold text-amber-600">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    <span>Evaluating</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
