import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/tasks/TaskCard';
import {
    IconAlertCircle,
    IconActivity,
    IconCheckCircle,
    IconInbox,
    IconWallet,
} from '../components/icons';

const ValidationsPage = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [taskError, setTaskError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTasks = async () => {
        try {
            const res = await contractService.getUserContracts();
            setTasks(res.data.contracts || []);
            setTaskError(null);
        } catch (err) {
            console.error("Failed to load tasks:", err);
            setTaskError("Failed to load your validations queue. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 15000);
        return () => clearInterval(interval);
    }, []);

    const firstName = user?.fullName?.split(' ')[0] || 'there';

    const validationTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (!t) return false;
            const validatorId = typeof t.validator === "object" ? t.validator?.id : t.validatorId || t.validator;
            return validatorId?.toString() === user?.id?.toString();
        });
    }, [tasks, user]);

    const { validatingCount, pendingCount, completedCount } = useMemo(() => ({
        validatingCount: validationTasks.filter(t => t.status === 'VALIDATING').length,
        pendingCount: validationTasks.filter(t => t.status === 'ACTIVE').length,
        completedCount: validationTasks.filter(t => t.status === 'COMPLETED' || t.status === 'REJECTED' || t.status === 'FAILED').length,
    }), [validationTasks]);
    
    return (
        <div className="page-shell bg-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── Page Header ──────────────────────────────── */}
                <header className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                            Validate Tasks
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Review proof submitted by creators — approve or reject.
                        </p>
                    </div>
                    <div className="flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white/90 border border-slate-200 shadow-sm">
                        {firstName}'s queue
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            setRefreshing(true);
                            await fetchTasks();
                            setRefreshing(false);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </header>

                {/* ── Stats Row ─────────────────────────────────── */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" aria-label="Validation overview">
                    <div className="dash-stat-card">
                        <div className="dash-stat-card__icon" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284c7' }}>
                            <IconActivity className="w-5 h-5" />
                        </div>
                        <p className="dash-stat-card__count">{validatingCount}</p>
                        <p className="dash-stat-card__label">Awaiting Review</p>
                    </div>

                    <div className="dash-stat-card">
                        <div className="dash-stat-card__icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                            <IconWallet className="w-5 h-5" />
                        </div>
                        <p className="dash-stat-card__count">{pendingCount}</p>
                        <p className="dash-stat-card__label">In Progress</p>
                    </div>

                    <div className="dash-stat-card">
                        <div className="dash-stat-card__icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                            <IconCheckCircle className="w-5 h-5" />
                        </div>
                        <p className="dash-stat-card__count">{completedCount}</p>
                        <p className="dash-stat-card__label">Resolved</p>
                    </div>
                </section>

                {/* ── Task List ─────────────────────────────────── */}
                {taskError ? (
                     <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 mb-6">
                         <IconAlertCircle className="w-5 h-5 shrink-0" />
                         <p className="text-sm font-medium">{taskError}</p>
                     </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <span className="spinner w-10 h-10" />
                        <p className="text-sm text-slate-500 font-medium">Loading requests…</p>
                    </div>
                ) : validationTasks.length === 0 ? (
                    <div className="empty-state-card">
                        <div className="p-5 bg-slate-100 rounded-full mb-4">
                            <IconInbox className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No validation requests</h3>
                        <p className="text-slate-500 text-sm text-center max-w-xs">
                            You haven't been assigned as a validator on any tasks yet.
                        </p>
                    </div>
                ) : (
                    <div className="tasks-grid">
                        {validationTasks.map(task => (
                            <TaskCard key={task.id} task={task} onRefetch={fetchTasks} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationsPage;
