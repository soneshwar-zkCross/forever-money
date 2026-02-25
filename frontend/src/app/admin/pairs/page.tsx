'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    RefreshCw,
    LayoutGrid,
    List,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import {
    useJobs,
    useNetworkStats,
    useJobRevenue,
    useJobTVL,
    useJobAPY,
    useLeaderboard,
    Job
} from '@/lib/api';
import { formatUsd, formatFeeRate } from '@/lib/format';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PairsPage() {
    const { data: jobs, isLoading } = useJobs();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const router = useRouter();

    const displayJobs = jobs || [];

    const headerActions = (
        <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden md:flex bg-cream/50 p-1 rounded-xl border border-cream-dark/50 space-x-1">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'text-primary/30 hover:text-primary/60'}`}
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-md' : 'text-primary/30 hover:text-primary/60'}`}
                >
                    <LayoutGrid size={16} />
                </button>
            </div>
            <button className="px-3 md:px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center space-x-2 uppercase tracking-widest active:scale-95">
                <RefreshCw size={14} />
                <span className="hidden md:inline">Sync All Pairs</span>
            </button>
        </div>
    );

    return (
        <AdminLayout
            title="Trading Pairs"
            description="Monitor trading pairs and their active miners"
            icon={<Terminal size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/50 rounded-3xl animate-pulse border border-cream-dark" />)}
                    </div>
                ) : (
                    <>
                        {/* Mobile: Always Grid/Card View */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {displayJobs.map((job) => (
                                <PairCard key={job.job_id} job={job as Job} />
                            ))}
                        </div>

                        {/* Desktop: Toggleable List/Grid */}
                        <div className="hidden md:block">
                            {viewMode === 'list' ? (
                                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 md:p-8 overflow-x-auto">
                                        <table className="w-full text-left min-w-[900px]">
                                            <thead>
                                                <tr className="text-[10px] text-primary/30 font-black uppercase tracking-[0.2em] border-b border-cream-dark">
                                                    <th className="pb-4">#</th>
                                                    <th className="pb-4">Pair</th>
                                                    <th className="pb-4">TVL</th>
                                                    <th className="pb-4">Fees Collected</th>
                                                    <th className="pb-4">T1 APY</th>
                                                    <th className="pb-4">T2 APY</th>
                                                    <th className="pb-4">USD APY</th>
                                                    <th className="pb-4">vs HODL</th>
                                                    <th className="pb-4">vs FULL RANGE</th>
                                                    <th className="pb-4">Vaults</th>
                                                    <th className="pb-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs">
                                                {displayJobs.map((job, i) => (
                                                    <PairRow key={job.job_id} job={job as Job} index={i + 1} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                                    {displayJobs.map((job) => (
                                        <PairCard key={job.job_id} job={job as Job} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}

function PairRow({ job, index }: { job: Job, index: number }) {
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: revenue } = useJobRevenue(job.job_id, 30);
    const { data: apy } = useJobAPY(job.job_id, 30);
    const { data: leaderboard } = useLeaderboard(job.job_id);
    const router = useRouter();

    return (
        <tr
            onClick={() => router.push(`/admin/pairs/${job.job_id}`)}
            className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
        >
            <td className="py-5 font-black text-primary/20">{index}</td>
            <td className="py-5 font-black">
                <Link href={`/admin/pairs/${job.job_id}`} className="hover:underline hover:text-blue-600 transition-all">
                    {job.metadata?.pair_name || job.target}
                </Link>
            </td>
            <td className="py-5 font-bold text-primary/60">{formatUsd(tvl?.tvl_usd)}</td>
            <td className="py-5 font-bold text-primary/60">${(revenue?.revenue_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td className="py-5 font-bold text-primary/30">{(apy?.apy_percent_token0 || 0).toFixed(1)}%</td>
            <td className="py-5 font-bold text-primary/30">{(apy?.apy_percent_token1 || 0).toFixed(1)}%</td>
            <td className="py-5 font-black text-primary">{(apy?.apy_percent || 0).toFixed(1)}%</td>
            <td className="py-5 font-bold text-primary/30">-</td>
            <td className="py-5 font-bold text-primary/30">-</td>
            <td className="py-5 font-bold text-primary/60">{leaderboard?.length || 0}</td>
            <td className="py-5 text-right">
                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
            </td>
        </tr>
    );
}

function PairCard({ job }: { job: Job }) {
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: revenue } = useJobRevenue(job.job_id, 30);
    const { data: apy } = useJobAPY(job.job_id, 30);
    const { data: stats } = useNetworkStats(job.job_id);

    return (
        <Link
            href={`/admin/pairs/${job.job_id}`}
            className="bg-white p-8 rounded-3xl border border-cream-dark shadow-sm hover:shadow-md transition-all group flex flex-col"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-black text-primary mb-1">{job.metadata?.pair_name || job.target}</h3>
                    <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest">{job.is_active ? 'Active Pair' : 'Inactive Pair'}</p>
                </div>
                <div className="bg-primary/5 p-2 rounded-xl">
                    <Terminal size={16} className="text-primary/40" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                    <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">TVL</p>
                    <p className="text-lg font-black text-primary">{formatUsd(tvl?.tvl_usd)}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">Revenue</p>
                    <p className="text-lg font-black text-primary">${(revenue?.revenue_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-cream-dark/50">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">USD APY</span>
                    <span className="text-xs font-black text-primary">{(apy?.apy_percent || 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">Miners</span>
                    <span className="text-xs font-black text-primary">{stats?.total_miners || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">Fee Rate</span>
                    <span className="text-xs font-black text-primary">{formatFeeRate(job.fee_rate)}</span>
                </div>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/20 group-hover:text-primary transition-colors">
                <span>View Details</span>
                <ArrowRight size={14} />
            </div>
        </Link>
    );
}
