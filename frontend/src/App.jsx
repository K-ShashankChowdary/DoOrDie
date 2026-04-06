import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import ValidationsPage from './pages/ValidationsPage';

// Policy Pages
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ShippingPage from './pages/ShippingPage';
import RefundPage from './pages/RefundPage';
import ContactPage from './pages/ContactPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Policy Routes (Public) */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/shipping" element={<ShippingPage />} />
        <Route path="/refunds" element={<RefundPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/validations" element={<ValidationsPage />} />
            {/* Redirect root to dashboard by default */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        {/* Catch All 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
