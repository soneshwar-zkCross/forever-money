'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    ExternalLink,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { useJobs, useNetworkStats, useLeaderboard, useJobAPY, useJobPnL, useJobTVL, useJobRevenue, useJobActivity, useAllRounds, useExecutions, usePoolOnchainState, useVaultOnchainState, useMetagraph, useBaseScanTransactions, refreshVaultData } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { MetagraphNeuron } from '@/lib/api';
import { useJobTVLHistory } from '@/lib/metrics-hooks';
import { formatUsd, formatFeeRate } from '@/lib/format';
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const router = useRouter();
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);
    const { data: revenue } = useJobRevenue(jobId, 30);
    const { data: miners } = useLeaderboard(jobId);
    const { data: activity } = useJobActivity(jobId);
    const { data: tvlHistory } = useJobTVLHistory(jobId, 30);
    const { data: roundsData } = useAllRounds(jobId, 20);
    const { data: executions } = useExecutions(jobId);
    const { data: poolState, isLoading: poolLoading, refetch: refetchPool } = usePoolOnchainState(jobId);
    const { data: vaultState, isLoading: vaultLoading, refetch: refetchVault } = useVaultOnchainState(jobId);
    const queryClient = useQueryClient();

    const handleRefreshOnchain = async () => {
        // Server-side: expire cache, fetch fresh from RPC, cache the result
        await refreshVaultData(jobId);
        // Client-side: refetch from server (now has fresh data)
        await Promise.all([refetchPool(), refetchVault()]);
        queryClient.invalidateQueries({ queryKey: ['vaults-summary'] });
    };
    const { data: metagraph } = useMetagraph();

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

    const { data: basescanTxs } = useBaseScanTransactions(job.sn_liquidity_manager_address);

    // Derive token symbols: on-chain data > job_id > metadata
    const jobIdParts = jobId.replace(/[-_]/g, '/').toUpperCase().split('/');
    const fallbackT0 = jobIdParts[0] || '?';
    const fallbackT1 = jobIdParts[1] || '?';

    const hasFinancialData = (tvl?.tvl_usd || 0) > 0;

    // Use on-chain vault value as fallback when TVL endpoint returns 0
    const vaultTotalUsd = vaultState?.total_value_usd || 0;

    // Metagraph lookup
    const metagraphByUid: Record<number, MetagraphNeuron> = {};
    if (metagraph?.neurons) {
        for (const n of metagraph.neurons) {
            metagraphByUid[n.uid] = n;
        }
    }

    // Build performance chart data
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

    // Token symbols: prefer on-chain data, fallback to job_id parts
    const t0 = vaultState?.token0?.symbol || poolState?.token0?.symbol || fallbackT0;
    const t1 = vaultState?.token1?.symbol || poolState?.token1?.symbol || fallbackT1;

    return (
        <AdminLayout
            title={`${t0} / ${t1} | Aerodrome | Base`}
            description={`POOL — ${job.pair_address}`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-4 pb-20 animate-fade-in">
                {/* Header */}
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

                {/* Metrics Row — filled with on-chain + operational data */}
                <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                    <MetricBox
                        label="Pool Price"
                        value={poolState?.pool_price
                            ? (poolState.pool_price < 0.01 ? poolState.pool_price.toExponential(3) : poolState.pool_price.toFixed(poolState.pool_price > 100 ? 2 : 6))
                            : '—'}
                        subvalue={`${t1}/${t0}`}
                        loading={poolLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label={`${t0} Price`}
                        value={poolState?.token0?.price_usd ? `$${poolState.token0.price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : formatUsd(tvl?.token0_price_usd)}
                        loading={poolLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label={`${t1} Price`}
                        value={poolState?.token1?.price_usd ? `$${poolState.token1.price_usd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : formatUsd(tvl?.token1_price_usd)}
                        loading={poolLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label="Vault TVL"
                        value={hasFinancialData ? formatUsd(tvl?.tvl_usd) : (vaultTotalUsd > 0 ? `$${vaultTotalUsd.toFixed(2)}` : '—')}
                        subvalue={vaultState?.deployed_value_usd != null && vaultState?.idle_value_usd != null
                            ? `$${vaultState.deployed_value_usd.toFixed(2)} in pool · $${vaultState.idle_value_usd.toFixed(2)} idle`
                            : undefined}
                        highlight
                        loading={vaultLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label="Active Miners (24h)"
                        value={String(activity?.miner_activity.active_miners_24h || stats?.active_miners_24h || 0)}
                        subvalue={`${activity?.miner_activity.total_miners || stats?.total_miners || 0} total`}
                    />
                    <MetricBox
                        label="Total Rounds"
                        value={String(activity?.round_outcomes.total_rounds || 0)}
                        subvalue={`${activity?.round_outcomes.eval_rounds || 0} eval / ${activity?.round_outcomes.live_rounds || 0} live`}
                    />
                    <MetricBox
                        label="Completion Rate"
                        value={`${activity?.round_outcomes.completion_rate || 0}%`}
                        subvalue={`Top score: ${(activity?.score_stats.top_combined_score || 0).toFixed(4)}`}
                    />
                </div>

                {/* Second metrics row — financial when available, operational always */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <MetricBox
                        label="Pool Fee"
                        value={poolState?.fee ? `${(poolState.fee / 10000).toFixed(2)}%` : '—'}
                        loading={poolLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label="Current Tick"
                        value={poolState?.slot0?.tick?.toLocaleString() || '—'}
                        loading={poolLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label="Positions"
                        value={vaultState?.positions ? `${vaultState.positions.length} active` : '—'}
                        loading={vaultLoading}
                        onRefresh={handleRefreshOnchain}
                    />
                    <MetricBox
                        label="Avg Response Time"
                        value={`${(activity?.miner_activity.avg_response_time_ms || 0).toFixed(0)}ms`}
                    />
                    <MetricBox
                        label="Fees Earned (30D)"
                        value={formatUsd(revenue?.revenue_usd)}
                    />
                    <MetricBox
                        label="Net PnL"
                        value={formatUsd(pnl?.pnl_usd)}
                        highlight
                    />
                </div>

                {/* Vault Positions — in-pool liquidity ranges */}
                {vaultState?.positions && vaultState.positions.length > 0 && (
                    <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Vault Positions</h3>
                                <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">
                                    {vaultState.positions.length} active position{vaultState.positions.length !== 1 ? 's' : ''} in pool
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">Deployed</span>
                                <div className="text-sm font-black text-primary">${(vaultState.deployed_value_usd || 0).toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-cream/5">
                                    <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                        <th className="pl-8 py-4">#</th>
                                        <th className="py-4">Tick Range</th>
                                        <th className="py-4">Price Range ({t1}/{t0})</th>
                                        <th className="py-4 text-right">{t0}</th>
                                        <th className="py-4 text-right">{t1}</th>
                                        <th className="py-4 text-right pr-8">Value USD</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px] font-bold">
                                    {vaultState.positions.map((pos, i) => {
                                        const val0 = pos.amount0 * (vaultState.token0?.price_usd || 0);
                                        const val1 = pos.amount1 * (vaultState.token1?.price_usd || 0);
                                        const inRange = poolState?.slot0?.tick != null
                                            && poolState.slot0.tick >= pos.tick_lower
                                            && poolState.slot0.tick < pos.tick_upper;
                                        return (
                                            <tr key={i} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors">
                                                <td className="pl-8 py-4 text-primary/40">{i + 1}</td>
                                                <td className="py-4 font-mono text-primary/60">
                                                    {pos.tick_lower.toLocaleString()} → {pos.tick_upper.toLocaleString()}
                                                    {inRange && <span className="ml-2 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase bg-green-50 text-green-600 border border-green-100">In Range</span>}
                                                </td>
                                                <td className="py-4 font-mono text-primary/60">
                                                    {isFullRange(pos.tick_lower, pos.tick_upper)
                                                        ? <span className="text-primary/40 italic">Full Range</span>
                                                        : <>{formatPrice(pos.price_lower)} → {formatPrice(pos.price_upper)}</>
                                                    }
                                                </td>
                                                <td className="py-4 text-right font-mono">{pos.amount0.toFixed(pos.amount0 > 1 ? 4 : 8)}</td>
                                                <td className="py-4 text-right font-mono">{pos.amount1.toFixed(pos.amount1 > 1 ? 2 : 6)}</td>
                                                <td className="py-4 text-right pr-8 font-black">${(val0 + val1).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Idle inventory row */}
                        {(vaultState.token0?.idle || 0) > 0 || (vaultState.token1?.idle || 0) > 0 ? (
                            <div className="px-8 py-4 bg-cream/5 border-t border-cream-dark/30 flex items-center justify-between text-[10px] font-bold text-primary/40">
                                <span className="uppercase tracking-widest">Idle in vault (not in pool)</span>
                                <span className="font-mono">
                                    {(vaultState.token0?.idle || 0).toFixed(4)} {t0} + {(vaultState.token1?.idle || 0).toFixed(2)} {t1}
                                    <span className="ml-3 font-black text-primary/60">${(vaultState.idle_value_usd || 0).toFixed(2)}</span>
                                </span>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Performance Chart (when data exists) */}
                {performanceData.length > 0 && (
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
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#F2EDE4" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }} tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #F2EDE4', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 700 }} />
                                    <Line type="monotone" dataKey="forever" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="lp" stroke="#0D1117" strokeWidth={1.5} dot={false} />
                                    <Line type="monotone" dataKey="holding" stroke="#3B82F6" strokeWidth={1.2} strokeOpacity={0.4} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-6 flex items-center justify-between pt-6 border-t border-cream-dark/30">
                            <span className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">Data Source: Hyperliquid</span>
                            <span className="text-[9px] font-bold text-primary/20 uppercase tracking-widest">12M Cycles</span>
                        </div>
                    </div>
                )}

                {/* Recent Rounds */}
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

                {/* Miner Leaderboard */}
                <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Miner Leaderboard</h3>
                            <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">
                                {metagraph?.block ? `Block #${metagraph.block.toLocaleString()}` : 'Ranked by combined score'}
                            </p>
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
                                    <th className="py-4 text-right">Stake</th>
                                    <th className="py-4 text-right">Incentive</th>
                                    <th className="py-4 text-right">Emission</th>
                                    <th className="py-4">Axon</th>
                                    <th className="py-4">Status</th>
                                    <th className="pr-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-bold">
                                {(miners || []).map((miner, i) => {
                                    const meta = metagraphByUid[miner.miner_uid];
                                    return (
                                            <tr key={miner.miner_uid} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors group cursor-pointer"
                                                onClick={() => router.push(`/admin/miners/${miner.miner_uid}?pair=${jobId}`)}>
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
                                                <td className="py-4 text-right text-primary/60 font-mono">
                                                    {meta ? (meta.stake > 0 ? meta.stake.toFixed(2) : '0') : '—'}
                                                </td>
                                                <td className="py-4 text-right font-mono">
                                                    {meta ? (
                                                        <span className={meta.incentive > 0 ? 'text-green-600' : 'text-primary/30'}>
                                                            {meta.incentive > 0 ? meta.incentive.toFixed(4) : '0'}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-4 text-right font-mono">
                                                    {meta ? (
                                                        <span className={meta.emission > 0 ? 'text-blue-600' : 'text-primary/30'}>
                                                            {meta.emission > 0 ? meta.emission.toFixed(4) : '0'}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-4">
                                                    {meta?.axon ? (
                                                        <div className="flex items-center space-x-1">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${meta.axon.is_serving ? 'bg-green-500' : 'bg-red-400'}`} />
                                                            <span className="font-mono text-[8px] text-primary/30">{meta.axon.ip}:{meta.axon.port}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-primary/20">—</span>
                                                    )}
                                                </td>
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
                                    );
                                })}
                                {(!miners || miners.length === 0) && (
                                    <tr><td colSpan={12} className="py-8 text-center text-primary/20 text-xs font-bold uppercase tracking-widest">No miners registered</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Executions */}
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

                {/* On-Chain Transactions */}
                {basescanTxs && basescanTxs.length > 0 && (
                    <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">On-Chain Transactions</h3>
                                <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Vault transactions on Base</p>
                            </div>
                            <a
                                href={`https://basescan.org/address/${job.sn_liquidity_manager_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 text-[9px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-widest"
                            >
                                <span>View All</span>
                                <ExternalLink size={10} />
                            </a>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-cream/5">
                                    <tr className="text-[9px] text-primary/20 font-bold uppercase tracking-widest border-b border-cream-dark/50">
                                        <th className="pl-8 py-4">Tx Hash</th>
                                        <th className="py-4">Method</th>
                                        <th className="py-4">From</th>
                                        <th className="py-4">Status</th>
                                        <th className="py-4">Block</th>
                                        <th className="py-4 text-right pr-8">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px] font-bold">
                                    {basescanTxs.slice(0, 15).map((tx) => {
                                        const methodName = tx.functionName ? tx.functionName.split('(')[0] : tx.input?.slice(0, 10) || '—';
                                        return (
                                            <tr key={tx.hash} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors">
                                                <td className="pl-8 py-4">
                                                    <a
                                                        href={`https://basescan.org/tx/${tx.hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center space-x-1 text-blue-500 hover:text-blue-700 transition-colors font-mono"
                                                    >
                                                        <span>{tx.hash.slice(0, 10)}...</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                </td>
                                                <td className="py-4">
                                                    <span className="px-2 py-0.5 bg-cream/30 text-primary/60 rounded text-[8px] font-mono">
                                                        {methodName}
                                                    </span>
                                                </td>
                                                <td className="py-4 font-mono text-primary/50">
                                                    {tx.from.slice(0, 8)}...{tx.from.slice(-4)}
                                                </td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                                        tx.isError === '0'
                                                            ? 'bg-green-50 text-green-600'
                                                            : 'bg-red-50 text-red-600'
                                                    }`}>
                                                        {tx.isError === '0' ? 'Success' : 'Failed'}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-primary/40 font-mono">{Number(tx.blockNumber).toLocaleString()}</td>
                                                <td className="py-4 text-right pr-8 text-primary/40">
                                                    {timeAgo(new Date(Number(tx.timeStamp) * 1000).toISOString())}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Miner Activity */}
                {activity && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <MetricBox
                                label="Avg Combined Score"
                                value={activity.score_stats.avg_combined_score.toFixed(4)}
                                subvalue={`Top: ${activity.score_stats.top_combined_score.toFixed(4)}`}
                            />
                            <MetricBox
                                label="Avg Round Duration"
                                value={activity.round_outcomes.avg_round_duration_seconds > 0 ? `${Math.round(activity.round_outcomes.avg_round_duration_seconds)}s` : '—'}
                            />
                            <MetricBox
                                label={`APY ${t0} / ${t1}`}
                                value={`${(apy?.apy_percent_token0 || 0).toFixed(1)}% / ${(apy?.apy_percent_token1 || 0).toFixed(1)}%`}
                            />
                            <MetricBox
                                label="APY (USD)"
                                value={`${(apy?.apy_percent || 0).toFixed(1)}%`}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="bg-white border border-cream-dark p-6 rounded-[24px] shadow-sm">
                                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/30 mb-4">Score Distribution</h4>
                                <div className="space-y-3 text-[10px] font-bold">
                                    {(['min', 'q25', 'q50', 'q75', 'max'] as const).map((key) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-primary/40">{key === 'q50' ? 'Median' : key.toUpperCase()}</span>
                                            <span className="text-primary">{activity.score_stats.score_distribution[key].toFixed(4)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Vault Info from on-chain */}
                            <div className="bg-white border border-cream-dark p-6 rounded-[24px] shadow-sm">
                                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/30 mb-4">Vault Details</h4>
                                <div className="space-y-3 text-[10px] font-bold">
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Owner</span>
                                        <span className="text-primary font-mono">{vaultState?.owner ? `${vaultState.owner.slice(0, 8)}...${vaultState.owner.slice(-4)}` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Operator</span>
                                        <span className="text-primary font-mono">{vaultState?.operator ? `${vaultState.operator.slice(0, 8)}...${vaultState.operator.slice(-4)}` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Fee Split</span>
                                        <span className="text-primary">{vaultState?.fee_split != null ? `${vaultState.fee_split}%` : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Metagraph Neurons</span>
                                        <span className="text-primary">{metagraph?.total_neurons || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-primary/40">Subnet</span>
                                        <span className="text-primary">{metagraph?.netuid || 98}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

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

                {/* Pair Configuration */}
                <div className="bg-white border border-cream-dark p-8 rounded-[32px] shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30 mb-6 pb-4 border-b border-cream-dark/30">Pair Configuration</h3>
                    <div className="space-y-4">
                        <ConfigEntry label="Pair Address" value={job.pair_address} isMono />
                        <ConfigEntry label="Vault Address" value={job.sn_liquidity_manager_address} isMono />
                        {poolState?.token0 && <ConfigEntry label={`Token0 (${poolState.token0.symbol})`} value={poolState.token0.address} isMono />}
                        {poolState?.token1 && <ConfigEntry label={`Token1 (${poolState.token1.symbol})`} value={poolState.token1.address} isMono />}
                        <ConfigEntry label="Fee Rate" value={formatFeeRate(job.fee_rate)} />
                        <ConfigEntry label="Target Ratio" value={`${((job.target_ratio || 0) * 100).toFixed(0)}%`} />
                        <ConfigEntry label="Round Duration" value={`${job.round_duration_seconds}s (${Math.round((job.round_duration_seconds || 0) / 60)}m)`} />
                        <ConfigEntry label="Chain" value={`Base (${poolState?.chain_id || 8453})`} />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricBox({ label, value, subvalue, highlight, isApy, loading, onRefresh }: { label: string; value: string; subvalue?: string; highlight?: boolean; isApy?: boolean; loading?: boolean; onRefresh?: () => void }) {
    const showSyncing = loading && value !== '—' && value !== '$0.00';
    const [spinning, setSpinning] = React.useState(false);

    const handleClick = async () => {
        if (!onRefresh || spinning) return;
        setSpinning(true);
        try { onRefresh(); } finally { setTimeout(() => setSpinning(false), 2000); }
    };

    return (
        <div className={`bg-white border border-cream-dark p-5 rounded-[20px] shadow-sm flex flex-col justify-between hover:shadow-md transition-all group ${highlight ? 'bg-cream/5 border-primary/10' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-[8px] font-bold text-primary/30 uppercase tracking-widest leading-none group-hover:text-primary transition-colors">{label}</span>
                {showSyncing ? (
                    <span className="text-[7px] font-bold uppercase tracking-widest text-amber-500 animate-pulse">Syncing</span>
                ) : onRefresh ? (
                    <button onClick={handleClick} className="text-primary/15 hover:text-primary/50 transition-colors" title="Refresh">
                        <RefreshCw size={10} className={spinning ? 'animate-spin' : ''} />
                    </button>
                ) : null}
            </div>
            <div>
                {loading && (value === '—' || value === '$0.00' || value === '0') ? (
                    <div className="h-5 w-20 bg-cream-dark/30 rounded animate-pulse" />
                ) : (
                    <span className={`text-base font-black tracking-tighter leading-tight block ${highlight ? 'text-primary' : 'text-primary/70 group-hover:text-primary'}`}>
                        {value}
                    </span>
                )}
                {subvalue && !loading && (
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

function isFullRange(tickLower: number, tickUpper: number): boolean {
    // Full-range ticks are typically at or near the min/max tick bounds
    return tickLower <= -887200 || tickUpper >= 887200;
}

function formatPrice(price: number): string {
    if (price === 0) return '0';
    if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.001) return price.toFixed(6);
    if (price >= 0.000001) return price.toFixed(9);
    return price.toFixed(12);
}

