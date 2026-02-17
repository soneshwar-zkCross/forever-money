'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Trophy,
    Search,
    ChevronRight,
    LayoutGrid,
    Globe
} from 'lucide-react';
import { useJobs, useLeaderboard } from '@/lib/api';
import Link from 'next/link';

// ... (imports)

// Inline SVG Components for Reliability
const BaseLogo = () => (
    <svg viewBox="0 0 1000 1000" className="w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#0052FF" d="M500 1000c276.14 0 500-223.86 500-500S776.14 0 500 0 0 223.86 0 500s223.86 500 500 500z" />
        <path fill="#fff" d="M294.5 500c0 113.5 92 205.5 205.5 205.5 53.68 0 102.51-20.57 139.54-54.25-34.93-30.82-80.79-49.5-131.29-49.5-68.21 0-128.03-34.78-163.75-87.75z" />
    </svg>
);

const EthLogo = () => (
    <svg viewBox="0 0 784.37 1277.39" className="w-3 h-4" xmlns="http://www.w3.org/2000/svg">
        <g>
            <polygon fill="#343434" points="392.07,0 383.5,29.11 383.5,873.74 392.07,882.29 784.13,650.54" />
            <polygon fill="#8C8C8C" points="392.07,0 -0,650.54 392.07,882.29 392.07,472.33" />
            <polygon fill="#3C3C3B" points="392.07,956.52 387.24,962.41 387.24,1263.28 392.07,1277.38 784.37,724.89" />
            <polygon fill="#8C8C8C" points="392.07,1277.38 392.07,956.52 -0,724.89" />
            <polygon fill="#141414" points="392.07,882.29 784.13,650.54 392.07,472.33" />
            <polygon fill="#393939" points="0,650.54 392.07,882.29 392.07,472.33" />
        </g>
    </svg>
);

