'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface PerformanceChartProps {
    data: any[];
    lightTheme?: boolean;
}

export default function PerformanceChart({ data, lightTheme }: PerformanceChartProps) {
    const primaryColor = lightTheme ? '#0D1117' : '#ffffff';
    const gridColor = lightTheme ? '#E5E7EB' : '#333333';
    const textColor = lightTheme ? '#4B5563' : '#666666';

    return (
        <div className="w-full h-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryColor} stopOpacity={lightTheme ? 0.05 : 0.1} />
                            <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                    />
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: textColor, fontSize: 10 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: textColor, fontSize: 10 }}
                        tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: lightTheme ? '#ffffff' : '#000000',
                            border: `1px solid ${gridColor}`,
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: lightTheme ? '#0D1117' : '#ffffff',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        itemStyle={{ color: lightTheme ? '#0D1117' : '#ffffff' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={primaryColor}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
