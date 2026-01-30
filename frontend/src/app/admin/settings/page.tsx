'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Settings, Shield, Bell, Key, Database, Save } from 'lucide-react';

export default function SettingsPage() {
    return (
        <AdminLayout
            title="Settings"
            description="Configure validator behavior, notifications, and security keys."
            icon={<Settings size={20} />}
        >
            <div className="space-y-8 animate-fade-in pb-20">
                {/* General Settings */}
                <Section title="Validator Configuration" icon={<Database size={20} />}>
                    <div className="space-y-6">
                        <ToggleSetting
                            label="Auto-Sync Leaderboard"
                            description="Automatically fetch new scores every block."
                            defaultChecked={true}
                        />
                        <ToggleSetting
                            label="Broadcast Logs"
                            description="Share execution logs with the public dashboard."
                            defaultChecked={false}
                        />
                        <div className="pt-4">
                            <label className="block text-xs font-black text-primary uppercase tracking-widest mb-2">Data Retention Period</label>
                            <select className="w-full bg-cream/30 border border-cream-dark rounded-xl px-4 py-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/5">
                                <option>7 Days</option>
                                <option>30 Days</option>
                                <option>90 Days</option>
                                <option>Forever</option>
                            </select>
                        </div>
                    </div>
                </Section>

                {/* Security */}
                <Section title="Security & Keys" icon={<Shield size={20} />}>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-primary uppercase tracking-widest">Validator Hotkey</label>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value="5H3j...Bbjm"
                                    disabled
                                    className="flex-1 bg-cream/50 border border-cream-dark rounded-xl px-4 py-3 text-sm font-mono text-primary/60"
                                />
                                <button className="px-4 py-2 bg-white border border-cream-dark rounded-xl text-xs font-black uppercase tracking-wider hover:bg-cream transition-colors">
                                    Copy
                                </button>
                            </div>
                        </div>
                        <ToggleSetting
                            label="Require Signature for Updates"
                            description="Enforce wallet signature for all configuration changes."
                            defaultChecked={true}
                        />
                    </div>
                </Section>

                {/* Notifications */}
                <Section title="Notifications" icon={<Bell size={20} />}>
                    <div className="space-y-6">
                        <ToggleSetting
                            label="Miner Drop Alerts"
                            description="Notify when a top miner drops out of the active set."
                            defaultChecked={true}
                        />
                        <ToggleSetting
                            label="Score Deviation Alerts"
                            description="Notify when combined scores shift by >10%."
                            defaultChecked={false}
                        />
                    </div>
                </Section>

                <div className="flex justify-end pt-4">
                    <button className="px-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:translate-y-px active:translate-y-1 transition-all flex items-center space-x-3">
                        <Save size={16} />
                        <span>Save Changes</span>
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-[40px] border border-cream-dark shadow-sm p-10">
            <div className="flex items-center space-x-4 mb-8 pb-8 border-b border-cream">
                <div className="p-3 bg-cream rounded-2xl text-primary/40">
                    {icon}
                </div>
                <h3 className="text-xl font-black text-primary tracking-tight">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function ToggleSetting({ label, description, defaultChecked }: { label: string, description: string, defaultChecked: boolean }) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setChecked(!checked)}>
            <div className="space-y-1">
                <p className="text-sm font-black text-primary group-hover:text-primary transition-colors">{label}</p>
                <p className="text-xs font-bold text-primary/30">{description}</p>
            </div>
            <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${checked ? 'bg-primary' : 'bg-cream-dark'}`}>
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
        </div>
    );
}
