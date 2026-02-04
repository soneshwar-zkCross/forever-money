'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    Play,
    Clock,
    Activity,
    RefreshCw,
    ChevronRight,
    Users,
    Zap,
    Hash,
    Layers,
    ArrowUpRight,
    CheckCircle2,
    AlertCircle,
    DollarSign
} from 'lucide-react';
import {
    useJobs,
    useNetworkStats,
    useJobRevenue,
    useJobTVL,
    useJobPnL,
    useJobAPY,
    Job
} from '@/lib/api';
import Link from 'next/link';

export default function PairsPage() {
    const { data: jobs, isLoading } = useJobs();

    // Use mock jobs if API returns empty (for demo purposes)
    const displayJobs = (jobs && jobs.length > 0) ? jobs : MOCK_JOBS;

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

                {/* Activity Feed / Logs Section */}
                <ActivityFeed jobs={displayJobs || []} />
            </div>
        </AdminLayout>
    );
}

import { X, FileJson } from 'lucide-react';

// Mock Jobs for Demonstration
const MOCK_JOBS: Job[] = [
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
        round_duration_seconds: 900, // 15 min
        metadata: { pair_name: 'Tao/USDC', description: 'Tao/USDC Vault' },
        sn_liquidity_manager_address: '0xMockPoolTAO',
        target_ratio: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        job_id: 'job_bid_weth',
        pair_address: '0x...BID1',
        fee_rate: 0.1,
        target: 'BID/WETH',
        chain_id: 1,
        is_active: true,
        round_duration_seconds: 1200, // 20 min
        metadata: { pair_name: 'BID/WETH', description: 'BID/WETH Vault' },
        sn_liquidity_manager_address: '0xMockPoolBID1',
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
    }
];

// Mock Data for Demonstration
const MOCK_LOGS = [
    {
        execution_id: 'exec_1',
        round_number: 142,
        miner_hotkey: '5H3jiA...x9Jk',
        pair_name: 'WETH/USDC',
        tx_hash: '0x99A43bbDF9D098eEC7bCEda4e2494615dfD9bB8B',
        tx_status: 'success',
        executed_at: new Date().toISOString(),
        strategy_data: {
            action: 'REBALANCE',
            direction: 'SELL_WETH_BUY_USDC',
            amount_in: '12.5 WETH',
            amount_out_min: '45,200 USDC',
            slippage_tolerance: '0.5%',
            reason: 'Divergence > 2.5%'
        }
    },
    {
        execution_id: 'exec_2',
        round_number: 142,
        miner_hotkey: '5Df8gB...m2Lp',
        pair_name: 'Tao/USDC',
        tx_hash: '0x1fa...456',
        tx_status: 'success',
        executed_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        strategy_data: {
            action: 'HOLD',
            current_spread: '0.1%',
            threshold: '1.0%',
            notes: 'Spread within optimal range'
        }
    },
    {
        execution_id: 'exec_3',
        round_number: 100,
        miner_hotkey: '5Kp9xC...q4Nr',
        pair_name: 'BID/WBNB',
        tx_hash: '0x789...012',
        tx_status: 'failed',
        executed_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        strategy_data: {
            action: 'REBALANCE',
            error: 'Gas limit exceeded',
            gas_used: 5000000,
            target_alloc: '40% BID / 60% WBNB'
        }
    },
    {
        execution_id: 'exec_4',
        round_number: 141,
        miner_hotkey: '5Ab1yD...s6Ot',
        pair_name: 'ETH/USDC',
        tx_hash: '0x345...678',
        tx_status: 'success',
        executed_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        strategy_data: {
            action: 'REBALANCE',
            direction: 'BUY_ETH_SELL_USDC',
            amount_in: '100,000 USDC',
            amount_out_min: '28.4 ETH',
            path: ['USDC', 'WETH', 'ETH']
        }
    },
    {
        execution_id: 'exec_5',
        round_number: 141,
        miner_hotkey: '5Lm2zE...u8Pv',
        pair_name: 'BID/WETH',
        tx_hash: '0x901...234',
        tx_status: 'success',
        executed_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        strategy_data: {
            action: 'LIQUIDITY_ADD',
            pool: 'BID/WETH',
            amount_a: '50000 BID',
            amount_b: '10 WETH'
        }
    }
];

