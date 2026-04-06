/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuthStatus = async () => {
        try {
            // Attempt to restore session
            const response = await api.post('/users/refresh-token');
            setUser(response.data.data.user);
        } catch {
            // No valid session, or token expired/invalid
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const login = async (email, password) => {
        const response = await api.post('/users/login', { email, password });
        setUser(response.data.data.user);
        return response.data;
    };

    const signup = async (userData) => {
        const response = await api.post('/users/signup', userData);
        setUser(response.data.data.user);
        return response.data;
    };

    const logout = async () => {
        try {
            // Notify server to clear refresh token
            await api.post('/users/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            // Always clear the local session state
            setUser(null);
        }
    };

    const linkRazorpay = async (payload = {}) => {
        const response = await api.post('/users/link-razorpay', payload);
        const { razorpayLinkedAccountId } = response.data.data;
        setUser(prev => ({ ...prev, razorpayLinkedAccountId }));
        return response.data;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        signup,
        linkRazorpay,
        setUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
