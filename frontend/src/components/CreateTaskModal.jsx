import React, { useState, useEffect } from 'react';
import contractService from '../services/contract.service';

const CreateTaskModal = ({ onClose, onTaskCreated }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        stakeAmount: 50,
        deadline: '',
        validator: null // holds the selected User object
    });
    
    // Search Validator state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Debounce search query to not overwhelm API
    useEffect(() => {
        const fetchValidators = async () => {
             if (searchQuery.trim().length < 2) {
                 setSearchResults([]);
                 return;
             }
             setIsSearching(true);
             try {
                 const res = await contractService.searchValidators(searchQuery);
                 setSearchResults(res.data);
             } catch (err) {
                 console.error("Failed to search validators", err);
             } finally {
                 setIsSearching(false);
             }
        };

        const timerId = setTimeout(() => {
            fetchValidators();
        }, 300);

        return () => clearTimeout(timerId);
    }, [searchQuery]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectValidator = (user) => {
        setFormData(prev => ({ ...prev, validator: user }));
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!formData.validator) {
            setError("You must select a validator.");
            return;
        }
        
        if (formData.stakeAmount < 50) {
            setError("Minimum stake amount is ₹50");
            return;
        }

        setLoading(true);
        try {
            const result = await contractService.createContract({
                title: formData.title,
                description: formData.description,
                stakeAmount: Number(formData.stakeAmount),
                deadline: formData.deadline,
                validator: formData.validator._id
            });
            onTaskCreated(result.data.contract);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to create task");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            
            {/* Modal Content */}
            <div className="card glass relative w-full max-w-lg shadow-2xl slide-in z-10 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Create New Task</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="label">Task Title</label>
                        <input
                            required
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="input"
                            placeholder="e.g. Finish React Dashboard"
                        />
                    </div>

                    <div>
                        <label className="label">Description (Optional)</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="input min-h-[80px]"
                            placeholder="Provide details for your validator..."
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Stake Amount (₹)</label>
                            <input
                                required
                                type="number"
                                name="stakeAmount"
                                min="50"
                                value={formData.stakeAmount}
                                onChange={handleChange}
                                className="input font-medium"
                            />
                        </div>
                        <div>
                            <label className="label">Deadline</label>
                            <input
                                required
                                type="datetime-local"
                                name="deadline"
                                value={formData.deadline}
                                onChange={handleChange}
                                className="input"
                            />
                        </div>
                    </div>

                    {/* Validator Selection Block */}
                    <div className="relative border-t border-slate-100 pt-5 mt-2">
                        <label className="label">Assign a Validator</label>
                        
                        {formData.validator ? (
                            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{formData.validator.fullName}</p>
                                    <p className="text-xs text-slate-500">{formData.validator.email}</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setFormData(prev => ({ ...prev, validator: null }))}
                                    className="text-brand-red text-sm font-medium hover:underline"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input"
                                    placeholder="Search by name, email, or UPI..."
                                />
                                {isSearching && <span className="absolute right-3 top-3 w-4 h-4 spinner !border-slate-300 !border-t-brand-red"></span>}
                                
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-md overflow-hidden z-20">
                                        {searchResults.map(user => (
                                            <div 
                                                key={user._id} 
                                                className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                                                onClick={() => handleSelectValidator(user)}
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-800 text-sm">{user.fullName}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                                <button type="button" className="btn btn-secondary !py-1 !px-3 !text-xs">Select</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-2">This person will verify if you complete your task successfully.</p>
                    </div>

                    <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
                        {loading ? <span className="spinner w-5 h-5 !border-2 !border-white/30 !border-t-white mix-blend-screen"></span> : 'Draft Contract'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;
