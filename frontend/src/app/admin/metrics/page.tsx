'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Monitor, Cpu, Activity, Server, Database, Globe } from 'lucide-react';

export default function MetricsPage() {
    return (
        <AdminLayout
            title="System Metrics"
            description="Real-time network telemetry and node performance indicators."
            icon={<Monitor size={20} />}
        >
            <div className="space-y-10 animate-fade-in pb-20">
                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <MetricCard
                        label="Node Latency"
                        value="45ms"
                        status="Optimal"
                        statusColor="bg-green-50 text-green-600"
                        icon={<Activity size={20} />}
                    />
                    <MetricCard
                        label="Block Sync"
                        value="0.2s"
                        status="Real-time"
                        statusColor="bg-blue-50 text-blue-600"
                        icon={<Database size={20} />}
                    />
                    <MetricCard
                        label="API Uptime"
                        value="99.9%"
                        status="14d Streak"
                        statusColor="bg-purple-50 text-purple-600"
                        icon={<Server size={20} />}
                    />
                </div>

                {/* Detailed Resource Usage */}
                <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-10">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 bg-cream rounded-2xl text-primary/40">
                            <Cpu size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-primary tracking-tight">Resource Consumption</h3>
                            <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">Local Validator Node</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <ResourceBar label="CPU Load" value={34} color="bg-primary" />
                        <ResourceBar label="Memory Usage" value={62} color="bg-amber-500" />
                        <ResourceBar label="Network Bandwidth" value={18} color="bg-blue-500" />
                        <ResourceBar label="Storage I/O" value={45} color="bg-green-500" />
                    </div>
                </div>

                {/* Network Map / Nodes (Placeholder) */}
                <div className="bg-primary text-white rounded-[40px] shadow-xl p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                    <div className="relative z-10 flex justify-between items-end">
                        <div className="space-y-4">
                            <div className="p-3 bg-white/10 w-fit rounded-2xl backdrop-blur-md">
                                <Globe size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Global Network</h3>
                                <p className="text-white/60 font-medium">12 Active Validator Nodes Connected</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Subnet ID</p>
                            <p className="text-4xl font-black tracking-tighter">SN98</p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricCard({ label, value, status, statusColor, icon }: { label: string, value: string, status: string, statusColor: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white p-8 rounded-[40px] border border-cream-dark shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
            <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 bg-cream/50 text-primary rounded-2xl">
                    {icon}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                    {status}
                </span>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-primary/20 uppercase tracking-[0.2em]">{label}</p>
                <p className="text-3xl font-black text-primary tracking-tighter">{value}</p>
            </div>
        </div>
    );
}

function ResourceBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-primary">{label}</span>
                <span className="text-primary/40">{value}%</span>
            </div>
            <div className="h-3 bg-cream rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${value}%` }}></div>
            </div>
        </div>
    );
}
