import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconAlertCircle,
  IconLock,
  IconMail,
  IconUser,
} from "../components/icons";
import Footer from "../components/Footer";

const SignupPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [customerFacingBusinessName, setCustomerFacingBusinessName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic phone validation
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      setError("Please enter a valid phone number (10-15 digits)");
      setLoading(false);
      return;
    }

    // Basic validation for Razorpay v2 requirements
    if (fullName.trim().length < 4) {
      setError("Full Name must be at least 4 characters long for account verification.");
      setLoading(false);
      return;
    }

    const finalLegalName = (legalBusinessName || fullName).trim();
    if (finalLegalName.length < 4) {
      setError("Legal Business Name must be at least 4 characters long.");
      setLoading(false);
      return;
    }

    try {
      await signup({ 
        fullName, 
        email, 
        password, 
        phone: normalizedPhone,
        legalBusinessName: finalLegalName,
        customerFacingBusinessName: (customerFacingBusinessName || fullName).trim()
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || "Signup failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/40">
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-12">
        <div className="auth-card slide-in relative z-0 max-w-xl mx-auto">
          <header className="auth-header">
            <p className="text-xs uppercase tracking-[0.25em] font-semibold text-[color:var(--brand-red)]">
              Create Account
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Start organizing
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Create an account to add tasks, deadlines, and an accountability partner.
            </p>
          </header>

          {error && (
            <div className="alert alert-error mb-6" role="alert">
              <IconAlertCircle className="w-5 h-5 shrink-0 text-red-600/90" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-field">
                <label className="label" htmlFor="fullName">
                  Full Name
                </label>
                <div className="input-row">
                  <span className="input-row__icon">
                    <IconUser className="w-5 h-5" />
                  </span>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!legalBusinessName) setLegalBusinessName(e.target.value);
                      if (!customerFacingBusinessName) setCustomerFacingBusinessName(e.target.value);
                    }}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="label" htmlFor="email">
                  Email
                </label>
                <div className="input-row">
                  <span className="input-row__icon">
                    <IconMail className="w-5 h-5" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-field">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="input-row">
                  <span className="input-row__icon">
                    <IconLock className="w-5 h-5" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="label" htmlFor="phone">
                  Phone (for Payouts)
                </label>
                <div className="input-row">
                  <span className="input-row__icon">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payout Account Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-field">
                  <label className="label" htmlFor="legalName">Legal Name</label>
                  <input
                    id="legalName"
                    type="text"
                    className="input !bg-white"
                    placeholder="e.g. John Doe & Co."
                    value={legalBusinessName}
                    onChange={(e) => setLegalBusinessName(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="facingName">Display Name</label>
                  <input
                    id="facingName"
                    type="text"
                    className="input !bg-white"
                    placeholder="e.g. Acme Services"
                    value={customerFacingBusinessName}
                    onChange={(e) => setCustomerFacingBusinessName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-4 text-base font-bold shadow-xl shadow-red-600/20 active:scale-[0.98] transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <span
                  className="spinner"
                  style={{ width: "20px", height: "20px", borderWidth: "2px" }}
                ></span>
              ) : (
                "Create Account & Link Payouts"
              )}
            </button>
          </form>

          <div className="auth-footer mt-8 border-t border-slate-100 pt-6">
            <span className="text-sm text-slate-500">Already have an account?</span>
            <Link to="/login" className="subtle-link hover:underline text-sm font-bold">
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignupPage;
