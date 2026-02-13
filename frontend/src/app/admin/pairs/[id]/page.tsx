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
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, CartesianGrid } from 'recharts';

export default function PairDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const { data: jobs } = useJobs();
    const { data: stats } = useNetworkStats(jobId);
    const { data: apy } = useJobAPY(jobId, 30);
    const { data: pnl } = useJobPnL(jobId, 30);
    const { data: tvl } = useJobTVL(jobId);
    const { data: miners, isLoading: leaderboardLoading } = useLeaderboard(jobId);

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

    // Mock Performance Data for 3 Lines
    const performanceData = Array.from({ length: 48 }, (_, i) => {
        const hour = Math.floor(i / 2).toString().padStart(2, '0');
        const min = (i % 2 === 0 ? '00' : '30');
        const time = `${hour}:${min}`;
        return {
            time,
            forever: 4000 + (i * 120) + (Math.sin(i / 4) * 400),
            lp: 4000 + (i * 90) + (Math.sin(i / 5) * 200),
            holding: 4000 + (i * 60) + (Math.sin(i / 6) * 100),
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
                            <span>{stats?.total_miners || 10}</span>
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
                    <MetricBox label="TVL (USD)" value={`$${((tvl?.tvl_usd || 0) / 1000000).toFixed(1)}M`} />
                    <MetricBox label="Fees Earned (30D)" value={`$${((pnl?.pnl_usd || 0) / 1000).toFixed(0)}k`} />
                    <MetricBox
                        label={`APY cbBTC / USDE / USD`}
                        value="0.0% / 0.0% / 0.0%"
                        subvalue="LIVE CALCULATIONS"
                        isApy
                    />
                    <MetricBox label="Active Vault Jobs" value={stats?.total_miners?.toString() || "10"} />
                    <MetricBox label="Initial Portfolio Value" value="$742" />
                    <MetricBox label="Current Portfolio Value" value="$2,742" />
                    <MetricBox label="Net Gain" value="$2,000" highlight />
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
                    <div className="flex items-center justify-between gap-4 mb-10 text-[9px] font-bold uppercase tracking-widest">
                        <div className="flex items-center space-x-3 whitespace-nowrap">
                            <span className="text-primary/30">If you have</span>
                            <div className="flex items-center bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2">
                                <input type="text" defaultValue="1" className="bg-transparent border-none focus:ring-0 w-6 text-primary font-bold p-0 text-[10px]" />
                                <span className="text-primary/30 ml-1">BTC</span>
                            </div>
                            <span className="text-primary/30">and</span>
                            <div className="flex items-center bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2">
                                <input type="text" defaultValue="65k" className="bg-transparent border-none focus:ring-0 w-8 text-primary font-bold p-0 text-[10px]" />
                                <span className="text-primary/30 ml-1">USDC</span>
                            </div>
                            <span className="text-primary/30">for</span>
                            <div className="flex items-center bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2 min-w-24">
                                <span className="text-primary font-bold">365 Days</span>
                                <ChevronRight size={12} className="ml-auto text-primary/20 rotate-90" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-6 border-l border-cream-dark/50 pl-6 h-10">
                            <div className="flex items-center space-x-3 whitespace-nowrap">
                                <span className="text-primary/30">Pair</span>
                                <div className="flex items-center bg-cream/20 border border-cream-dark/50 rounded-lg px-3 py-2">
                                    <span className="text-primary font-bold">BTC / USDC</span>
                                    <ChevronRight size={12} className="ml-2 text-primary/20 rotate-90" />
                                </div>
                            </div>

                            <div className="flex items-center space-x-4 border-l border-cream-dark/50 pl-6">
                                <span className="text-primary/30">APY</span>
                                <div className="flex items-center space-x-4">
                                    <span className="text-primary font-bold">(USD): 41%</span>
                                    <span className="text-primary font-bold">BTC: 20%</span>
                                    <span className="text-primary font-bold">USDC: 20%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
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
                                    btc="0.0524 BTC"
                                    btcChange="+0.0024"
                                    btcChangePct="+4.8%"
                                    btcChangeColor="text-green-500"
                                    apyUsdc1="42.5%"
                                    usdc="12,930 USDC"
                                    usdcChange="+0.0024"
                                    usdcChangePct="+4.8%"
                                    apyUsdc2="42.5%"
                                    apyTotal="42.5%"
                                />
                                <StrategyRow
                                    name="Full-range LP"
                                    btc="0.0524 BTC"
                                    btcChange="+0.0024"
                                    btcChangePct="+4.8%"
                                    btcChangeColor="text-primary"
                                    apyUsdc1="42.5%"
                                    usdc="12,930 USDC"
                                    usdcChange="+0.0024"
                                    usdcChangePct="+4.8%"
                                    apyUsdc2="42.5%"
                                    apyTotal="42.5%"
                                />
                                <StrategyRow
                                    name="Holding"
                                    btc="0.0524 BTC"
                                    btcChange="+0.0024"
                                    btcChangePct="+4.8%"
                                    btcChangeColor="text-primary"
                                    apyUsdc1="42.5%"
                                    usdc="12,930 USDC"
                                    usdcChange="+0.0024"
                                    usdcChangePct="+4.8%"
                                    apyUsdc2="42.5%"
                                    apyTotal="42.5%"
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
                <div className="bg-white border border-cream-dark p-8 rounded-[32px] shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-12">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30 whitespace-nowrap">Performance Over Time</h3>
                            <div className="flex items-center space-x-6">
                                <ChartLegend label="ForeverMoney" color="#3B82F6" />
                                <ChartLegend label="Full-range LP" color="#0D1117" />
                                <ChartLegend label="Holding" color="#3B82F6" opacity={0.5} />
                            </div>
                        </div>
                        <div className="flex items-center bg-cream/20 p-1 rounded-full border border-cream-dark/30">
                            {['1D', '7D', '30D', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    className={`px-3 py-1 text-[9px] font-bold rounded-full transition-all ${tf === '30D' ? 'bg-primary text-white shadow-md' : 'text-primary/40 hover:text-primary'}`}
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
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }}
                                    interval={7}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#0C2060', opacity: 0.3, fontSize: 9, fontWeight: 700 }}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #F2EDE4', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 700 }}
                                />
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

                {/* Active Vaults Section */}
                <div className="bg-white border border-cream-dark rounded-[32px] shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-cream-dark/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30">Active Vaults</h3>
                            <p className="text-[9px] font-bold text-primary/20 uppercase tracking-widest mt-1">Live Execution Records</p>
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                            10 Active
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
                                    <th className="py-4 whitespace-nowrap text-blue-600">Fees cbBTC</th>
                                    <th className="py-4 whitespace-nowrap text-blue-600">Fees USDC</th>
                                    <th className="py-4 whitespace-nowrap text-blue-600">APY cbBTC</th>
                                    <th className="py-4 whitespace-nowrap text-blue-600">APY USDE</th>
                                    <th className="py-4 whitespace-nowrap text-blue-600 text-right pr-4">APY (USD)</th>
                                    <th className="pr-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-bold">
                                {[1, 2, 7, 8, 5, 6, 9, 11, 10, 4].map((no, i) => (
                                    <tr key={no} className="border-b border-cream-dark/20 last:border-0 hover:bg-cream/5 transition-colors group cursor-pointer">
                                        <td className="pl-8 py-4 text-primary/40">Vault #{no}</td>
                                        <td className="py-4">
                                            <div className="flex flex-col">
                                                <span>5G036030...</span>
                                                <span className="text-[8px] text-primary/20 uppercase tracking-tighter">UID: {no}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-blue-600">$135,000</td>
                                        <td className="py-4 text-blue-500">$72,350</td>
                                        <td className="py-4 text-blue-500">1,100,587</td>
                                        <td className="py-4 text-blue-500">4.7689</td>
                                        <td className="py-4 text-blue-500">32.5%</td>
                                        <td className="py-4 text-blue-500">15.2%</td>
                                        <td className="py-4 text-blue-600 text-right pr-4">14%</td>
                                        <td className="pr-8 py-4 text-right">
                                            <ChevronRight size={12} className="inline text-blue-600 transition-transform group-hover:translate-x-1" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pair Configuration Section */}
                <div className="bg-white border border-cream-dark p-8 rounded-[32px] shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/30 mb-6 pb-4 border-b border-cream-dark/30">Pair Configuration</h3>
                    <div className="space-y-4">
                        <ConfigEntry label="Pair Address" value="0x44e992bb3889bf030369fbb10a9c99b83cb3e775" isMono />
                        <ConfigEntry label="Vault Address" value="0x44e992bb3889bf030369fbb10a9c99b83cb3e775" isMono />
                        <ConfigEntry label="Fee Rate" value="0.30%" />
                        <ConfigEntry label="Target Ratio" value="50%" />
                        <ConfigEntry label="Round Duration" value="900s (15m)" />
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
        <div className="flex items-center justify-between text-[10px] font-bold text-primary">
            <span className="text-primary/20 uppercase tracking-widest">{label}</span>
            <span className={isMono ? 'font-mono' : ''}>{value}</span>
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
