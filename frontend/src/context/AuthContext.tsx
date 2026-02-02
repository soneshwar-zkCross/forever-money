'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SubstrateWallet } from '@/lib/wallets';
// import { EvmWallet } from '@/lib/evm-wallets'; // Future support

interface User {
    wallet_address: string;
    permissions: string[];
    exp: number;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (type: 'substrate' | 'evm') => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    useEffect(() => {
        // Load token from storage on mount
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                // Basic decode (in real app, verify signature or call /me)
                const payload = JSON.parse(atob(token.split('.')[1]));
                // Check expiry
                if (payload.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setUser({
                        wallet_address: payload.sub,
                        permissions: payload.permissions || [],
                        exp: payload.exp
                    });
                }
            } catch (e) {
                console.error("Invalid token", e);
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = async (type: 'substrate' | 'evm') => {
        if (type === 'evm') {
            // EVM-only wallets (pure MetaMask) not yet supported
            // However, EVM accounts from Talisman work through 'substrate' type
            throw new Error("Pure EVM wallet support coming soon. Use Talisman for EVM accounts.");
        }

        try {
            // 1. Connect Wallet (supports both Substrate and EVM accounts from Talisman)
            const accounts = await SubstrateWallet.connect();
            if (accounts.length === 0) {
                throw new Error("No accounts found. Please connect a wallet extension.");
            }
            const address = accounts[0].address; // Default to first account (can be Substrate or EVM)

            // 2. Request Challenge
            const challengeRes = await fetch(`${API_URL}/api/auth/challenge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_address: address })
            });

            if (!challengeRes.ok) {
                const err = await challengeRes.json();
                throw new Error(err.detail || "Failed to get auth challenge");
            }
            const { challenge, message } = await challengeRes.json();

            console.log('=== Authentication Debug ===');
            console.log('Wallet Address:', address);
            console.log('Challenge:', challenge);
            console.log('Message to sign:', message);

            // 3. Sign Message
            const signature = await SubstrateWallet.signMessage(address, message);

            console.log('Signature:', signature);

            // 4. Verify Signature
            const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    challenge: challenge,
                    signature: signature
                })
            });

            if (!verifyRes.ok) {
                // Handle specific error cases
                if (verifyRes.status === 404 || verifyRes.status === 401) {
                    throw new Error("You are not an Admin. Please contact an administrator.");
                }

                const err = await verifyRes.json();
                throw new Error(err.detail || "Authentication failed");
            }

            const data = await verifyRes.json();

            // 5. Save Session
            localStorage.setItem('auth_token', data.access_token);
            const payload = JSON.parse(atob(data.access_token.split('.')[1]));
            setUser({
                wallet_address: payload.sub,
                permissions: payload.permissions || [],
                exp: payload.exp
            });

            router.push('/admin');

        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setUser(null);
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
