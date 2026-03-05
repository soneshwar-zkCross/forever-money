'use client';

import React, { useState, useMemo } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Link from 'next/link';
import Image from 'next/image';
import {
    Users,
    ChevronDown,
    ArrowRight,
    ExternalLink,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { useAllMiners } from '@/lib/api';

const MINERS_PER_PAGE = 24;

export default function MinersPage() {
    const [sortBy, setSortBy] = useState('Miner ID');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [timeframe, setTimeframe] = useState('30D');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showInactive, setShowInactive] = useState(false);

    const { data: minersData, isLoading, isFetching } = useAllMiners();
    const miners = minersData?.miners;
    const lastSynced = minersData?.last_synced;
    const source = minersData?.source;

    const sortOptions = ['Miner ID', 'Combined Score', 'Eval Score', 'Live Score', 'Participation Days'];
    const timeframes = ['1D', '7D', '30D', 'ALL'];

    // Sort miners based on selected option
    const sortedMiners = useMemo(() => {
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

    // Filter miners by active status and search query
    const filteredMiners = useMemo(() => {
        let result = sortedMiners;

        // Active/inactive filter
        if (!showInactive) {
            result = result.filter((m) => m.is_active);
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((m) =>
                String(m.miner_uid).includes(q) ||
                m.miner_hotkey.toLowerCase().includes(q) ||
                (m.miner_name && m.miner_name.toLowerCase().includes(q))
            );
        }

        return result;
    }, [sortedMiners, searchQuery, showInactive]);

    // Counts for the toggle label
    const activeCount = useMemo(() => {
        return sortedMiners.filter((m) => m.is_active).length;
    }, [sortedMiners]);
    const totalCount = sortedMiners.length;

    // Reset to page 1 when sort, search, or filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [sortBy, searchQuery, showInactive]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredMiners.length / MINERS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * MINERS_PER_PAGE;
    const endIdx = Math.min(startIdx + MINERS_PER_PAGE, filteredMiners.length);
    const pagedMiners = filteredMiners.slice(startIdx, endIdx);

    // Smart page number generation
    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [1];
        if (safePage > 3) pages.push('...');
        const start = Math.max(2, safePage - 1);
        const end = Math.min(totalPages - 1, safePage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (safePage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    return (
        <AdminLayout
            title="Miners"
            description="GLOBAL VALIDATOR PERFORMANCE ACROSS ALL PROTOCOLS"
            icon={<Users size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {/* Top Bar - Sort, Search & Timeframe */}
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

                    {/* Search Bar */}
                    <div className="relative w-full md:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
                        <input
                            type="text"
                            placeholder="Search UID, hotkey, or name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-cream-dark rounded-xl pl-9 pr-4 py-2 text-[11px] font-bold text-primary placeholder:text-primary/30 focus:outline-none focus:border-primary/30 transition-all shadow-sm"
                        />
                    </div>

                    {/* Active / All Toggle */}
                    <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm self-start md:self-auto">
                        <button
                            onClick={() => setShowInactive(false)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${!showInactive
                                ? 'bg-primary text-white shadow-md'
                                : 'text-primary/30 hover:text-primary/50'
                            }`}
                        >
                            Active ({activeCount})
                        </button>
                        <button
                            onClick={() => setShowInactive(true)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${showInactive
                                ? 'bg-primary text-white shadow-md'
                                : 'text-primary/30 hover:text-primary/50'
                            }`}
                        >
                            All ({totalCount})
                        </button>
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

                {/* Sync Status Bar */}
                <div className="flex items-center justify-end space-x-3 text-[10px] font-bold uppercase tracking-widest">
                    {isFetching && !isLoading ? (
                        <span className="flex items-center space-x-1.5 text-primary/40">
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Syncing...</span>
                        </span>
                    ) : lastSynced ? (
                        <span className="flex items-center space-x-1.5 text-primary/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500/40" />
                            <span>Last synced: <SyncTimeAgo iso={lastSynced} /></span>
                        </span>
                    ) : source === 'live' ? (
                        <span className="flex items-center space-x-1.5 text-yellow-600/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_6px] shadow-yellow-500/40" />
                            <span>Live (no cache)</span>
                        </span>
                    ) : null}
                </div>

                {/* Main View - 3-Column Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[480px] bg-white border border-cream-dark rounded-[32px]"></div>)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pagedMiners.map((miner) => (
                                <div
                                    key={miner.miner_uid}
                                    className={`bg-white p-6 rounded-[32px] border border-cream-dark shadow-sm hover:shadow-md transition-all duration-500 font-bold text-primary group flex flex-col h-full ${!miner.is_active ? 'opacity-60' : ''}`}
                                >
                                    {/* Card Header */}
                                    <div className="flex justify-between items-center mb-5 shrink-0">
                                        <div className="flex items-center space-x-2 min-w-0">
                                            <Link href={`/admin/miners/${miner.miner_uid}`} className="hover:underline transition-all min-w-0">
                                                <h4 className="text-sm font-black tracking-tight uppercase truncate">
                                                    {miner.miner_name
                                                        ? `${miner.miner_name} (UID ${miner.miner_uid})`
                                                        : `UID ${miner.miner_uid} - ${miner.miner_hotkey.slice(0, 8)}...`
                                                    }
                                                </h4>
                                            </Link>
                                            <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] shrink-0 ${miner.is_active
                                                ? 'bg-green-500 shadow-green-500/40'
                                                : 'bg-red-400 shadow-red-400/40'
                                                }`} title={miner.is_active ? 'Active (last 24h)' : 'Inactive'} />
                                        </div>
                                        <Link
                                            href={`/admin/miners/${miner.miner_uid}`}
                                            className="flex items-center space-x-1.5 text-[9px] font-bold uppercase tracking-wider text-primary/40 hover:text-primary transition-colors group/link shrink-0 ml-2"
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

                        {/* Pagination */}
                        {filteredMiners.length > MINERS_PER_PAGE && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                                    Showing {startIdx + 1}-{endIdx} of {filteredMiners.length} miners
                                </span>

                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        className="p-2 rounded-lg text-primary/40 hover:text-primary hover:bg-cream/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    {pageNumbers.map((page, idx) =>
                                        page === '...' ? (
                                            <span key={`ellipsis-${idx}`} className="px-2 text-[10px] font-bold text-primary/30">...</span>
                                        ) : (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page as number)}
                                                className={`min-w-[32px] h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    safePage === page
                                                        ? 'bg-primary text-white shadow-md'
                                                        : 'text-primary/40 hover:text-primary hover:bg-cream/30'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    )}

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        className="p-2 rounded-lg text-primary/40 hover:text-primary hover:bg-cream/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {filteredMiners.length === 0 && (
                            <div className="text-center py-16 text-primary/40 text-[11px] font-bold uppercase tracking-widest">
                                {searchQuery
                                    ? <>No miners found for &ldquo;{searchQuery}&rdquo;</>
                                    : !showInactive
                                        ? <>No active miners in the last 24h. <button onClick={() => setShowInactive(true)} className="underline hover:text-primary transition-colors">Show all miners</button></>
                                        : <>No miners found</>
                                }
                            </div>
                        )}
                    </>
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

function SyncTimeAgo({ iso }: { iso: string }) {
    const [, setTick] = useState(0);
    React.useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diff < 60) return <span>just now</span>;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return <span>{mins}m ago</span>;
    const hrs = Math.floor(mins / 60);
    return <span>{hrs}h {mins % 60}m ago</span>;
}
