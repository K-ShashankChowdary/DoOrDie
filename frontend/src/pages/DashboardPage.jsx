import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/tasks/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
import LinkStripeModal from '../components/modals/LinkStripeModal';
import {
    IconActivity,
    IconCheckCircle,
    IconInbox,
    IconPlus,
    IconWallet,
} from '../components/icons';

const DashboardPage = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [balance, setBalance] = useState({ available: 0, pending: 0 });

    const { getBalance, verifyStripeStatus } = useAuth();

    const fetchTasks = async () => {
        try {
            // Cache busting with timestamp to prevent 304 Not Modified when status changes
            const res = await contractService.getUserContracts(`?t=${Date.now()}`);
            setTasks(res.data.contracts || []);
        } catch (err) {
            console.error("Failed to load tasks:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBalance = async () => {
        if (!user?.stripeAccountId) return;
        try {
            const res = await getBalance();
            // The API returns { statusCode, data: { available, pending }, ... }
            if (res && res.data) {
                setBalance(res.data);
            }
        } catch (err) {
            console.error("Failed to load balance:", err);
        }
    };

    const handleManualRefresh = () => {
        setLoading(true);
        Promise.all([fetchTasks(), fetchBalance()]).finally(() => {
            setTimeout(() => setLoading(false), 500);
        });
    };

    useEffect(() => {
        fetchTasks();
        fetchBalance();
        
        const interval = setInterval(() => {
            fetchTasks();
            fetchBalance();
        }, 10000);

        // Detect redirect from Stripe Onboarding
        const urlParams = new URLSearchParams(window.location.search);
        const onboardingStatus = urlParams.get('stripe_onboarding');

        if (onboardingStatus === 'success') {
            verifyStripeStatus().then(() => {
                fetchBalance();
                // Clear query params to prevent re-verification on reload
                window.history.replaceState({}, document.title, "/dashboard");
            }).catch(err => {
                console.error("Failed to verify Stripe status:", err);
            });
        }

        return () => clearInterval(interval);
    }, [user?.stripeAccountId]);

    const handleTaskCreated = (newTask) => {
        setTasks(prev => [newTask, ...prev]);
    };

    // Combined tasks for a single-list view
    const displayedTasks = useMemo(() => {
        return tasks.filter(t => {
            const creatorId = typeof t.creator === 'object' ? t.creator?._id : t.creator;
            const validatorId = typeof t.validator === 'object' ? t.validator?._id : t.validator;
            return creatorId?.toString() === user?._id?.toString() || validatorId?.toString() === user?._id?.toString();
        });
    }, [tasks, user]);

    const { activeCount, pendingCount, doneCount } = useMemo(() => ({
        activeCount: displayedTasks.filter(t => t.status === 'ACTIVE' || t.status === 'VALIDATING').length,
        pendingCount: displayedTasks.filter(t => t.status === 'PENDING_PAYMENT' && new Date(t.deadline) > new Date()).length,
        doneCount: displayedTasks.filter(t => t.status === 'COMPLETED' || t.status === 'REJECTED' || t.status === 'FAILED').length
    }), [displayedTasks]);

    const firstName = user?.fullName?.split(' ')[0] || 'there';
    
    return (
        <div className="page-shell bg-transparent">
            <div className="dashboard-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <header className="dashboard-top !border-0 !pb-2">
                    <div className="dashboard-user">
                        <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                    Hey {firstName}, here is your list.
                                </h1>
                                <button 
                                    onClick={handleManualRefresh}
                                    className={`p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 ${loading ? 'animate-spin text-blue-600' : ''}`}
                                    title="Refresh Dashboard"
                                >
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                                Add todos, track due dates, and finish what matters.
                            </p>
                        </div>
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary shadow-xl shadow-blue-500/20 active:scale-95 transition-transform">
                            <IconPlus className="w-5 h-5" />
                            <span className="hidden sm:inline">Add Task</span>
                        </button>
                    </div>
                </header>

                {!user?.stripeOnboardingComplete && (
                    <div className="mt-8 mb-6 p-6 bg-red-50/50 border border-red-100 rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 animate-in slide-in-from-top-4">
                        <div className="p-4 bg-red-100 rounded-2xl flex-shrink-0">
                            <IconWallet className="w-8 h-8 text-red-600" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-xl font-bold text-slate-900">
                                Connect Stripe Payouts
                            </h3>
                            <p className="text-red-700/80 text-sm mt-2 max-w-xl leading-relaxed font-semibold">
                                To validate tasks and automatically receive payouts, please link your payout account.
                            </p>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setIsLinkModalOpen(true)} 
                            className="btn btn-primary whitespace-nowrap px-8 py-3 rounded-xl shadow-lg shadow-red-600/10 hover:scale-105 transition-transform"
                        >
                            Link Payout Account
                        </button>
                    </div>
                )}

                <section className="dashboard-hero grid grid-cols-1 sm:grid-cols-4 gap-4 mt-8" aria-label="Task overview">
                    <div className="stat-card stat-card--blue h-32">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">In Progress</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconActivity className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{activeCount}</p>
                    </div>
                    <div className="stat-card stat-card--amber h-32">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">To Activate</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconWallet className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{pendingCount}</p>
                    </div>
                    <div className="stat-card stat-card--emerald h-32">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Done</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconCheckCircle className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{doneCount}</p>
                    </div>
                    <div className="stat-card stat-card--wallet h-32">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Balance</p>
                            <div className="stat-card__icon-wrap">
                                <IconWallet className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                                <span className="text-3xl font-bold stat-value leading-none">
                                    ₹{balance.available.toFixed(2)}
                                </span>
                            </div>
                            {balance.pending > 0 && (
                                <div className="pending-stripe">
                                    <div className="pending-stripe__dot animate-pulse" />
                                    <span className="pending-stripe__text">
                                        + ₹{balance.pending.toFixed(2)} Pending
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <div className="h-12" aria-hidden />

                <main className="dashboard-content grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {displayedTasks.length > 0 ? (
                        displayedTasks.map((task) => (
                            <TaskCard 
                                key={task._id} 
                                task={task} 
                                onRefetch={handleManualRefresh}
                            />
                        ))
                    ) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/50 rounded-[3rem] border border-dashed border-slate-200">
                            <div className="p-6 bg-slate-50 rounded-full mb-6 text-slate-300">
                                <IconInbox className="w-12 h-12" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Clean Slate</h3>
                            <p className="text-slate-500 max-w-sm text-center font-medium">
                                No active tasks found. Start by creating a task or staking something new.
                            </p>
                        </div>
                    )}
                </main>
            </div>

            {isModalOpen && (
                <CreateTaskModal 
                    onClose={() => setIsModalOpen(false)} 
                    onTaskCreated={handleTaskCreated}
                />
            )}

            <LinkStripeModal
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
            />
        </div>
    );
};

export default DashboardPage;
