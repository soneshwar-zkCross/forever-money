'use client';

import React, { useEffect, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
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
    price: number;
    high: number;
    low: number;
}

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
                    let price = point.close;
                    let high = point.high;
                    let low = point.low;

                    // If we fetched T1 but want T0/T1, or if we need inversion
                    if (invertPrice) {
                        price = 1 / price;
                        const oldHigh = high;
                        high = 1 / low;
                        low = 1 / oldHigh;
                    }

                    return {
                        timestamp: point.timestamp,
                        time: formatTime(point.timestamp, days),
                        price,
                        high,
                        low,
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

    // Calculate price range for Y-axis
    const allPrices = chartData.flatMap(d => [d.price, d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.1;

    return (
        <div className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                    <XAxis
                        dataKey="time"
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                    />

                    <YAxis
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        domain={[minPrice - padding, maxPrice + padding]}
                        tickFormatter={(value) => `$${value.toFixed(value < 1 ? 4 : 2)}`}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px',
                        }}
                        formatter={(value: any, name?: string) => {
                            const num = Number(value);
                            const formatted = num < 1 ? num.toFixed(6) : num.toFixed(2);
                            const safeName = name || '';
                            return [`$${formatted}`, safeName === 'price' ? 'Price' : safeName];
                        }}
                    />

                    {/* Liquidity Range - Lower Bound */}
                    {lowerPriceBound && (
                        <ReferenceLine
                            y={lowerPriceBound}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                                value: `Lower: $${lowerPriceBound.toFixed(2)}`,
                                position: 'left',
                                fill: '#059669',
                                fontSize: 11,
                                fontWeight: 'bold',
                            }}
                        />
                    )}

                    {/* Liquidity Range - Upper Bound */}
                    {upperPriceBound && (
                        <ReferenceLine
                            y={upperPriceBound}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                                value: `Upper: $${upperPriceBound.toFixed(2)}`,
                                position: 'left',
                                fill: '#059669',
                                fontSize: 11,
                                fontWeight: 'bold',
                            }}
                        />
                    )}

                    {/* Liquidity Range - Shaded Area */}
                    {lowerPriceBound && upperPriceBound && (
                        <ReferenceArea
                            y1={lowerPriceBound}
                            y2={upperPriceBound}
                            fill="#10b981"
                            fillOpacity={0.1}
                            stroke="#10b981"
                            strokeOpacity={0.3}
                        />
                    )}

                    {/* Current Price Line */}
                    {currentPrice && (
                        <ReferenceLine
                            y={currentPrice}
                            stroke="#f59e0b"
                            strokeWidth={2}
                            label={{
                                value: `Current: $${currentPrice.toFixed(2)}`,
                                position: 'right',
                                fill: '#d97706',
                                fontSize: 11,
                                fontWeight: 'bold',
                            }}
                        />
                    )}

                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#priceGradient)"
                        dot={false}
                        activeDot={{ r: 6, fill: '#8b5cf6' }}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-600">
                        {invertPrice ? `${token0Symbol}/${token1Symbol}` : `${token0Symbol}`} Price
                    </span>
                </div>
                {lowerPriceBound && upperPriceBound && (
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">Liquidity Range</span>
                    </div>
                )}
                {currentPrice && (
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
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
