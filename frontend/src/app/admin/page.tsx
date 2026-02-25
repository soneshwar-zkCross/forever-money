'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    LayoutDashboard,
    Zap,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import {
    useJobs,
    useSubnetEmissions,
    useSubnetTVL,
    useSubnetRevenue,
    useTopEarners,
    useJobTVL,
    useJobRevenue,
    useJobAPY,
    Job
} from '@/lib/api';
import { formatUsd, formatFeeRate } from '@/lib/format';
import { useSubnetMetricsHistory } from '@/lib/metrics-hooks';
import PerformanceChart from '@/components/charts/PerformanceChart';
import EarningsChart from '@/components/charts/EarningsChart';

export default function DashboardPage() {
    const { data: jobs } = useJobs();
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
    const { data: topEarners } = useTopEarners(5);

    const [timeframe, setTimeframe] = useState('30D');

    // Map timeframe to days for API
    const timeframeDays = useMemo(() => {
        switch (timeframe) {
            case '1D': return 1;
            case '7D': return 7;
            case '30D': return 30;
            case 'ALL': return 365;
            default: return 30;
        }
    }, [timeframe]);

    const { data: metricsHistory } = useSubnetMetricsHistory(timeframeDays);

    // Transform metrics history for Performance chart
    const performanceData = useMemo(() => {
        if (!metricsHistory?.series?.length) return [];
        return metricsHistory.series.map(point => ({
            time: timeframeDays <= 1
                ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            value: point.tvl_usd,
            value2: point.revenue_usd,
        }));
    }, [metricsHistory, timeframeDays]);

    // Transform metrics history for Earnings chart using top earner score distribution
    const earningsData = useMemo(() => {
        if (!metricsHistory?.series?.length || !topEarners?.length) return [];
        const percentages = topEarners.slice(0, 5).map(e => e.score_percentage || 0.2);
        return metricsHistory.series.map(point => {
            const totalEmissions = point.revenue_usd || 0;
            return {
                time: timeframeDays <= 1
                    ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                m1: totalEmissions * (percentages[0] || 0),
                m2: totalEmissions * (percentages[1] || 0),
                m3: totalEmissions * (percentages[2] || 0),
                m4: totalEmissions * (percentages[3] || 0),
                m5: totalEmissions * (percentages[4] || 0),
            };
        });
    }, [metricsHistory, topEarners, timeframeDays]);

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
                            <StatusIndicator label="Network DB" status={jobs ? "online" : "offline"} detail={`${jobs?.length || 0} Jobs Synced`} />
                            <StatusIndicator label="Metagraph" status={emissions ? "online" : "syncing"} detail={emissionsLoading ? "Syncing..." : "Live"} />
                            <StatusIndicator label="Emissions" status={emissions && emissions.miner_ratio > 0 ? "online" : "offline"} detail={`${((emissions?.burn_ratio || 0) * 100).toFixed(0)}% Burn Rate`} />
                        </div>
                        <div className="text-[10px] text-primary/30 font-bold uppercase tracking-[0.2em] bg-cream/50 px-4 py-1.5 rounded-full border border-cream-dark/50 whitespace-nowrap w-fit">
                            Last Updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Section 2: Top Metrics (4 Columns) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <MetricCard
                        label="TVL (USD)"
                        value={`$${(subnetTVL?.total_tvl_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        change={`${subnetTVL?.vault_count || 0} vaults`}
                        trend="up"
                    />
                    <MetricCard
                        label="Fees Earned (USD)"
                        value={`$${(subnetRevenue?.total_revenue_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        change={`${subnetRevenue?.vault_count || 0} vaults`}
                        trend="up"
                    />
                    <MetricCard
                        label="Emissions (USD)"
                        value={`$${(emissions?.total_emissions_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        change={`${((emissions?.burn_ratio || 0) * 100).toFixed(0)}% burn`}
                        trend="neutral"
                    />
                    <MetricCard
                        label="Emissions (Alpha)"
                        value={emissions?.total_emissions_alpha?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0"}
                        change={`$${(emissions?.alpha_price_usd || 0).toFixed(4)}/a`}
                        trend="neutral"
                    />
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
                        {performanceData.length > 0 ? (
                            <PerformanceChart data={performanceData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                                No performance data available
                            </div>
                        )}
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
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all ${timeframe === tf ? 'bg-primary text-white shadow-md' : 'text-primary/40'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px] md:h-[400px] w-full">
                        {earningsData.length > 0 ? (
                            <EarningsChart data={earningsData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-primary/20 text-xs font-black uppercase tracking-widest">
                                No earnings data available
                            </div>
                        )}
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-4 md:gap-6 pt-8 border-t border-cream-dark/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/30 w-full md:w-auto">Top Miners</span>
                        {topEarners?.slice(0, 5).map((earner, i) => {
                            const colors = ['#020617', '#0C2060', '#1A3485', '#1E40AF', '#3B82F6'];
                            return (
                                <MinerTag
                                    key={earner.miner_uid}
                                    rank={i + 1}
                                    hotkey={earner.miner_hotkey.slice(0, 11)}
                                    uid={earner.miner_uid}
                                    color={colors[i] || '#3B82F6'}
                                />
                            );
                        })}
                        {!topEarners && (
                            <span className="text-[10px] text-primary/20 font-bold uppercase tracking-widest">Loading...</span>
                        )}
                    </div>
                </div>

                {/* Section 5: Performance Tables */}
                <div className="flex flex-col gap-6">
                    <Panel title="Top Pairs by Revenue" href="/admin/pairs">
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {jobs?.slice(0, 5).map((job, i) => (
                                <DashboardPairCard key={job.job_id} job={job} index={i + 1} />
                            ))}
                            {!jobs && (
                                <div className="text-center py-10 text-primary/20 text-xs font-black uppercase tracking-widest animate-pulse">Loading pairs...</div>
                            )}
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
                                        <th className="pb-4">USD APY</th>
                                        <th className="pb-4">Status</th>
                                        <th className="pb-4">Fee Rate</th>
                                        <th className="pb-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {jobs?.slice(0, 5).map((job, i) => (
                                        <DashboardPairRow key={job.job_id} job={job} index={i + 1} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title="Top Miners by Earnings" href="/admin/miners">
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {topEarners?.map((earner, i) => (
                                <div
                                    key={earner.miner_uid}
                                    className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
                                    onClick={() => router.push(`/admin/miners/${earner.miner_uid}`)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Miner</div>
                                            <Link
                                                href={`/admin/miners/${earner.miner_uid}`}
                                                className="text-sm font-black text-primary hover:underline hover:text-blue-600 truncate block font-mono"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                UID {earner.miner_uid} - {earner.miner_hotkey.slice(0, 8)}...
                                            </Link>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Rank</div>
                                            <div className="bg-cream-dark/20 px-2 py-1 rounded-lg text-xs font-black text-primary/60">#{i + 1}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Earnings (a)</div>
                                            <div className="text-xs font-black text-primary">{earner.estimated_earnings_alpha.toFixed(4)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Score</div>
                                            <div className="text-xs font-black text-blue-600">{(earner.score_percentage * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Earnings (USD)</div>
                                            <div className="text-xs font-black text-primary">${earner.estimated_earnings_usd.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {!topEarners && (
                                <div className="text-center py-10 text-primary/20 text-xs font-black uppercase tracking-widest animate-pulse">Loading miners...</div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead>
                                    <tr className="text-[10px] text-primary/30 font-black uppercase tracking-[0.2em] border-b border-cream-dark">
                                        <th className="pb-4">#</th>
                                        <th className="pb-4">Miner</th>
                                        <th className="pb-4">Score</th>
                                        <th className="pb-4">Earnings (a)</th>
                                        <th className="pb-4 text-right pr-4">Earnings (USD)</th>
                                        <th className="pb-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {topEarners?.map((earner, i) => (
                                        <tr key={earner.miner_uid} className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
                                            onClick={() => router.push(`/admin/miners/${earner.miner_uid}`)}>
                                            <td className="py-5 font-black text-primary/20">{i + 1}</td>
                                            <td className="py-5 font-bold text-primary/60">
                                                <Link href={`/admin/miners/${earner.miner_uid}`} className="hover:underline hover:text-blue-600 transition-all" onClick={(e) => e.stopPropagation()}>
                                                    UID {earner.miner_uid} - {earner.miner_hotkey.slice(0, 8)}...
                                                </Link>
                                            </td>
                                            <td className="py-5 font-black text-primary">{(earner.score_percentage * 100).toFixed(1)}%</td>
                                            <td className="py-5 font-black text-primary">{earner.estimated_earnings_alpha.toFixed(4)} a</td>
                                            <td className="py-5 font-black text-primary text-2xl tracking-tighter text-right pr-4">${earner.estimated_earnings_usd.toFixed(2)}</td>
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

// Dashboard Pair Row - fetches per-job metrics
function DashboardPairRow({ job, index }: { job: Job, index: number }) {
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: revenue } = useJobRevenue(job.job_id, 30);
    const { data: apy } = useJobAPY(job.job_id, 30);
    const router = useRouter();

    return (
        <tr className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
            onClick={() => router.push(`/admin/pairs/${job.job_id}`)}>
            <td className="py-5 font-black text-primary/20">{index}</td>
            <td className="py-5 font-black">
                <Link href={`/admin/pairs/${job.job_id}`} className="hover:underline hover:text-blue-600 transition-all font-black" onClick={(e) => e.stopPropagation()}>
                    {job.metadata?.pair_name || job.pair_address.slice(0, 10) + '...'}
                </Link>
            </td>
            <td className="py-5 font-bold text-primary/60">{formatUsd(tvl?.tvl_usd)}</td>
            <td className="py-5 font-bold text-primary/60">${(revenue?.revenue_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td className="py-5 font-black text-primary">{(apy?.apy_percent || 0).toFixed(1)}%</td>
            <td className="py-5">
                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${job.is_active ? 'bg-green-500 text-white shadow-sm shadow-green-200' : 'bg-red-500 text-white shadow-sm shadow-red-200'}`}>
                    {job.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td className="py-5 font-bold text-primary/30">{formatFeeRate(job.fee_rate)}</td>
            <td className="py-5 text-right">
                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
            </td>
        </tr>
    );
}

// Dashboard Pair Card (mobile)
function DashboardPairCard({ job, index }: { job: Job, index: number }) {
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: revenue } = useJobRevenue(job.job_id, 30);
    const { data: apy } = useJobAPY(job.job_id, 30);
    const router = useRouter();

    return (
        <div
            className="bg-cream/5 border border-cream-dark/50 rounded-2xl p-5 cursor-pointer hover:border-primary/20 transition-all"
            onClick={() => router.push(`/admin/pairs/${job.job_id}`)}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Pair</div>
                    <Link
                        href={`/admin/pairs/${job.job_id}`}
                        className="text-sm font-black text-primary hover:underline hover:text-blue-600 truncate block"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {job.metadata?.pair_name || job.pair_address.slice(0, 10) + '...'}
                    </Link>
                </div>
                <div className="text-right">
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Rank</div>
                    <div className="bg-cream-dark/20 px-2 py-1 rounded-lg text-xs font-black text-primary/60">#{index}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">TVL</div>
                    <div className="text-xs font-black text-primary">{formatUsd(tvl?.tvl_usd)}</div>
                </div>
                <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Fees</div>
                    <div className="text-xs font-black text-blue-600">${(revenue?.revenue_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-dashed border-cream-dark/50 pt-4">
                <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">USD APY</div>
                    <div className="text-xs font-black text-primary">{(apy?.apy_percent || 0).toFixed(1)}%</div>
                </div>
                <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-primary/30 mb-1">Status</div>
                    <div className={`text-xs font-black ${job.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {job.is_active ? 'Active' : 'Inactive'}
                    </div>
                </div>
            </div>
        </div>
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

function MetricCard({ label, value, change }: { label: string; value: string; change: string; trend: 'up' | 'down' | 'neutral' }) {
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
                <span className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">{change}</span>
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
