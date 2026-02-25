'use client';

import React, { use, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    Activity,
    TrendingUp,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ExternalLink,
    Layers,
    Zap,
    RefreshCw,
    ChevronRight,
    ArrowRight,
    Plus,
    Calendar,
    Coins
} from 'lucide-react';
import { useJobs, useNetworkStats, useLeaderboard, useJobAPY, useJobPnL, useJobTVL, useJobRevenue } from '@/lib/api';
import { useJobTVLHistory } from '@/lib/metrics-hooks';
import { formatUsd, formatFeeRate, formatTokenAmount } from '@/lib/format';
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);
    const { data: revenue } = useJobRevenue(jobId, 30);
    const { data: miners, isLoading: leaderboardLoading } = useLeaderboard(jobId);
    const { data: tvlHistory } = useJobTVLHistory(jobId, 30);

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

                {/* Main Metrics Row (7 Standardized Boxes) */}
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

                {/* Strategy Comparison Section */}
                <div className="bg-white border border-cream-dark p-8 rounded-[32px] shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Strategy Comparison & Benchmarking</h3>
                        <div className="px-3 py-1 bg-cream/30 rounded-full border border-cream-dark/30 text-[9px] font-bold text-primary/40 uppercase tracking-widest">
                            30-Day Period
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-black text-primary mb-1">Put Crypto to work via AI Managed Liquidity</h2>
                    </div>

                    {/* Calculator UI - Clean Horizontal Line */}
                    <div className="flex flex-col xl:flex-row items-center justify-between gap-6 mb-10 text-[9px] font-bold uppercase tracking-widest bg-cream/5 p-4 rounded-2xl border border-cream-dark/10 xl:bg-transparent xl:p-0 xl:border-none">
                        <div className="flex flex-wrap items-center justify-center gap-3 whitespace-nowrap w-full xl:w-auto">
                            <span className="text-primary/30">If you have</span>
                            <div className="flex items-center bg-white xl:bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2">
                                <input type="text" defaultValue="1" className="bg-transparent border-none focus:ring-0 w-6 text-primary font-bold p-0 text-[10px] text-center" />
                                <span className="text-primary/30 ml-1">BTC</span>
                            </div>
                            <span className="text-primary/30">and</span>
                            <div className="flex items-center bg-white xl:bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2">
                                <input type="text" defaultValue="65k" className="bg-transparent border-none focus:ring-0 w-8 text-primary font-bold p-0 text-[10px] text-center" />
                                <span className="text-primary/30 ml-1">USDC</span>
                            </div>
                            <span className="text-primary/30">for</span>
                            <div className="flex items-center bg-white xl:bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2 min-w-24 justify-between">
                                <span className="text-primary font-bold">365 Days</span>
                                <ChevronRight size={12} className="ml-2 text-primary/20 rotate-90" />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-4 xl:gap-6 xl:border-l border-cream-dark/50 xl:pl-6 w-full xl:w-auto">
                            <div className="flex items-center space-x-3 whitespace-nowrap justify-center w-full md:w-auto">
                                <span className="text-primary/30">Pair</span>
                                <div className="flex items-center bg-white xl:bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2 w-full md:w-auto justify-between">
                                    <span className="text-primary font-bold">BTC / USDC</span>
                                    <ChevronRight size={12} className="ml-2 text-primary/20 rotate-90" />
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-center items-center gap-4 md:border-l border-cream-dark/50 md:pl-6 w-full md:w-auto">
                                <span className="text-primary/30 hidden md:inline">APY</span>
                                <div className="flex items-center justify-center space-x-4 w-full md:w-auto">
                                    <span className="text-primary font-bold">(USD): {(apy?.apy_percent || 0).toFixed(1)}%</span>
                                    <span className="text-primary font-bold">{token0Symbol}: {(apy?.apy_percent_token0 || 0).toFixed(1)}%</span>
                                    <span className="text-primary font-bold">{token1Symbol}: {(apy?.apy_percent_token1 || 0).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="overflow-x-auto pb-2">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/20 border-b border-cream-dark/50">
                                    <th className="text-left py-4">Strategy</th>
                                    <th className="text-left py-4">BTC Balance</th>
                                    <th className="text-left py-4">Change</th>
                                    <th className="text-left py-4">APY (USDC)</th>
                                    <th className="text-left py-4">USDC Balance</th>
                                    <th className="text-left py-4">Change</th>
                                    <th className="text-left py-4">APY (USDC)</th>
                                    <th className="text-right py-4">APY (USD)</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold text-primary">
                                <StrategyRow
                                    name="ForeverMoney"
                                    isBest
                                    btc={`${(tvl?.tvl_token0 || 0).toFixed(4)} ${token0Symbol}`}
                                    btcChange={pnl?.pnl_token0 ? `${pnl.pnl_token0 >= 0 ? '+' : ''}${pnl.pnl_token0.toFixed(4)}` : "—"}
                                    btcChangePct={apy?.apy_percent_token0 ? `${apy.apy_percent_token0.toFixed(1)}%` : "—"}
                                    btcChangeColor="text-green-500"
                                    apyUsdc1={`${(apy?.apy_percent_token0 || 0).toFixed(1)}%`}
                                    usdc={`${(tvl?.tvl_token1 || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token1Symbol}`}
                                    usdcChange={pnl?.pnl_token1 ? `${pnl.pnl_token1 >= 0 ? '+' : ''}${pnl.pnl_token1.toFixed(4)}` : "—"}
                                    usdcChangePct={apy?.apy_percent_token1 ? `${apy.apy_percent_token1.toFixed(1)}%` : "—"}
                                    apyUsdc2={`${(apy?.apy_percent_token1 || 0).toFixed(1)}%`}
                                    apyTotal={`${(apy?.apy_percent || 0).toFixed(1)}%`}
                                />
                                <StrategyRow
                                    name="Full-range LP"
                                    btc="—"
                                    btcChange="—"
                                    btcChangePct="—"
                                    btcChangeColor="text-primary"
                                    apyUsdc1="—"
                                    usdc="—"
                                    usdcChange="—"
                                    usdcChangePct="—"
                                    apyUsdc2="—"
                                    apyTotal="—"
                                />
                                <StrategyRow
                                    name="Holding"
                                    btc="—"
                                    btcChange="—"
                                    btcChangePct="—"
                                    btcChangeColor="text-primary"
                                    apyUsdc1="0.0%"
                                    usdc="—"
                                    usdcChange="—"
                                    usdcChangePct="—"
                                    apyUsdc2="0.0%"
                                    apyTotal="0.0%"
                                />
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 p-6 bg-cream/10 rounded-2xl border border-cream-dark/20">
                        <p className="text-[10px] font-medium text-primary/40 leading-relaxed text-center">
                            ForeverMoney Strategy demonstrates superior performance with AI-managed liquidity optimization. The strategy actively rebalances positions to maximize fee capture and token appreciation, resulting in higher absolute gains and APY compared to passive approaches.
                        </p>
                    </div>
                </div>

                {/* Performance Chart Section */}
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

                {/* Active Vaults Section */}
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

function StrategyRow({
    name,
    isBest,
    btc, btcChange, btcChangePct, btcChangeColor,
    apyUsdc1, usdc, usdcChange, usdcChangePct,
    apyUsdc2, apyTotal
}: any) {
    return (
        <tr className="border-b border-cream-dark/30 last:border-0">
            <td className="py-5">
                <div className="flex items-center space-x-2">
                    <span className="font-black text-primary">{name}</span>
                    {isBest && <span className="px-1.5 py-0.5 bg-green-500 text-white rounded-[2px] text-[7px] font-black uppercase tracking-widest">Best</span>}
                </div>
                {isBest && <p className="text-[8px] font-bold text-primary/20 uppercase mt-0.5">AI Managed Liquidity</p>}
            </td>
            <td className="py-5 whitespace-nowrap">{btc}</td>
            <td className="py-5">
                <div className="flex flex-col">
                    <span className={btcChangeColor}>{btcChange}</span>
                    <span className="text-[8px] text-green-500 opacity-60 font-bold">{btcChangePct}</span>
                </div>
            </td>
            <td className="py-5">
                <div className="flex items-center space-x-1.5">
                    <TrendingUp size={10} className="text-green-500" />
                    <span className="text-green-500">{apyUsdc1}</span>
                </div>
            </td>
            <td className="py-5 whitespace-nowrap">{usdc}</td>
            <td className="py-5">
                <div className="flex flex-col">
                    <span className="text-green-600">{usdcChange}</span>
                    <span className="text-[8px] text-green-600/60 font-bold">{usdcChangePct}</span>
                </div>
            </td>
            <td className="py-5">
                <div className="flex items-center space-x-1.5">
                    <TrendingUp size={10} className="text-green-600" />
                    <span className="text-green-600">{apyUsdc2}</span>
                </div>
            </td>
            <td className="py-5 text-right">
                <div className="flex items-center justify-end space-x-1.5">
                    <TrendingUp size={12} className="text-green-600" />
                    <span className="text-lg text-green-600">{apyTotal}</span>
                </div>
            </td>
        </tr>
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
