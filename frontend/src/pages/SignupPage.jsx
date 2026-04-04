import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconAlertCircle,
  IconLock,
  IconMail,
  IconUser,
} from "../components/icons";

const SignupPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="page-shell auth-page">
      <div className="auth-card slide-in relative z-0">
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
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
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
                placeholder="Jordan Patel"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span
                className="spinner"
                style={{ width: "20px", height: "20px", borderWidth: "2px" }}
              ></span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login" className="subtle-link hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
