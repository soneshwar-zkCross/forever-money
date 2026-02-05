"use client";

import React, { useState, useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { ShieldCheck, ArrowRight, Wallet, Cpu, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [walletType, setWalletType] = useState<null | 'substrate' | 'evm'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    router.push('/admin');
  }, [router]);

  const handleConnect = async (type: 'substrate' | 'evm') => {
    setError(null);
    setConnecting(true);
    setWalletType(type);

    try {
      await login(type);
      // Redirect happens in login()
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check console.');
      setConnecting(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center overflow-hidden dragon-bg font-sans">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] animate-fade-in"></div>

      {/* Error Changes */}
      {error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-red-50 border border-red-200 px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 text-red-600">
            <AlertCircle size={20} />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:opacity-50">
              <span className="text-lg">&times;</span>
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-5xl flex h-[620px] animate-slide-up shadow-2xl rounded-[48px] overflow-hidden glass-panel mx-4">

        {/* Left Aspect - Branding */}
        <div className="hidden lg:flex w-[40%] bg-primary relative p-16 flex-col justify-between overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute -right-20 -bottom-20 opacity-30 select-none pointer-events-none transform rotate-12">
            <Image src="/images/dragon_feature.png" alt="Dragon" width={600} height={600} className="object-contain mix-blend-overlay" />
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10">
            <Logo color="#FFFFFF" width={160} height={26} />
            <div className="mt-16 space-y-4">
              <h1 className="text-5xl font-black text-white tracking-tighter leading-[0.9]">
                Forever <br /> Console
              </h1>
              <p className="text-white/60 font-medium text-lg leading-relaxed max-w-[240px]">
                High-fidelity validator terminal for SN98.
              </p>
            </div>
          </div>

          <div className="relative z-10 bg-white/10 self-start px-5 py-2.5 rounded-full border border-white/10 flex items-center space-x-2.5 text-white/80 backdrop-blur-sm">
            <ShieldCheck size={18} className="text-white" />
            <span className="text-[10px] font-black uppercase tracking-widest">Protocol Secured</span>
          </div>
        </div>

        {/* Auth Aspect - Interaction */}
        <div className="w-full lg:w-[60%] flex flex-col justify-center p-12 lg:p-20 bg-white/95 relative">
          <div className="mb-14">
            <span className="text-primary/40 text-xs font-black uppercase tracking-[0.3em] mb-4 block">Authentication</span>
            <h2 className="text-5xl font-black text-primary tracking-tight">Login</h2>
            <p className="text-ink-muted mt-3 text-lg font-medium">Connect an authorized validator wallet to proceed.</p>
          </div>

          <div className="space-y-5">
            <AuthButton
              title="Substrate / Bittensor"
              subtitle="Talisman, Polkadot.js"
              icon={<Cpu size={24} />}
              onClick={() => handleConnect('substrate')}
              loading={connecting && walletType === 'substrate'}
              disabled={connecting}
            />
            <AuthButton
              title="Ethereum / EVM"
              subtitle="MetaMask, Rabby"
              icon={<Wallet size={24} />}
              onClick={() => handleConnect('evm')}
              loading={connecting && walletType === 'evm'}
              disabled={connecting}
            />
          </div>

          <div className="mt-16 pt-10 border-t border-cream-dark flex flex-col items-center">
            <p className="text-[10px] font-bold text-ink-muted/40 uppercase tracking-[0.25em] mb-2">
              Secure Access Only
            </p>
            <div className="w-1.5 h-1.5 rounded-full bg-primary/10"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AuthButton = ({ title, subtitle, icon, onClick, loading, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center p-7 rounded-[32px] border border-cream-dark bg-white hover:bg-cream/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 disabled:opacity-50 group"
  >
    <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
      {loading ? <Loader2 size={24} className="animate-spin" /> : icon}
    </div>
    <div className="ml-6 text-left flex-1">
      <h3 className="text-xl font-black text-primary leading-none mb-1.5">{title}</h3>
      <p className="text-sm font-semibold text-ink-muted/50">{subtitle}</p>
    </div>
    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-cream/50 group-hover:bg-primary/10 transition-colors">
      <ArrowRight size={20} className="text-primary/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
    </div>
  </button>
);
