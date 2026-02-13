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

interface EarningsChartProps {
    data: any[];
}

export default function EarningsChart({ data }: EarningsChartProps) {
    const shades = [
        '#020617', // slates-950
        '#0C2060', // primary
        '#1A3485', // primary-light
        '#1E40AF', // blue-800
        '#3B82F6', // blue-500
        '#60A5FA', // blue-400
    ];

    return (
        <div className="w-full h-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#F2EDE4"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                        tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #F2EDE4',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#000000',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="m1"
                        stackId="1"
                        stroke={shades[0]}
                        fill={shades[0]}
                        strokeWidth={0}
                        fillOpacity={1}
                        animationDuration={1000}
                    />
                    <Area
                        type="monotone"
                        dataKey="m2"
                        stackId="1"
                        stroke={shades[1]}
                        fill={shades[1]}
                        strokeWidth={0}
                        fillOpacity={1}
                        animationDuration={1200}
                    />
                    <Area
                        type="monotone"
                        dataKey="m3"
                        stackId="1"
                        stroke={shades[2]}
                        fill={shades[2]}
                        strokeWidth={0}
                        fillOpacity={1}
                        animationDuration={1400}
                    />
                    <Area
                        type="monotone"
                        dataKey="m4"
                        stackId="1"
                        stroke={shades[3]}
                        fill={shades[3]}
                        strokeWidth={0}
                        fillOpacity={1}
                        animationDuration={1600}
                    />
                    <Area
                        type="monotone"
                        dataKey="m5"
                        stackId="1"
                        stroke={shades[4]}
                        fill={shades[4]}
                        strokeWidth={0}
                        fillOpacity={1}
                        animationDuration={1800}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
