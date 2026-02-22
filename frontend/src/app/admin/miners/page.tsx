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

    const sortOptions = ['Miner ID', 'Combined Score', 'Eval Score', 'Live Score', 'Participation Days'];
    const timeframes = ['1D', '7D', '30D', 'ALL'];

    // Sort miners based on selected option
    const sortedMiners = React.useMemo(() => {
        if (!miners) return [];
        const sorted = [...miners];
        switch (sortBy) {
            case 'Miner ID':
                sorted.sort((a, b) => a.miner_uid - b.miner_uid);
                break;
            case 'Combined Score':
                sorted.sort((a, b) => b.combined_score - a.combined_score);
                break;
            case 'Eval Score':
                sorted.sort((a, b) => b.evaluation_score - a.evaluation_score);
                break;
            case 'Live Score':
                sorted.sort((a, b) => b.live_score - a.live_score);
                break;
            case 'Participation Days':
                sorted.sort((a, b) => b.participation_days - a.participation_days);
                break;
        }
        return sorted;
    }, [miners, sortBy]);

    return (
        <AdminLayout
            title="Miners"
            description="GLOBAL VALIDATOR PERFORMANCE ACROSS ALL PROTOCOLS"
            icon={<Users size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {/* Top Bar - Sort & Timeframe */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-primary w-full md:w-auto justify-between md:justify-start">
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
                    <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm self-start md:self-auto overflow-x-auto max-w-full">
                        {timeframes.map(t => (
                            <button
                                key={t}
                                onClick={() => setTimeframe(t)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${timeframe === t
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
                        {sortedMiners?.map((miner) => (
                            <div
                                key={miner.miner_uid}
                                className="bg-white p-6 rounded-[32px] border border-cream-dark shadow-sm hover:shadow-md transition-all duration-500 font-bold text-primary group flex flex-col h-full"
                            >
                                {/* Card Header */}
                                <div className="flex justify-between items-center mb-5 shrink-0">
                                    <div className="flex items-center space-x-2">
                                        <Link href={`/admin/miners/${miner.miner_uid}`} className="hover:underline transition-all">
                                            <h4 className="text-sm font-black tracking-tight uppercase">
                                                UID {miner.miner_uid} - {miner.miner_hotkey.slice(0, 8)}...
                                            </h4>
                                        </Link>
                                        <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${miner.is_eligible_for_live
                                            ? 'bg-green-500 shadow-green-500/40'
                                            : 'bg-yellow-500 shadow-yellow-500/40'
                                            }`} />
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
                                    <StatRow label="Combined Score:" value={miner.combined_score.toFixed(6)} isBlue />
                                    <StatRow label="Eval Score:" value={miner.evaluation_score.toFixed(6)} isBlue />
                                    <StatRow label="Live Score:" value={miner.live_score.toFixed(6)} isBlue />
                                    <StatRow label="Total Evaluations:" value={miner.total_evaluations.toLocaleString()} isBlue />
                                    <StatRow label="Live Rounds:" value={miner.total_live_rounds.toLocaleString()} isBlue />

                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest pt-1">
                                        <span className="text-primary/20">Chains:</span>
                                        <div className="flex items-center space-x-2">
                                            <ChainBadge name="BASE" icon="/images/base-logo.svg" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest pt-1">
                                        <span className="text-primary/20">Participation Days:</span>
                                        <span className="text-blue-600">{miner.participation_days}</span>
                                    </div>
                                </div>

                                {/* Hotkey Sub-section */}
                                <div className="mt-6 pt-6 border-t border-dashed border-cream-dark/50 shrink-0">
                                    <div className="flex justify-between items-center mb-5">
                                        <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/20">Hotkey</h5>
                                        <div className="flex items-center space-x-1.5 text-primary/40 font-mono text-[10px]">
                                            <span>{miner.miner_hotkey.slice(0, 6)}...{miner.miner_hotkey.slice(-4)}</span>
                                            <ExternalLink size={10} className="cursor-pointer hover:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <ContributionRow label="Eligible for Live" value={miner.is_eligible_for_live ? 'Yes' : 'No'} href={`/admin/miners/${miner.miner_uid}`} />
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
