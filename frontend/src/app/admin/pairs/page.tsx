'use client';

import { useState, useMemo } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Terminal,
    RefreshCw,
    LayoutGrid,
    List,
    ChevronRight,
    ArrowRight,
    Loader2
} from 'lucide-react';
import {
    useJobs,
    useJobActivity,
    useVaultsSummary,
    Job,
} from '@/lib/api';
import type { VaultSummaryEntry } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PairsPage() {
    const { data: jobs, isLoading } = useJobs();
    const { data: vaultsSummary, isLoading: vaultsLoading, isFetching: vaultsFetching } = useVaultsSummary();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const vaultsReady = !!vaultsSummary;

    const displayJobs = (jobs || []).filter(j => j.is_active);

    // Index vault data by job_id for quick lookup
    const vaultByJobId = useMemo(() => {
        const map: Record<string, VaultSummaryEntry> = {};
        for (const v of vaultsSummary?.vaults || []) {
            map[v.job_id] = v;
        }
        return map;
    }, [vaultsSummary]);

    const headerActions = (
        <div className="flex items-center space-x-2 md:space-x-4">
            {/* Total TVL badge */}
            {(vaultsSummary?.total_tvl_usd || 0) > 0 && (
                <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-cream/50 border border-cream-dark/50 rounded-xl">
                    <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">Total TVL</span>
                    <span className="text-sm font-black text-primary">${vaultsSummary!.total_tvl_usd.toFixed(2)}</span>
                </div>
            )}
            <div className="hidden md:flex bg-cream/50 p-1 rounded-xl border border-cream-dark/50 space-x-1">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'text-primary/30 hover:text-primary/60'}`}
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-md' : 'text-primary/30 hover:text-primary/60'}`}
                >
                    <LayoutGrid size={16} />
                </button>
            </div>
            <button className="px-3 md:px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center space-x-2 uppercase tracking-widest active:scale-95">
                <RefreshCw size={14} />
                <span className="hidden md:inline">Sync All Pairs</span>
            </button>
        </div>
    );

    return (
        <AdminLayout
            title="Trading Pairs"
            description="Monitor trading pairs and their active miners"
            icon={<Terminal size={20} />}
            headerActions={headerActions}
        >
            <div className="space-y-6 animate-fade-in pb-20">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/50 rounded-3xl animate-pulse border border-cream-dark" />)}
                    </div>
                ) : (
                    <>
                        {/* Mobile: Always Card View */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {displayJobs.map((job) => (
                                <PairCard key={job.job_id} job={job as Job} vault={vaultByJobId[job.job_id]} vaultsLoading={vaultsLoading} />
                            ))}
                        </div>

                        {/* Desktop: Toggleable List/Grid */}
                        <div className="hidden md:block">
                            {viewMode === 'list' ? (
                                <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 md:p-8 overflow-x-auto">
                                        <table className="w-full text-left min-w-[900px]">
                                            <thead>
                                                <tr className="text-[10px] text-primary/30 font-black uppercase tracking-[0.2em] border-b border-cream-dark">
                                                    <th className="pb-4">#</th>
                                                    <th className="pb-4">Pair</th>
                                                    <th className="pb-4">TVL</th>
                                                    <th className="pb-4">Deployed</th>
                                                    <th className="pb-4">Idle</th>
                                                    <th className="pb-4">Token0</th>
                                                    <th className="pb-4">Token1</th>
                                                    <th className="pb-4">Rounds</th>
                                                    <th className="pb-4">Miners</th>
                                                    <th className="pb-4">Status</th>
                                                    <th className="pb-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs">
                                                {displayJobs.map((job, i) => (
                                                    <PairRow key={job.job_id} job={job as Job} index={i + 1} vault={vaultByJobId[job.job_id]} vaultsLoading={vaultsLoading} vaultsFetching={vaultsFetching} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                                    {displayJobs.map((job) => (
                                        <PairCard key={job.job_id} job={job as Job} vault={vaultByJobId[job.job_id]} vaultsLoading={vaultsLoading} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}

function PairRow({ job, index, vault, vaultsLoading, vaultsFetching }: { job: Job; index: number; vault?: any; vaultsLoading: boolean; vaultsFetching: boolean }) {
    const { data: activity } = useJobActivity(job.job_id);
    const router = useRouter();

    const totalRounds = activity?.round_outcomes?.total_rounds || 0;
    const totalMiners = activity?.miner_activity?.total_miners || 0;
    const tvl = vault?.total_value_usd || 0;
    const deployed = vault?.deployed_value_usd || 0;
    const idle = vault?.idle_value_usd || 0;
    const t0 = vault?.token0;
    const t1 = vault?.token1;
    const showLoader = vaultsLoading && !vault;
    const syncing = vaultsFetching && !!vault;

    return (
        <tr
            onClick={() => router.push(`/admin/pairs/${job.job_id}`)}
            className="group hover:bg-cream/30 transition-colors border-b border-cream-dark/30 last:border-0 cursor-pointer"
        >
            <td className="py-5 font-black text-primary/20">{index}</td>
            <td className="py-5 font-black">
                <Link href={`/admin/pairs/${job.job_id}`} className="hover:underline hover:text-blue-600 transition-all"
                    onClick={(e) => e.stopPropagation()}>
                    {vault?.token0?.symbol && vault?.token1?.symbol
                        ? `${vault.token0.symbol}/${vault.token1.symbol}`
                        : job.job_id.replace(/[-_]/g, '/').toUpperCase()}
                </Link>
                {syncing && <Loader2 size={10} className="inline ml-1.5 animate-spin text-primary/30" />}
            </td>
            <td className="py-5 font-black text-primary">
                {showLoader ? <span className="inline-block w-16 h-4 bg-cream-dark/40 rounded animate-pulse" /> : tvl > 0 ? `$${tvl.toFixed(2)}` : '$0'}
            </td>
            <td className="py-5 font-bold text-green-600">
                {showLoader ? <span className="inline-block w-14 h-4 bg-cream-dark/40 rounded animate-pulse" /> : deployed > 0 ? `$${deployed.toFixed(2)}` : '$0'}
            </td>
            <td className="py-5 font-bold text-primary/40">
                {showLoader ? <span className="inline-block w-14 h-4 bg-cream-dark/40 rounded animate-pulse" /> : idle > 0 ? `$${idle.toFixed(2)}` : '$0'}
            </td>
            <td className="py-5 font-bold text-primary/50 font-mono text-[10px]">
                {showLoader ? <span className="inline-block w-20 h-4 bg-cream-dark/40 rounded animate-pulse" /> : t0 ? `${t0.balance.toFixed(t0.balance > 1 ? 4 : 8)} ${t0.symbol}` : '-'}
            </td>
            <td className="py-5 font-bold text-primary/50 font-mono text-[10px]">
                {showLoader ? <span className="inline-block w-20 h-4 bg-cream-dark/40 rounded animate-pulse" /> : t1 ? `${t1.balance.toFixed(t1.balance > 1 ? 2 : 6)} ${t1.symbol}` : '-'}
            </td>
            <td className="py-5 font-bold text-primary/60">{totalRounds}</td>
            <td className="py-5 font-bold text-primary/60">{totalMiners}</td>
            <td className="py-5">
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                    job.is_active
                        ? 'bg-green-50 text-green-600 border border-green-100'
                        : 'bg-gray-50 text-gray-400 border border-gray-100'
                }`}>
                    {job.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td className="py-5 text-right">
                <ChevronRight size={14} className="text-primary/20 group-hover:text-primary transition-colors inline" />
            </td>
        </tr>
    );
}

function PairCard({ job, vault, vaultsLoading }: { job: Job; vault?: any; vaultsLoading: boolean }) {
    const { data: activity } = useJobActivity(job.job_id);

    const tvl = vault?.total_value_usd || 0;
    const deployed = vault?.deployed_value_usd || 0;
    const totalRounds = activity?.round_outcomes?.total_rounds || 0;
    const totalMiners = activity?.miner_activity?.total_miners || 0;
    const t0 = vault?.token0;
    const t1 = vault?.token1;
    const showLoader = vaultsLoading && !vault;

    return (
        <Link
            href={`/admin/pairs/${job.job_id}`}
            className="bg-white p-8 rounded-3xl border border-cream-dark shadow-sm hover:shadow-md transition-all group flex flex-col"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-black text-primary mb-1">
                        {vault?.token0?.symbol && vault?.token1?.symbol
                            ? `${vault.token0.symbol}/${vault.token1.symbol}`
                            : job.job_id.replace(/[-_]/g, '/').toUpperCase()}
                    </h3>
                    <p className="text-[10px] font-black text-primary/20 uppercase tracking-widest">
                        {job.is_active ? 'Active' : 'Inactive'} · {totalRounds} rounds · {totalMiners} miners
                    </p>
                </div>
                <div className="bg-primary/5 p-2 rounded-xl">
                    {showLoader ? <Loader2 size={16} className="text-primary/40 animate-spin" /> : <Terminal size={16} className="text-primary/40" />}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                    <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">TVL</p>
                    {showLoader
                        ? <div className="h-7 w-24 bg-cream-dark/40 rounded animate-pulse" />
                        : <p className="text-lg font-black text-primary">{tvl > 0 ? `$${tvl.toFixed(2)}` : '$0'}</p>
                    }
                </div>
                <div>
                    <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">In Pool</p>
                    {showLoader
                        ? <div className="h-7 w-24 bg-cream-dark/40 rounded animate-pulse" />
                        : <p className="text-lg font-black text-green-600">{deployed > 0 ? `$${deployed.toFixed(2)}` : '$0'}</p>
                    }
                </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-cream-dark/50">
                {showLoader ? (
                    <>
                        <div className="h-4 w-full bg-cream-dark/40 rounded animate-pulse" />
                        <div className="h-4 w-full bg-cream-dark/40 rounded animate-pulse" />
                    </>
                ) : (
                    <>
                        {t0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">{t0.symbol}</span>
                                <span className="text-xs font-black text-primary">{t0.balance.toFixed(t0.balance > 1 ? 4 : 8)}</span>
                            </div>
                        )}
                        {t1 && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">{t1.symbol}</span>
                                <span className="text-xs font-black text-primary">{t1.balance.toFixed(t1.balance > 1 ? 2 : 6)}</span>
                            </div>
                        )}
                    </>
                )}
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tight">Rounds</span>
                    <span className="text-xs font-black text-primary">{totalRounds}</span>
                </div>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/20 group-hover:text-primary transition-colors">
                <span>View Details</span>
                <ArrowRight size={14} />
            </div>
        </Link>
    );
}
