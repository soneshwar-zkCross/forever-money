'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    RefreshCw,
} from 'lucide-react';
import {
    useJobs,
    useNetworkStats,
    useJobRevenue,
    useJobTVL,
    useJobAPY,
    Job
} from '@/lib/api';
import Link from 'next/link';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export default function PairsPage() {
    const { data: jobs, isLoading } = useJobs();

    // User requested to remove mock pairs as they might be creating issues.
    // Displaying only real jobs fetched from the API.
    const displayJobs = jobs || [];

    const headerActions = (
        <button className="px-4 py-2 bg-primary text-white rounded-xl text-[9px] font-black shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center space-x-2 uppercase tracking-wider active:scale-95">
            <RefreshCw size={12} />
            <span>Sync All Pairs</span>
        </button>
    );

    return (
        <AdminLayout
            title="Trading Pairs"
            description="Monitor trading pairs and their active miners."
            icon={<Terminal size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Active Pairs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-48 bg-white/50 rounded-3xl animate-pulse border border-cream-dark" />)
                    ) : (
                        displayJobs.map(job => (
                            <PairCard key={job.job_id} job={job} />
                        ))
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

// Mock Jobs for Demonstration
const MOCK_JOBS: Job[] = [
    {
        job_id: 'job_cbbtc_usdc',
        pair_address: '0x...cbBTC',
        fee_rate: 0.05,
        target: 'cbBTC/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'cbBTC/USDC', description: 'Coinbase BTC / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolcbBTC',
        target_ratio: 0.5,
        created_at: new Date('2025-01-26').toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_weth_usdc',
        pair_address: '0x...WETH',
        fee_rate: 0.05,
        target: 'WETH/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'WETH/USDC', description: 'WETH/USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolWETH',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_eth_usdc',
        pair_address: '0x...ETH',
        fee_rate: 0.05,
        target: 'ETH/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 300,
        metadata: { pair_name: 'ETH/USDC', description: 'ETH/USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolETH',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_tao_usdc',
        pair_address: '0x...TAO',
        fee_rate: 0.08,
        target: 'Tao/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 900,
        metadata: { pair_name: 'Tao/USDC', description: 'Tao/USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolTAO',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_link_usdc',
        pair_address: '0x...LINK',
        fee_rate: 0.05,
        target: 'LINK/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'LINK/USDC', description: 'Chainlink / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolLINK',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_xaut_usdt',
        pair_address: '0x...XAUT',
        fee_rate: 0.04,
        target: 'XAUT/USDT',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 1200,
        metadata: { pair_name: 'XAUT/USDT', description: 'Tether Gold / USDT Vault' },
        sn_liquidity_manager_address: '0xMockPoolXAUT',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_xsn_usdc',
        pair_address: '0x...xSN',
        fee_rate: 0.1,
        target: 'xSN/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'xSN/USDC', description: 'xSN / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolxSN',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_bid_wbnb',
        pair_address: '0x...BID2',
        fee_rate: 0.1,
        target: 'BID/WBNB',
        chain_id: 56,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'BID/WBNB', description: 'BID/WBNB Vault' },
        sn_liquidity_manager_address: '0xMockPoolBID2',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_arb_usdc',
        pair_address: '0x...ARB',
        fee_rate: 0.04,
        target: 'ARB/USDC',
        chain_id: 42161,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'ARB/USDC', description: 'Arbitrum Vault' },
        sn_liquidity_manager_address: '0xMockPoolARB',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_sol_usdc',
        pair_address: '0x...SOL',
        fee_rate: 0.06,
        target: 'SOL/USDC',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 600,
        metadata: { pair_name: 'SOL/USDC', description: 'Solana / USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolSOL',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

function PairCard({ job }: { job: Job }) {
    const { data: stats, isLoading: statsLoading } = useNetworkStats(job.job_id);
    const { data: revenue, isLoading: revenueLoading } = useJobRevenue(job.job_id, 30);
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: apy } = useJobAPY(job.job_id, 30);

    const [token0Symbol, token1Symbol] = job.metadata.pair_name.split('/') || ['T0', 'T1'];

    // Mock chart data for the mini display
    const chartData = React.useMemo(() => {
        const baseValue = tvl?.tvl_usd || 1000000;
        return Array.from({ length: 7 }, (_, i) => ({
            day: i,
            value: baseValue + (Math.sin(i) * baseValue * 0.1) + (Math.random() * baseValue * 0.05)
        }));
    }, [tvl]);

    return (
        <Link
            href={`/admin/pairs/${job.job_id}`}
            className="bg-white p-6 rounded-3xl border border-cream-dark shadow-sm hover:shadow-md transition-all duration-500 font-mono text-primary flex flex-col h-full overflow-hidden cursor-pointer group/card"
        >
            {/* Header Section */}
            <div className="border-t border-dashed border-primary/10 mb-4" />
            <div className="flex justify-between items-center mb-4 text-[13px] font-black uppercase tracking-tight">
                <span>PAIR PERFORMANCE — {token0Symbol} / {token1Symbol}</span>
            </div>
            <div className="border-t border-dashed border-primary/10 mb-6" />

            {/* Metrics Section */}
            <div className="flex justify-between mb-8 border-b border-dashed border-primary/10 pb-6 mt-2">
                <div className="flex flex-col">
                    <span className="text-sm font-black text-blue-600">${((tvl?.tvl_usd || 0) / 1000000).toFixed(1)}M</span>
                    <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">TVL</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-black text-blue-600">
                        {revenueLoading ? '...' : `$${((revenue?.revenue_usd || 0) / 1000).toFixed(0)}k`}
                    </span>
                    <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">REVENUE</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-blue-600">{stats?.total_miners || 0}</span>
                    <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">ACTIVE JOBS</span>
                </div>
            </div>

            {/* Performance Over Time Section */}
            <div className="border-t border-dashed border-primary/10 mb-2" />
            <div className="text-[11px] font-black uppercase mb-2 opacity-30">
                PAIR PERFORMANCE OVER TIME
            </div>
            <div className="border-t border-dashed border-primary/10 mb-4" />

            {/* Line Chart */}
            <div className="h-24 w-full mb-6 relative group/chart">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white px-2 py-1 border border-cream-dark text-[10px] shadow-sm">
                                            ${(payload[0].value as number).toLocaleString()}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
                {/* Chart Overlay for visual flair */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
            </div>

            {/* Active Jobs Section */}
            <div className="border-t border-dashed border-primary/10 mb-2" />
            <div className="text-[11px] font-black uppercase mb-2 opacity-30">
                ACTIVE JOBS
            </div>
            <div className="border-t border-dashed border-primary/10 mb-4" />

            {/* Card Footer Decorator */}
            <div className="mt-auto pt-4 border-t border-dashed border-primary/10 text-[10px] font-bold text-primary/40 flex justify-between uppercase">
                <span>Network Status: Online</span>
                <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span>Live</span>
                </div>
            </div>
        </Link>
    );
}

// Removing Activity Feed Component as requested
