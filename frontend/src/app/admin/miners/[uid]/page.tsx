'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
    ReferenceDot,
    Label
} from 'recharts';
import { useMinerWinRate } from '@/lib/metrics-hooks';
import { useJobs, useMinerVaults } from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    ArrowLeft,
    Info,
    ChevronDown,
    LayoutGrid,
    ChevronRight
} from 'lucide-react';

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
                    <div className="text-primary/40 animate-pulse font-mono uppercase font-black tracking-widest text-[10px]">
                        Initializing Terminal...
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const isVaultSpecific = !!jobId;
    const selectedJob = jobs?.find(j => j.job_id === jobId);
    const [token0Symbol, token1Symbol] = selectedJob?.metadata.pair_name.split('/') || ['cbBTC', 'USDC'];

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
                        <div className="px-3 py-1 bg-green-50 text-green-600 border border-green-100/50 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            Active
                        </div>
                    </div>
                </div>

                {isVaultSpecific ? (
                    <VaultPerformanceView
                        minerUid={minerUid}
                        token0Symbol={token0Symbol}
                        token1Symbol={token1Symbol}
                        winRateData={winRateData}
                    />
                ) : (
                    <MinerPerformanceView
                        minerUid={minerUid}
                        minerVaults={minerVaults}
                        winRateData={winRateData}
                        token0Symbol={token0Symbol}
                        token1Symbol={token1Symbol}
                    />
                )}
            </div>
        </AdminLayout>
    );
}

