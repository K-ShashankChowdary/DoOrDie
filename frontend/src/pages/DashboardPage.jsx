import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/tasks/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
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
    const [taskError, setTaskError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [balance, setBalance] = useState({ available: 0, pending: 0 });
    const [showBalance, setShowBalance] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [topupAmount, setTopupAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [topupLoading, setTopupLoading] = useState(false);
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [walletMessage, setWalletMessage] = useState(null);
    const [withdrawals, setWithdrawals] = useState([]);

    const { getBalance, createTopupSession, requestWithdrawal, getWithdrawalHistory } = useAuth();

    const fetchTasks = useCallback(async () => {
        try {
            const res = await contractService.getUserContracts();
            setTasks(res.data.contracts || []);
            setTaskError(null);
        } catch (err) {
            console.error("Failed to load tasks:", err);
            setTaskError("We couldn't load your tasks right now. Please check your connection and try again.");
        }
    }, []);

    const fetchBalance = useCallback(async () => {
        try {
            setRefreshing(true);
            const res = await getBalance();
            if (res && res.data) {
                setBalance(res.data);
            }
        } catch (err) {
            console.error("Failed to load balance:", err);
            setWalletMessage({ type: 'error', text: err?.response?.data?.message || "Failed to refresh wallet balance." });
        } finally {
            setRefreshing(false);
        }
    }, [getBalance]);

    const fetchWithdrawals = useCallback(async () => {
        try {
            const res = await getWithdrawalHistory();
            setWithdrawals(res?.data?.withdrawals || []);
        } catch (err) {
            console.error("Failed to load withdrawals:", err);
        }
    }, [getWithdrawalHistory]);

    const handleManualRefresh = () => {
        setLoading(true);
        Promise.all([fetchTasks(), fetchBalance(), fetchWithdrawals()]).finally(() => setLoading(false));
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchTasks(), fetchBalance(), fetchWithdrawals()]);
            if (!cancelled) setLoading(false);
        };
        load();

        const interval = setInterval(() => {
            fetchTasks();
            fetchBalance();
            fetchWithdrawals();
        }, 15000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [fetchTasks, fetchBalance, fetchWithdrawals]);


    const handleTaskCreated = (newTask) => {
        setTasks(prev => [newTask, ...prev]);
    };

    const displayedTasks = useMemo(() => {
        return tasks.filter(t => {
            if (!t) return false;
            const creatorId = typeof t.creator === 'object' ? t.creator?.id : t.creatorId || t.creator;
            return creatorId?.toString() === user?.id?.toString();
        });
    }, [tasks, user]);

    const { activeCount, pendingCount, doneCount } = useMemo(() => ({
        activeCount: displayedTasks.filter(t => t && (t.status === 'ACTIVE' || t.status === 'VALIDATING')).length,
        pendingCount: displayedTasks.filter(t => t && ((t.status === 'PENDING_PAYMENT' || t.status === 'PENDING_DEPOSIT') && new Date(t.deadline) > new Date())).length,
        doneCount: displayedTasks.filter(t => t && (t.status === 'COMPLETED' || t.status === 'REJECTED' || t.status === 'FAILED')).length
    }), [displayedTasks]);

    const totalWallet = useMemo(() => {
        const a = Number(balance?.available) || 0;
        const p = Number(balance?.pending) || 0;
        return a + p;
    }, [balance]);

    const firstName = user?.fullName?.split(' ')[0] || 'there';

    const handleTopup = async (e) => {
        e.preventDefault();
        setWalletMessage(null);
        const amount = Number(topupAmount);
        if (!Number.isFinite(amount) || amount < 50) {
            setWalletMessage({ type: 'error', text: 'Top-up amount must be at least ₹50.' });
            return;
        }
        setTopupLoading(true);
        try {
            await createTopupSession(amount);
            setWalletMessage({ type: 'success', text: 'Funds added (demo wallet — instant balance update).' });
            setTopupAmount('');
            await Promise.all([fetchBalance(), fetchWithdrawals()]);
        } catch (err) {
            setWalletMessage({ type: 'error', text: err?.response?.data?.message || 'Could not add funds.' });
        } finally {
            setTopupLoading(false);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setWalletMessage(null);
        const amount = Number(withdrawAmount);
        if (!Number.isFinite(amount) || amount < 100) {
            setWalletMessage({ type: 'error', text: 'Withdrawal amount must be at least ₹100.' });
            return;
        }
        setWithdrawLoading(true);
        try {
            await requestWithdrawal(amount);
            setWalletMessage({
                type: 'success',
                text: 'Withdrawal completed (demo — simulated bank transfer).',
            });
            setWithdrawAmount('');
            await Promise.all([fetchBalance(), fetchWithdrawals()]);
        } catch (err) {
            setWalletMessage({ type: 'error', text: err?.response?.data?.message || 'Withdrawal failed.' });
        } finally {
            setWithdrawLoading(false);
        }
    };

    return (
        <div className="page-shell bg-transparent">
            <div className="dashboard-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                <header className="flex items-start sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3 min-w-0">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                    Hey {firstName} 👋
                                </h1>
                                <button
                                    onClick={handleManualRefresh}
                                    className={`p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 shadow-sm ${loading ? 'animate-spin text-blue-500' : ''}`}
                                    title="Refresh Dashboard"
                                    type="button"
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Track your stakes, deadlines, and earnings.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                        style={{ background: 'var(--brand-grad)' }}
                    >
                        <IconPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Task</span>
                    </button>
                </header>

                <div className="mb-6 px-4 py-3 rounded-2xl border border-slate-200/80 bg-white/60 text-sm text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800">Demo wallet</span>
                    <span className="text-slate-400">·</span>
                    <span>Add and withdraw funds are simulated for this resume project — no real payments.</span>
                </div>

                <div className="dashboard-layout">
                    <div className="dashboard-layout__main">
                        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" aria-label="Task overview">
                            <div className="dash-stat-card">
                                <div className="dash-stat-card__icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                                    <IconActivity className="w-5 h-5" />
                                </div>
                                <p className="dash-stat-card__count">{activeCount}</p>
                                <p className="dash-stat-card__label">In Progress</p>
                            </div>

                            <div className="dash-stat-card">
                                <div className="dash-stat-card__icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <p className="dash-stat-card__count">{pendingCount}</p>
                                <p className="dash-stat-card__label">To Activate</p>
                            </div>

                            <div className="dash-stat-card">
                                <div className="dash-stat-card__icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                                    <IconCheckCircle className="w-5 h-5" />
                                </div>
                                <p className="dash-stat-card__count">{doneCount}</p>
                                <p className="dash-stat-card__label">Completed</p>
                            </div>
                        </section>

                        <main className="dashboard-layout__tasks">
                            {taskError ? (
                                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 mb-6">
                                    <IconAlertCircle className="w-5 h-5 shrink-0" />
                                    <p className="text-sm font-medium">{taskError}</p>
                                </div>
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <span className="spinner w-10 h-10" />
                                    <p className="text-sm text-slate-500 font-medium">Loading your tasks…</p>
                                </div>
                            ) : displayedTasks.length > 0 ? (
                                <div className="tasks-grid">
                                    {displayedTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onRefetch={handleManualRefresh}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state-card">
                                    <div className="p-5 bg-slate-100 rounded-full mb-4">
                                        <IconInbox className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">No tasks yet</h3>
                                    <p className="text-slate-500 text-sm text-center max-w-xs">
                                        Create your first task to start staking and tracking your progress.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(true)}
                                        className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                                        style={{ background: 'var(--brand-grad)' }}
                                    >
                                        + Create Task
                                    </button>
                                </div>
                            )}
                        </main>
                    </div>

                    <aside className="dashboard-layout__wallet">
                            <div className="dash-wallet-card">
                            <div className="dash-wallet-card__top">
                                <div>
                                    <p className="dash-wallet-card__label">Wallet (demo)</p>
                                    <p className="dash-wallet-card__amount">
                                        {showBalance
                                            ? `₹${(Number(balance?.available) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                            : '₹ ••••••'}
                                    </p>
                                    {showBalance && (
                                        <p className="dash-wallet-card__sub text-xs text-slate-500 mt-1.5 font-medium">
                                            Total in wallet ₹{totalWallet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            {(Number(balance?.pending) || 0) > 0 && (
                                                <span className="text-slate-400"> (includes locked funds)</span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBalance(!showBalance)}
                                    className="dash-wallet-card__eye"
                                    title={showBalance ? 'Hide' : 'Show'}
                                >
                                    {showBalance ? (
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    ) : (
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                                    )}
                                </button>
                            </div>

                            {(Number(balance?.pending) || 0) > 0 && (
                                <div className="dash-wallet-card__pending">
                                    <span className="dash-wallet-card__pending-dot" />
                                    +₹{(Number(balance?.pending) || 0).toFixed(2)} locked (stakes & withdrawals in flight)
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={fetchBalance}
                                disabled={refreshing}
                                className="dash-wallet-card__refresh"
                            >
                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" className={refreshing ? 'animate-spin' : ''}>
                                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {refreshing ? 'Refreshing…' : 'Refresh balance'}
                            </button>

                            <div className="wallet-actions mt-4 space-y-4 min-w-0">
                                <form onSubmit={handleTopup} className="wallet-action-block">
                                    <label className="wallet-action-label" htmlFor="wallet-topup-amount">Add money (instant)</label>
                                    <input
                                        id="wallet-topup-amount"
                                        type="number"
                                        min="50"
                                        step="0.01"
                                        value={topupAmount}
                                        onChange={(e) => setTopupAmount(e.target.value)}
                                        placeholder="Amount in ₹ (min 50)"
                                        className="wallet-action-input"
                                    />
                                    <button
                                        type="submit"
                                        disabled={topupLoading || withdrawLoading}
                                        className="wallet-action-btn wallet-action-btn--primary"
                                    >
                                        {topupLoading ? 'Adding…' : 'Add funds'}
                                    </button>
                                </form>

                                <form onSubmit={handleWithdraw} className="wallet-action-block">
                                    <label className="wallet-action-label" htmlFor="wallet-withdraw-amount">Withdraw (simulated)</label>
                                    <input
                                        id="wallet-withdraw-amount"
                                        type="number"
                                        min="100"
                                        step="0.01"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="Amount in ₹ (min 100)"
                                        className="wallet-action-input"
                                    />
                                    <button
                                        type="submit"
                                        disabled={topupLoading || withdrawLoading}
                                        className="wallet-action-btn wallet-action-btn--primary wallet-action-btn--muted"
                                    >
                                        {withdrawLoading ? 'Processing…' : 'Withdraw'}
                                    </button>
                                </form>
                            </div>

                            {walletMessage && (
                                <p className={`text-xs mt-3 leading-relaxed font-medium rounded-lg px-2 py-1.5 ${walletMessage.type === 'error' ? 'text-red-700 bg-red-50' : 'text-emerald-800 bg-emerald-50'}`}>
                                    {walletMessage.text}
                                </p>
                            )}

                            <div className="mt-4 border-t border-slate-200/90 pt-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Recent withdrawals</p>
                                <div className="space-y-1.5 max-h-28 overflow-auto pr-0.5">
                                    {withdrawals.length === 0 ? (
                                        <p className="text-xs text-slate-400">No withdrawals yet.</p>
                                    ) : withdrawals.slice(0, 6).map((w) => (
                                        <div key={w.id} className="flex items-center justify-between text-xs gap-2">
                                            <span className="font-semibold text-slate-700">₹{Number(w.amount).toFixed(2)}</span>
                                            <span className="text-[10px] text-slate-400 shrink-0">{new Date(w.createdAt).toLocaleDateString('en-IN')}</span>
                                            <span className={`font-bold shrink-0 ${
                                                w.status === 'COMPLETED' ? 'text-emerald-600' :
                                                w.status === 'FAILED' ? 'text-red-600' : 'text-amber-600'
                                            }`}>{w.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {isModalOpen && (
                <CreateTaskModal
                    onClose={() => setIsModalOpen(false)}
                    onTaskCreated={handleTaskCreated}
                />
            )}

        </div>
    );
};

export default DashboardPage;
