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

    const fetchTasks = async () => {
        try {
            const res = await contractService.getUserContracts();
            setTasks(res.data.contracts || []);
        } catch (err) {
            console.error("Failed to load tasks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleTaskCreated = (newTask) => {
        setTasks(prev => [newTask, ...prev]);
    };

    const firstName = user?.fullName?.split(' ')[0] || 'there';

    // Only creator tasks
    const displayedTasks = useMemo(() => tasks.filter(t => t.creator === user?._id || t.creator?._id === user?._id), [tasks, user]);

    const { activeCount, pendingCount, doneCount } = useMemo(() => ({
        activeCount: displayedTasks.filter(t => t.status === 'ACTIVE').length,
        pendingCount: displayedTasks.filter(t => t.status === 'PENDING_PAYMENT').length,
        doneCount: displayedTasks.filter(t => t.status === 'COMPLETED').length,
    }), [displayedTasks]);
    
    return (
        <div className="page-shell bg-transparent">
            <div className="container-wide dashboard-layout fade-in pt-6">
                <header className="dashboard-top !border-0 !pb-2">
                    <div className="dashboard-user">
                        <div className="space-y-2 min-w-0 flex-1">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                Hey {firstName}, here is your list.
                            </h1>
                            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                                Add todos, track due dates, and finish what matters.
                            </p>
                        </div>
                    </div>
                    <div className="dashboard-actions hidden sm:flex">
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary whitespace-nowrap">
                            <IconPlus className="w-4 h-4" />
                            New task
                        </button>
                    </div>
                </header>

                {!user?.stripeAccountId && (
                    <div className="mb-8 bg-red-50/50 border border-red-200 rounded-2xl p-6 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="text-center sm:text-left">
                            <h3 className="text-red-900 font-bold text-xl flex items-center justify-center sm:justify-start gap-3">
                                <IconWallet className="w-6 h-6 text-red-600" />
                                Action Required
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

                <section className="dashboard-hero grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Task overview">
                    <div className="stat-card stat-card--blue h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In progress</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconActivity className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{activeCount}</p>
                    </div>
                    <div className="stat-card stat-card--amber h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">To activate</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconWallet className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{pendingCount}</p>
                    </div>
                    <div className="stat-card stat-card--emerald h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Done</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconCheckCircle className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{doneCount}</p>
                    </div>
                </section>

                <div className="mb-4"></div>

                {loading ? (
                    <div className="dashboard-loading-surface flex flex-col justify-center items-center gap-5 py-20 px-6">
                        <span className="spinner w-11 h-11" aria-hidden />
                        <p className="text-sm text-slate-500 font-medium">Loading your tasks…</p>
                    </div>
                ) : displayedTasks.length === 0 ? (
                    <div className="empty-card w-full max-w-6xl mx-auto text-center flex flex-col items-center justify-center gap-8 py-16 px-6">
                        <div className="inline-flex items-center justify-center rounded-2xl bg-white/90 p-5 shadow-[var(--elev-2)] ring-1 ring-slate-200/80">
                            <IconInbox className="w-12 h-12 text-[color:var(--brand-red)]" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                            No tasks yet
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm leading-relaxed px-2">
                            Add your first task with a due date, an amount (min ₹50), and someone who checks it off with you.
                        </p>
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                            <IconPlus className="w-4 h-4" />
                            Create your first task
                        </button>
                    </div>
                ) : (
                    <section className="dashboard-tasks-section" aria-label="Your tasks">
                        <div className="tasks-grid">
                            {displayedTasks.map(task => (
                                <TaskCard key={task._id} task={task} onRefetch={fetchTasks} />
                            ))}
                        </div>
                    </section>
                )}
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