export default function LeaderboardPage() {
    const { data: jobs } = useJobs();
    const [timeframe, setTimeframe] = useState('30D');

    // Use the first job ID as base for leaderboard data
    const selectedJobId = jobs?.[0]?.job_id || '';
    const { data: leaderboard, isLoading } = useLeaderboard(selectedJobId);

    // Filter directly if needed, but search is removed
    const displayMiners = leaderboard || [];

    return (
        <AdminLayout
            title="Leaderboard"
            description="Miners Leaderboard — Page 5"
            icon={<Trophy size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20 font-mono text-primary">
                {/* High Density Leaderboard Table */}
                <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm overflow-hidden min-h-[600px]">
                    <div className="p-4 md:p-8 border-b border-cream flex flex-col md:flex-row md:items-center justify-between bg-cream/5 gap-4">
                        <div className="flex items-center space-x-4">
                            <h4 className="text-[13px] font-black text-primary tracking-tight uppercase">Miners Ranking</h4>
                            <span className="px-3 py-1 bg-cream-dark/30 rounded-full text-[9px] font-black text-primary/40 uppercase tracking-widest">
                                {displayMiners?.length || 0} Entities
                            </span>
                        </div>

                        {/* Timeframe Toggle Moved Here */}
                        <div className="flex items-center space-x-4 text-[10px] font-black uppercase bg-cream-dark/10 px-4 py-2 rounded-xl border border-cream-dark/30 self-start md:self-auto overflow-x-auto max-w-full">
                            <span className="opacity-40">TF:</span>
                            {['1D', '7D', '30D', 'All'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`transition-colors hover:text-blue-600 whitespace-nowrap ${timeframe === tf ? 'text-blue-600' : 'text-primary/60'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 p-4">
                        {isLoading ? (
                            <div className="text-center py-10 animate-pulse text-primary/20 text-xs font-black uppercase tracking-widest">
                                Synchronizing...
                            </div>
                        ) : displayMiners?.map((miner, idx) => (
                            <div
                                key={miner.miner_uid}
                                className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
                                onClick={() => window.location.href = `/admin/miners/${miner.miner_uid}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-3">
                                        <span className={`text-lg font-black ${idx < 3 ? 'text-blue-600' : 'text-primary/40'}`}>
                                            #{idx + 1}
                                        </span>
                                        <div>
                                            <div className="text-sm font-black text-primary">5F{miner.miner_uid.toString().padStart(6, '0')}</div>
                                            <div className="text-[9px] font-bold text-primary/30 uppercase tracking-tighter">
                                                {miner.miner_hotkey.substring(0, 8)}...
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1.5 bg-cream-dark/20 px-2 py-1 rounded-lg">
                                        <BaseLogo />
                                        <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">Base</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">TVL</div>
                                        <div className="text-xs font-black text-primary">${(75000 - (idx * 1500)).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Fees</div>
                                        <div className="text-xs font-black text-blue-600">${(3450 - (idx * 50)).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Net APY</div>
                                        <div className="text-xs font-black text-primary">{(21.5 - (idx * 0.2)).toFixed(1)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Active Vaults</div>
                                        <div className="text-xs font-black text-primary">{3 + (idx % 3)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left font-mono">
                            <thead>
                                <tr className="text-[10px] font-black text-primary/30 uppercase tracking-tighter border-b border-cream-dark bg-cream/5">
                                    <th className="px-8 py-4">Rank</th>
                                    <th className="px-8 py-4">Miner ID</th>
                                    <th className="px-8 py-4">TVL (USD)</th>
                                    <th className="px-8 py-4">Fees Earned</th>
                                    <th className="px-8 py-4">Net APY</th>
                                    <th className="px-8 py-4">Benchmark</th>
                                    <th className="px-8 py-4">Active Vaults</th>
                                    <th className="px-8 py-4">Chains</th>
                                    <th className="px-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-dark/30">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={9} className="px-8 py-20 text-center animate-pulse text-primary/20 text-xs font-black uppercase tracking-widest">
                                            Synchronizing System Leaderboard...
                                        </td>
                                    </tr>
                                ) : displayMiners?.map((miner, idx) => (
                                    <tr
                                        key={miner.miner_uid}
                                        className="hover:bg-cream/20 transition-all cursor-pointer group"
                                        onClick={() => window.location.href = `/admin/miners/${miner.miner_uid}`}
                                    >
                                        <td className="px-8 py-5">
                                            <span className={`text-[11px] font-black ${idx < 3 ? 'text-blue-600' : 'text-primary/40'}`}>
                                                #{idx + 1}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black tracking-tight text-primary">5F{miner.miner_uid.toString().padStart(6, '0')}</span>
                                                <span className="text-[8px] font-bold text-primary/30 uppercase tracking-tighter">
                                                    {miner.miner_hotkey.substring(0, 8)}...
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-black text-primary/80">
                                            ${(75000 - (idx * 1500)).toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-black text-blue-600">
                                            ${(3450 - (idx * 50)).toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-black text-primary/80">
                                            {(21.5 - (idx * 0.2)).toFixed(1)}%
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-black text-primary/40">
                                            {(45.2 - (idx * 0.1)).toFixed(1)}%
                                        </td>
                                        <td className="px-8 py-5 text-[11px] font-black text-primary/80">
                                            {3 + (idx % 3)}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center space-x-2">
                                                <div className="flex items-center space-x-1.5 bg-cream-dark/20 px-2.5 py-1.5 rounded-lg border border-cream-dark/50">
                                                    <BaseLogo />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Base</span>
                                                </div>
                                                {idx % 2 === 0 && (
                                                    <div className="flex items-center space-x-1.5 bg-cream-dark/20 px-2.5 py-1.5 rounded-lg border border-cream-dark/50">
                                                        <EthLogo />
                                                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Eth</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <ChevronRight size={14} className="text-primary/10 group-hover:text-primary transition-colors inline" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
