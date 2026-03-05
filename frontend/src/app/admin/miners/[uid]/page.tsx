'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
    LineChart,
    Line,
    ResponsiveContainer,
    YAxis,
    XAxis,
    Tooltip,
    AreaChart,
    Area,
    CartesianGrid,
} from 'recharts';
import { useMinerWinRate } from '@/lib/metrics-hooks';
import { useJobTVLHistory } from '@/lib/metrics-hooks';
import { useJobs, useMinerVaults, useMinerProfile, useJobTVL, useJobAPY, useJobRevenue, useJobPnL, useMinerScoreHistory, useMinerMetricsHistory, useMinerVaultActivity } from '@/lib/api';
import type { RoundHistoryEntry, ExecutionLogEntry, StrategyEntry } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    Info,
    LayoutGrid,
    ChevronRight
} from 'lucide-react';

function timeframeToDays(tf: string): number {
    switch (tf) {
        case '1D': return 1;
        case '7D': return 7;
        case '30D': return 30;
        case 'ALL': return 365;
        default: return 30;
    }
}

function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MinerDetailsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const minerUid = parseInt(params?.uid as string) || 0;
    const jobId = searchParams.get('pair');

    const isVaultSpecific = !!jobId;

    const { data: winRateData, isLoading: winRateLoading } = useMinerWinRate(minerUid, jobId || undefined);
    const { data: jobs } = useJobs();
    const { data: minerVaults } = useMinerVaults(minerUid);
    const { data: minerProfile, isLoading: profileLoading } = useMinerProfile(minerUid);

    // Job-level hooks only for vault-specific view
    const { data: tvl } = useJobTVL(jobId || '');
    const { data: apy } = useJobAPY(jobId || '', 30);
    const { data: revenue } = useJobRevenue(jobId || '', 30);
    const { data: pnl } = useJobPnL(jobId || '', 30);

    if ((winRateLoading || profileLoading) || !minerUid) {
        return (
            <AdminLayout title="Loading..." description="Fetching performance details" icon={<Terminal size={20} />}>
                <div className="flex items-center justify-center py-20">
                    <div className="text-primary/40 animate-pulse font-mono uppercase font-black tracking-widest text-[10px]">
                        Initializing Terminal...
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const selectedJob = jobs?.find(j => j.job_id === jobId);
    const [token0Symbol, token1Symbol] = selectedJob?.metadata.pair_name.split('/') || ['cbBTC', 'USDC'];

    // Find the vault for this miner on the selected job
    const selectedVault = minerVaults?.vaults?.find((v: any) => v.job_id === jobId);
    const isLive = selectedVault?.is_eligible_for_live ?? false;

    return (
        <AdminLayout
            title={isVaultSpecific
                ? `Vault #${minerUid} | ${token0Symbol} / ${token1Symbol} | Aerodrome | Base`
                : `Miner ID: 5F${minerUid.toString().padStart(6, '0')}`
            }
            description={isVaultSpecific ? `START DATE: 25/01/26` : `Global Miner Performance — Page 4`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-6 pb-20 font-bold text-primary">
                {/* Header Actions - Subheader Row */}
                <div className="flex items-center justify-between">
                    <Link
                        href={isVaultSpecific ? `/admin/miners/${minerUid}` : "/admin/miners"}
                        className="flex items-center space-x-2 text-[10px] uppercase tracking-widest text-primary/40 hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={14} />
                        <span>Back to {isVaultSpecific ? 'Pairs' : 'Miners'}</span>
                    </Link>
                    <div className="flex items-center space-x-4">
                        {isVaultSpecific ? (
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                isLive
                                    ? 'bg-green-50 text-green-600 border-green-100/50'
                                    : 'bg-amber-50 text-amber-600 border-amber-100/50'
                            }`}>
                                {isLive ? 'Live' : 'Evaluation'}
                            </div>
                        ) : (
                            <div className="px-3 py-1 bg-green-50 text-green-600 border border-green-100/50 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                Active
                            </div>
                        )}
                    </div>
                </div>

                {isVaultSpecific ? (
                    <VaultPerformanceView
                        minerUid={minerUid}
                        jobId={jobId}
                        token0Symbol={token0Symbol}
                        token1Symbol={token1Symbol}
                        winRateData={winRateData}
                        tvl={tvl}
                        apy={apy}
                        revenue={revenue}
                        pnl={pnl}
                        isLive={isLive}
                        vaultData={selectedVault}
                    />
                ) : (
                    <MinerPerformanceView
                        minerUid={minerUid}
                        minerVaults={minerVaults}
                        minerProfile={minerProfile}
                        winRateData={winRateData}
                    />
                )}
            </div>
        </AdminLayout>
    );
}

function VaultPerformanceView({ minerUid, jobId, token0Symbol, token1Symbol, winRateData, tvl, apy, revenue, pnl, isLive, vaultData }: any) {
    const [timeframe, setTimeframe] = useState('30D');
    const timeframes = ['1D', '7D', '30D', 'ALL'];
    const days = timeframeToDays(timeframe);

    const { data: tvlHistory } = useJobTVLHistory(jobId || '', days);
    const { data: activity } = useMinerVaultActivity(minerUid, jobId || '');
    const series = tvlHistory?.series || [];

    const hasFinancialData = (tvl?.tvl_usd || 0) > 0;

    const growthData = useMemo(() => {
        return series.map((pt: any) => ({
            time: formatTimestamp(pt.timestamp),
            tvl_usd: pt.tvl_usd || 0,
            revenue_usd: pt.revenue_usd || 0,
        }));
    }, [series]);

    const flowData = useMemo(() => {
        return series.map((pt: any) => ({
            time: formatTimestamp(pt.timestamp),
            pnl_usd: pt.pnl_usd || 0,
            revenue_usd: pt.revenue_usd || 0,
        }));
    }, [series]);

    const summary = activity?.summary;
    const roundHistory = activity?.round_history || [];
    const executionLog = activity?.execution_log || [];
    const latestStrategy = activity?.latest_strategy;
    const recentStrategies = activity?.recent_strategies || [];
    const pt = activity?.pool_tokens;
    const t0Sym = pt?.token0_symbol || token0Symbol;
    const t1Sym = pt?.token1_symbol || token1Symbol;
    const t0Dec = pt?.token0_decimals ?? 18;
    const t1Dec = pt?.token1_decimals ?? 18;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Metrics */}
            {hasFinancialData ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MiniStatBox label="Net Deposit (USD)" value={formatUsd(tvl?.tvl_usd)} />
                    <MiniStatBox label="Fees Earned (USD)" value={formatUsd(revenue?.revenue_usd)} />
                    <MiniStatBox label={`APY ${token0Symbol} / ${token1Symbol}`} value={`${(apy?.apy_percent_token0 || 0).toFixed(1)}% / ${(apy?.apy_percent_token1 || 0).toFixed(1)}%`} />
                    <MiniStatBox label="APY (USD)" value={`${(apy?.apy_percent || 0).toFixed(1)}%`} />
                    <MiniStatBox label="PnL (USD)" value={formatUsd(pnl?.pnl_usd)} />
                    <MiniStatBox label="Rounds" value={`${winRateData?.total_participations || 0}`} />
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MiniStatBox label="Combined Score" value={(vaultData?.combined_score ?? 0).toFixed(4)} />
                    <MiniStatBox label="Eval Score" value={(vaultData?.evaluation_score ?? 0).toFixed(4)} />
                    <MiniStatBox label="Rounds Won" value={`${summary?.rounds_won ?? winRateData?.total_wins ?? 0}`} />
                    <MiniStatBox label="Total Rounds" value={`${summary?.total_rounds ?? winRateData?.total_participations ?? 0}`} />
                    <MiniStatBox label="Live Executions" value={`${summary?.total_executions ?? 0}`} />
                    <MiniStatBox label="Avg Score" value={`${(summary?.avg_score ?? 0).toFixed(4)}`} />
                </div>
            )}

            {/* Financial sections — only when financial data exists */}
            {hasFinancialData && (
                <>
                    {/* Vault Growth Chart */}
                    <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
                            <div className="flex flex-col space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Vault Growth</span>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                                    <LegendItem color="bg-black" label="TVL (USD)" />
                                    <LegendItem color="bg-green-500" label="Revenue (USD)" />
                                </div>
                            </div>
                            <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm self-start md:self-auto overflow-x-auto max-w-full">
                                {timeframes.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeframe(t)}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all whitespace-nowrap ${timeframe === t
                                            ? 'bg-primary text-white shadow-md'
                                            : 'text-primary/30 hover:text-primary/50'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-80 w-full relative">
                            {growthData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={growthData}>
                                        <defs>
                                            <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#000" stopOpacity={0.05} />
                                                <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#0C206010" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }} tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`} />
                                        <Tooltip content={({ active, payload }) => (
                                            active && payload && payload.length > 0 ? (
                                                <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                                    <div className="text-primary/30 mb-2">{payload[0]?.payload?.time}</div>
                                                    {payload.map((p: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center space-x-4 mb-1 last:mb-0">
                                                            <span className="uppercase tracking-widest opacity-40">{p.name}:</span>
                                                            <span style={{ color: p.color }}>${(p.value as number).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null
                                        )} />
                                        <Area type="monotone" dataKey="tvl_usd" name="TVL (USD)" stroke="#000" strokeWidth={2} fill="url(#colorUsd)" dot={false} />
                                        <Area type="monotone" dataKey="revenue_usd" name="Revenue (USD)" stroke="#22c55e" strokeWidth={2} fill="transparent" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                                    Collecting vault data...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Capital Flow and PnL Chart */}
                    <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
                            <div className="flex flex-col space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Capital Flow and PNL</span>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                                    <LegendItem color="bg-black" label="PnL (USD)" />
                                    <LegendItem color="bg-blue-500" label="Revenue (USD)" />
                                </div>
                            </div>
                        </div>
                        <div className="h-80 w-full relative">
                            {flowData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={flowData} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#0C206010" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }} tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`} />
                                        <Tooltip content={({ active, payload }) => (
                                            active && payload && payload.length > 0 ? (
                                                <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                                    <div className="text-primary/30 mb-2">{payload[0]?.payload?.time}</div>
                                                    {payload.map((p: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center space-x-4 mb-1 last:mb-0">
                                                            <span className="uppercase tracking-widest opacity-40">{p.name}:</span>
                                                            <span style={{ color: p.color }}>${(p.value as number).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null
                                        )} />
                                        <Line type="monotone" dataKey="pnl_usd" name="PnL (USD)" stroke="#000" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="revenue_usd" name="Revenue (USD)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                                    Collecting PnL data...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Inventory Overview */}
                    <div className="bg-white p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                        <div className="flex items-center justify-between mb-8">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Inventory Overview</span>
                            <Info size={14} className="text-primary/20" />
                        </div>
                        <div className="space-y-6 pt-2 border-t border-dashed border-cream-dark/50">
                            <InventoryRow label="Current:" tokens={`${(tvl?.tvl_token0 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token0Symbol} / ${(tvl?.tvl_token1 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token1Symbol}`} value={formatUsd(tvl?.tvl_usd)} />
                            <InventoryRow label="Fees Earned:" tokens={`${(revenue?.revenue_token0 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token0Symbol} / ${(revenue?.revenue_token1 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token1Symbol}`} value={formatUsd(revenue?.revenue_usd)} />
                            <InventoryRow label="APY:" tokens={`${(apy?.apy_percent_token0 || 0).toFixed(1)}% ${token0Symbol} / ${(apy?.apy_percent_token1 || 0).toFixed(1)}% ${token1Symbol}`} value={`${(apy?.apy_percent || 0).toFixed(1)}% USD`} isBlue />
                            <div className="border-t border-dashed border-cream-dark/50 pt-2" />
                            <InventoryRow label="PnL:" tokens={`${(pnl?.pnl_token0 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token0Symbol} / ${(pnl?.pnl_token1 || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token1Symbol}`} value={formatUsd(pnl?.pnl_usd)} isBlue />
                        </div>
                    </div>
                </>
            )}

            {/* Round History Table — always shown */}
            <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Round History</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/20">
                        {roundHistory.length} rounds
                    </span>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    {roundHistory.length > 0 ? (
                        <table className="w-full text-[10px] font-bold min-w-[700px]">
                            <thead className="sticky top-0 bg-white">
                                <tr className="text-primary/20 text-left border-b border-cream-dark/30">
                                    <th className="pb-3 uppercase tracking-widest">Round</th>
                                    <th className="pb-3 uppercase tracking-widest">Type</th>
                                    <th className="pb-3 uppercase tracking-widest">Your Score</th>
                                    <th className="pb-3 uppercase tracking-widest">Best Score</th>
                                    <th className="pb-3 uppercase tracking-widest">Rank</th>
                                    <th className="pb-3 uppercase tracking-widest">Winner</th>
                                    <th className="pb-3 uppercase tracking-widest">Participants</th>
                                    <th className="pb-3 uppercase tracking-widest">Duration</th>
                                    <th className="pb-3 uppercase tracking-widest">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roundHistory.map((r: RoundHistoryEntry, i: number) => {
                                    const scores = Object.entries(r.all_scores || {}).map(([uid, s]) => ({ uid: Number(uid), score: s }));
                                    // Sort by score desc, but place winner_uid first on ties to match backend tiebreaking
                                    const sorted = [...scores].sort((a, b) => {
                                        if (b.score !== a.score) return b.score - a.score;
                                        // On tie, winner goes first
                                        if (a.uid === r.winner_uid) return -1;
                                        if (b.uid === r.winner_uid) return 1;
                                        return 0;
                                    });
                                    const rank = sorted.findIndex(s => s.uid === minerUid) + 1;
                                    const bestEntry = sorted[0];
                                    return (
                                        <tr
                                            key={i}
                                            className={`border-b border-cream-dark/10 last:border-0 ${r.is_winner ? 'bg-green-50/50' : 'hover:bg-cream/20'} transition-colors`}
                                        >
                                            <td className="py-3 font-black">#{r.round_number}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                                    r.round_type === 'live'
                                                        ? 'bg-green-50 text-green-600 border-green-100/50'
                                                        : 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                }`}>
                                                    {r.round_type === 'evaluation' ? 'Eval' : 'Live'}
                                                </span>
                                            </td>
                                            <td className="py-3 font-black">{r.miner_score !== null ? r.miner_score.toFixed(4) : '—'}</td>
                                            <td className="py-3 text-primary/50">{bestEntry ? bestEntry.score.toFixed(4) : '—'}</td>
                                            <td className="py-3">
                                                {rank > 0 ? (
                                                    <span className={rank === 1 ? 'text-green-600 font-black' : ''}>
                                                        {rank}/{scores.length}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="py-3">
                                                {r.is_winner ? (
                                                    <span className="text-green-600 font-black">You</span>
                                                ) : (
                                                    <span className="text-primary/40">UID {r.winner_uid ?? '—'}</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-primary/50">{scores.length}</td>
                                            <td className="py-3 text-primary/50">{r.duration_seconds ? formatDuration(r.duration_seconds) : '—'}</td>
                                            <td className="py-3 text-primary/40">{r.end_time ? timeAgo(r.end_time) : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-12 text-center text-primary/20 text-xs font-black uppercase tracking-widest">
                            No round data available
                        </div>
                    )}
                </div>
            </div>

            {/* Execution Log — grouped by round, always shown */}
            <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Execution Log</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/20">
                        {summary?.failed_executions ?? 0} / {summary?.total_executions ?? 0} failed
                    </span>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    {executionLog.length > 0 ? (
                        <div className="space-y-3">
                            {groupExecutionsByRound(executionLog).map((group, i) => (
                                <div key={i} className="border border-cream-dark/30 rounded-2xl overflow-hidden">
                                    {/* Round header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-cream/5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black">Round #{group.round_number}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                                group.hasSuccess
                                                    ? 'bg-green-50 text-green-600 border-green-100/50'
                                                    : group.allFailed
                                                    ? 'bg-red-50 text-red-600 border-red-100/50'
                                                    : 'bg-amber-50 text-amber-600 border-amber-100/50'
                                            }`}>
                                                {group.hasSuccess ? 'success' : group.allFailed ? `${group.entries.length}x failed` : 'pending'}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold text-primary/30">
                                            {group.latestTime ? timeAgo(group.latestTime) : '—'}
                                        </span>
                                    </div>
                                    {/* Attempts */}
                                    <div className="divide-y divide-cream-dark/20">
                                        {group.entries.map((ex, j) => (
                                            <div key={j} className="flex items-start gap-3 px-4 py-2.5 text-[10px]">
                                                <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                    ex.tx_status === 'success'
                                                        ? 'bg-green-50 text-green-600 border-green-100/50'
                                                        : ex.tx_status === 'failed'
                                                        ? 'bg-red-50 text-red-600 border-red-100/50'
                                                        : 'bg-amber-50 text-amber-600 border-amber-100/50'
                                                }`}>
                                                    {ex.tx_status || '?'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-bold text-red-500/80">{cleanErrorMessage(ex.error)}</span>
                                                </div>
                                                <span className="shrink-0 text-primary/30 font-bold">{ex.positions.length} pos</span>
                                                <span className="shrink-0 text-primary/25 font-bold">{ex.executed_at ? timeAgo(ex.executed_at) : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-primary/20 text-xs font-black uppercase tracking-widest">
                            No executions recorded
                        </div>
                    )}
                </div>
            </div>

            {/* Strategy History — always shown */}
            <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Strategy History</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/20">
                        {recentStrategies.length} responses
                    </span>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                    {recentStrategies.length > 0 ? (
                        <div className="space-y-3">
                            {recentStrategies.map((s: StrategyEntry, i: number) => (
                                <div key={i} className={`border rounded-2xl overflow-hidden ${i === 0 ? 'border-blue-200 bg-blue-50/20' : 'border-cream-dark/30'}`}>
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-cream/5">
                                        <div className="flex items-center gap-3">
                                            {i === 0 && (
                                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-100/50">
                                                    Latest
                                                </span>
                                            )}
                                            {s.price != null && (
                                                <span className="text-[10px] font-bold text-primary/50">
                                                    Price: {formatSqrtPriceX96(Number(s.price), t0Dec, t1Dec)}
                                                </span>
                                            )}
                                            {s.block != null && (
                                                <span className="text-[10px] font-bold text-primary/30">
                                                    Block {s.block.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-primary/30">
                                            {s.submitted_at ? timeAgo(s.submitted_at) : '—'}
                                        </span>
                                    </div>
                                    {/* Positions */}
                                    <div className="px-4 py-3 space-y-2">
                                        {s.inventory && (
                                            <div className="text-[10px] font-bold text-primary/40">
                                                Inventory: {formatTokenAmount(s.inventory.amount0, t0Dec)} {t0Sym} / {formatTokenAmount(s.inventory.amount1, t1Dec)} {t1Sym}
                                            </div>
                                        )}
                                        {s.positions.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {s.positions.map((pos: any, j: number) => (
                                                    <div key={j} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold">
                                                        <span className="text-primary/30 uppercase tracking-widest w-12">Pos {j + 1}</span>
                                                        <span className="text-primary">
                                                            tick {Number(pos.tick_lower).toLocaleString()} &rarr; {Number(pos.tick_upper).toLocaleString()}
                                                        </span>
                                                        {(pos.allocation0 || pos.allocation1) && (
                                                            <span className="text-primary/50">
                                                                {formatTokenAmount(pos.allocation0, t0Dec)} {t0Sym} / {formatTokenAmount(pos.allocation1, t1Dec)} {t1Sym}
                                                            </span>
                                                        )}
                                                        {pos.confidence != null && (
                                                            <span className="text-blue-600">
                                                                {(Number(pos.confidence) * 100).toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-primary/20">No positions</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-primary/20 text-xs font-black uppercase tracking-widest">
                            No strategy data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MinerPerformanceView({ minerUid, minerVaults, minerProfile, winRateData }: any) {
    const router = useRouter();

    const { data: scoreHistory } = useMinerScoreHistory(minerUid);
    const { data: metricsHistory } = useMinerMetricsHistory(minerUid, 30);

    // Use best (max) score across jobs — same logic as backend list_all_miners
    const jobs = minerProfile?.jobs || [];
    const bestCombined = jobs.length > 0
        ? Math.max(...jobs.map((j: any) => j.combined_score))
        : 0;
    const bestEval = jobs.length > 0
        ? Math.max(...jobs.map((j: any) => j.evaluation_score))
        : 0;
    const bestLive = jobs.length > 0
        ? Math.max(...jobs.map((j: any) => j.live_score))
        : 0;

    const scoreData = useMemo(() => {
        const points = scoreHistory?.data_points || [];
        return points.map((pt: any) => ({
            time: formatTimestamp(pt.timestamp),
            combined: pt.combined_score || 0,
            evaluation: pt.evaluation_score || 0,
            live: pt.live_score || 0,
        }));
    }, [scoreHistory]);

    const earningsData = useMemo(() => {
        const series = metricsHistory?.series || [];
        return series.map((pt: any) => ({
            time: formatTimestamp(pt.timestamp),
            earnings_usd: pt.earnings_usd || 0,
        }));
    }, [metricsHistory]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Metrics (6 boxes) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStatBox label="Best Combined" value={bestCombined.toFixed(4)} />
                <MiniStatBox label="Best Eval" value={bestEval.toFixed(4)} />
                <MiniStatBox label="Best Live" value={bestLive.toFixed(4)} />
                <MiniStatBox label="Win Rate" value={`${(winRateData?.win_rate || 0).toFixed(1)}%`} />
                <MiniStatBox label="Total Rounds" value={`${winRateData?.total_participations || 0}`} />
                <MiniStatBox label="Active Vaults" value={`${minerVaults?.active_vaults || 0}`} />
            </div>

            {/* Performance Over Time */}
            <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
                    <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Performance Over Time</span>
                        {scoreData.length >= 2 && (
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                                <LegendItem color="bg-black" label="Combined" />
                                <LegendItem color="bg-blue-500" label="Evaluation" />
                                <LegendItem color="bg-green-500" label="Live" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-80 w-full relative">
                    {scoreData.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={scoreData}>
                                <defs>
                                    <linearGradient id="colorCombined" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000" stopOpacity={0.05} />
                                        <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#0C206010" />
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                    domain={[0, 1]}
                                    tickFormatter={(val) => val.toFixed(2)}
                                />
                                <Tooltip
                                    content={({ active, payload }) => (
                                        active && payload && payload.length > 0 ? (
                                            <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                                <div className="text-primary/30 mb-2">{payload[0]?.payload?.time}</div>
                                                {payload.map((p: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center space-x-4 mb-1 last:mb-0">
                                                        <span className="uppercase tracking-widest opacity-40">{p.name}:</span>
                                                        <span style={{ color: p.color }}>{(p.value as number).toFixed(4)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null
                                    )}
                                />
                                <Area type="monotone" dataKey="combined" name="Combined" stroke="#000" strokeWidth={2} fill="url(#colorCombined)" dot={false} />
                                <Area type="monotone" dataKey="evaluation" name="Evaluation" stroke="#3b82f6" strokeWidth={1.5} fill="transparent" dot={false} />
                                <Area type="monotone" dataKey="live" name="Live" stroke="#22c55e" strokeWidth={1.5} fill="transparent" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                            Not enough data yet — chart requires at least 2 snapshots
                        </div>
                    )}
                </div>
            </div>

            {/* Earnings Over Time */}
            <div className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-10">
                    <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Earnings Over Time</span>
                        {earningsData.length >= 2 && (
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2">
                                <LegendItem color="bg-black" label="Earnings (USD)" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-80 w-full relative">
                    {earningsData.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={earningsData}>
                                <defs>
                                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000" stopOpacity={0.05} />
                                        <stop offset="95%" stopColor="#000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#0C206010" />
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                    tickFormatter={(val) => `$${val.toFixed(0)}`}
                                />
                                <Tooltip
                                    content={({ active, payload }) => (
                                        active && payload && payload.length > 0 ? (
                                            <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                                <div className="text-primary/30 mb-2">{payload[0]?.payload?.time}</div>
                                                {payload.map((p: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center space-x-4 mb-1 last:mb-0">
                                                        <span className="uppercase tracking-widest opacity-40">{p.name}:</span>
                                                        <span style={{ color: p.color }}>
                                                            ${(p.value as number).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null
                                    )}
                                />
                                <Area type="monotone" dataKey="earnings_usd" name="Earnings (USD)" stroke="#000" strokeWidth={2} fill="url(#colorEarnings)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                            Not enough data yet — chart requires at least 2 snapshots
                        </div>
                    )}
                </div>
            </div>

            {/* Active Vaults Table */}
            <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Active Vaults by Miner</span>
                    <LayoutGrid size={14} className="text-primary/20" />
                </div>
                <div className="border-t border-dashed border-cream-dark/50 mb-6" />

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {(minerVaults?.vaults || []).map((vault: any, i: number) => (
                        <div
                            key={i}
                            className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
                            onClick={() => router.push(`/admin/miners/${minerUid}?pair=${vault.job_id}`)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Vault No.</div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-black text-primary">#{vault.vault_id}</span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                            vault.is_eligible_for_live
                                                ? 'bg-green-50 text-green-600 border-green-100/50'
                                                : 'bg-amber-50 text-amber-600 border-amber-100/50'
                                        }`}>
                                            {vault.is_eligible_for_live ? 'Live' : 'Eval'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Chain</div>
                                    <div className="flex items-center space-x-1.5 bg-cream-dark/20 px-2.5 py-1 rounded-lg">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Base</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Pair</div>
                                    <Link
                                        href={`/admin/pairs/${vault.job_id}`}
                                        className="text-xs font-black text-primary hover:underline hover:text-blue-600 truncate block"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {vault.pair_name}
                                    </Link>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Combined</div>
                                    <div className="text-xs font-black text-primary">{vault.combined_score.toFixed(4)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Revenue</div>
                                    <div className="text-xs font-black text-primary">{formatUsd(vault.revenue_usd)}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Rounds</div>
                                    <div className="text-xs font-black text-blue-600">{vault.total_evaluations + vault.total_live_rounds}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-[10px] font-bold min-w-[700px]">
                        <thead>
                            <tr className="text-primary/20 text-left border-b border-cream-dark/30">
                                <th className="pb-4 uppercase tracking-widest">Vault No.</th>
                                <th className="pb-4 uppercase tracking-widest">Status</th>
                                <th className="pb-4 uppercase tracking-widest">Pair</th>
                                <th className="pb-4 uppercase tracking-widest">Chain</th>
                                <th className="pb-4 uppercase tracking-widest">Combined</th>
                                <th className="pb-4 uppercase tracking-widest">Eval Score</th>
                                <th className="pb-4 uppercase tracking-widest">Revenue USD</th>
                                <th className="pb-4 uppercase tracking-widest">Rounds</th>
                                <th className="pb-4"></th>
                            </tr>
                        </thead>
                        <tbody className="text-primary">
                            {(minerVaults?.vaults || []).map((vault: any, i: number) => (
                                <tr key={i} className="hover:bg-cream/20 transition-colors border-b border-cream-dark/10 last:border-0 group cursor-pointer"
                                    onClick={() => router.push(`/admin/miners/${minerUid}?pair=${vault.job_id}`)}>
                                    <td className="py-5 font-black">Vault #{vault.vault_id}</td>
                                    <td className="py-5">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                            vault.is_eligible_for_live
                                                ? 'bg-green-50 text-green-600 border-green-100/50'
                                                : 'bg-amber-50 text-amber-600 border-amber-100/50'
                                        }`}>
                                            {vault.is_eligible_for_live ? 'Live' : 'Eval'}
                                        </span>
                                    </td>
                                    <td className="py-5 uppercase tracking-wide">
                                        <Link href={`/admin/pairs/${vault.job_id}`} className="hover:underline hover:text-blue-600 transition-all"
                                            onClick={(e) => e.stopPropagation()}>
                                            {vault.pair_name}
                                        </Link>
                                    </td>
                                    <td className="py-5 opacity-40 uppercase">Base</td>
                                    <td className="py-5 font-black">{vault.combined_score.toFixed(4)}</td>
                                    <td className="py-5 text-blue-600 font-black">{vault.evaluation_score.toFixed(4)}</td>
                                    <td className="py-5 font-black">{formatUsd(vault.revenue_usd)}</td>
                                    <td className="py-5">{vault.total_evaluations + vault.total_live_rounds}</td>
                                    <td className="py-5 text-right">
                                        <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function timeAgo(isoStr: string): string {
    try {
        return formatDistanceToNow(new Date(isoStr), { addSuffix: true });
    } catch {
        return formatTimestamp(isoStr);
    }
}

function cleanErrorMessage(raw: string | null): string {
    if (!raw) return '—';
    // Strip outer wrapper: "Executor bot returned status 500: {...}"
    let msg = raw.replace(/^Executor bot returned status \d+:\s*/, '');
    // Try to parse JSON and extract inner message
    try {
        const parsed = JSON.parse(msg);
        if (parsed.error) {
            msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        }
    } catch { /* not JSON, use as-is */ }
    // Extract just the message from RPC error format: "{'code': -32000, 'message': '...'}"
    const rpcMatch = msg.match(/'message':\s*'([^']+)'/);
    if (rpcMatch) return rpcMatch[1];
    // Clean up common patterns
    msg = msg.replace(/^\{"error":\s*"?|"?\}$/g, '');
    msg = msg.replace(/^Cannot estimate gas with `eth_estimateGas`:\s*/, 'Gas estimation failed: ');
    // Trim to reasonable length
    if (msg.length > 80) msg = msg.slice(0, 77) + '...';
    return msg;
}

interface ExecutionGroup {
    round_number: number | null;
    entries: ExecutionLogEntry[];
    hasSuccess: boolean;
    allFailed: boolean;
    latestTime: string | null;
}

function groupExecutionsByRound(log: ExecutionLogEntry[]): ExecutionGroup[] {
    const map = new Map<number | string, ExecutionLogEntry[]>();
    for (const ex of log) {
        const key = ex.round_number ?? 'unknown';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ex);
    }
    const groups: ExecutionGroup[] = [];
    for (const [key, entries] of map) {
        const hasSuccess = entries.some(e => e.tx_status === 'success');
        const allFailed = entries.every(e => e.tx_status === 'failed');
        const latestTime = entries[0]?.executed_at || null;
        groups.push({
            round_number: typeof key === 'number' ? key : null,
            entries,
            hasSuccess,
            allFailed,
            latestTime,
        });
    }
    return groups;
}

function formatSqrtPriceX96(sqrtPriceX96: number, token0Decimals: number, token1Decimals: number): string {
    // sqrtPriceX96 is a Uniswap V3 Q64.96 fixed-point value
    // price (token1 per token0) = (sqrtPriceX96 / 2^96)^2 * 10^(token0Decimals - token1Decimals)
    const Q96 = 2 ** 96;
    const ratio = sqrtPriceX96 / Q96;
    const rawPrice = ratio * ratio;
    const price = rawPrice * Math.pow(10, token0Decimals - token1Decimals);
    if (price === 0) return '0';
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (price >= 0.001) return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return price.toExponential(4);
}

function formatTokenAmount(raw: string | number | undefined, decimals: number = 18): string {
    if (raw === undefined || raw === null) return '0';
    const n = Number(raw);
    if (n === 0) return '0';
    const divisor = Math.pow(10, decimals);
    const value = n / divisor;
    // Choose display precision based on magnitude
    if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (Math.abs(value) >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function MiniStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl md:rounded-[32px] border border-cream-dark shadow-sm flex flex-col justify-between h-full hover:bg-cream/5 transition-all duration-300">
            <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.15em] mb-4 leading-none">
                {label}
            </span>
            <span className="text-base font-black text-primary tracking-tight leading-none">
                {value}
            </span>
        </div>
    );
}

function InventoryRow({ label, tokens, value, isBlue }: { label: string; tokens: string; value: string; isBlue?: boolean }) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between text-[11px] font-bold gap-1 md:gap-0">
            <span className="text-primary/20 uppercase tracking-widest w-40">{label}</span>
            <div className="flex-1 flex justify-between items-center md:ml-10 w-full md:w-auto">
                <span className="text-primary uppercase tracking-tight">{tokens}</span>
                <span className={`${isBlue ? 'text-blue-600' : 'text-primary'} font-black text-xs`}>{value}</span>
            </div>
        </div>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">{label}</span>
        </div>
    );
}
