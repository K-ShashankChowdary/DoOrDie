import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page flex items-center justify-center p-4">
            <div className="card glass w-full max-w-md mx-auto slide-in">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Welcome Back to <span className="text-slate-900">Do</span><span className="text-slate-400">Or</span><span className="text-red-600">Die</span></h1>
                    <p className="text-sm text-slate-500">Sign in to manage your tasks.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary w-full mt-4"
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}}></span> : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                    Don't have an account? <Link to="/signup" className="hover:underline font-medium" style={{color: "var(--brand-red)"}}>Sign up</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
