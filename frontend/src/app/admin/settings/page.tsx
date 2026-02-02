'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Settings, Shield, Bell, Database, Save, Users, Plus, Trash2, Key } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SubstrateWallet } from '@/lib/wallets';

interface Admin {
    wallet_address: string;
    name: string;
    added_at: string;
    added_by: string;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [newAdminAddress, setNewAdminAddress] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    useEffect(() => {
        fetchAdmins();
    }, [user]);

    const fetchAdmins = async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/wallets`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setAdmins(data.admins);
            }
        } catch (e) {
            console.error("Failed to fetch admins", e);
        } finally {
            setLoadingAdmins(false);
        }
    };

    const handleAddAdmin = async () => {
        if (!user || !newAdminAddress || !newAdminName) return;
        setAddingAdmin(true);
        setAddError(null);

        try {
            // 1. Sign Message
            const message = `Add admin wallet: ${newAdminAddress}`;
            const signature = await SubstrateWallet.signMessage(user.wallet_address, message);

            // 2. Submit Request
            const res = await fetch(`${API_URL}/api/admin/wallets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    wallet_address: newAdminAddress,
                    name: newAdminName,
                    permissions: ["read", "write", "manage_admins"],
                    message: message,
                    signature: signature
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add admin");
            }

            // 3. Reset and Refresh
            setNewAdminAddress('');
            setNewAdminName('');
            fetchAdmins();

        } catch (e: any) {
            console.error(e);
            setAddError(e.message);
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleRemoveAdmin = async (address: string) => {
        if (!confirm('Are you sure you want to remove this admin?')) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/wallets/${address}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            if (res.ok) fetchAdmins();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <AdminLayout
            title="Settings"
            description="Configure validator behavior, notifications, and security keys."
            icon={<Settings size={20} />}
        >
            <div className="space-y-8 animate-fade-in pb-20">

                {/* Admin Management Section */}
                <Section title="Access Control" icon={<Users size={20} />}>
                    <div className="space-y-8">
                        {/* List */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-black text-primary uppercase tracking-wide">Authorized Admins</h4>
                                <span className="text-xs font-bold text-primary/40 bg-cream/50 px-3 py-1 rounded-lg">{admins.length} Active</span>
                            </div>

                            <div className="grid gap-3">
                                {loadingAdmins ? (
                                    <p className="text-sm text-primary/40 italic">Loading access list...</p>
                                ) : (
                                    admins.map((admin) => (
                                        <div key={admin.wallet_address} className="flex items-center justify-between p-4 bg-cream/20 border border-cream rounded-2xl group hover:border-cream-dark transition-all">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-cream shadow-sm flex items-center justify-center text-primary/40 font-mono text-xs">
                                                    {admin.wallet_address.slice(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary text-sm">{admin.name}</p>
                                                    <p className="font-mono text-[10px] text-primary/40">{admin.wallet_address}</p>
                                                </div>
                                            </div>
                                            {admin.wallet_address !== user?.wallet_address && (
                                                <button
                                                    onClick={() => handleRemoveAdmin(admin.wallet_address)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform hover:scale-105"
                                                    title="Revoke Access"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            {admin.wallet_address === user?.wallet_address && (
                                                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider rounded-lg">You</span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Add Form */}
                        <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
                            <h4 className="text-sm font-black text-primary uppercase tracking-wide mb-4">Grant Access</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <input
                                    placeholder="Wallet Address (SS58)"
                                    className="w-full bg-white border border-cream-dark rounded-xl px-4 py-3 text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                    value={newAdminAddress}
                                    onChange={(e) => setNewAdminAddress(e.target.value)}
                                />
                                <input
                                    placeholder="Admin Name / Label"
                                    className="w-full bg-white border border-cream-dark rounded-xl px-4 py-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                    value={newAdminName}
                                    onChange={(e) => setNewAdminName(e.target.value)}
                                />
                            </div>

                            {addError && (
                                <p className="text-xs font-bold text-red-500 mb-4 bg-red-50 p-2 rounded-lg border border-red-100">
                                    Error: {addError}
                                </p>
                            )}

                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddAdmin}
                                    disabled={addingAdmin || !newAdminAddress || !newAdminName}
                                    className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:translate-y-px active:translate-y-1 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {addingAdmin ? (
                                        <span className="animate-pulse">Verifying Signature...</span>
                                    ) : (
                                        <>
                                            <Plus size={16} />
                                            <span>Sign & Add Admin</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="mt-4 text-[10px] text-primary/40 leading-relaxed text-center">
                                Adding a new admin requires a cryptographic signature from your authenticated wallet.
                                This action is recorded on-chain via the console audit log.
                            </p>
                        </div>
                    </div>
                </Section>

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
