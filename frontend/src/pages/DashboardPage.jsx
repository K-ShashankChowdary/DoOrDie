import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
import {
    IconActivity,
    IconCheckCircle,
    IconInbox,
    IconLogOut,
    IconPlus,
    IconWallet,
} from '../components/icons';

const DashboardPage = () => {
    const { user, logout } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
    const userInitial = (user?.fullName?.trim()?.charAt(0) || '?').toUpperCase();

    const { activeCount, pendingCount, doneCount } = useMemo(() => ({
        activeCount: tasks.filter(t => t.status === 'ACTIVE').length,
        pendingCount: tasks.filter(t => t.status === 'PENDING_PAYMENT').length,
        doneCount: tasks.filter(t => t.status === 'COMPLETED').length,
    }), [tasks]);
    
    return (
        <div className="page-shell">
            <div className="container-wide dashboard-layout fade-in">
                <header className="dashboard-top">
                    <div className="dashboard-user">
                        <div className="dashboard-avatar" aria-hidden>
                            {userInitial}
                        </div>
                        <div className="space-y-2 min-w-0 flex-1">
                            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[color:var(--brand-red)]">
                                My tasks
                            </p>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                Hey {firstName}, here is your list.
                            </h1>
                            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                                Add todos, track due dates, and finish what matters.
                            </p>
                        </div>
                    </div>
                    <div className="dashboard-actions">
                        <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary whitespace-nowrap">
                            <IconPlus className="w-4 h-4" />
                            New task
                        </button>
                        <button type="button" onClick={logout} className="btn btn-secondary text-sm">
                            <IconLogOut className="w-4 h-4" />
                            Log out
                        </button>
                    </div>
                </header>

                <section className="dashboard-hero grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 lg:gap-10 items-start" aria-label="Task overview">
                    <div className="dashboard-hero-content space-y-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="stat-pill">Overview</span>
                            <span className="text-sm text-slate-500">At a glance</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                            In progress tasks are live. &quot;To activate&quot; means checkout is still pending.
                        </p>
                    </div>
                    <div className="stat-grid w-full min-w-0">
                        <div className="stat-card stat-card--blue">
                            <div className="stat-card__head">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In progress</p>
                                <div className="stat-card__icon-wrap" aria-hidden>
                                    <IconActivity className="w-4 h-4" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold stat-value leading-none tabular-nums">{activeCount}</p>
                        </div>
                        <div className="stat-card stat-card--amber">
                            <div className="stat-card__head">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">To activate</p>
                                <div className="stat-card__icon-wrap" aria-hidden>
                                    <IconWallet className="w-4 h-4" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold stat-value leading-none tabular-nums">{pendingCount}</p>
                        </div>
                        <div className="stat-card stat-card--emerald">
                            <div className="stat-card__head">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Done</p>
                                <div className="stat-card__icon-wrap" aria-hidden>
                                    <IconCheckCircle className="w-4 h-4" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold stat-value leading-none tabular-nums">{doneCount}</p>
                        </div>
                    </div>
                </section>

                {loading ? (
                    <div className="dashboard-loading-surface flex flex-col justify-center items-center gap-5 py-20 px-6">
                        <span className="spinner w-11 h-11" aria-hidden />
                        <p className="text-sm text-slate-500 font-medium">Loading your tasks…</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="empty-card w-full text-center flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto">
                        <div className="inline-flex items-center justify-center rounded-2xl bg-white/90 p-5 shadow-[var(--elev-2)] ring-1 ring-slate-200/80">
                            <IconInbox className="w-12 h-12 text-[color:var(--brand-red)]" />
                        </div>
                        <div className="pill-outline">Nothing yet</div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">No tasks yet</h2>
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
                        <div className="dashboard-tasks-head">
                            <h2 className="dashboard-tasks-title">
                                All tasks
                                <span className="dashboard-count-badge">{tasks.length}</span>
                            </h2>
                        </div>
                        <div className="tasks-grid">
                            {tasks.map(task => (
                                <TaskCard key={task._id} task={task} onRefetch={fetchTasks} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {tasks.length > 0 && (
                <button 
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="fab fab-fixed btn btn-primary flex items-center justify-center md:hidden"
                    aria-label="Add task"
                >
                    <IconPlus className="w-6 h-6" />
                </button>
            )}

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
