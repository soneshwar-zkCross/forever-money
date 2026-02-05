'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Link from 'next/link';
import {
    Users,
    Activity,
    Search,
    Grid
} from 'lucide-react';
import { useJobs, useLeaderboard } from '@/lib/api';

export default function MinersPage() {
    const { data: jobs } = useJobs();
    const [searchQuery, setSearchQuery] = useState('');

    // Use the first job ID as default, but we'll hide the selector
    const selectedJobId = jobs?.[0]?.job_id || '';

    const { data: miners, isLoading } = useLeaderboard(selectedJobId);

    const filteredMiners = miners?.filter(m =>
        m.miner_hotkey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.miner_uid.toString().includes(searchQuery)
    );

    const headerActions = (
        <div className="relative group">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors" />
            <input
                type="text"
                placeholder="Search miners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-cream/50 border border-cream-dark pl-11 pr-4 py-2 rounded-xl text-[11px] font-bold text-primary w-[300px] focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all focus:bg-white"
            />
        </div>
    );

    return (
        <AdminLayout
            title="Miners"
            description="Global validator performance across all protocol jobs."
            icon={<Users size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Main View - Grid Only */}
                {isLoading ? (
                    <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-8 animate-pulse">
                        <div className="h-10 bg-cream/50 rounded-xl mb-4 w-full"></div>
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-cream/30 rounded-xl mb-3 w-full"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredMiners?.map((miner, i) => (
                            <Link
                                key={miner.miner_uid}
                                href={`/admin/miners/${miner.miner_uid}`}
                                className="bg-white p-8 rounded-3xl border border-cream-dark shadow-sm hover:shadow-md transition-all duration-500 font-mono text-primary relative overflow-hidden block group"
                            >
                                {/* Terminal Style Header */}
                                <div className="border-t border-dashed border-primary/10 mb-4" />

                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-black tracking-tight uppercase group-hover:text-blue-600 transition-colors">
                                        MINER ID: 5F0...{miner.miner_hotkey.slice(-4)}
                                    </h4>
                                    <div className={`w-2 h-2 rounded-full ${miner.is_eligible_for_live ? 'bg-green-500 animate-pulse' : 'bg-amber-500'} shadow-sm`}></div>
                                </div>

                                <div className="border-t border-dashed border-primary/10 mb-6" />

                                {/* Main Stats */}
                                <div className="space-y-2 mb-8">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="opacity-40 uppercase tracking-tighter">Total Earnings:</span>
                                        <span className="text-blue-600 group-hover:text-primary transition-colors">${(18400 - (i * 120)).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="opacity-40 uppercase tracking-tighter">Alpha Earned:</span>
                                        <span className="text-blue-600 group-hover:text-primary transition-colors">{(92000 - (i * 600)).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="opacity-40 uppercase tracking-tighter">Jobs Participated:</span>
                                        <span className="text-blue-600 group-hover:text-primary transition-colors">{6 + (i % 3)}</span>
                                    </div>
                                </div>

                                {/* Contributions Section */}
                                <div className="border-t border-dashed border-primary/10 mb-2" />
                                <div className="text-[11px] font-black uppercase mb-2 opacity-30">
                                    Top Jobs Contributions
                                </div>
                                <div className="border-t border-dashed border-primary/10 mb-4" />

                                <div className="space-y-2">
                                    {(jobs && jobs.length > 0 ? jobs.slice(0, 3) : [
                                        { metadata: { pair_name: 'BID/WETH' }, job_id: 'mock-1' },
                                        { metadata: { pair_name: 'TAO/USDC' }, job_id: 'mock-2' },
                                        { metadata: { pair_name: 'ETH/USDC' }, job_id: 'mock-3' }
                                    ]).map((job, idx) => {
                                        const mockValues = [6800, 4100, 3900];
                                        const val = (mockValues[idx] || 2000) - (i * 50);
                                        return (
                                            <div
                                                key={idx}
                                                className="flex justify-between text-[11px] font-bold"
                                            >
                                                <span className="opacity-60 transition-all text-left">
                                                    {job.metadata?.pair_name || 'UNKNOWN'}
                                                </span>
                                                <span className="text-blue-600">${val.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
