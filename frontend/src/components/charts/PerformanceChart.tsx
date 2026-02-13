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
    const blueColor = '#3B82F6';
    const blackColor = '#0D1117';
    const gridColor = '#F2EDE4';
    const textColor = '#9CA3AF';

    return (
        <div className="w-full h-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={blueColor} stopOpacity={0.1} />
                            <stop offset="95%" stopColor={blueColor} stopOpacity={0} />
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
                        tick={{ fill: textColor, fontSize: 10, fontWeight: 600 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: textColor, fontSize: 10, fontWeight: 600 }}
                        tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#ffffff',
                            border: `1px solid ${gridColor}`,
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0D1117',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                        }}
                        itemStyle={{ padding: '2px 0' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        name="TVL"
                        stroke={blueColor}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorBlue)"
                        animationDuration={1500}
                    />
                    <Area
                        type="monotone"
                        dataKey="value2"
                        name="Revenue"
                        stroke={blackColor}
                        strokeWidth={2.5}
                        fill="transparent"
                        animationDuration={2000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
