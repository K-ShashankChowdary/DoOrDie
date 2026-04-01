import React from 'react';
import { format } from 'date-fns';

const TaskCard = ({ task }) => {
    // Extract properties mapped from the backend contract model
    const { title, description, stakeAmount, deadline, status, validator } = task;

    // Helper function to render the correct design-system badge based on status
    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_PAYMENT':
                return <span className="badge badge-warning">Awaiting Payment</span>;
            case 'ACTIVE':
                return <span className="badge badge-info">Active</span>;
            case 'VALIDATING':
                return <span className="badge badge-info text-purple-600 bg-purple-100">Validating</span>;
            case 'COMPLETED':
                return <span className="badge badge-success">Completed</span>;
            case 'FAILED':
                return <span className="badge badge-danger">Failed</span>;
            default:
                return <span className="badge badge-warning">{status}</span>;
        }
    };

    // Calculate urgency visual if deadline is approaching
    const isOverdue = new Date(deadline) < new Date() && status === 'ACTIVE';

    return (
        <div className={`card glass flex flex-col justify-between ${isOverdue ? 'border-red-400/50 shadow-sm shadow-red-500/10' : ''}`}>
            <div>
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-slate-800 line-clamp-1">{title}</h3>
                    {getStatusBadge(status)}
                </div>
                
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {description || 'No description provided.'}
                </p>
            </div>

            <div className="pt-4 border-t border-slate-100 text-sm flex items-center justify-between">
                <div>
                    <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Stake</span>
                    <span className="font-bold text-slate-700">₹{stakeAmount}</span>
                </div>
                
                <div className="text-right">
                    <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Deadline</span>
                    <span className={`font-medium ${isOverdue ? 'text-brand-red' : 'text-slate-600'}`}>
                        {format(new Date(deadline), 'MMM dd, yyyy - HH:mm')}
                    </span>
                </div>
            </div>
            
            {status === 'PENDING_PAYMENT' && (
                <button className="btn btn-primary w-full mt-4 text-sm py-2">
                    Pay ₹{stakeAmount}
                </button>
            )}
        </div>
    );
};

export default TaskCard;
