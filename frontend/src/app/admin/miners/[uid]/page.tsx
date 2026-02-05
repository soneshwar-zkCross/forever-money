'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { useMinerWinRate } from '@/lib/metrics-hooks';
import { useJobs, useMinerVaults } from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import { Terminal, ArrowLeft, Activity, Info, ChevronRight, LayoutGrid } from 'lucide-react';

export default function MinerDetailsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const minerUid = parseInt(params?.uid as string) || 0;
    const jobId = searchParams.get('pair');

    const { data: winRateData, isLoading: winRateLoading } = useMinerWinRate(minerUid, jobId || undefined);
    const { data: jobs } = useJobs();
    const { data: minerVaults } = useMinerVaults(minerUid);

    if (winRateLoading || !minerUid) {
        return (
            <AdminLayout title="Loading..." description="Fetching performance details" icon={<Terminal size={20} />}>
                <div className="flex items-center justify-center py-20">
                    <div className="text-primary/40 animate-pulse font-mono uppercase font-black tracking-widest">
                        Initializing Terminal...
                    </div>
                </div>
            </AdminLayout>
        );
    }

    // Determine if we are showing Page 3 (Vault Specific) or Page 4 (Miner Global)
    const isVaultSpecific = !!jobId;
    const selectedJob = jobs?.find(j => j.job_id === jobId);
    const [token0Symbol, token1Symbol] = selectedJob?.metadata.pair_name.split('/') || ['T0', 'T1'];

    return (
        <AdminLayout
            title={isVaultSpecific
                ? `Vault #${minerUid} | ${token0Symbol} / ${token1Symbol} | Aerodrome | Base`
                : `Miner ID: 5F${minerUid.toString().padStart(6, '0')}`
            }
            description={isVaultSpecific ? `Start Date: 25/01/26` : `Global Miner Performance — Page 4`}
            icon={<Terminal size={20} />}
        >
            <div className="space-y-6 pb-20 font-mono text-primary">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-2">
                    <Link
                        href={isVaultSpecific ? `/admin/miners/${minerUid}` : "/admin/miners"}
                        className="flex items-center space-x-2 text-sm text-primary/60 hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to {isVaultSpecific ? 'Miner Board' : 'Miners'}</span>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-black uppercase">
                            Active
                        </div>
                    </div>
                </div>

                {isVaultSpecific ? (
                    /* Page 3: Vault Performance View */
                    <VaultPerformanceView
                        minerUid={minerUid}
                        token0Symbol={token0Symbol}
                        token1Symbol={token1Symbol}
                        winRateData={winRateData}
                    />
                ) : (
                    /* Page 4: Global Miner Performance View */
                    <MinerPerformanceView
                        minerUid={minerUid}
                        minerVaults={minerVaults}
                        winRateData={winRateData}
                    />
                )}
            </div>
        </AdminLayout>
    );
}

