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
    Loader2,
    Menu,
    X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

interface AdminLayoutProps {
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    className?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, headerActions, title, description, icon, className }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, loading, logout, user } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const isActive = (path: string) => {
        if (path === '/admin' && pathname === '/admin') return true;
        if (path !== '/admin' && pathname?.startsWith(path)) return true;
        return false;
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-cream">
                <Loader2 className="animate-spin text-primary opacity-20" size={48} />
            </div>
        );
    }

    return (
        <div className={`flex h-screen bg-cream text-primary selection:bg-primary-light selection:text-white ${className || ''}`}>
            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-50
                w-[280px] md:w-[210px] bg-white border-r border-cream-dark flex flex-col h-full 
                transform transition-transform duration-300 ease-in-out md:transform-none shadow-2xl md:shadow-none
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 pb-8 flex items-center justify-between md:justify-start space-x-3 group">
                    <div className="flex items-center space-x-3">
                        <div className="bg-primary/5 p-2 rounded-xl group-hover:bg-primary transition-all duration-500">
                            <LogoMark width={20} height={16} className="group-hover:filter group-hover:invert transition-all" />
                        </div>
                        <span className="text-[11px] font-black tracking-tighter text-primary uppercase">ForeverConsole</span>
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-2 text-primary/50 hover:text-primary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 space-y-1">
                    <p className="px-4 pb-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/30">Console</p>
                    <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" href="/admin" active={isActive('/admin')} />
                    <NavItem icon={<Users size={18} />} label="Miners" href="/admin/miners" active={isActive('/admin/miners')} />
                    <NavItem icon={<Terminal size={18} />} label="Pairs" href="/admin/pairs" active={isActive('/admin/pairs')} />
                </nav>

                <div className="p-4 mt-auto border-t border-cream-dark/50">
                    <button onClick={logout} className="flex items-center w-full space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300 font-bold text-xs group">
                        <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="uppercase tracking-wider">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                {/* Header */}
                <header className="h-16 md:h-20 bg-cream/30 px-4 md:px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30 shrink-0 backdrop-blur-sm border-b border-white/5 md:border-none">
                    <div className="flex items-center space-x-3 md:space-x-5">
                        {/* Mobile Hamburger */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-2 -ml-2 text-primary/50 hover:text-primary transition-colors hover:bg-white/50 rounded-lg"
                        >
                            <Menu size={20} />
                        </button>

                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white border border-cream-dark flex items-center justify-center text-primary/40 shadow-sm">
                            {icon || <LayoutDashboard size={16} className="md:w-[18px] md:h-[18px]" />}
                        </div>
                        <div className="flex flex-col">
                            {title ? (
                                <>
                                    <span className="text-sm md:text-base font-black text-primary tracking-tight leading-none mb-0.5 md:mb-1 truncate max-w-[150px] md:max-w-none">{title}</span>
                                    {description && (
                                        <span className="hidden md:block text-[10px] font-bold text-ink-muted/40 uppercase tracking-widest leading-none truncate max-w-[400px]">
                                            {description}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 leading-none mb-0.5 md:mb-1">SN98 Forever</span>
                                    <span className="text-xs md:text-sm font-black text-primary tracking-tight">Main Terminal</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 md:space-x-8">
                        {headerActions && (
                            <div className="flex items-center space-x-3 mr-4">
                                {headerActions}
                            </div>
                        )}

                        <div className="hidden sm:flex items-center">
                            <button className="p-2.5 text-primary/30 hover:text-primary transition-all relative">
                                <Bell size={20} />
                                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full border border-white"></span>
                            </button>
                        </div>

                        <div className="flex items-center space-x-3 md:space-x-4 pl-2">
                            <div className="text-right hidden lg:block">
                                <p className="text-[10px] font-black text-primary uppercase tracking-wider leading-none mb-1">Current Admin</p>
                                <p className="text-[10px] font-mono text-ink-muted/40 uppercase leading-none">
                                    {user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'DX0000...0000'}
                                </p>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-cream-dark flex items-center justify-center text-primary/40 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                <UserCircle size={20} className="md:w-6 md:h-6" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 scroll-smooth bg-cream/10">
                    <div className="max-w-[1600px] mx-auto">
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
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group ${active
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-primary/60 hover:text-primary hover:bg-primary/5'
            }`}
    >
        <span className={`${active ? 'text-white' : 'text-primary/40 group-hover:text-primary'} transition-colors`}>
            {icon}
        </span>
        <span className={`text-[12px] font-black tracking-tight ${active ? 'text-white' : ''}`}>{label}</span>
    </Link>
);

export default AdminLayout;
