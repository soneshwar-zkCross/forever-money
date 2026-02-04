'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { useJobTVL, useJobTVLHistory, useInventoryChange, useJobAPY } from '@/lib/metrics-hooks';
import { useJobRevenue } from '@/lib/api';

export default function VaultDetailsPage() {
    const params = useParams();
    const jobId = params?.id as string || '';

    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'history'>('reports');
    const [historyDays, setHistoryDays] = useState(7);

    // Fetch data with new hooks
    const { data: tvlData, isLoading: tvlLoading } = useJobTVL(jobId);
    const { data: historyData, isLoading: historyLoading } = useJobTVLHistory(jobId, historyDays);
    const { data: inventoryData } = useInventoryChange(jobId);
    const { data: revenueData } = useJobRevenue(jobId, historyDays);
    const { data: apyData } = useJobAPY(jobId, 30);

    if (tvlLoading || !jobId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-400">Loading vault details...</div>
            </div>
        );
    }

    // Format data for charts
    const positionHistoryData = historyData?.series.map(point => ({
        date: new Date(point.timestamp).toLocaleDateString(),
        token0_percent: 50, // TODO: Calculate from actual ratio
        token1_percent: 50,
    })) || [];

    const feesHistoryData = historyData?.series.map(point => ({
        date: new Date(point.timestamp).toLocaleDateString(),
        token0_fees: point.revenue_usd / 2,
        token1_fees: point.revenue_usd / 2,
    })) || [];

    const currentToken0 = tvlData?.tvl_token0 || 0;
    const currentToken1 = tvlData?.tvl_token1 || 0;
    const totalAmount = currentToken0 + currentToken1;
    const token0Percent = totalAmount > 0 ? (currentToken0 / totalAmount) * 100 : 50;
    const token1Percent = totalAmount > 0 ? (currentToken1 / totalAmount) * 100 : 50;

    return (
        <div className="p-8 bg-gray-950 min-h-screen text-white">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Vault Details</h1>
                <p className="text-gray-400 text-sm font-mono">{jobId}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                {(['overview', 'reports', 'history'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 rounded-full font-medium transition-all ${activeTab === tab
                            ? 'bg-blue-900 text-white shadow-lg shadow-blue-900/50'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Reports Tab Content */}
            {activeTab === 'reports' && (
                <div className="space-y-8">
                    {/* Current Position Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-6">Current Position</h2>
                        <div className="flex items-center gap-8 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg font-bold">
                                    Ξ
                                </div>
                                <div>
                                    <div className="text-3xl font-bold">{currentToken0.toFixed(2)}</div>
                                    <div className="text-sm text-gray-400">ETH</div>
                                </div>
                            </div>
                            <div className="text-3xl text-gray-600">|</div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-lg font-bold">
                                    $
                                </div>
                                <div>
                                    <div className="text-3xl font-bold">{currentToken1.toFixed(0)}</div>
                                    <div className="text-sm text-gray-400">USDC</div>
                                </div>
                            </div>
                        </div>

                        {/* Position Breakdown */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Position</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium flex items-center gap-2">
                                        <span className="w-3 h-3 bg-blue-500 rounded"></span>
                                        USDC
                                    </span>
                                    <span className="font-mono">{currentToken1.toFixed(0)} ({token1Percent.toFixed(0)}%)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium flex items-center gap-2">
                                        <span className="w-3 h-3 bg-purple-500 rounded"></span>
                                        ETH
                                    </span>
                                    <span className="font-mono">{currentToken0.toFixed(2)} ({token0Percent.toFixed(0)}%)</span>
                                </div>
                                {/* Progress bar */}
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex mt-4">
                                    <div
                                        className="bg-blue-500"
                                        style={{ width: `${token1Percent}%` }}
                                    ></div>
                                    <div
                                        className="bg-purple-500"
                                        style={{ width: `${token0Percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Position Ratio Chart */}
                        {!historyLoading && positionHistoryData.length > 0 && (
                            <div className="h-64 mt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={positionHistoryData}>
                                        <defs>
                                            <linearGradient id="colorToken0" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="date" stroke="#9ca3af" />
                                        <YAxis stroke="#9ca3af" domain={[0, 100]} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                            labelStyle={{ color: '#9ca3af' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="token0_percent"
                                            stroke="#8b5cf6"
                                            fill="url(#colorToken0)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* TVL & Performance Metrics */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 border border-blue-800/50">
                            <div className="text-sm text-blue-300 mb-2">Total Value Locked</div>
                            <div className="text-3xl font-bold">${tvlData?.tvl_usd.toLocaleString() || 0}</div>
                            {inventoryData && (
                                <div className={`text-sm mt-2 ${inventoryData.change.percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {inventoryData.change.percent >= 0 ? '+' : ''}{inventoryData.change.percent.toFixed(2)}% from start
                                </div>
                            )}
                        </div>

                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-6 border border-green-800/50">
                            <div className="text-sm text-green-300 mb-2">APY ({historyDays}d)</div>
                            <div className="text-3xl font-bold">{apyData?.apy_percent.toFixed(2) || '0.00'}%</div>
                            <div className="text-sm text-gray-400 mt-2">APY ({historyDays}d)</div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 border border-purple-800/50">
                            <div className="text-sm text-purple-300 mb-2">Total Revenue ({historyDays}d)</div>
                            <div className="text-3xl font-bold">${(revenueData?.revenue_usd || 0).toLocaleString()}</div>
                            <div className="text-sm text-gray-400 mt-2">Fees earned</div>
                        </div>
                    </div>

                    {/* Vault Fees Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-6">Vault Fees</h2>

                        {/* Fee Breakdown */}
                        <div className="mb-6 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-blue-500 rounded"></span>
                                    <span className="font-medium">USDC Fees</span>
                                </span>
                                <span className="font-mono">{(revenueData?.revenue_token1 || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-purple-500 rounded"></span>
                                    <span className="font-medium">ETH Fees</span>
                                </span>
                                <span className="font-mono">{(revenueData?.revenue_token0 || 0).toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                                <span className="font-medium">Total Fees Value (USD)</span>
                                <span className="font-mono text-lg text-green-400">
                                    ${(revenueData?.revenue_usd || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Fees History Chart */}
                        {!historyLoading && feesHistoryData.length > 0 && (
                            <div className="h-80 mt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={feesHistoryData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="date" stroke="#9ca3af" />
                                        <YAxis stroke="#9ca3af" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                            labelStyle={{ color: '#9ca3af' }}
                                            formatter={(value?: number) => value ? `$${value.toFixed(2)}` : '$0.00'}
                                        />
                                        <Legend />
                                        <Bar dataKey="token0_fees" fill="#8b5cf6" name="ETH Fees" radius={[8, 8, 0, 0]} />
                                        <Bar dataKey="token1_fees" fill="#3b82f6" name="USDC Fees" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex justify-center gap-4">
                        {[7, 30, 90].map(days => (
                            <button
                                key={days}
                                onClick={() => setHistoryDays(days)}
                                className={`px-6 py-2 rounded-lg font-medium transition-all ${historyDays === days
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {days}d
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="text-center text-gray-400 py-20">
                    Overview tab - Coming soon
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="text-center text-gray-400 py-20">
                    Vault history - Coming soon
                </div>
            )}
        </div>
    );
}