function VaultPerformanceView({ minerUid, token0Symbol, token1Symbol, winRateData }: any) {
    const [timeframe, setTimeframe] = useState('30D');
    const [filter, setFilter] = useState('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const timeframes = ['1D', '7D', '30D', 'ALL'];
    const filters = ['All', 'Deposits', 'Withdrawals', 'Fees', 'Inventory Gain or Loss'];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Metrics (6 boxes) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStatBox label="Net Deposit (USD)" value={`$173,498`} />
                <MiniStatBox label="Fees Earned (USD)" value={`$3,675`} />
                <MiniStatBox label={`APY ${token0Symbol} / ${token1Symbol}`} value={`32.5% / 15.2%`} />
                <MiniStatBox label="APY (USD)" value={`2.5%`} />
                <MiniStatBox label="Benchmark Market" value="22.5%" />
                <MiniStatBox label="Rounds" value="12" />
            </div>

            {/* Vault Growth Chart */}
            <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex justify-between items-start mb-10">
                    <div className="flex flex-col space-y-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Vault Growth</span>
                        <div className="flex items-center space-x-6 mt-2">
                            <LegendItem color="bg-black" label="Growth (USD)" />
                            <LegendItem color="bg-blue-500" label={`Growth - Token 1 (${token0Symbol})`} />
                            <LegendItem color="bg-green-500" label={`Growth - Token 2 (${token1Symbol})`} />
                        </div>
                    </div>
                    <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm">
                        {timeframes.map(t => (
                            <button
                                key={t}
                                onClick={() => setTimeframe(t)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${timeframe === t
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
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getMockGrowthData()}>
                            <defs>
                                <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
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
                                tickFormatter={(val) => `$${val / 1000}k`}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 900, fill: '#3b82f6' }}
                                tickFormatter={(val) => `$${val / 1000}k`}
                            />
                            <Tooltip
                                content={({ active, payload }) => (
                                    active && payload ? (
                                        <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                            <div className="text-primary/30 mb-2">{payload[0].payload.time}</div>
                                            {payload.map((p: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center space-x-4 mb-1 last:mb-0">
                                                    <span className="uppercase tracking-widest opacity-40">{p.name}:</span>
                                                    <span style={{ color: p.color }}>${(p.value as number).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null
                                )}
                            />
                            <Area type="monotone" dataKey="usd" name="Growth (USD)" stroke="#000" strokeWidth={2} fill="url(#colorUsd)" dot={false} />
                            <Area type="monotone" dataKey="t1" name="Token 1" stroke="#3b82f6" strokeWidth={2} fill="transparent" dot={false} yAxisId="right" />
                            <Area type="monotone" dataKey="t2" name="Token 2" stroke="#22c55e" strokeWidth={2} fill="transparent" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Capital Flow and PnL Chart */}
            <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex justify-between items-start mb-10">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Capital Flow and PNL</span>
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className="bg-white border border-cream-dark px-4 py-1.5 rounded-xl flex items-center space-x-2 hover:border-primary/20 transition-all shadow-sm text-[9px] font-black uppercase tracking-widest"
                            >
                                <span>{filter}</span>
                                <ChevronDown size={12} className={`text-primary/20 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-cream-dark rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                                    {filters.map(f => (
                                        <button
                                            key={f}
                                            onClick={() => {
                                                setFilter(f);
                                                setIsFilterOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest hover:bg-cream/30 transition-colors text-primary"
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex bg-white/50 border border-cream-dark rounded-xl p-1 shadow-sm">
                            {timeframes.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimeframe(t)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${timeframe === t
                                            ? 'bg-primary text-white shadow-md'
                                            : 'text-primary/30 hover:text-primary/50'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-80 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getMockFlowData()} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#0C206010" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fontWeight: 900, fill: '#0C206020' }}
                                tickFormatter={(val) => `$${val / 1000}k`}
                            />
                            <Tooltip
                                content={({ active, payload }) => (
                                    active && payload ? (
                                        <div className="bg-white p-3 border border-cream-dark rounded-xl shadow-xl text-[10px] font-bold">
                                            <div className="text-primary/30 mb-1">{payload[0].payload.date}</div>
                                            <div className="text-primary">${(payload[0].value as number).toLocaleString()}</div>
                                        </div>
                                    ) : null
                                )}
                            />
                            <Line
                                type="stepAfter"
                                dataKey="value"
                                stroke="#000"
                                strokeWidth={2}
                                dot={false}
                            />
                            <ReferenceDot x="Jan 19" y={5000} r={4} fill="#000" stroke="#fff" strokeWidth={2}>
                                <Label
                                    value="Initial Deposit $4,890.12"
                                    position="top"
                                    offset={10}
                                    content={(props: any) => (
                                        <g>
                                            <rect x={props.viewBox.x - 45} y={props.viewBox.y - 45} width={90} height={35} rx={8} fill="white" stroke="#0C206010" />
                                            <text x={props.viewBox.x} y={props.viewBox.y - 30} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0C206030" className="uppercase tracking-widest">Initial Deposit</text>
                                            <text x={props.viewBox.x} y={props.viewBox.y - 20} textAnchor="middle" fontSize="9" fontWeight="900" fill="#0C2060">$4,890.12</text>
                                            <line x1={props.viewBox.x} y1={props.viewBox.y - 10} x2={props.viewBox.x} y2={props.viewBox.y} stroke="#0C206010" strokeDasharray="2 2" />
                                        </g>
                                    )}
                                />
                            </ReferenceDot>
                            <ReferenceDot x="Feb 08" y={2200} r={4} fill="#000" stroke="#fff" strokeWidth={2}>
                                <Label
                                    value="Withdrawal $890.12"
                                    position="top"
                                    offset={10}
                                    content={(props: any) => (
                                        <g>
                                            <rect x={props.viewBox.x - 45} y={props.viewBox.y - 45} width={90} height={35} rx={8} fill="white" stroke="#0C206010" />
                                            <text x={props.viewBox.x} y={props.viewBox.y - 30} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0C206030" className="uppercase tracking-widest">Withdrawal</text>
                                            <text x={props.viewBox.x} y={props.viewBox.y - 20} textAnchor="middle" fontSize="9" fontWeight="900" fill="#0C2060">$890.12</text>
                                            <line x1={props.viewBox.x} y1={props.viewBox.y - 10} x2={props.viewBox.x} y2={props.viewBox.y} stroke="#0C206010" strokeDasharray="2 2" />
                                        </g>
                                    )}
                                />
                            </ReferenceDot>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Inventory Overview Card */}
            <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex items-center justify-between mb-8">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Inventory Overview</span>
                    <Info size={14} className="text-primary/20" />
                </div>
                <div className="space-y-6 pt-2 border-t border-dashed border-cream-dark/50">
                    <InventoryRow label="Current:" tokens={`13,483 ${token0Symbol} / 1 ${token1Symbol}`} value={`$73,498`} />
                    <InventoryRow label="Fees Earned:" tokens={`4,587 ${token0Symbol} / 0.23 ${token1Symbol}`} value={`$3,675`} />
                    <InventoryRow label="APY:" tokens={`23.5% ${token0Symbol} / 20.45% ${token1Symbol}`} value={`17.3% USD`} isBlue />
                    <div className="border-t border-dashed border-cream-dark/50 pt-2" />
                    <InventoryRow label="Net Deposited:" tokens={`130,483 ${token0Symbol} / 10 ${token1Symbol}`} value={`$173,498`} />
                    <InventoryRow label="Net Withdrawn:" tokens={`100,000 ${token0Symbol} / 9 ${token1Symbol}`} value={`$100,000`} isBlue />
                </div>
            </div>
        </div>
    );
}

function MinerPerformanceView({ minerUid, minerVaults, winRateData, token0Symbol, token1Symbol }: any) {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page 4 implementation (reuse patterns from above) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStatBox label="Total TVL (USD)" value={`$173,498`} />
                <MiniStatBox label="Fees Earned (USD)" value={`$3,675`} />
                <MiniStatBox label="APY (USD)" value={`2.5%`} />
                <MiniStatBox label="Benchmark Market" value="22.5%" />
                <MiniStatBox label="Active Vaults" value={`${minerVaults?.active_vaults || 3}`} />
                <MiniStatBox label="Rounds" value={`${winRateData?.total_participations || 148}`} />
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm text-primary">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/30">Active Vaults by Miner</span>
                    <LayoutGrid size={14} className="text-primary/20" />
                </div>
                <div className="border-t border-dashed border-cream-dark/50 mb-6" />

                <table className="w-full text-[10px] font-bold">
                    <thead>
                        <tr className="text-primary/20 text-left border-b border-cream-dark/30">
                            <th className="pb-4 uppercase tracking-widest">Vault No.</th>
                            <th className="pb-4 uppercase tracking-widest">Pair</th>
                            <th className="pb-4 uppercase tracking-widest">Chain</th>
                            <th className="pb-4 uppercase tracking-widest">TVL USD</th>
                            <th className="pb-4 uppercase tracking-widest">Fees USD</th>
                            <th className="pb-4 uppercase tracking-widest">APY USD</th>
                            <th className="pb-4 uppercase tracking-widest">Benchmark</th>
                            <th className="pb-4"></th>
                        </tr>
                    </thead>
                    <tbody className="text-primary">
                        {(minerVaults?.vaults || []).map((vault: any, i: number) => (
                            <tr key={i} className="hover:bg-cream/20 transition-colors border-b border-cream-dark/10 last:border-0 group cursor-pointer"
                                onClick={() => window.location.href = `/admin/miners/${minerUid}?pair=${vault.job_id}`}>
                                <td className="py-5 font-black">Vault #{vault.vault_id}</td>
                                <td className="py-5 uppercase tracking-wide">{vault.pair_name}</td>
                                <td className="py-5 opacity-40 uppercase">Base</td>
                                <td className="py-5">$73,498</td>
                                <td className="py-5 text-blue-600">$3,675</td>
                                <td className="py-5">42.5%</td>
                                <td className="py-5 opacity-30">21.5%</td>
                                <td className="py-5 text-right">
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

function MiniStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-6 rounded-[32px] border border-cream-dark shadow-sm flex flex-col justify-between h-full hover:bg-cream/5 transition-all duration-300">
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
        <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-primary/20 uppercase tracking-widest w-40">{label}</span>
            <div className="flex-1 flex justify-between items-center ml-10">
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

// Mock Data Generators
function getMockGrowthData() {
    return [
        { time: '00:00', usd: 4200, t1: 4400, t2: 4100 },
        { time: '04:00', usd: 5800, t1: 6200, t2: 5200 },
        { time: '08:00', usd: 4800, t1: 4600, t2: 6000 },
        { time: '12:00', usd: 6200, t1: 5200, t2: 4400 },
        { time: '16:00', usd: 8400, t1: 8200, t2: 7800 },
        { time: '20:00', usd: 9200, t1: 9800, t2: 6200 },
        { time: '23:59', usd: 12000, t1: 14000, t2: 13000 },
    ];
}

function getMockFlowData() {
    return [
        { date: 'Jan 10', value: 5000 },
        { date: 'Jan 19', value: 5000 },
        { date: 'Jan 19', value: 4890 },
        { date: 'Jan 25', value: 4890 },
        { date: 'Feb 02', value: 1800 },
        { date: 'Feb 08', value: 1800 },
        { date: 'Feb 08', value: 2200 },
        { date: 'Feb 12', value: 12000 },
        { date: 'Feb 18', value: 12000 },
        { date: 'Mar 01', value: 12000 },
    ];
}
