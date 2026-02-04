'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { useMinerWinRate, useMinerDividends, useMinerJobEarnings } from '@/lib/metrics-hooks';
import { useJobs, useMinerVaults } from '@/lib/api';
import Link from 'next/link';

export default function MinerDetailsPage() {
    const params = useParams();
    const minerUid = parseInt(params?.uid as string) || 0;

    const [selectedJobId, setSelectedJobId] = useState<string>('');

    // Fetch data
    const { data: winRateData, isLoading: winRateLoading } = useMinerWinRate(minerUid, selectedJobId);
    const { data: dividendsData } = useMinerDividends(minerUid);
    const { data: jobEarningsData } = useMinerJobEarnings(minerUid, selectedJobId);
    const { data: jobs } = useJobs();
    const { data: minerVaults } = useMinerVaults(minerUid);

    if (winRateLoading || !minerUid) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-400">Loading miner details...</div>
            </div>
        );
    }

    // Select first job if none selected
    if (!selectedJobId && jobs && jobs.length > 0) {
        setSelectedJobId(jobs[0].job_id);
    }

    // Mock performance data for chart
    const performanceData = [
        { round: '1', score: 0.85, revenue: 120 },
        { round: '2', score: 0.92, revenue: 150 },
        { round: '3', score: 0.78, revenue: 100 },
        { round: '4', score: 0.88, revenue: 130 },
        { round: '5', score: 0.95, revenue: 180 },
        { round: '6', score: 0.82, revenue: 110 },
    ];

    const winRatePercent = winRateData?.win_rate || 0;
    const lossRatePercent = 100 - winRatePercent;

    const winRateChartData = [
        { name: 'Wins', value: winRatePercent, color: '#10b981' },
        { name: 'Losses', value: lossRatePercent, color: '#ef4444' },
    ];

    return (
        <div className="p-8 bg-gray-950 min-h-screen text-white">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Miner Details</h1>
                <div className="flex items-center gap-4">
                    <div className="text-gray-400">
                        <span className="font-semibold">UID:</span> {minerUid}
                    </div>
                    <div className="text-gray-400 text-xs font-mono">
                        {winRateData?.miner_hotkey.slice(0, 16)}...{winRateData?.miner_hotkey.slice(-8)}
                    </div>
                </div>
            </div>

            {/* Job Selector */}
            <div className="mb-8">
                <label className="block text-sm text-gray-400 mb-2">Select Vault</label>
                <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {jobs?.map(job => (
                        <option key={job.job_id} value={job.job_id}>
                            {job.metadata?.pair_name || job.job_id}
                        </option>
                    ))}
                </select>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-6 mb-8">
                {/* Win Rate */}
                <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-6 border border-green-800/50">
                    <div className="text-sm text-green-300 mb-2">Win Rate</div>
                    <div className="text-4xl font-bold">{winRatePercent.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400 mt-2">
                        {winRateData?.total_wins}/{winRateData?.total_participations} rounds
                    </div>
                </div>

                {/* Current Score */}
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 border border-blue-800/50">
                    <div className="text-sm text-blue-300 mb-2">Current Score</div>
                    <div className="text-4xl font-bold">{jobEarningsData?.score.toFixed(3) || '0.000'}</div>
                    <div className="text-sm text-gray-400 mt-2">Job performance</div>
                </div>

                {/* Estimated Earnings */}
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 border border-purple-800/50">
                    <div className="text-sm text-purple-300 mb-2">Job Earnings (Est.)</div>
                    <div className="text-4xl font-bold">{jobEarningsData?.earnings_alpha.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-400 mt-2">α / ${jobEarningsData?.earnings_usd.toFixed(2) || '0.00'}</div>
                </div>

                {/* Current Dividends */}
                <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl p-6 border border-amber-800/50">
                    <div className="text-sm text-amber-300 mb-2">Current Dividends</div>
                    <div className="text-4xl font-bold">{dividendsData?.current_dividends_alpha.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-400 mt-2">α (claimable)</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Win Rate Pie Chart */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Win/Loss Distribution</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={winRateChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={(entry) => `${entry.value.toFixed(1)}%`}
                                >
                                    {winRateChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(1)}%` : 'N/A'}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">{winRateData?.total_wins || 0}</div>
                            <div className="text-sm text-gray-400">Total Wins</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-400">
                                {(winRateData?.total_participations || 0) - (winRateData?.total_wins || 0)}
                            </div>
                            <div className="text-sm text-gray-400">Total Losses</div>
                        </div>
                    </div>
                </div>

                {/* Performance Over Time */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Recent Performance</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="round" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    labelStyle={{ color: '#9ca3af' }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ fill: '#8b5cf6', r: 5 }}
                                    activeDot={{ r: 7 }}
                                    name="Score"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                <h2 className="text-xl font-semibold mb-6">Job Earnings Breakdown</h2>

                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div>
                        <div className="text-sm text-gray-400 mb-2">Share of Emissions</div>
                        <div className="text-2xl font-bold">{jobEarningsData?.share_percent.toFixed(2) || '0.00'}%</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-400 mb-2">Alpha Earnings</div>
                        <div className="text-2xl font-bold text-purple-400">
                            {jobEarningsData?.earnings_alpha.toFixed(4) || '0.0000'} α
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-400 mb-2">USD Value</div>
                        <div className="text-2xl font-bold text-green-400">
                            ${jobEarningsData?.earnings_usd.toFixed(2) || '0.00'}
                        </div>
                    </div>
                </div>

                {/* Earnings Chart */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="round" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#9ca3af' }}
                                formatter={(value: number | undefined) => value !== undefined ? `$${value.toFixed(2)}` : 'N/A'}
                            />
                            <Bar
                                dataKey="revenue"
                                fill="#8b5cf6"
                                name="Revenue per Round"
                                radius={[8, 8, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Miner's Vaults Section */}
            <div className="mt-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                <h2 className="text-xl font-semibold mb-2">Miner's Vaults</h2>
                <p className="text-sm text-gray-400 mb-6">
                    Liquidity positions across different trading pairs
                </p>

                {minerVaults && minerVaults.total_vaults > 0 ? (
                    <div className="space-y-4">
                        <div className="flex gap-4 mb-6">
                            <div className="px-4 py-2 bg-green-900/20 border border-green-800/50 rounded-lg">
                                <span className="text-xs text-green-300">Total Vaults: </span>
                                <span className="text-sm font-bold text-white">{minerVaults.total_vaults}</span>
                            </div>
                            <div className="px-4 py-2 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                                <span className="text-xs text-blue-300">Active: </span>
                                <span className="text-sm font-bold text-white">{minerVaults.active_vaults}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {minerVaults.vaults.map((vault) => (
                                <Link
                                    key={vault.vault_id}
                                    href={`/admin/pairs/${vault.job_id}`}
                                    className="block bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-600 hover:bg-gray-800 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                                                {vault.pair_name}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-mono mt-1">
                                                {vault.pair_address.slice(0, 12)}...{vault.pair_address.slice(-8)}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${vault.is_eligible_for_live ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-gray-700/30 text-gray-400 border border-gray-600'}`}>
                                            {vault.is_eligible_for_live ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">Combined Score</p>
                                            <p className="text-lg font-bold text-purple-400">
                                                {vault.combined_score.toFixed(3)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">Revenue</p>
                                            <p className="text-lg font-bold text-green-400">
                                                ${vault.revenue_usd.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-gray-900/50 rounded px-2 py-1.5">
                                            <p className="text-gray-500">Evaluations</p>
                                            <p className="text-white font-bold">{vault.total_evaluations}</p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded px-2 py-1.5">
                                            <p className="text-gray-500">Live Rounds</p>
                                            <p className="text-white font-bold">{vault.total_live_rounds}</p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded px-2 py-1.5">
                                            <p className="text-gray-500">Days</p>
                                            <p className="text-white font-bold">{vault.participation_days}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                                        <div className="flex gap-3 text-xs text-gray-400">
                                            <span>Eval: {vault.evaluation_score.toFixed(3)}</span>
                                            <span>Live: {vault.live_score.toFixed(3)}</span>
                                        </div>
                                        <svg className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-400">No vaults found for this miner.</p>
                    </div>
                )}
            </div>

            {/* Note about dividends */}
            {dividendsData && (
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                    <p className="text-sm text-blue-300">
                        <span className="font-semibold">ℹ️ Note:</span> {dividendsData.note}
                    </p>
                </div>
            )}
        </div>
    );
}
