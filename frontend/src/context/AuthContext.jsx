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
            const response = await api.post('/users/refresh-token');
            setUser(response.data.data.user);
        } catch {
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
            await api.post('/users/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
        }
    };

    const getBalance = async () => {
        const response = await api.get('/users/balance');
        return response?.data;
    };

    const createTopupSession = async (amount) => {
        const response = await api.post('/users/wallet/topup', { amount });
        return response?.data;
    };

    const requestWithdrawal = async (amount) => {
        const response = await api.post('/users/wallet/withdraw', { amount });
        return response?.data;
    };

    const getWithdrawalHistory = async () => {
        const response = await api.get('/users/wallet/withdrawals');
        return response?.data;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        signup,
        getBalance,
        createTopupSession,
        requestWithdrawal,
        getWithdrawalHistory,
        setUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
