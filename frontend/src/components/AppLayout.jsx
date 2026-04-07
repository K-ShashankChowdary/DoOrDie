import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import { IconLogOut, IconCheckCircle, IconActivity } from './icons';
import Footer from './Footer';

const AppLayout = () => {
    const { user, logout } = useAuth();
    const [validationCount, setValidationCount] = useState(0);

    useEffect(() => {
        const fetchBadgeCount = async () => {
            try {
                const res = await contractService.getUserContracts();
                const tasks = res.data.contracts || [];
                const count = tasks.filter(t => {
                    const validatorId = typeof t.validator === 'object' ? t.validator?._id : t.validator;
                    return validatorId?.toString() === user?._id?.toString() && t.status === 'VALIDATING';
                }).length;
                setValidationCount(count);
            } catch {
                console.error("Failed to fetch notification badge");
            }
        };
        fetchBadgeCount();
        const interval = setInterval(fetchBadgeCount, 30000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.18)] transition-all duration-300">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-[72px] gap-4">
                        
                        {/* Logo & Navigation */}
                        <div className="flex items-center gap-8 min-w-0">
                            <Link to="/dashboard" className="flex-shrink-0 flex items-center gap-2 group cursor-pointer">
                                <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 shadow-sm">
                                    <span className="text-white font-black text-lg leading-none">D</span>
                                </div>
                                <span className="text-xl font-black text-slate-900 tracking-tight">DoOrDie</span>
                            </Link>

                            <nav className="hidden md:flex items-center space-x-1" aria-label="Global">
                                <NavLink
                                    to="/dashboard"
                                    className={({ isActive }) =>
                                        `nav-pill ${isActive ? 'nav-pill--active' : 'nav-pill--inactive'}`
                                    }
                                >
                                    <IconActivity className="w-4 h-4" />
                                    My Tasks
                                </NavLink>

                                <NavLink
                                    to="/validations"
                                    className={({ isActive }) =>
                                        `nav-pill ${isActive ? 'nav-pill--active' : 'nav-pill--inactive'}`
                                    }
                                >
                                    <IconCheckCircle className="w-4 h-4" />
                                    Validate Tasks
                                    {validationCount > 0 && (
                                        <span className="ml-1 animate-pulse flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-600 text-white rounded-full text-[11px] font-black shadow-sm">
                                            {validationCount}
                                        </span>
                                    )}
                                </NavLink>
                            </nav>
                        </div>

                        {/* User Actions */}
                        <div className="flex items-center gap-4 sm:gap-6 sm:border-l sm:border-slate-200 sm:pl-6">
                            <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 py-1.5 px-1.5 rounded-full shadow-sm hover:border-slate-300 transition-all duration-300 min-w-[120px]">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 uppercase shadow-inner flex-shrink-0">
                                    {user?.fullName?.charAt(0) || '?'}
                                </div>
                                <span className="text-sm font-bold text-slate-700 pr-3 max-w-[100px] truncate">
                                    {user?.fullName?.split(' ')[0]}
                                </span>
                            </div>

                            <button
                                onClick={logout}
                                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all duration-300 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm"
                            >
                                <IconLogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Log out</span>
                            </button>
                        </div>

                    </div>
                </div>
            </header>

            {/* Mobile Navigation (bottom) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] pb-safe-area flex items-center px-2 py-2 gap-2 transform transition-all duration-500">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isActive ? 'text-red-600 bg-red-50 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <IconActivity className="w-5 h-5 mb-1" />
                    Tasks
                </NavLink>
                <NavLink
                    to="/validations"
                    className={({ isActive }) =>
                        `relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                            isActive ? 'text-red-600 bg-red-50 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <div className="relative">
                        <IconCheckCircle className="w-5 h-5 mb-1" />
                        {validationCount > 0 && (
                            <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold ring-2 ring-white">
                                {validationCount}
                            </span>
                        )}
                    </div>
                    Validations
                </NavLink>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-12 pt-6 flex flex-col slide-in relative z-10">
                <div className="flex-1">
                    <Outlet />
                </div>
                <Footer />
            </main>
        </div>
    );
};

export default AppLayout;
