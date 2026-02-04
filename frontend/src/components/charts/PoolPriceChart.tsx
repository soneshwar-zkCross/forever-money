'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, Time, CandlestickStyleOptions, DeepPartial } from 'lightweight-charts';

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

interface PoolPriceChartProps {
    jobId: string;
    lowerPriceBound?: number;
    upperPriceBound?: number;
    currentPrice?: number;
    token0Symbol?: string;
    token1Symbol?: string;
}

export default function PoolPriceChart({
    jobId,
    lowerPriceBound,
    upperPriceBound,
    currentPrice,
    token0Symbol = 'Token0',
    token1Symbol = 'Token1',
}: PoolPriceChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const [candles, setCandles] = useState<CandleData[]>([]);
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
                let res = await fetch(`${API_BASE_URL}/jobs/${jobId}/pool-data/candles?interval=3600&lookback_hours=24`);

                if (res.ok) {
                    const data = await res.json();
                    setCandles(data.candles || []);
                    setDataSource(data.source || 'reader_database');
                } else {
                    console.warn('Pool data not available, falling back to swap events');
                    // Fallback to regular candles
                    res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candles?interval=3600&lookback_hours=24`);

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
    }, [jobId]);

    // Create chart
    useEffect(() => {
        if (!containerRef.current || candles.length === 0) return;

        // Clear existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: 600,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#6b7280',
            },
            grid: {
                vertLines: { color: 'rgba(229, 231, 235, 1)' },
                horzLines: { color: 'rgba(229, 231, 235, 1)' },
            },
            crosshair: {
                mode: 1, // Normal mode
            },
            rightPriceScale: {
                borderColor: '#e5e7eb',
            },
            timeScale: {
                borderColor: '#e5e7eb',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // Add candlestick series (v5 API)
        const candlestickSeries = (chart as any).addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // Transform and set candlestick data
        const candlestickData = candles
            .filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
            .map(candle => ({
                time: candle.timestamp as Time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }));

        if (candlestickData.length > 0) {
            candlestickSeries.setData(candlestickData);
        }

        // Add price bound lines if available
        if (lowerPriceBound && lowerPriceBound > 0) {
            candlestickSeries.createPriceLine({
                price: lowerPriceBound,
                color: '#10b981',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: 'Lower Bound',
            });
        }

        if (upperPriceBound && upperPriceBound > 0) {
            candlestickSeries.createPriceLine({
                price: upperPriceBound,
                color: '#10b981',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: 'Upper Bound',
            });
        }

        if (currentPrice && currentPrice > 0) {
            candlestickSeries.createPriceLine({
                price: currentPrice,
                color: '#f59e0b',
                lineWidth: 2,
                lineStyle: 0, // Solid
                axisLabelVisible: true,
                title: 'Current',
            });
        }

        // Fit content
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [candles, lowerPriceBound, upperPriceBound, currentPrice]);

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

    if (candles.length === 0) {
        return (
            <div className="flex items-center justify-center h-[600px] bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                    <p className="text-sm text-gray-500 mb-2">No price data available</p>
                    <p className="text-xs text-gray-400">Waiting for swap data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Data source badge */}
            {dataSource === 'reader_database' && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-semibold">
                        📊 Pool Data Available
                    </div>
                    <span className="text-gray-500">Real-time data from Aerodrome</span>
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

            {/* Chart container */}
            <div
                ref={containerRef}
                className="w-full h-[600px] bg-white rounded-lg border border-gray-200"
            />

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                        <div className="w-2 h-3 bg-green-500"></div>
                        <div className="w-2 h-3 bg-red-500"></div>
                    </div>
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
                        {dataSource === 'reader_database' ? 'Reader DB' : 'Swap Events'}
                    </p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500 mb-1">Interval</p>
                    <p className="font-bold text-gray-900">1 Hour</p>
                </div>
            </div>
        </div>
    );
}
