'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    ArrowRight
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
import EarningsChart from '@/components/charts/EarningsChart';

export default function DashboardPage() {
    const { data: jobs, isLoading: jobsLoading } = useJobs();
    const router = useRouter();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    React.useEffect(() => {
        if (jobs && jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].job_id);
        }
    }, [jobs, selectedJobId]);

    const { data: emissions, isLoading: emissionsLoading } = useSubnetEmissions();
    const { data: subnetTVL } = useSubnetTVL();
    const { data: subnetRevenue } = useSubnetRevenue(30);

    const [timeframe, setTimeframe] = useState('30D');

    // Mock chart data (Styled to match the image)
    const performanceData = [
        { time: '00:00', value: 4000, value2: 4500 },
        { time: '04:00', value: 6500, value2: 5800 },
        { time: '08:00', value: 5500, value2: 5200 },
        { time: '12:00', value: 7200, value2: 6500 },
        { time: '16:00', value: 8100, value2: 8500 },
        { time: '20:00', value: 9500, value2: 9800 },
        { time: '23:59', value: 12402, value2: 11000 },
    ];

    const earningsData = [
        { time: '00:00', m1: 1000, m2: 2000, m3: 800, m4: 500, m5: 300 },
        { time: '04:00', m1: 1500, m2: 2200, m3: 1200, m4: 700, m5: 400 },
        { time: '08:00', m1: 1200, m2: 2400, m3: 1100, m4: 600, m5: 500 },
        { time: '12:00', m1: 1800, m2: 2800, m3: 1500, m4: 900, m5: 700 },
        { time: '16:00', m1: 2200, m2: 3200, m3: 1800, m4: 1100, m5: 800 },
        { time: '20:00', m1: 2600, m2: 3800, m3: 2200, m4: 1300, m5: 1000 },
        { time: '23:59', m1: 3000, m2: 4200, m3: 2500, m4: 1500, m5: 1200 },
    ];

    // ...
    return (
        <AdminLayout
            title="Dashboard Overview"
            description="Subnet Performance & Real-time Execution Monitoring"
            icon={<LayoutDashboard size={20} />}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {/* Section 1: System Status Bar */}
                <div className="bg-white border border-cream-dark shadow-sm rounded-xl md:rounded-2xl p-4 md:p-6 overflow-x-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-max md:min-w-0">
                        <div className="flex items-center gap-6 md:gap-12">
                            <StatusIndicator label="API Service" status="online" detail="Latency: 42ms" />
                            <StatusIndicator label="Network DB" status={jobs ? "online" : "offline"} detail={`${jobs?.length || 0} Indexes Synced`} />
                            <StatusIndicator label="Metagraph" status={emissions ? "online" : "syncing"} detail={emissionsLoading ? "Syncing..." : "Live"} />
                            <StatusIndicator label="Emissions" status={emissions && emissions.miner_ratio > 0 ? "online" : "offline"} detail={`${((emissions?.burn_ratio || 0) * 100).toFixed(0)}% Burn Rate`} />
                        </div>
                        <div className="text-[10px] text-primary/30 font-bold uppercase tracking-[0.2em] bg-cream/50 px-4 py-1.5 rounded-full border border-cream-dark/50 whitespace-nowrap w-fit">
                            Last Updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Section 2: Top Metrics (4 Columns to match image) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <MetricCard label="TVL (USD)" value={`$${(subnetTVL?.total_tvl_usd || 12402156).toLocaleString()}`} change="+4.2%" trend="up" />
                    <MetricCard label="Fees Earned (USD)" value={`$${(subnetRevenue?.total_revenue_usd || 183200).toLocaleString()}`} change="+12.5%" trend="up" />
                    <MetricCard label="Emissions (USD)" value={`$${(emissions?.total_emissions_usd || 0).toLocaleString()}`} change="0%" trend="neutral" />
                    <MetricCard label="Emissions (Alpha)" value={emissions?.total_emissions_alpha ? emissions.total_emissions_alpha.toLocaleString() : "0"} change="-2.1%" trend="down" />
                </div>

                {/* Section 3: Performance Chart */}
                <div className="bg-white border border-cream-dark shadow-sm p-4 md:p-10 rounded-xl md:rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 md:space-x-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/30">Performance Graph</h3>
                            <div className="hidden md:block h-4 w-px bg-cream-dark"></div>
                            <div className="flex items-center gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                                <ChartLegend label="TVL" color="#3B82F6" active />
                                <ChartLegend label="Revenue (USD)" color="#0D1117" />
                                <ChartLegend label="Emissions (USD)" color="#9CA3AF" />
                            </div>
                        </div>
                        <div className="flex items-center bg-cream/50 p-1 rounded-full border border-cream-dark/50 self-start md:self-auto">
                            {['1D', '7D', '30D', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all duration-300 ${timeframe === tf ? 'bg-primary text-white shadow-md' : 'text-primary/40 hover:text-primary'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px] md:h-[400px] w-full">
                        <PerformanceChart data={performanceData} />
                    </div>
                </div>

                {/* Section 4: Miner Earnings Chart */}
                <div className="bg-white border border-cream-dark shadow-sm p-4 md:p-10 rounded-xl md:rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/30">Miner Earnings (USD)</h3>
                        <div className="flex items-center bg-cream/50 p-1 rounded-full border border-cream-dark/50 self-start md:self-auto">
                            {['1D', '7D', '30D', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all ${tf === '30D' ? 'bg-primary text-white shadow-md' : 'text-primary/40'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px] md:h-[400px] w-full">
                        <EarningsChart data={earningsData} />
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-4 md:gap-6 pt-8 border-t border-cream-dark/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/30 w-full md:w-auto">Top Miners</span>
                        <MinerTag rank={1} hotkey="5F087687363" uid={7} color="#020617" />
                        <MinerTag rank={2} hotkey="5F087687363" uid={7} color="#0C2060" />
                        <MinerTag rank={3} hotkey="5F087687363" uid={7} color="#1A3485" />
                        <MinerTag rank={4} hotkey="5F087687363" uid={7} color="#1E40AF" />
                        <MinerTag rank={5} hotkey="5F087687363" uid={7} color="#3B82F6" />
                    </div>
                </div>

                {/* Section 5: Performance Tables */}
                <div className="flex flex-col gap-6">
                    <Panel title="Top Pairs by Revenue" href="/admin/pairs">
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
                                    onClick={() => router.push(`/admin/pairs/1`)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Pair</div>
                                            <Link
                                                href={`/admin/pairs/1`}
                                                className="text-sm font-black text-primary hover:underline hover:text-blue-600 truncate block"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                cbBTC/USDC
                                            </Link>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Rank</div>
                                            <div className="bg-cream-dark/20 px-2 py-1 rounded-lg text-xs font-black text-primary/60">#{i}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">TVL</div>
                                            <div className="text-xs font-black text-primary">$4.2M</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Fees</div>
                                            <div className="text-xs font-black text-blue-600">$72,350</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">USD APY</div>
                                            <div className="text-xs font-black text-primary">38.2%</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Vaults</div>
                                            <div className="text-xs font-black text-primary/60">12</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead>
                                    <tr className="text-[10px] text-primary/30 font-black uppercase tracking-[0.2em] border-b border-cream-dark">
                                        <th className="pb-4">#</th>
                                        <th className="pb-4">Pair</th>
                                        <th className="pb-4">TVL</th>
                                        <th className="pb-4">Fees Collected</th>
                                        <th className="pb-4">T1 APY</th>
                                        <th className="pb-4">T2 APY</th>
                                        <th className="pb-4">USD APY</th>
                                        <th className="pb-4">vs HODL</th>
                                        <th className="pb-4">vs FULL RANGE</th>
                                        <th className="pb-4">Vaults</th>
                                        <th className="pb-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {[
                                        { pair: 'cbBTC/USDC', jobId: '1', tvl: '$4.2M', fees: '$72,350', t1: '45.6%', t2: '32.5%', usd: '38.2%', hodl: '54%', range: '54%', vaults: '12' },
                                        { pair: 'cbBTC/USDC', jobId: '1', tvl: '$3.8M', fees: '$70,350', t1: '42.1%', t2: '35.8%', usd: '39.0%', hodl: '52%', range: '54%', vaults: '8' },
                                        { pair: 'cbBTC/USDC', jobId: '1', tvl: '$3.5M', fees: '$68,350', t1: '48.3%', t2: '31.2%', usd: '40.1%', hodl: '55%', range: '54%', vaults: '15' },
                                        { pair: 'cbBTC/USDC', jobId: '1', tvl: '$3.5M', fees: '$68,350', t1: '48.3%', t2: '31.2%', usd: '40.1%', hodl: '55%', range: '54%', vaults: '15' },
                                        { pair: 'cbBTC/USDC', jobId: '1', tvl: '$3.5M', fees: '$68,350', t1: '48.3%', t2: '31.2%', usd: '40.1%', hodl: '55%', range: '54%', vaults: '15' },
                                    ].map((row, i) => (
                                        <tr key={i} className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
                                            onClick={() => router.push(`/admin/pairs/${row.jobId}`)}>
                                            <td className="py-5 font-black text-primary/20">{i + 1}</td>
                                            <td className="py-5 font-black">
                                                <Link href={`/admin/pairs/${row.jobId}`} className="hover:underline hover:text-blue-600 transition-all font-black" onClick={(e) => e.stopPropagation()}>
                                                    {row.pair}
                                                </Link>
                                            </td>
                                            <td className="py-5 font-bold text-primary/60">{row.tvl}</td>
                                            <td className="py-5 font-bold text-primary/60">{row.fees}</td>
                                            <td className="py-5 font-bold text-primary/30">{row.t1}</td>
                                            <td className="py-5 font-bold text-primary/30">{row.t2}</td>
                                            <td className="py-5 font-black text-primary">{row.usd}</td>
                                            <td className="py-5 font-bold text-primary/30">{row.hodl}</td>
                                            <td className="py-5 font-bold text-primary/30">{row.range}</td>
                                            <td className="py-5 font-bold text-primary/60">{row.vaults}</td>
                                            <td className="py-5 text-right">
                                                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title="Top Miners by Earnings" href="/admin/miners">
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
                                    onClick={() => router.push(`/admin/miners/7`)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Miner</div>
                                            <Link
                                                href="/admin/miners/7"
                                                className="text-sm font-black text-primary hover:underline hover:text-blue-600 truncate block font-mono"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                5F087687363
                                            </Link>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Rank</div>
                                            <div className="bg-cream-dark/20 px-2 py-1 rounded-lg text-xs font-black text-primary/60">#{i}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">TVL</div>
                                            <div className="text-xs font-black text-primary">$72,350</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Fees</div>
                                            <div className="text-xs font-black text-blue-600">$150</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Emissions (USD)</div>
                                            <div className="text-xs font-black text-primary">$350</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead>
                                    <tr className="text-[10px] text-primary/30 font-black uppercase tracking-[0.2em] border-b border-cream-dark">
                                        <th className="pb-4">#</th>
                                        <th className="pb-4">Miner</th>
                                        <th className="pb-4">Fees</th>
                                        <th className="pb-4">Emissions(USD)</th>
                                        <th className="pb-4 text-right pr-4">TVL</th>
                                        <th className="pb-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <tr key={i} className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
                                            onClick={() => router.push(`/admin/miners/7`)}>
                                            <td className="py-5 font-black text-primary/20">{i}</td>
                                            <td className="py-5 font-bold text-primary/60">
                                                <Link href="/admin/miners/7" className="hover:underline hover:text-blue-600 transition-all" onClick={(e) => e.stopPropagation()}>
                                                    5F087687363
                                                </Link>
                                            </td>
                                            <td className="py-5 font-black text-primary">$150</td>
                                            <td className="py-5 font-black text-primary">$350</td>
                                            <td className="py-5 font-black text-primary text-2xl tracking-tighter text-right pr-4">$72,350</td>
                                            <td className="py-5 text-right">
                                                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusIndicator({ label, status, detail }: { label: string, status: 'online' | 'offline' | 'syncing', detail: string }) {
    const dots = { online: 'bg-green-500 shadow-green-200', offline: 'bg-red-500 shadow-red-200', syncing: 'bg-yellow-500 shadow-yellow-200' };
    return (
        <div className="flex items-center space-x-4 border-r border-cream-dark last:border-0 pr-12">
            <div className={`w-2 h-2 rounded-full ${dots[status]} ${status === 'online' ? 'animate-pulse' : ''} shadow-lg ring-4 ring-white`}></div>
            <div>
                <p className="text-[9px] font-black text-primary/20 uppercase tracking-[0.2em] leading-none mb-1.5">{label}</p>
                <div className="flex items-center gap-2">
                    <p className="text-[11px] text-primary font-black uppercase tracking-tight leading-none">{status}</p>
                    <span className="text-[9px] text-primary/30 font-bold uppercase tracking-widest">{detail}</span>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, change, trend }: { label: string; value: string; change: string; trend: 'up' | 'down' | 'neutral' }) {
    return (
        <div className="bg-white border border-cream-dark p-8 rounded-xl md:rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/20 group-hover:text-primary/40 transition-colors">{label}</p>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center bg-cream/50`}>
                    <Zap size={10} className="text-primary/20" />
                </div>
            </div>
            <div className="flex items-end justify-between">
                <p className="text-2xl font-black tracking-tighter text-primary">{value}</p>
                {/* Visual sparkline icon placeholder could go here if needed, matching the image's small gray curves */}
                <div className="h-4 w-10 opacity-20">
                    <svg viewBox="0 0 40 16" className="w-full h-full stroke-primary" fill="none">
                        <path d="M0 12 Q 10 0, 20 8 T 40 4" strokeWidth="2" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

function ChartLegend({ label, color, active }: { label: string, color: string, active?: boolean }) {
    return (
        <div className="flex items-center space-x-2 cursor-pointer group">
            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm`} style={{ backgroundColor: color }}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${active ? 'text-primary' : 'text-primary/30 group-hover:text-primary/60'}`}>{label}</span>
        </div>
    );
}

function MinerTag({ rank, hotkey, uid, color }: { rank: number, hotkey: string, uid: number, color: string }) {
    return (
        <Link href={`/admin/miners/${uid}`} className="flex items-center space-x-2 group/tag cursor-pointer">
            <span className="text-[10px] font-black text-primary/20 group-hover/tag:text-primary/40 transition-colors">#{rank}</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-tight group-hover/tag:underline transition-all" style={{ color }}>{hotkey}</span>
        </Link>
    );
}

function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-cream-dark rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="px-8 py-6 border-b border-cream-dark flex items-center justify-between">
                <h3 className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">{title}</h3>
                {href && (
                    <Link href={href} className="text-[10px] font-black text-primary/40 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5">
                        View all <ArrowRight size={12} />
                    </Link>
                )}
            </div>
            <div className="p-8 flex-1">{children}</div>
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