function StrategyDetailsModal({ isOpen, onClose, log }: { isOpen: boolean; onClose: () => void; log: any }) {
    if (!isOpen || !log) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-cream-dark">
                <div className="p-6 border-b border-cream flex justify-between items-center bg-cream/20">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-primary/60">
                            <FileJson size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-primary tracking-tight">Strategy Details</h3>
                            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Execution Payload</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-primary/40 hover:text-primary">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 bg-slate-50 font-mono text-xs">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-cream shadow-sm">
                                <span className="block text-[9px] font-black text-primary/30 uppercase tracking-widest mb-1">Pair</span>
                                <span className="text-primary font-bold">{log.pair_name}</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-cream shadow-sm">
                                <span className="block text-[9px] font-black text-primary/30 uppercase tracking-widest mb-1">Status</span>
                                <span className={`font-bold ${log.tx_status === 'success' ? 'text-green-600' : 'text-red-500'}`}>{log.tx_status.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-cream shadow-sm">
                            <span className="block text-[9px] font-black text-primary/30 uppercase tracking-widest mb-2">Strategy Output Data</span>
                            <pre className="text-primary/70 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.strategy_data, null, 2)}
                            </pre>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-cream shadow-sm flex justify-between items-center">
                            <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">TX Hash</span>
                            <span className="text-primary/50 truncate max-w-[200px]">{log.tx_hash}</span>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-cream bg-white flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                        Close Viewer
                    </button>
                </div>
            </div>
        </div>
    );
}

