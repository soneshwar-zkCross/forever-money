'use client';

import React, { useEffect, useState } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
    Cell,
} from 'recharts';
import { fetchOHLCData, getCoingeckoId, OHLCDataPoint } from '@/lib/coingecko';

interface OHLCPriceChartProps {
    token0Symbol: string;
    token1Symbol: string;
    token0Address?: string;
    token1Address?: string;
    days?: 1 | 7 | 30;
    lowerPriceBound?: number;
    upperPriceBound?: number;
    currentPrice?: number;
    invertPrice?: boolean;
}

interface ChartData {
    timestamp: number;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    // For candlestick rendering as bars
    candleRange: [number, number];
    isGreen: boolean;
}

// Custom Candlestick Shape
const Candlestick = (props: any) => {
    const { x, y, width, height, payload } = props;

    if (!payload || payload.open === undefined || payload.close === undefined) {
        return null;
    }

    const isGreen = payload.close >= payload.open;
    const color = isGreen ? '#10b981' : '#ef4444';
    const wickColor = '#6b7280';

    // Calculate positions
    const candleWidth = Math.max(width * 0.7, 2);
    const candleX = x + (width - candleWidth) / 2;

    // Wick (high to low line)
    const wickX = x + width / 2;

    return (
        <g>
            {/* Wick (thin line from high to low) */}
            <line
                x1={wickX}
                y1={y}
                x2={wickX}
                y2={y + height}
                stroke={wickColor}
                strokeWidth={1}
            />

            {/* Candle body */}
            <rect
                x={candleX}
                y={isGreen ? y : y + (height * (payload.open - payload.low) / (payload.high - payload.low))}
                width={candleWidth}
                height={Math.abs(height * (payload.close - payload.open) / (payload.high - payload.low))}
                fill={color}
                stroke={color}
                strokeWidth={1}
            />
        </g>
    );
};

