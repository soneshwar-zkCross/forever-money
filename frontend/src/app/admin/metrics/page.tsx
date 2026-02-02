'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Monitor, DollarSign, TrendingUp, Award, Flame, Users } from 'lucide-react';
import { useSubnetRevenue, useSubnetEmissions, useTopEarners, usePairPerformance } from '@/lib/api';

export default function MetricsPage() {
    const { data: revenue, isLoading: revenueLoading } = useSubnetRevenue(30);
    const { data: emissions, isLoading: emissionsLoading } = useSubnetEmissions();
    const { data: topEarners, isLoading: earnersLoading } = useTopEarners(5);
    const { data: pairs, isLoading: pairsLoading } = usePairPerformance();

    return (
        <AdminLayout
            title="Network Metrics"
            description="Real-time subnet revenue, emissions, and performance analytics."
            icon={<Monitor size={20} />}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <MetricCard
                        label="Total Revenue (30d)"
                        value={revenueLoading ? "..." : `$${revenue?.total_revenue_usd.toFixed(2) || '0.00'}`}
                        status={`${revenue?.vault_count || 0} Vaults`}
                        statusColor="bg-green-50 text-green-600"
                        icon={<DollarSign size={20} />}
                        isLoading={revenueLoading}
                    />
                    <MetricCard
                        label="Miner Emissions"
                        value={emissionsLoading ? "..." : `${emissions?.miner_alpha.toFixed(2) || '0'} α`}
                        status={`${((emissions?.miner_ratio || 0) * 100).toFixed(1)}% to Miners`}
                        statusColor="bg-blue-50 text-blue-600"
                        icon={<TrendingUp size={20} />}
                        isLoading={emissionsLoading}
                    />
                    <MetricCard
                        label="Burn Rate"
                        value={emissionsLoading ? "..." : `${((emissions?.burn_ratio || 0) * 100).toFixed(1)}%`}
                        status={`${emissions?.burn_alpha.toFixed(2) || '0'} α Burned`}
                        statusColor="bg-orange-50 text-orange-600"
                        icon={<Flame size={20} />}
                        isLoading={emissionsLoading}
                    />
                </div>

                {/* Emissions Breakdown */}
                <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-10">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 bg-cream rounded-2xl text-primary/40">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-primary tracking-tight">Emissions Distribution</h3>
                            <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                                Alpha Price: ${emissions?.alpha_price_usd.toFixed(4) || '0.0000'}
                            </p>
                        </div>
                    </div>

                    {emissionsLoading ? (
                        <div className="text-center py-8 text-primary/40">Loading emissions data...</div>
                    ) : (
                        <div className="space-y-6">
                            <EmissionsBar
                                label="Miner Allocation"
                                alpha={emissions?.miner_alpha || 0}
                                usd={emissions?.miner_usd || 0}
                                percentage={emissions?.miner_ratio || 0}
                                color="bg-blue-500"
                            />
                            <EmissionsBar
                                label="Burn (UID 0)"
                                alpha={emissions?.burn_alpha || 0}
                                usd={emissions?.burn_usd || 0}
                                percentage={emissions?.burn_ratio || 0}
                                color="bg-orange-500"
                            />
                            <div className="pt-4 border-t border-cream-dark">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-primary">Total Subnet Emissions</span>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary">
                                            {emissions?.total_emissions_alpha.toFixed(2) || '0'} α
                                        </p>
                                        <p className="text-xs font-medium text-primary/40">
                                            ${emissions?.total_emissions_usd.toFixed(2) || '0'} USD
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Top Earners */}
                <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-10">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 bg-cream rounded-2xl text-primary/40">
                            <Award size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-primary tracking-tight">Top Earning Miners</h3>
                            <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">By Estimated Earnings</p>
                        </div>
                    </div>

                    {earnersLoading ? (
                        <div className="text-center py-8 text-primary/40">Loading top earners...</div>
                    ) : (
                        <div className="space-y-4">
                            {topEarners?.map((earner, idx) => (
                                <div
                                    key={earner.miner_uid}
                                    className="flex items-center justify-between p-4 bg-cream/30 rounded-2xl hover:bg-cream/50 transition-colors"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-black">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-primary">UID {earner.miner_uid}</p>
                                            <p className="text-[10px] font-mono text-primary/40">
                                                {earner.miner_hotkey.slice(0, 12)}...
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-primary">
                                            {earner.estimated_earnings_alpha.toFixed(4)} α
                                        </p>
                                        <p className="text-xs font-medium text-primary/40">
                                            ${earner.estimated_earnings_usd.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pair Performance */}
                <div className="bg-primary text-white rounded-[40px] shadow-xl p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                    <div className="relative z-10">
                        <div className="flex items-center space-x-4 mb-8">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Pair Performance</h3>
                                <p className="text-white/60 font-medium">Revenue by Trading Pair</p>
                            </div>
                        </div>

                        {pairsLoading ? (
                            <div className="text-center py-8 text-white/40">Loading pair performance...</div>
                        ) : (
                            <div className="space-y-4">
                                {pairs?.slice(0, 3).map((pair) => (
                                    <div
                                        key={pair.pair_address}
                                        className="p-6 bg-white/10 rounded-2xl backdrop-blur-md"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-mono text-white/60 mb-1">
                                                    {pair.pair_address.slice(0, 10)}...{pair.pair_address.slice(-8)}
                                                </p>
                                                <p className="text-xs text-white/40">
                                                    {pair.vault_count} vault{pair.vault_count !== 1 ? 's' : ''} • {pair.total_miners} miners
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black">${pair.total_revenue_usd.toFixed(2)}</p>
                                                <p className="text-xs text-white/60">Total Revenue</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricCard({
    label,
    value,
    status,
    statusColor,
    icon,
    isLoading
}: {
    label: string,
    value: string,
    status: string,
    statusColor: string,
    icon: React.ReactNode,
    isLoading?: boolean
}) {
    return (
        <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
            <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 bg-cream/50 text-primary rounded-2xl">
                    {icon}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                    {status}
                </span>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-primary/20 uppercase tracking-[0.2em]">{label}</p>
                <p className="text-3xl font-black text-primary tracking-tighter">
                    {isLoading ? <span className="animate-pulse">...</span> : value}
                </p>
            </div>
        </div>
    );
}

function EmissionsBar({
    label,
    alpha,
    usd,
    percentage,
    color
}: {
    label: string,
    alpha: number,
    usd: number,
    percentage: number,
    color: string
}) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-primary">{label}</span>
                <div className="text-right">
                    <p className="text-primary">{alpha.toFixed(2)} α</p>
                    <p className="text-primary/40">${usd.toFixed(2)}</p>
                </div>
            </div>
            <div className="h-3 bg-cream rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage * 100}%` }}
                ></div>
            </div>
        </div>
    );
}