function ActivityFeed({ jobs }: { jobs: Job[] }) {
    const [logs, setLogs] = React.useState<any[]>(MOCK_LOGS); // Initialize with MOCK_LOGS
    const [loading, setLoading] = React.useState(false);
    const [selectedLog, setSelectedLog] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchAllLogs = async () => {
            if (!jobs.length) return;

            setLoading(true);
            try {
                // Fetch logs for all active jobs
                const promises = jobs.map(async (job) => {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/jobs/${job.job_id}/executions?limit=5`);
                    if (res.ok) {
                        const data = await res.json();
                        return data.executions.map((exec: any) => ({ ...exec, pair_name: job.metadata.pair_name }));
                    }
                    return [];
                });

                const results = await Promise.all(promises);
                const allLogs = results.flat().sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());

                if (allLogs.length > 0) {
                    setLogs(allLogs);
                } else {
                    setLogs(MOCK_LOGS);
                }
            } catch (error) {
                console.error("Failed to fetch logs", error);
                setLogs(MOCK_LOGS); // Fallback on error
            } finally {
                setLoading(false);
            }
        };

        if (jobs.length > 0) fetchAllLogs();

        const interval = setInterval(() => {
            if (jobs.length > 0) fetchAllLogs();
        }, 10000);
        return () => clearInterval(interval);
    }, [jobs]);

    return (
        <>
            <div className="bg-white rounded-[48px] border border-cream-dark shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-10 border-b border-cream flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Activity size={20} className="text-primary/20" />
                        <h4 className="text-lg font-black text-primary tracking-tight uppercase">Activity Feed</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div className="px-4 py-2 bg-cream/30 rounded-xl text-[10px] font-black text-primary/40 uppercase tracking-widest">
                            Live Stream
                        </div>
                    </div>
                </div>

                <div className="p-0">
                    {logs.length === 0 ? (
                        <div className="p-10 flex flex-col items-center justify-center text-primary/10 space-y-4">
                            <Play size={64} className="opacity-20 translate-x-1" />
                            <div className="text-center max-w-sm">
                                <p className="text-xs font-black uppercase tracking-[0.2em] mb-2">Awaiting Execution Broadcast</p>
                                <p className="text-[10px] font-medium leading-relaxed">System is synced. Real-time rebalancing events will appear here as they are broadcast by the subnet validators.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-cream">
                            {logs.map((log) => (
                                <div key={log.execution_id} className="p-6 hover:bg-cream/20 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center space-x-6">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${log.tx_status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            {log.tx_status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-3 mb-1">
                                                <span className="text-xs font-black text-primary uppercase tracking-wide">{log.pair_name || 'UNKNOWN/PAIR'}</span>
                                                <span className="text-[10px] font-bold text-primary/30 uppercase tracking-wider">Round #{log.round_number}</span>
                                            </div>
                                            <p className="text-sm font-medium text-primary/80">
                                                Miner <span className="font-mono font-bold text-primary">{log.miner_hotkey ? log.miner_hotkey.substring(0, 8) : 'Unknown'}...</span> executed rebalance strategy.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end space-y-2">
                                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">{new Date(log.executed_at).toLocaleTimeString()}</p>
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="text-[10px] font-black text-primary hover:text-primary/70 transition-colors uppercase tracking-wider flex items-center space-x-1"
                                            >
                                                <span>View Details</span>
                                                <FileJson size={10} />
                                            </button>
                                            <a
                                                href={`https://scan.test.bt.io/tx/${log.tx_hash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center space-x-1 text-[10px] font-black text-primary/40 hover:text-primary transition-colors uppercase tracking-wider"
                                            >
                                                <span>TX</span>
                                                <ArrowUpRight size={10} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <StrategyDetailsModal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                log={selectedLog}
            />
        </>
    );
}

function PairCard({ job }: { job: Job }) {
    const { data: stats, isLoading: statsLoading } = useNetworkStats(job.job_id);
    const { data: revenue, isLoading: revenueLoading } = useJobRevenue(job.job_id, 30);
    const { data: tvl } = useJobTVL(job.job_id);
    const { data: pnl } = useJobPnL(job.job_id, 30);
    const { data: apy } = useJobAPY(job.job_id, 30);

    const [token0Symbol, token1Symbol] = job.metadata.pair_name.split('/') || ['T0', 'T1'];

    return (
        <div className="bg-white p-5 rounded-3xl border border-cream-dark shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-cream rounded-xl flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <Terminal size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-primary tracking-tight">{job.metadata.pair_name}</h3>
                        <p className="text-[9px] font-bold text-primary/30 uppercase tracking-wider">{job.target}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${job.is_active ? 'bg-green-50 text-green-600' : 'bg-cream text-primary/20'}`}>
                    {job.is_active ? 'Active' : 'Paused'}
                </span>
            </div>

            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4 relative z-10 auto-rows-min">
                {/* TVL */}
                <div className="bg-blue-50/50 rounded-xl p-2.5">
                    <p className="text-[8px] font-black text-blue-600 uppercase tracking-wider mb-1">TVL</p>
                    <p className="text-sm font-black text-primary tracking-tight">
                        ${(tvl?.tvl_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>

                {/* PnL */}
                <div className={`rounded-xl p-2.5 ${(pnl?.pnl_usd || 0) >= 0 ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                    <p className={`text-[8px] font-black uppercase tracking-wider mb-1 ${(pnl?.pnl_usd || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        PnL (30d)
                    </p>
                    <p className="text-sm font-black text-primary tracking-tight">
                        ${(pnl?.pnl_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>

                {/* Revenue */}
                <div className="bg-purple-50/50 rounded-xl p-2.5">
                    <p className="text-[8px] font-black text-purple-600 uppercase tracking-wider mb-1">Revenue</p>
                    <p className="text-sm font-black text-primary tracking-tight">
                        {revenueLoading ? '...' : `$${(revenue?.revenue_usd || 0).toFixed(2)}`}
                    </p>
                </div>

                {/* APY */}
                <div className="bg-orange-50/50 rounded-xl p-2.5 col-span-2">
                    <p className="text-[8px] font-black text-orange-600 uppercase tracking-wider mb-1">APY</p>
                    <div className="flex items-center justify-between space-x-2">
                        <div>
                            <p className="text-xs font-black text-primary tracking-tight">
                                {(apy?.apy_percent || 0).toFixed(1)}%
                            </p>
                            <p className="text-[8px] text-orange-600 font-bold">USD</p>
                        </div>
                        <div>
                            <p className="text-xs font-black text-primary tracking-tight">
                                {(apy?.apy_percent_token0 || 0).toFixed(1)}%
                            </p>
                            <p className="text-[8px] text-orange-600 font-bold">{token0Symbol}</p>
                        </div>
                        <div>
                            <p className="text-xs font-black text-primary tracking-tight">
                                {(apy?.apy_percent_token1 || 0).toFixed(1)}%
                            </p>
                            <p className="text-[8px] text-orange-600 font-bold">{token1Symbol}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4 relative z-10">
                <div className="space-y-0.5">
                    <div className="flex items-center space-x-1 text-primary/30">
                        <Users size={10} />
                        <span className="text-[8px] font-black uppercase tracking-wider">Miners</span>
                    </div>
                    <p className="text-xl font-black text-primary tracking-tight">
                        {statsLoading ? '...' : stats?.active_miners_24h || 0}
                    </p>
                </div>
                <div className="space-y-0.5">
                    <div className="flex items-center space-x-1 text-primary/30">
                        <Activity size={10} />
                        <span className="text-[8px] font-black uppercase tracking-wider">Part.</span>
                    </div>
                    <p className="text-xl font-black text-primary tracking-tight">
                        {statsLoading ? '...' : `${((stats?.avg_participation_rate || 0) * 100).toFixed(0)}%`}
                    </p>
                </div>
                <div className="space-y-0.5">
                    <div className="flex items-center space-x-1 text-primary/30">
                        <Layers size={10} />
                        <span className="text-[8px] font-black uppercase tracking-wider">Rounds</span>
                    </div>
                    <p className="text-xl font-black text-primary tracking-tight">
                        {statsLoading ? '...' : stats?.total_rounds || 0}
                    </p>
                </div>
            </div>

            {/* Config Details */}
            <div className="bg-cream/20 rounded-xl p-3 mb-4 relative z-10">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[8px] font-black text-primary/40 uppercase tracking-wider">Configuration</p>
                    <div className="flex items-center space-x-1 text-primary/40">
                        <Clock size={10} />
                        <span className="text-[9px] font-bold">{job.round_duration_seconds / 60}m Cycles</span>
                    </div>
                </div>
                <div className="flex items-center space-x-1.5 text-[9px] font-mono text-primary/60 truncate">
                    <Hash size={10} />
                    <span className="truncate">{job.pair_address}</span>
                </div>
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-cream relative z-10 mt-auto">
                <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-ink-muted/60 uppercase tracking-wider">
                        Round #{statsLoading ? '...' : stats?.current_round_number}
                    </span>
                </div>
                <div className="flex items-center space-x-1">
                    <Link href="/admin/leaderboard" className="p-1.5 text-primary/30 hover:text-primary hover:bg-cream rounded-lg transition-all">
                        <Users size={16} />
                    </Link>
                    <Link
                        href={`/admin/pairs/${job.job_id}`}
                        className="flex items-center space-x-1.5 text-primary group/action hover:bg-cream px-2.5 py-1.5 rounded-lg transition-all"
                    >
                        <span className="text-[9px] font-black uppercase tracking-wider">Details</span>
                        <ArrowUpRight size={12} className="group-hover/action:translate-x-0.5 group-hover/action:-translate-y-0.5 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Hover Decorator */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 pointer-events-none"></div>
        </div>
    );
}