function MinerPerformanceView({ minerUid, minerVaults, winRateData }: any) {
    return (
        <div className="space-y-6">
            {/* 6 High Density Stat Boxes - Page 4 Style */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStatBox label="Total TVL (USD)" value={`$173,498`} />
                <MiniStatBox label="Fees Earned (USD)" value={`$3,675`} />
                <MiniStatBox label="APY (USD)" value={`2.5%`} />
                <MiniStatBox label="Benchmark Market" value="22.5%" />
                <MiniStatBox label="Active Vaults" value={`${minerVaults?.active_vaults || 3}`} />
                <MiniStatBox label="Rounds" value={`${winRateData?.total_participations || 148}`} />
            </div>

            {/* Global Performance Chart */}
            <div className="bg-white p-8 rounded-[32px] border border-cream-dark shadow-sm font-mono text-primary flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black uppercase tracking-tight">
                            Earnings (USD) | Capital Deployed | Vault Value
                        </span>
                        <span className="text-[10px] uppercase opacity-30 font-bold mt-1">Performance Over Time</span>
                    </div>
                    <div className="flex items-center space-x-4 text-[10px] font-black uppercase bg-cream/20 px-4 py-2 rounded-xl">
                        <span className="opacity-40">TF:</span>
                        <button className="hover:text-blue-600 transition-colors">1D</button>
                        <span>|</span>
                        <button className="hover:text-blue-600 transition-colors">7D</button>
                        <span>|</span>
                        <button className="text-blue-600">30D</button>
                        <span>|</span>
                        <button className="hover:text-blue-600 transition-colors">All</button>
                    </div>
                </div>
                <div className="border-t border-dashed border-primary/10 mb-8" />
                <div className="h-64 w-full mb-6 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Array.from({ length: 30 }, (_, i) => ({ day: i, value: i * 500 + Math.random() * 2000 }))}>
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip
                                content={({ active, payload }) => (
                                    active && payload ? <div className="bg-white px-2 py-1 border border-cream-dark text-[10px] shadow-sm">${(payload[0].value as number).toLocaleString()}</div> : null
                                )}
                            />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f620" strokeWidth={3} dot={false} animationDuration={1500} />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[9px] font-black opacity-20 uppercase tracking-widest -translate-x-4">USD</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-black opacity-20 uppercase tracking-widest translate-y-4">Time</div>
                </div>
            </div>

            {/* Active Vaults by Miner Table */}
            <div className="bg-white p-8 rounded-[32px] border border-cream-dark shadow-sm text-primary">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[13px] font-black uppercase tracking-tight">Active Vaults by Miner</span>
                    <LayoutGrid size={14} className="opacity-20" />
                </div>
                <div className="border-t border-dashed border-primary/10 mb-6" />

                <table className="w-full text-[11px] font-mono">
                    <thead>
                        <tr className="text-primary/30 text-left border-b border-cream-dark">
                            <th className="pb-3 font-black uppercase tracking-tighter">Vault No.</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">Pair</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">Chain</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">TVL USD</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">Fees USD</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">APY USD</th>
                            <th className="pb-3 font-black uppercase tracking-tighter">Benchmark</th>
                            <th className="pb-3"></th>
                        </tr>
                    </thead>
                    <tbody className="text-primary">
                        {(minerVaults?.vaults || []).map((vault: any, i: number) => (
                            <tr key={i} className="hover:bg-cream/20 transition-colors border-b border-cream-dark/30 last:border-0 group cursor-pointer"
                                onClick={() => window.location.href = `/admin/miners/${minerUid}?pair=${vault.job_id}`}>
                                <td className="py-4 font-black">Vault #{vault.vault_id}</td>
                                <td className="py-4 font-bold">{vault.pair_name}</td>
                                <td className="py-4 opacity-60">Base</td>
                                <td className="py-4 font-bold">${vault.revenue_usd.toLocaleString()}</td>
                                <td className="py-4 font-bold text-blue-600">${(vault.revenue_usd * 0.05).toLocaleString()}</td>
                                <td className="py-4 font-bold">42.5%</td>
                                <td className="py-4 font-bold opacity-40">21.5%</td>
                                <td className="py-4 text-right">
                                    <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function VaultPerformanceView({ minerUid, token0Symbol, token1Symbol, winRateData }: any) {
    return (
        <div className="space-y-6">
            {/* 6 High Density Metric Boxes - Page 3 Style */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStatBox label="Net Deposit (USD)" value={`$173,498`} />
                <MiniStatBox label="Fees Earned (USD)" value={`$3,675`} />
                <MiniStatBox label={`APY ${token0Symbol} / ${token1Symbol}`} value={`32.5% / 15.2%`} />
                <MiniStatBox label="APY (USD)" value={`2.5%`} />
                <MiniStatBox label="Benchmark Market" value="22.5%" />
                <MiniStatBox label="Rounds" value={`${winRateData?.total_participations || 148}`} />
            </div>

            {/* Vault Performance Chart */}
            <div className="bg-white p-8 rounded-[32px] border border-cream-dark shadow-sm font-mono text-primary flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black uppercase tracking-tight">
                            {token0Symbol}/{token1Symbol} Price | Vault Growth (USD)
                        </span>
                        <span className="text-[10px] uppercase opacity-30 font-bold mt-1">Performance Over Time</span>
                    </div>
                    <div className="flex items-center space-x-4 text-[10px] font-black uppercase bg-cream/20 px-4 py-2 rounded-xl">
                        <span className="opacity-40">TF:</span>
                        <button className="hover:text-blue-600 transition-colors">1D</button>
                        <span>|</span>
                        <button className="hover:text-blue-600 transition-colors">7D</button>
                        <span>|</span>
                        <button className="text-blue-600">30D</button>
                        <span>|</span>
                        <button className="hover:text-blue-600 transition-colors">All</button>
                    </div>
                </div>
                <div className="border-t border-dashed border-primary/10 mb-8" />
                <div className="h-64 w-full mb-6 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={Array.from({ length: 30 }, (_, i) => ({ day: i, value: 50000 + (Math.sin(i / 2) * 5000) + (i * 200) }))}>
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip
                                content={({ active, payload }) => (
                                    active && payload ? <div className="bg-white px-2 py-1 border border-cream-dark text-[10px] shadow-sm">${(payload[0].value as number).toLocaleString()}</div> : null
                                )}
                            />
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={1500} />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[9px] font-black opacity-20 uppercase tracking-widest -translate-x-4">USD</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-black opacity-20 uppercase tracking-widest translate-y-4">Time</div>
                </div>
            </div>

            {/* Inventory Overview Card */}
            <div className="bg-white p-8 rounded-[32px] border border-cream-dark shadow-sm text-primary flex flex-col">
                <div className="border-t border-dashed border-primary/10 mb-4" />
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-black uppercase tracking-tight">Inventory Overview</span>
                    <Info size={14} className="opacity-20" />
                </div>
                <div className="border-t border-dashed border-primary/10 mb-8" />
                <div className="space-y-6">
                    <InventoryRow label="Current:" tokens={`13,483 ${token0Symbol} / 1 ${token1Symbol}`} value={`$73,498`} />
                    <InventoryRow label="Fees Earned:" tokens={`4,587 ${token0Symbol} / 0.23 ${token1Symbol}`} value={`$3,675`} />
                    <InventoryRow label="APY:" tokens={`23.5% ${token0Symbol} / 20.45% ${token1Symbol}`} value={`17.3% USD`} />
                    <div className="border-t border-dashed border-primary/10 py-2" />
                    <InventoryRow label="Net Deposited:" tokens={`130,483 ${token0Symbol} / 10 ${token1Symbol}`} value={`$173,498`} />
                    <InventoryRow label="Net Withdrawn:" tokens={`100,000 ${token0Symbol} / 9 ${token1Symbol}`} value={`$100,000`} />
                </div>
            </div>
        </div>
    );
}

function MiniStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-4 rounded-2xl border border-cream-dark shadow-sm font-mono flex flex-col justify-between h-full hover:bg-cream/5 transition-colors">
            <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest mb-2 leading-tight">
                {label}
            </span>
            <span className="text-sm font-black text-primary tracking-tight">
                {value}
            </span>
        </div>
    );
}

function InventoryRow({ label, tokens, value }: { label: string; tokens: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs font-bold font-mono">
            <span className="opacity-40 uppercase w-32">{label}</span>
            <div className="flex flex-grow justify-between items-center max-w-lg">
                <span className="text-primary">{tokens}</span>
                <span className="text-blue-600 font-black">{value}</span>
            </div>
        </div>
    );
}
