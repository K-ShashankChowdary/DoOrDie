import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/tasks/TaskCard';
import {
    IconActivity,
    IconCheckCircle,
    IconInbox,
    IconWallet,
} from '../components/icons';

const ValidationsPage = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const firstName = user?.fullName?.split(' ')[0] || 'there';

    // Only validation tasks
    const validationTasks = useMemo(() => {
        return tasks.filter(t => {
            const validatorId = typeof t.validator === 'object' ? t.validator?._id : t.validator;
            return validatorId?.toString() === user?._id?.toString();
        });
    }, [tasks, user]);

    const { validatingCount, pendingCount, completedCount } = useMemo(() => ({
        validatingCount: validationTasks.filter(t => t.status === 'VALIDATING').length,
        pendingCount: validationTasks.filter(t => t.status === 'ACTIVE').length,
        completedCount: validationTasks.filter(t => t.status === 'COMPLETED' || t.status === 'REJECTED' || t.status === 'FAILED').length,
    }), [validationTasks]);
    
    return (
        <div className="page-shell bg-transparent">
            <div className="container-wide dashboard-layout fade-in pt-6">
                <header className="dashboard-top !border-0 !pb-2">
                    <div className="dashboard-user">
                        <div className="space-y-2 min-w-0 flex-1">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                Validation Requests
                            </h1>
                            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
                                Review work completed by other users to unlock their deposits.
                            </p>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Assigned to {firstName}
                            </p>
                        </div>
                    </div>
                </header>

                <section className="dashboard-hero grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Task overview">
                    <div className="stat-card stat-card--blue h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Awaiting Review</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconActivity className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{validatingCount}</p>
                    </div>
                    <div className="stat-card stat-card--amber h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconWallet className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{pendingCount}</p>
                    </div>
                    <div className="stat-card stat-card--emerald h-28">
                        <div className="stat-card__head">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Resolved</p>
                            <div className="stat-card__icon-wrap" aria-hidden>
                                <IconCheckCircle className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold stat-value leading-none tabular-nums">{completedCount}</p>
                    </div>
                </section>

                <div className="mb-4"></div>

                {loading ? (
                    <div className="dashboard-loading-surface flex flex-col justify-center items-center gap-5 py-20 px-6">
                        <span className="spinner w-11 h-11" aria-hidden />
                        <p className="text-sm text-slate-500 font-medium">Loading requests…</p>
                    </div>
                ) : validationTasks.length === 0 ? (
                    <div className="empty-card w-full max-w-6xl mx-auto text-center flex flex-col items-center justify-center gap-8 py-16 px-6">
                        <div className="inline-flex items-center justify-center rounded-2xl bg-white/90 p-5 shadow-[var(--elev-2)] ring-1 ring-slate-200/80">
                            <IconInbox className="w-12 h-12 text-[color:var(--brand-red)]" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                            No validation requests
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm leading-relaxed px-2">
                            You currently do not have any tasks assigned to you for validation.
                        </p>
                    </div>
                ) : (
                    <section className="dashboard-tasks-section" aria-label="Validation tasks">
                        <div className="tasks-grid">
                            {validationTasks.map(task => (
                                <TaskCard key={task._id} task={task} onRefetch={fetchTasks} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default ValidationsPage;
