import React from 'react';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
    const { user, logout } = useAuth();
    
    return (
        <div className="page p-6">
            <div className="container max-w-4xl mx-auto pt-8">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">My Tasks</h1>
                        <p className="text-sm text-slate-500">Welcome back, {user?.fullName || 'User'}. Stay focused on your goals.</p>
                    </div>
                    
                    <button onClick={logout} className="btn btn-secondary text-sm">
                        Log Out
                    </button>
                </div>
                
                <div className="card glass w-full py-12 text-center text-slate-500">
                    <p>Your tasks will appear here.</p>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
