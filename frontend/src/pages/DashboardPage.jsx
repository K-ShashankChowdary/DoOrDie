import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import contractService from '../services/contract.service';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';

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
        // Optimistically add the new task to the top of the list
        setTasks(prev => [newTask, ...prev]);
    };
    
    return (
        <div className="page p-6 pb-24">
            <div className="container max-w-5xl mx-auto pt-8">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">My Tasks</h1>
                        <p className="text-sm text-slate-500">Welcome back, <span className="font-semibold text-slate-800">{user?.fullName || 'User'}</span>. Stay focused on your goals.</p>
                    </div>
                    
                    <button onClick={logout} className="btn btn-secondary text-sm">
                        Log Out
                    </button>
                </div>
                
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <span className="spinner w-8 h-8"></span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="card glass w-full py-20 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No active tasks yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mb-6">Create a high-stakes task and commit to completing it by dedicating a stake amount.</p>
                        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                            Create Your First Task
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tasks.map(task => (
                            <TaskCard key={task._id} task={task} onRefetch={fetchTasks} />
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button for mobile / quick access */}
            {tasks.length > 0 && (
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="fixed bottom-8 right-8 btn btn-primary !rounded-full !w-14 !h-14 shadow-xl !p-0 flex items-center justify-center"
                    aria-label="Create Task"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
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
