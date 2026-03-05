'use client';

import React, { use } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    ExternalLink,
    ChevronRight,
} from 'lucide-react';
import { useJobs, useNetworkStats, useLeaderboard, useJobAPY, useJobPnL, useJobTVL, useJobRevenue, useJobActivity, useAllRounds, useExecutions } from '@/lib/api';
import { useJobTVLHistory } from '@/lib/metrics-hooks';
import { formatUsd, formatFeeRate, formatTokenAmount } from '@/lib/format';
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);
    const { data: revenue } = useJobRevenue(jobId, 30);
    const { data: miners, isLoading: leaderboardLoading } = useLeaderboard(jobId);
    const { data: activity } = useJobActivity(jobId);
    const { data: tvlHistory } = useJobTVLHistory(jobId, 30);
    const { data: roundsData } = useAllRounds(jobId, 20);
    const { data: executions } = useExecutions(jobId);

    const job = jobs?.find(j => j.job_id === jobId) || {
        job_id: jobId,
        metadata: { pair_name: 'cbBTC/USDC' },
        sn_liquidity_manager_address: '0x44e992bb3889bf030369fbb10a9c99b83cb3e775',
        pair_address: '0x44e992bb3889bf030369fbb10a9c99b83cb3e775',
        fee_rate: 0.003,
        target_ratio: 0.5,
        round_duration_seconds: 900,
        is_active: true
    };

    const [token0Symbol, token1Symbol] = job.metadata.pair_name.split('/') || ['cbBTC', 'USDC'];

    const hasFinancialData = (tvl?.tvl_usd || 0) > 0;

    // Build performance chart data from real TVL history
    const tvlSeries = tvlHistory?.series || [];
    const performanceData = tvlSeries.map((pt: any) => {
        const d = new Date(pt.timestamp);
        const time = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
            time,
            forever: pt.tvl_usd || 0,
            lp: (pt.tvl_usd || 0) - (pt.revenue_usd || 0),
            holding: (pt.tvl_usd || 0) - (pt.pnl_usd || 0),
        };
    });

    return (
        <AdminLayout
            title={`${token0Symbol} / ${token1Symbol} | Aerodrome | Base`}
            description={`POOL — ${job.sn_liquidity_manager_address}`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-4 pb-20 animate-fade-in">
                {/* Header Actions & Breadcrumb */}
                <div className="flex items-center justify-between h-12">
                    <Link
                        href="/admin/pairs"
                        className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-primary/40 hover:text-primary transition-colors group"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Back to Pairs</span>
                    </Link>
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-bold uppercase tracking-widest border border-green-100/50">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span>Active</span>
                            <span className="text-green-200">|</span>
                            <span>{stats?.active_miners_24h || 0} miners</span>
                        </div>
                        <a
                            href={`https://basescan.org/address/${job.sn_liquidity_manager_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-primary/40 hover:text-primary transition-colors flex items-center space-x-2 uppercase tracking-widest"
                        >
                            <span>View on BaseScan</span>
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>

                {/* Main Metrics Row */}
                {hasFinancialData ? (
                    <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                        <MetricBox label="TVL (USD)" value={formatUsd(tvl?.tvl_usd)} />
                        <MetricBox label="Fees Earned (30D)" value={formatUsd(revenue?.revenue_usd)} />
                        <MetricBox
                            label={`APY ${token0Symbol} / ${token1Symbol} / USD`}
                            value={`${(apy?.apy_percent_token0 || 0).toFixed(1)}% / ${(apy?.apy_percent_token1 || 0).toFixed(1)}% / ${(apy?.apy_percent || 0).toFixed(1)}%`}
                            isApy
                        />
                        <MetricBox label="Active Miners (24h)" value={stats?.active_miners_24h?.toString() || "0"} subvalue={`${stats?.total_miners || 0} total`} />
                        <MetricBox label={`Avg TVL (${token0Symbol})`} value={formatTokenAmount(apy?.avg_tvl_token0, token0Symbol)} />
                        <MetricBox label={`Avg TVL (${token1Symbol})`} value={formatTokenAmount(apy?.avg_tvl_token1, token1Symbol)} />
                        <MetricBox label="Net PnL" value={formatUsd(pnl?.pnl_usd)} highlight />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <MetricBox
                            label="Total Rounds"
                            value={String(activity?.round_outcomes.total_rounds || 0)}
                        />
                        <MetricBox
                            label="Eval / Live"
                            value={`${activity?.round_outcomes.eval_rounds || 0} / ${activity?.round_outcomes.live_rounds || 0}`}
                        />
                        <MetricBox
                            label="Completion Rate"
                            value={`${activity?.round_outcomes.completion_rate || 0}%`}
                        />
                        <MetricBox
                            label="Active Miners (24h)"
                            value={String(activity?.miner_activity.active_miners_24h || 0)}
                            subvalue={`${activity?.miner_activity.total_miners || 0} total`}
                        />
                        <MetricBox
                            label="Avg Response Time"
                            value={`${(activity?.miner_activity.avg_response_time_ms || 0).toFixed(0)}ms`}
                        />
                        <MetricBox
                            label="Top Score"
                            value={(activity?.score_stats.top_combined_score || 0).toFixed(4)}
                            highlight
                        />
                    </div>
                )}

                {/* Performance Chart Section (only when financial data exists) */}
                {hasFinancialData && (
                    <div className="bg-white border border-cream-dark p-4 md:p-8 rounded-[32px] shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex flex-col space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30 whitespace-nowrap">Performance Over Time</h3>
                                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                                    <ChartLegend label="ForeverMoney" color="#3B82F6" />
                                    <ChartLegend label="Full-range LP" color="#0D1117" />
                                    <ChartLegend label="Holding" color="#3B82F6" opacity={0.5} />
                                </div>
                            </div>
                            <div className="flex bg-cream/20 p-1 rounded-full border border-cream-dark/30 self-start md:self-auto overflow-x-auto max-w-full">
                                {['1D', '7D', '30D', 'ALL'].map((tf) => (
                                    <button
                                        key={tf}
                                        className={`px-3 py-1 text-[9px] font-bold rounded-full transition-all whitespace-nowrap ${tf === '30D' ? 'bg-primary text-white shadow-md' : 'text-primary/40 hover:text-primary'}`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-[300px] w-full relative">
                            {performanceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={performanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#F2EDE4" />
                                        <XAxis
                                            dataKey="time"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }}
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #F2EDE4', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 700 }}
                                        />
                                        <Line type="monotone" dataKey="forever" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                                        <Line type="monotone" dataKey="lp" stroke="#0D1117" strokeWidth={1.5} dot={false} />
                                        <Line type="monotone" dataKey="holding" stroke="#3B82F6" strokeWidth={1.2} strokeOpacity={0.4} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                                    Collecting performance data...
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex items-center justify-between pt-6 border-t border-cream-dark/30">
                            <span className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">Data Source: Hyperliquid</span>
                            <span className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">12M Cycles</span>
                        </div>
                    </div>
                )}

                {/* Recent Rounds Table */}
                <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Recent Rounds</h3>
                            <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Last {roundsData?.rounds?.length || 0} rounds</p>
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                            {roundsData?.total_rounds || 0} Total
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-cream/5">
                                <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                    <th className="pl-8 py-4">Round #</th>
                                    <th className="py-4">Type</th>
                                    <th className="py-4">Winner</th>
                                    <th className="py-4">Participants</th>
                                    <th className="py-4">Duration</th>
                                    <th className="py-4">Status</th>
                                    <th className="py-4">Tx</th>
                                    <th className="py-4 text-right pr-8">Time</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-bold">
                                {(roundsData?.rounds || []).map((round) => {
                                    const duration = round.start_time && round.end_time
                                        ? (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) / 1000
                                        : 0;
                                    return (
                                        <tr key={round.round_id} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors">
                                            <td className="pl-8 py-4 text-primary">#{round.round_number}</td>
                                            <td className="py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                                    round.round_type === 'live'
                                                        ? 'bg-green-50 text-green-600 border border-green-100'
                                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                }`}>
                                                    {round.round_type}
                                                </span>
                                            </td>
                                            <td className="py-4 text-primary/70">
                                                {round.winner_uid !== null ? `UID ${round.winner_uid}` : '—'}
                                            </td>
                                            <td className="py-4 text-primary/60">{round.participants_count}</td>
                                            <td className="py-4 text-primary/60">{formatDuration(duration)}</td>
                                            <td className="py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                                    round.status === 'completed'
                                                        ? 'bg-green-50 text-green-600'
                                                        : 'bg-yellow-50 text-yellow-600'
                                                }`}>
                                                    {round.status}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                {round.execution?.tx_hash ? (
                                                    <a
                                                        href={`https://basescan.org/tx/${round.execution.tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center space-x-1 text-blue-500 hover:text-blue-700 transition-colors"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                            round.execution.tx_status === 'success' ? 'bg-green-500' :
                                                            round.execution.tx_status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                                        }`} />
                                                        <span className="font-mono text-[9px]">{round.execution.tx_hash.slice(0, 8)}...</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-primary/20">—</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-right pr-8 text-primary/40">
                                                {timeAgo(round.end_time || round.start_time)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!roundsData?.rounds || roundsData.rounds.length === 0) && (
                                    <tr><td colSpan={8} className="py-8 text-center text-primary/20 text-xs font-bold uppercase tracking-widest">No rounds yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Miner Leaderboard (replaces Active Vaults when no financial data) */}
                {hasFinancialData ? (
                    <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Active Vaults</h3>
                                <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Live Execution Records</p>
                            </div>
                            <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                                {miners?.length || 0} Active
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-cream/5">
                                    <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                        <th className="pl-8 py-4">Vault No.</th>
                                        <th className="py-4">Miner</th>
                                        <th className="py-4 whitespace-nowrap">TVL</th>
                                        <th className="py-4 whitespace-nowrap">Fees USD</th>
                                        <th className="py-4 whitespace-nowrap text-blue-600">Fees {token0Symbol}</th>
                                        <th className="py-4 whitespace-nowrap text-blue-600">Fees {token1Symbol}</th>
                                        <th className="py-4 whitespace-nowrap text-blue-600">APY {token0Symbol}</th>
                                        <th className="py-4 whitespace-nowrap text-blue-600">APY {token1Symbol}</th>
                                        <th className="py-4 whitespace-nowrap text-blue-600 text-right pr-4">APY (USD)</th>
                                        <th className="pr-8 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px] font-bold">
                                    {(miners || []).map((miner, i) => (
                                        <tr key={miner.miner_uid} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors group cursor-pointer">
                                            <td className="pl-8 py-4 text-primary/40">Vault #{miner.miner_uid}</td>
                                            <td className="py-4">
                                                <div className="flex flex-col">
                                                    <span>{miner.miner_hotkey?.slice(0, 10)}...</span>
                                                    <span className="text-[8px] text-primary/20 uppercase tracking-tighter">UID: {miner.miner_uid}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 text-blue-600">{formatUsd(tvl?.tvl_usd ? tvl.tvl_usd / (miners?.length || 1) : 0)}</td>
                                            <td className="py-4 text-blue-500">{formatUsd(revenue?.revenue_usd ? revenue.revenue_usd / (miners?.length || 1) : 0)}</td>
                                            <td className="py-4 text-blue-500">{(revenue?.revenue_token0 ? revenue.revenue_token0 / (miners?.length || 1) : 0).toFixed(4)}</td>
                                            <td className="py-4 text-blue-500">{(revenue?.revenue_token1 ? revenue.revenue_token1 / (miners?.length || 1) : 0).toFixed(4)}</td>
                                            <td className="py-4 text-blue-500">{(apy?.apy_percent_token0 || 0).toFixed(1)}%</td>
                                            <td className="py-4 text-blue-500">{(apy?.apy_percent_token1 || 0).toFixed(1)}%</td>
                                            <td className="py-4 text-blue-600 text-right pr-4">{(apy?.apy_percent || 0).toFixed(1)}%</td>
                                            <td className="pr-8 py-4 text-right">
                                                <ChevronRight size={12} className="inline text-blue-600 transition-transform group-hover:translate-x-1" />
                                            </td>
                                        </tr>
                                    ))}
                                    {(!miners || miners.length === 0) && (
                                        <tr><td colSpan={10} className="py-8 text-center text-primary/20">No active vaults</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Miner Leaderboard</h3>
                                <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Ranked by combined score</p>
                            </div>
                            <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                                {miners?.length || 0} Miners
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-cream/5">
                                    <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                        <th className="pl-8 py-4">#</th>
                                        <th className="py-4">Miner</th>
                                        <th className="py-4 text-right">Combined</th>
                                        <th className="py-4 text-right">Eval</th>
                                        <th className="py-4 text-right">Live</th>
                                        <th className="py-4 text-right">Rounds</th>
                                        <th className="py-4">Status</th>
                                        <th className="pr-8 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px] font-bold">
                                    {(miners || []).map((miner, i) => (
                                        <Link
                                            key={miner.miner_uid}
                                            href={`/admin/miners/${miner.miner_uid}?pair=${jobId}`}
                                            className="contents"
                                        >
                                            <tr className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors group cursor-pointer">
                                                <td className="pl-8 py-4 text-primary/40">{i + 1}</td>
                                                <td className="py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono">{miner.miner_hotkey?.slice(0, 10)}...</span>
                                                        <span className="text-[8px] text-primary/20 uppercase tracking-tighter">UID {miner.miner_uid}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right text-primary font-mono">{miner.combined_score.toFixed(4)}</td>
                                                <td className="py-4 text-right text-blue-500 font-mono">{miner.evaluation_score.toFixed(4)}</td>
                                                <td className="py-4 text-right text-green-600 font-mono">{miner.live_score.toFixed(4)}</td>
                                                <td className="py-4 text-right text-primary/60">{miner.total_evaluations + miner.total_live_rounds}</td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                                        miner.is_active
                                                            ? 'bg-green-50 text-green-600 border border-green-100'
                                                            : 'bg-gray-50 text-gray-400 border border-gray-100'
                                                    }`}>
                                                        {miner.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="pr-8 py-4 text-right">
                                                    <ChevronRight size={12} className="inline text-blue-600 transition-transform group-hover:translate-x-1" />
                                                </td>
                                            </tr>
                                        </Link>
                                    ))}
                                    {(!miners || miners.length === 0) && (
                                        <tr><td colSpan={8} className="py-8 text-center text-primary/20 text-xs font-bold uppercase tracking-widest">No miners registered</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Recent Executions Section */}
                {executions && executions.length > 0 && (
                    <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Recent Executions</h3>
                                <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Live execution attempts</p>
                            </div>
                            <div className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                                {executions.length} Executions
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-cream/5">
                                    <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                        <th className="pl-8 py-4">Round #</th>
                                        <th className="py-4">Miner UID</th>
                                        <th className="py-4">Status</th>
                                        <th className="py-4">Tx Hash</th>
                                        <th className="py-4 text-right pr-8">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px] font-bold">
                                    {executions.map((exec) => (
                                        <tr key={exec.execution_id} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors">
                                            <td className="pl-8 py-4 text-primary">#{exec.round_number}</td>
                                            <td className="py-4 text-primary/70">UID {exec.miner_uid}</td>
                                            <td className="py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                                    exec.tx_status === 'success'
                                                        ? 'bg-green-50 text-green-600 border border-green-100'
                                                        : exec.tx_status === 'failed'
                                                        ? 'bg-red-50 text-red-600 border border-red-100'
                                                        : 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                                }`}>
                                                    {exec.tx_status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                {exec.tx_hash ? (
                                                    <a
                                                        href={`https://basescan.org/tx/${exec.tx_hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center space-x-1 text-blue-500 hover:text-blue-700 transition-colors"
                                                    >
                                                        <span className="font-mono text-[9px]">{exec.tx_hash.slice(0, 12)}...</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-primary/20">—</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-right pr-8 text-primary/40">
                                                {timeAgo(exec.executed_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Miner Activity Section */}
                {activity && (
                    <div className="space-y-3">
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <MetricBox
                                label="Active Miners (24h)"
                                value={String(activity.miner_activity.active_miners_24h)}
                                subvalue={`${activity.miner_activity.total_miners} total`}
                            />
                            <MetricBox
                                label="Avg Response Time"
                                value={`${activity.miner_activity.avg_response_time_ms.toFixed(0)}ms`}
                            />
                            <MetricBox
                                label="Avg Combined Score"
                                value={activity.score_stats.avg_combined_score.toFixed(4)}
                                subvalue={`Top: ${activity.score_stats.top_combined_score.toFixed(4)}`}
                            />
                            <MetricBox
                                label="Round Completion"
                                value={`${activity.round_outcomes.completion_rate}%`}
                                subvalue={`${activity.round_outcomes.total_rounds} rounds`}
                            />
                        </div>

                        {/* Round Breakdown + Score Distribution */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Round Breakdown */}
                            <div className="bg-white border border-cream-dark p-6 rounded-[24px] shadow-sm">
                                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/30 mb-4">Round Breakdown</h4>
                                <div className="space-y-3 text-[10px] font-bold">
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Evaluation Rounds</span>
                                        <span className="text-primary">{activity.round_outcomes.eval_rounds}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Live Rounds</span>
                                        <span className="text-primary">{activity.round_outcomes.live_rounds}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Avg Duration</span>
                                        <span className="text-primary">{activity.round_outcomes.avg_round_duration_seconds > 0 ? `${Math.round(activity.round_outcomes.avg_round_duration_seconds)}s` : '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Score Distribution */}
                            <div className="bg-white border border-cream-dark p-6 rounded-[24px] shadow-sm">
                                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/30 mb-4">Score Distribution</h4>
                                <div className="space-y-3 text-[10px] font-bold">
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Min</span>
                                        <span className="text-primary">{activity.score_stats.score_distribution.min.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Q25</span>
                                        <span className="text-primary">{activity.score_stats.score_distribution.q25.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Median</span>
                                        <span className="text-primary">{activity.score_stats.score_distribution.q50.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Q75</span>
                                        <span className="text-primary">{activity.score_stats.score_distribution.q75.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Max</span>
                                        <span className="text-primary">{activity.score_stats.score_distribution.max.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Winners Table */}
                        {activity.win_distribution.length > 0 && (
                            <div className="bg-white border border-cream-dark rounded-[24px] shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-cream-dark/50">
                                    <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/30">Top Winners</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-cream/5">
                                            <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                                <th className="pl-6 py-3">Miner UID</th>
                                                <th className="py-3">Hotkey</th>
                                                <th className="py-3 text-right">Wins</th>
                                                <th className="py-3 text-right pr-6">Win Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[10px] font-bold">
                                            {activity.win_distribution.map((w) => (
                                                <tr key={w.miner_uid} className="border-b border-cream-dark/20 last:border-0">
                                                    <td className="pl-6 py-3 text-primary">UID {w.miner_uid}</td>
                                                    <td className="py-3 text-primary/60 font-mono">{w.miner_hotkey.slice(0, 10)}...</td>
                                                    <td className="py-3 text-right text-blue-600">{w.wins}</td>
                                                    <td className="py-3 text-right pr-6 text-green-600">{w.win_rate}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Pair Configuration Section */}
                <div className="bg-white border border-cream-dark p-8 rounded-[32px] shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30 mb-6 pb-4 border-b border-cream-dark/30">Pair Configuration</h3>
                    <div className="space-y-4">
                        <ConfigEntry label="Pair Address" value={job.pair_address} isMono />
                        <ConfigEntry label="Vault Address" value={job.sn_liquidity_manager_address} isMono />
                        <ConfigEntry label="Fee Rate" value={formatFeeRate(job.fee_rate)} />
                        <ConfigEntry label="Target Ratio" value={`${((job.target_ratio || 0) * 100).toFixed(0)}%`} />
                        <ConfigEntry label="Round Duration" value={`${job.round_duration_seconds}s (${Math.round((job.round_duration_seconds || 0) / 60)}m)`} />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricBox({ label, value, subvalue, highlight, isApy }: { label: string; value: string; subvalue?: string; highlight?: boolean; isApy?: boolean }) {
    return (
        <div className={`bg-white border border-cream-dark p-5 rounded-[20px] shadow-sm flex flex-col justify-between hover:shadow-md transition-all group ${highlight ? 'bg-cream/5 border-primary/10' : ''}`}>
            <span className="text-[8px] font-bold text-primary/30 uppercase tracking-widest leading-none mb-4 group-hover:text-primary transition-colors">{label}</span>
            <div>
                <span className={`text-base font-black tracking-tighter leading-tight block ${highlight ? 'text-primary' : 'text-primary/70 group-hover:text-primary'}`}>
                    {value}
                </span>
                {subvalue && (
                    <p className={`text-[8px] font-bold uppercase mt-1 ${isApy ? 'text-primary/10' : 'text-primary/30'}`}>
                        {subvalue}
                    </p>
                )}
            </div>
        </div>
    );
}

function ConfigEntry({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-bold text-primary gap-1 sm:gap-0">
            <span className="text-primary/20 uppercase tracking-widest">{label}</span>
            <span className={`${isMono ? 'font-mono' : ''} truncate max-w-full sm:max-w-none`}>{value}</span>
        </div>
    );
}

function ChartLegend({ label, color, opacity = 1 }: { label: string; color: string; opacity?: number }) {
    return (
        <div className="flex items-center space-x-2" style={{ opacity }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/30">{label}</span>
        </div>
    );
}

function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(isoStr: string | null): string {
    if (!isoStr) return '—';
    try { return formatDistanceToNow(new Date(isoStr), { addSuffix: true }); }
    catch { return isoStr; }
}
