'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    LayoutDashboard,
    Database,
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Zap,
    Terminal,
    Cpu,
    HardDrive,
    TrendingUp,
    Users,
    Layers,
    RefreshCw,
    ChevronRight,
} from 'lucide-react';
import {
    useJobs,
    useLeaderboard,
    useNetworkStats,
    useSubnetEmissions,
    useExecutions,
    useSubnetTVL,
    useSubnetPnL,
    useSubnetRevenue,
    useTopEarners,
    usePairPerformance
} from '@/lib/api';
import PerformanceChart from '@/components/charts/PerformanceChart';

export default function DashboardPage() {
    const { data: jobs, isLoading: jobsLoading } = useJobs();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    React.useEffect(() => {
        if (jobs && jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].job_id);
        }
    }, [jobs, selectedJobId]);

    const { data: stats } = useNetworkStats(selectedJobId || '');
    const { data: emissions, isLoading: emissionsLoading } = useSubnetEmissions();
    const { data: executions } = useExecutions(selectedJobId || '');
    const { data: subnetTVL } = useSubnetTVL();
    const { data: subnetRevenue } = useSubnetRevenue(30);
    const { data: pairPerformance } = usePairPerformance();

    const [timeframe, setTimeframe] = useState('30D');

    const activeJobs = jobs?.filter(j => j.is_active) || [];

    // Calculate Alpha Revenue
    const alphaPrice = emissions?.alpha_price_usd || 1;
    const revenueAlpha = (subnetRevenue?.total_revenue_usd || 0) / alphaPrice;

    // Mock chart data (Styled for light theme)
    const chartData = [
        { time: '00:00', value: 4000 },
        { time: '04:00', value: 5500 },
        { time: '08:00', value: 4800 },
        { time: '12:00', value: 7200 },
        { time: '16:00', value: 8100 },
        { time: '20:00', value: 9500 },
        { time: '23:59', value: 12402 },
    ];

    return (
        <AdminLayout
            title="Dashboard Overview"
            description="Subnet Performance & Real-time Execution Monitoring"
            icon={<LayoutDashboard size={20} />}
        >
            <div className="space-y-8 animate-fade-in pb-20">
                {/* Section 1: System Status Bar */}
                <div className="bg-white border border-cream-dark shadow-sm rounded-2xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex flex-wrap items-center gap-8">
                            <StatusIndicator label="API Service" status="online" detail="Latency: 42ms" />
                            <StatusIndicator label="Network DB" status={jobs ? "online" : "offline"} detail={`${jobs?.length || 0} Indexes Synced`} />
                            <StatusIndicator label="Metagraph" status={emissions ? "online" : "syncing"} detail={emissionsLoading ? "Syncing..." : "Live"} />
                            <StatusIndicator label="Emissions" status={emissions && emissions.miner_ratio > 0 ? "online" : "offline"} detail={`${((emissions?.burn_ratio || 0) * 100).toFixed(0)}% Burn Rate`} />
                        </div>
                        <div className="text-[10px] text-primary/30 font-bold uppercase tracking-widest bg-cream px-3 py-1 rounded-full">
                            Last Updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Section 2: Top Metrics (5 Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <MetricCard label="TVL (USD)" value={`$${(subnetTVL?.total_tvl_usd || 12402156).toLocaleString()}`} icon={<Layers size={14} />} />
                    <MetricCard label="Revenue (USD)" value={`$${(subnetRevenue?.total_revenue_usd || 183200).toLocaleString()}`} icon={<TrendingUp size={14} />} />
                    <MetricCard label="Emissions (USD)" value={`$${(emissions?.total_emissions_usd || 92500).toLocaleString()}`} icon={<Zap size={14} />} />
                    <MetricCard label="Revenue (Alpha)" value={revenueAlpha ? revenueAlpha.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "1,249,865"} icon={<Activity size={14} />} />
                    <MetricCard label="Emissions (Alpha)" value={emissions?.total_emissions_alpha ? emissions.total_emissions_alpha.toLocaleString() : "640,000"} icon={<RefreshCw size={14} />} />
                </div>

                {/* Section 3: Performance Chart */}
                <div className="bg-white border border-cream-dark shadow-sm p-8 rounded-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/40">Performance Graph</h3>
                            <div className="h-4 w-px bg-cream-dark"></div>
                            <span className="text-[11px] font-bold text-primary">TVL | Revenue | Emissions</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {['1D', '7D', '30D', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${timeframe === tf ? 'bg-primary text-white' : 'text-primary/40 hover:bg-cream'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <PerformanceChart data={chartData} lightTheme />
                    </div>
                </div>

                {/* Section 4: Performance Tables (Wireframe Style) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Panel title="Top Pairs by Revenue">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="text-primary/30 text-left border-b border-cream-dark">
                                        <th className="pb-3 font-black uppercase tracking-tighter">Pair</th>
                                        <th className="pb-3 font-black uppercase tracking-tighter">Earnings</th>
                                        <th className="pb-3 font-black uppercase tracking-tighter">APY 1</th>
                                        <th className="pb-3 font-black uppercase tracking-tighter">APY 2</th>
                                        <th className="pb-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-primary">
                                    {(activeJobs.length > 0 ? activeJobs.slice(0, 5) : [
                                        { metadata: { pair_name: 'BID/WETH' }, job_id: 'mock-1' },
                                        { metadata: { pair_name: 'xTAO/USDC' }, job_id: 'mock-2' },
                                        { metadata: { pair_name: 'WETH/USDC' }, job_id: 'mock-3' },
                                        { metadata: { pair_name: 'xSN34/USDC' }, job_id: 'mock-4' },
                                        { metadata: { pair_name: 'xSN8/USDC' }, job_id: 'mock-5' },
                                    ]).map((p, i) => (
                                        <tr
                                            key={i}
                                            onClick={() => p.job_id && (window.location.href = `/admin/pairs/${p.job_id}`)}
                                            className="hover:bg-cream/50 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer group"
                                        >
                                            <td className="py-4 font-black">{p.metadata?.pair_name || 'UNKNOWN'}</td>
                                            <td className="py-4 font-mono font-bold">${(72350 - (i * 2000)).toLocaleString()}</td>
                                            <td className="py-4 font-mono text-primary/60">45.6%</td>
                                            <td className="py-4 font-mono text-primary/60">32.5%</td>
                                            <td className="py-4 text-right">
                                                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title="Top Miners by Earnings">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <tbody className="text-primary">
                                    {[
                                        { hotkey: '5F087687363', earnings: 72350 },
                                        { hotkey: '5F087687363', earnings: 61837 },
                                        { hotkey: '5F087687363', earnings: 59971 },
                                        { hotkey: '5F087687363', earnings: 49112 },
                                        { hotkey: '5F087687363', earnings: 32874 },
                                    ].map((m, i) => (
                                        <tr key={i} className="hover:bg-cream/50 transition-colors border-b border-cream-dark/30 last:border-0">
                                            <td className="py-4 font-black font-mono text-primary/60 tracking-tighter">
                                                {m.hotkey}
                                            </td>
                                            <td className="py-4 text-right font-black font-mono text-sm">
                                                ${m.earnings.toLocaleString()}
                                            </td>
                                            <td className="py-4 text-right">
                                                <ChevronRight size={14} className="text-primary/20 inline ml-4" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>

                {/* Section 5 & 6 (Monitoring Panels and Execution Stream) hidden for now as requested */}
            </div>
        </AdminLayout>
    );
}

function StatusIndicator({ label, status, detail }: { label: string, status: 'online' | 'offline' | 'syncing', detail: string }) {
    const dots = { online: 'bg-green-500', offline: 'bg-red-500', syncing: 'bg-yellow-500' };
    return (
        <div className="flex items-center space-x-4 border-r border-cream-dark last:border-0 pr-8">
            <div className={`w-2.5 h-2.5 rounded-full ${dots[status]} ${status === 'online' ? 'animate-pulse' : ''} shadow-sm`}></div>
            <div>
                <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] leading-none mb-1.5">{label}</p>
                <div className="flex items-center gap-2">
                    <p className="text-[11px] text-primary font-black uppercase tracking-tighter leading-none">{status}</p>
                    <span className="text-[9px] text-primary/20 font-mono">{detail}</span>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="bg-white border border-cream-dark p-6 rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all group">
            <div className="flex items-center justify-between mb-3 text-primary/20 group-hover:text-primary transition-colors">
                <p className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</p>
                {icon}
            </div>
            <p className="text-xl font-black tracking-tighter text-primary">{value}</p>
        </div>
    );
}

function Panel({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between bg-cream/10">
                <h3 className="text-[11px] font-black text-primary/40 uppercase tracking-[0.2em]">{title}</h3>
                {detail && <span className="text-[10px] text-primary/30 font-bold uppercase tracking-widest">{detail}</span>}
            </div>
            <div className="p-6 flex-1">{children}</div>
        </div>
    );
}

function MetricRow({ label, value, subtext }: { label: string; value: string; subtext: string }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-cream-dark/50 last:border-0 group">
            <div>
                <p className="text-xs font-black text-primary group-hover:text-primary-light transition-colors">{label}</p>
                <p className="text-[10px] text-primary/30 font-bold uppercase tracking-tighter mt-0.5">{subtext}</p>
            </div>
            <p className="text-sm font-black text-primary group-hover:text-primary-light transition-colors">{value}</p>
        </div>
    );
}

function Badge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        success: 'bg-green-500 text-white shadow-sm shadow-green-200',
        pending: 'bg-yellow-500 text-white shadow-sm shadow-yellow-200',
        failed: 'bg-red-500 text-white shadow-sm shadow-red-200',
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${styles[status] || 'bg-primary/5 text-primary/40 border-cream-dark'}`}>
            {status}
        </span>
    );
}
