import { Logo, LogoMark } from '@/components/ui/Logo';
import {
    LayoutDashboard,
    Trophy,
    Users,
    Terminal,
    Settings,
    LogOut,
    Bell,
    UserCircle,
    Monitor,
    Loader2 // Import Loader2
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

interface AdminLayoutProps {
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    title?: string;
    description?: string;
    icon?: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, headerActions, title, description, icon }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, loading, logout, user } = useAuth(); // Destructure logout and user too

    const isActive = (path: string) => {
        if (path === '/admin' && pathname === '/admin') return true;
        if (path !== '/admin' && pathname?.startsWith(path)) return true;
        return false;
    };

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/');
        }
    }, [loading, isAuthenticated, router]);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-cream">
                <Loader2 className="animate-spin text-primary opacity-20" size={48} />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="flex h-screen bg-cream text-primary selection:bg-primary-light selection:text-white">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-cream-dark flex flex-col h-full z-20">
                <div className="p-8 pb-10 flex items-center space-x-3 group">
                    <div className="bg-primary/5 p-2 rounded-xl group-hover:bg-primary transition-all duration-500">
                        <LogoMark width={24} height={20} className="group-hover:filter group-hover:invert transition-all" />
                    </div>
                    <span className="text-lg font-black tracking-tighter text-primary">ForeverConsole</span>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 space-y-1.5">
                    <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">Console</p>
                    <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" href="/admin" active={isActive('/admin')} />
                    <NavItem icon={<Trophy size={18} />} label="Leaderboard" href="/admin/leaderboard" active={isActive('/admin/leaderboard')} />
                    <NavItem icon={<Users size={18} />} label="Miners" href="/admin/miners" active={isActive('/admin/miners')} />
                    <NavItem icon={<Terminal size={18} />} label="Vaults" href="/admin/jobs" active={isActive('/admin/jobs')} />

                    <div className="pt-8 mb-2">
                        <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">Network</p>
                    </div>
                    <NavItem icon={<Monitor size={18} />} label="Metrics" href="/admin/metrics" active={isActive('/admin/metrics')} />
                    <NavItem icon={<Settings size={18} />} label="Settings" href="/admin/settings" active={isActive('/admin/settings')} />
                </nav>

                <div className="p-4 mt-auto">
                    <button onClick={logout} className="flex items-center w-full space-x-3 px-4 py-3.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 font-bold text-sm group">
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="h-20 glass-nav px-8 lg:px-12 flex items-center justify-between sticky top-0 z-10 shrink-0">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary/40">
                            {icon || <Monitor size={16} />}
                        </div>
                        <div className="flex flex-col">
                            {title ? (
                                <>
                                    <span className="text-sm font-black text-primary tracking-tight">{title}</span>
                                    {description && (
                                        <span className="text-[10px] font-bold text-ink-muted/40 uppercase tracking-wider leading-none truncate max-w-[300px]">
                                            {description}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 leading-none mb-1">SN98 Forever</span>
                                    <span className="text-sm font-black text-primary tracking-tight">Main Terminal</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        {headerActions && (
                            <div className="flex items-center space-x-3 mr-4">
                                {headerActions}
                            </div>
                        )}

                        <div className="hidden sm:flex items-center space-x-2">
                            <button className="p-2.5 text-primary/30 hover:text-primary hover:bg-primary/5 rounded-full transition-all relative">
                                <Bell size={18} />
                                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full border border-white"></span>
                            </button>
                        </div>

                        <div className="hidden sm:block h-6 w-px bg-cream-dark mx-2"></div>

                        <div className="flex items-center space-x-4 pl-2">
                            <div className="text-right hidden md:block">
                                <p className="text-xs font-black text-primary uppercase tracking-wider leading-none mb-1">Current Admin</p>
                                <p className="text-[10px] font-mono text-ink-muted/40 uppercase leading-none">
                                    {user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : '...'}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-white border border-cream-dark flex items-center justify-center text-primary shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                <UserCircle size={22} />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-8 lg:p-12 scroll-smooth">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, href, active }: { icon: React.ReactNode, label: string, href: string, active?: boolean }) => (
    <Link
        href={href}
        className={`flex items-center space-x-3.5 px-4 py-3 rounded-2xl transition-all duration-300 group ${active
            ? 'bg-primary text-white shadow-lg shadow-primary/10'
            : 'text-ink-muted hover:text-primary hover:bg-primary/5'
            }`}
    >
        <span className={`${active ? 'text-white' : 'text-primary/20 group-hover:text-primary'} transition-colors`}>
            {icon}
        </span>
        <span className={`text-[13px] font-bold tracking-tight ${active ? 'text-white' : 'text-primary/80'}`}>{label}</span>
    </Link>
);

export default AdminLayout;
