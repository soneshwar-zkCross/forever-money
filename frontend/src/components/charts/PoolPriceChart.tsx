'use client';

import React, { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
} from 'recharts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume0: number;
    volume1: number;
}

interface ChartDataPoint {
    time: string;
    price: number;
    timestamp: number;
}

interface PoolPriceChartProps {
    jobId: string;
    lowerPriceBound?: number;
    upperPriceBound?: number;
    currentPrice?: number;
    token0Symbol?: string;
    token1Symbol?: string;
    lookbackHours?: number;
}

export default function PoolPriceChart({
    jobId,
    lowerPriceBound,
    upperPriceBound,
    currentPrice,
    token0Symbol = 'Token0',
    token1Symbol = 'Token1',
    lookbackHours = 24,
}: PoolPriceChartProps) {
    const [candles, setCandles] = useState<CandleData[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<string>('');

    // Fetch candles from reader database (pool-data endpoint)
    useEffect(() => {
        async function fetchCandles() {
            setLoading(true);
            setError(null);

            try {
                // Try to fetch from pool-data endpoint first (reader database)
                let res = await fetch(`${API_BASE_URL}/jobs/${jobId}/pool-data/candles?interval=3600&lookback_hours=${lookbackHours}`);

                if (res.ok) {
                    const data = await res.json();
                    setCandles(data.candles || []);
                    setDataSource(data.source || 'reader_database');
                } else {
                    console.warn('Pool data not available, falling back to swap events');
                    // Fallback to regular candles
                    res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candles?interval=3600&lookback_hours=${lookbackHours}`);

                    if (!res.ok) throw new Error('Failed to fetch candles');

                    const data = await res.json();
                    setCandles(data.candles || []);
                    setDataSource('swap_events');
                }
            } catch (err) {
                console.error('Error fetching candles:', err);
                setError('Failed to load price data');
            } finally {
                setLoading(false);
            }
        }

        if (jobId) {
            fetchCandles();

            // Auto-refresh every 60 seconds
            const interval = setInterval(fetchCandles, 60000);
            return () => clearInterval(interval);
        }
    }, [jobId, lookbackHours]);

    // Transform candles to chart data
    useEffect(() => {
        if (candles.length === 0) return;

        const transformed = candles
            .filter(c => c.close > 0)
            .map(candle => {
                const date = new Date(candle.timestamp * 1000);

                // For time ranges > 24 hours, show date + time
                const timeFormat = lookbackHours > 24
                    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

                return {
                    time: timeFormat,
                    price: candle.close,
                    timestamp: candle.timestamp,
                };
            });

        setChartData(transformed);
    }, [candles, lookbackHours]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[600px] bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading price data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[600px] bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                    <p className="text-sm text-red-600 mb-2">{error}</p>
                    <p className="text-xs text-gray-400">Check API connection</p>
                </div>
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[600px] bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                    <p className="text-sm text-gray-500 mb-2">No price data available</p>
                    <p className="text-xs text-gray-400">Waiting for swap data...</p>
                </div>
            </div>
        );
    }

    // Calculate Y-axis domain
    const allPrices = chartData.map(d => d.price);
    if (lowerPriceBound && lowerPriceBound > 0) allPrices.push(lowerPriceBound);
    if (upperPriceBound && upperPriceBound > 0) allPrices.push(upperPriceBound);
    if (currentPrice && currentPrice > 0) allPrices.push(currentPrice);

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.15;

    return (
        <div className="space-y-4">
            {/* Data source badge */}
            {dataSource === 'reader_database' && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-semibold">
                        📊 Pool Data Available
                    </div>
                    <span className="text-gray-500">Real-time data from Aerodrome (cached)</span>
                </div>
            )}

            {dataSource === 'swap_events' && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-semibold">
                        ⚠️ Fallback Mode
                    </div>
                    <span className="text-gray-500">Using local swap events</span>
                </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <ResponsiveContainer width="100%" height={600}>
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                        <XAxis
                            dataKey="time"
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickLine={{ stroke: '#e5e7eb' }}
                        />

                        <YAxis
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickLine={{ stroke: '#e5e7eb' }}
                            domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
                            tickFormatter={(value) => `$${value < 1 ? value.toFixed(4) : value.toFixed(2)}`}
                        />

                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px',
                            }}
                            formatter={(value: any) => {
                                const num = Number(value);
                                return [`$${num < 1 ? num.toFixed(6) : num.toFixed(2)}`, 'Price'];
                            }}
                        />

                        {/* Liquidity Range - Shaded Area */}
                        {lowerPriceBound && upperPriceBound && lowerPriceBound > 0 && upperPriceBound > 0 && (
                            <ReferenceArea
                                y1={lowerPriceBound}
                                y2={upperPriceBound}
                                fill="#10b981"
                                fillOpacity={0.1}
                                stroke="#10b981"
                                strokeOpacity={0}
                            />
                        )}

                        {/* Lower Bound */}
                        {lowerPriceBound && lowerPriceBound > 0 && (
                            <ReferenceLine
                                y={lowerPriceBound}
                                stroke="#10b981"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: `Lower: $${lowerPriceBound < 1 ? lowerPriceBound.toFixed(4) : lowerPriceBound.toFixed(2)}`,
                                    position: 'insideBottomLeft',
                                    fill: '#059669',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                }}
                            />
                        )}

                        {/* Upper Bound */}
                        {upperPriceBound && upperPriceBound > 0 && (
                            <ReferenceLine
                                y={upperPriceBound}
                                stroke="#10b981"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: `Upper: $${upperPriceBound < 1 ? upperPriceBound.toFixed(4) : upperPriceBound.toFixed(2)}`,
                                    position: 'insideTopLeft',
                                    fill: '#059669',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                }}
                            />
                        )}

                        {/* Current Price */}
                        {currentPrice && currentPrice > 0 && (
                            <ReferenceLine
                                y={currentPrice}
                                stroke="#f59e0b"
                                strokeWidth={2}
                                label={{
                                    value: `Current: $${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2)}`,
                                    position: 'insideTopRight',
                                    fill: '#d97706',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                }}
                            />
                        )}

                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: '#8b5cf6' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-0.5 bg-purple-600"></div>
                    <span className="text-gray-600">
                        {token1Symbol}/{token0Symbol} Price
                    </span>
                </div>
                {lowerPriceBound && upperPriceBound && lowerPriceBound > 0 && upperPriceBound > 0 && (
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-green-500"></div>
                        <span className="text-gray-600">Liquidity Range</span>
                    </div>
                )}
                {currentPrice && currentPrice > 0 && (
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-0.5 bg-orange-500"></div>
                        <span className="text-gray-600">Current Position</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-xs text-center">
                <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500 mb-1">Total Candles</p>
                    <p className="font-bold text-gray-900">{candles.length}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500 mb-1">Data Source</p>
                    <p className="font-bold text-gray-900">
                        {dataSource === 'reader_database' ? 'Reader DB (Cached)' : 'Swap Events'}
                    </p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500 mb-1">Time Range</p>
                    <p className="font-bold text-gray-900">
                        {lookbackHours >= 720 ? `${lookbackHours / 720}M` : `${lookbackHours / 24}d`}
                    </p>
                </div>
            </div>
        </div>
    );
}