export default function OHLCPriceChart({
    token0Symbol,
    token1Symbol,
    token0Address,
    token1Address,
    days = 1,
    lowerPriceBound,
    upperPriceBound,
    currentPrice,
    invertPrice = false,
}: OHLCPriceChartProps) {
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadPriceData() {
            setLoading(true);
            setError(null);

            try {
                // Determine which token to fetch as the "main" token (usually the volatile one vs USD)
                let mainTokenId = null;
                let vsCurrency = 'usd';

                // Try to map symbols to IDs
                const commonMappings: Record<string, string> = {
                    'ETH': 'ethereum',
                    'WETH': 'ethereum',
                    'USDC': 'usd-coin',
                    'USDT': 'tether',
                    'DAI': 'dai',
                    'WBTC': 'wrapped-bitcoin',
                    'xTAO': 'bittensor',
                    'AERO': 'aerodrome-finance',
                };

                const t0Id = (token0Address ? getCoingeckoId(token0Address) : null) || commonMappings[token0Symbol.toUpperCase()];
                const t1Id = (token1Address ? getCoingeckoId(token1Address) : null) || commonMappings[token1Symbol.toUpperCase()];

                // Logic: If one is stable and other is not, fetch the non-stable one vs USD
                const stables = ['usd-coin', 'tether', 'dai'];

                if (t0Id && !stables.includes(t0Id)) {
                    mainTokenId = t0Id;
                } else if (t1Id && !stables.includes(t1Id)) {
                    mainTokenId = t1Id;
                    // If we are showing T1 price, we might need to invert if the user wants T0/T1
                } else {
                    mainTokenId = t0Id || 'ethereum';
                }

                const ohlcData = await fetchOHLCData(mainTokenId, vsCurrency, days);

                if (ohlcData.length === 0) {
                    setError('No price data available');
                    setLoading(false);
                    return;
                }

                // Transform OHLC data
                const transformed: ChartData[] = ohlcData.map((point) => {
                    let open = point.open;
                    let high = point.high;
                    let low = point.low;
                    let close = point.close;

                    // If we fetched T1 but want T0/T1, or if we need inversion
                    if (invertPrice) {
                        const oldHigh = high;
                        const oldLow = low;
                        open = 1 / open;
                        close = 1 / close;
                        high = 1 / oldLow;  // Inverted
                        low = 1 / oldHigh;  // Inverted
                    }

                    return {
                        timestamp: point.timestamp,
                        time: formatTime(point.timestamp, days),
                        open,
                        high,
                        low,
                        close,
                        candleRange: [low, high] as [number, number],
                        isGreen: close >= open,
                    };
                });

                setChartData(transformed);
            } catch (err) {
                console.error('Error loading price data:', err);
                setError('Failed to load price data');
            } finally {
                setLoading(false);
            }
        }

        loadPriceData();
    }, [token0Symbol, token1Symbol, token0Address, token1Address, days, invertPrice]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading price data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <p className="text-sm text-red-600 mb-2">{error}</p>
                    <p className="text-xs text-gray-400">Using fallback data from pool</p>
                </div>
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <p className="text-sm text-gray-500">No price data available</p>
            </div>
        );
    }

    // Calculate price range for Y-axis including bounds
    const allPrices = chartData.flatMap(d => [d.high, d.low]);
    if (lowerPriceBound && lowerPriceBound > 0) allPrices.push(lowerPriceBound);
    if (upperPriceBound && upperPriceBound > 0) allPrices.push(upperPriceBound);
    if (currentPrice && currentPrice > 0) allPrices.push(currentPrice);

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.15; // 15% padding

    const yDomain = [
        Math.max(0, minPrice - padding),
        maxPrice + padding
    ];

    return (
        <div className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="redFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                    <XAxis
                        dataKey="time"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        interval="preserveStartEnd"
                    />

                    <YAxis
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        domain={yDomain}
                        tickFormatter={(value) => `$${value < 1 ? value.toFixed(4) : value.toFixed(2)}`}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const data = payload[0].payload;
                            const formatPrice = (val: number) => val < 1 ? val.toFixed(6) : val.toFixed(2);

                            return (
                                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                                    <p className="text-xs font-bold text-gray-700 mb-2">{data.time}</p>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between gap-4">
                                            <span className="text-gray-600">Open:</span>
                                            <span className="font-mono font-semibold">${formatPrice(data.open)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-gray-600">High:</span>
                                            <span className="font-mono font-semibold text-green-600">${formatPrice(data.high)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-gray-600">Low:</span>
                                            <span className="font-mono font-semibold text-red-600">${formatPrice(data.low)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-gray-600">Close:</span>
                                            <span className="font-mono font-semibold">${formatPrice(data.close)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
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

                    {/* Liquidity Range - Lower Bound */}
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

                    {/* Liquidity Range - Upper Bound */}
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

                    {/* Current Price Line */}
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

                    {/* Candlesticks using Bar with custom shape */}
                    <Bar
                        dataKey="candleRange"
                        shape={<Candlestick />}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                        <div className="w-2 h-3 bg-green-500"></div>
                        <div className="w-2 h-3 bg-red-500"></div>
                    </div>
                    <span className="text-gray-600">
                        {invertPrice ? `${token0Symbol}/${token1Symbol}` : token0Symbol} Price
                    </span>
                </div>
                {lowerPriceBound && upperPriceBound && lowerPriceBound > 0 && upperPriceBound > 0 && (
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 opacity-30 border border-green-500"></div>
                        <span className="text-gray-600">Liquidity Range</span>
                    </div>
                )}
                {currentPrice && currentPrice > 0 && (
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-0.5 bg-orange-500"></div>
                        <span className="text-gray-600">Current Position</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatTime(timestamp: number, days: number): string {
    const date = new Date(timestamp);

    if (days === 1) {
        // Show hours for 1 day view
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else if (days === 7) {
        // Show day and time for 7 day view
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit'
        });
    } else {
        // Show date for 30 day view
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }
}
