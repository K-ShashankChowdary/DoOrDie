import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signup({ fullName, email, password });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page flex items-center justify-center p-4">
            <div className="card glass w-full max-w-md mx-auto slide-in">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Join <span className="text-slate-900">Do</span><span className="text-slate-400">Or</span><span className="text-red-600">Die</span></h1>
                    <p className="text-sm text-slate-500">Create an account to commit to your goals.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="label" htmlFor="fullName">Full Name</label>
                        <input
                            id="fullName"
                            type="text"
                            className="input"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

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
                            minLength={6}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary w-full mt-4"
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}}></span> : 'Create Account'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                    Already have an account? <Link to="/login" className="hover:underline font-medium" style={{color: "var(--brand-red)"}}>Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
