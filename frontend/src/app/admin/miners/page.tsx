'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Link from 'next/link';
import Image from 'next/image';
import {
    Users,
    ChevronDown,
    ArrowRight,
    ExternalLink,
    Terminal
} from 'lucide-react';
import { useJobs, useLeaderboard } from '@/lib/api';

export default function MinersPage() {
    const { data: jobs } = useJobs();
    const [sortBy, setSortBy] = useState('Miner ID');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [timeframe, setTimeframe] = useState('30D');

    // Use the first job ID as default for data fetching
    const selectedJobId = jobs?.[0]?.job_id || '';
    const { data: miners, isLoading } = useLeaderboard(selectedJobId);

    const sortOptions = ['Miner ID', 'TVL (USD)', 'Fees Earned', 'Net APY', 'Active Vaults', 'Chains'];
    const timeframes = ['1D', '7D', '30D', 'ALL'];

    return (
        <AdminLayout
            title="Miners"
            description="GLOBAL VALIDATOR PERFORMANCE ACROSS ALL PROTOCOLS"
            icon={<Users size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {/* Top Bar - Sort & Timeframe */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-primary">
                        <span className="text-primary/40">Sort By</span>
                        <div className="relative">
                            <button
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className="bg-white border border-cream-dark px-4 py-2 rounded-xl flex items-center space-x-2 hover:border-primary/20 transition-all shadow-sm"
                            >
                                <span>{sortBy}</span>
                                <ChevronDown size={14} className={`text-primary/20 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isSortOpen && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-cream-dark rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                                    {sortOptions.map(option => (
                                        <button
                                            key={option}
                                            onClick={() => {
                                                setSortBy(option);
                                                setIsSortOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-cream/30 transition-colors text-primary"
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeframe Toggle */}
                    <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm">
                        {timeframes.map(t => (
                            <button
                                key={t}
                                onClick={() => setTimeframe(t)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${timeframe === t
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-primary/30 hover:text-primary/50'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main View - 3-Column Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[480px] bg-white border border-cream-dark rounded-[32px]"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {miners?.map((miner, i) => (
                            <div
                                key={miner.miner_uid}
                                className="bg-white p-6 rounded-[32px] border border-cream-dark shadow-sm hover:shadow-md transition-all duration-500 font-bold text-primary group flex flex-col h-full"
                            >
                                {/* Card Header */}
                                <div className="flex justify-between items-center mb-5 shrink-0">
                                    <div className="flex items-center space-x-2">
                                        <Link href={`/admin/miners/${miner.miner_uid}`} className="hover:underline transition-all">
                                            <h4 className="text-sm font-black tracking-tight uppercase">
                                                Miner ID: 5f0...{miner.miner_hotkey.slice(-3)}
                                            </h4>
                                        </Link>
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                    </div>
                                    <Link
                                        href={`/admin/miners/${miner.miner_uid}`}
                                        className="flex items-center space-x-1.5 text-[9px] font-bold uppercase tracking-wider text-primary/40 hover:text-primary transition-colors group/link"
                                    >
                                        <span>Go to Vault</span>
                                        <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
                                    </Link>
                                </div>

                                {/* Main Stats - Dashed List */}
                                <div className="space-y-3.5 pt-5 border-t border-dashed border-cream-dark/50 flex-1">
                                    <StatRow label="Total Earnings:" value={`$${(18400 - (i * 120)).toLocaleString()}`} isBlue />
                                    <StatRow label="Alpha Earned:" value={(92000 - (i * 600)).toLocaleString()} isBlue />
                                    <StatRow label="Jobs Participated:" value={(2742 - i).toLocaleString()} isBlue />
                                    <StatRow label="TVL (USD):" value={`$${(2742 - i).toLocaleString()}`} isBlue />
                                    <StatRow label="Net APY:" value={`$${(2742 - i).toLocaleString()}`} isBlue />

                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest pt-1">
                                        <span className="text-primary/20">Chains:</span>
                                        <div className="flex items-center space-x-2">
                                            <ChainBadge name="BASE" icon="/images/base-logo.svg" />
                                            <ChainBadge name="ETH" icon="/images/eth-logo.svg" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest pt-1">
                                        <span className="text-primary/20">Active Vaults:</span>
                                        <span className="text-blue-600">3</span>
                                    </div>
                                </div>

                                {/* Contributions Sub-section */}
                                <div className="mt-6 pt-6 border-t border-dashed border-cream-dark/50 shrink-0">
                                    <div className="flex justify-between items-center mb-5">
                                        <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/20">Top Jobs Contributions</h5>
                                        <div className="flex items-center space-x-1.5 text-primary/40 font-mono text-[10px]">
                                            <span>0xa23...df45</span>
                                            <ExternalLink size={10} className="cursor-pointer hover:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <ContributionRow label="cbBTC/USDC" value="$6,800" href={`/admin/miners/${miner.miner_uid}?pair=1`} />
                                        <ContributionRow label="USDC/WETH" value="$4,100" href={`/admin/miners/${miner.miner_uid}?pair=2`} />
                                        <ContributionRow label="xTAO/USDC" value="$3,900" href={`/admin/miners/${miner.miner_uid}?pair=3`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function StatRow({ label, value, isBlue }: { label: string; value: string; isBlue?: boolean }) {
    return (
        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
            <span className="text-primary/20">{label}</span>
            <span className={isBlue ? 'text-blue-600' : 'text-primary'}>{value}</span>
        </div>
    );
}

function ChainBadge({ name, icon }: { name: string; icon: string }) {
    return (
        <div className="bg-cream/20 border border-cream-dark/50 px-2 py-1 rounded-lg flex items-center space-x-1.5">
            <div className="w-3.5 h-3.5 relative">
                <Image src={icon} alt={name} fill className="object-contain" />
            </div>
            <span className="text-[8px] font-black text-primary/60">{name}</span>
        </div>
    );
}

function ContributionRow({ label, value, href }: { label: string; value: string; href?: string }) {
    const content = (
        <div className="flex justify-between items-center text-[9px] font-bold py-1 group/row transition-all">
            <span className="text-primary/30 uppercase tracking-[0.1em] leading-none group-hover/row:text-primary transition-colors">{label}</span>
            <span className="text-blue-600 leading-none group-hover/row:underline">{value}</span>
        </div>
    );

    if (href) {
        return <Link href={href} className="block">{content}</Link>;
    }

    return content;
}

