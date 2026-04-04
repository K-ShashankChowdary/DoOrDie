import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconAlertCircle,
  IconLock,
  IconMail,
} from "../components/icons";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again.",
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
            Sign In
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Sign in to see your tasks, due dates, and progress in one place.
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
                autoComplete="current-password"
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
              "Sign In"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <Link to="/signup" className="subtle-link hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
