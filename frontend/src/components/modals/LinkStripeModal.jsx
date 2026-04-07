import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { IconAlertCircle, IconWallet, IconLock } from "../icons";

/**
 * LinkStripeModal component for initiating Stripe Connect Express onboarding.
 * 
 * Why: This modal provides a professional, simplified interface for validators
 * to connect their Stripe account, which is required for receiving stake payouts.
 */
const LinkStripeModal = ({ isOpen, onClose }) => {
  const { user, linkStripe } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setIsSubmitting(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    try {
      // linkStripe will call the backend and perform a window.location.href redirect
      await linkStripe();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to initiate Stripe onboarding"
      );
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm slide-in">
      <div className="modal-panel w-full max-w-lg flex flex-col gap-8 bg-white rounded-3xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Connect Payouts
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              We use Stripe to securely remit validator rewards to your bank.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"
            aria-label="Close dialog"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 animate-shake">
            <IconAlertCircle className="w-6 h-6 flex-shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Informative Body */}
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
              <IconLock className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-800">Secure & Direct</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                You will be redirected to Stripe’s secure dashboard to set up your Connect account. Your financial data is never stored on our servers.
              </p>
            </div>
          </div>

          <div className="space-y-4 px-1">
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Account Type</span>
              <span className="text-slate-900 font-bold">Stripe Express</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Payout Frequency</span>
              <span className="text-slate-900 font-bold">Manual / Scheduled</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl 
                ${isSubmitting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/30 text-white active:scale-95'}`}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner w-6 h-6 !border-white/30 !border-t-white" />
                  Initiating...
                </>
              ) : (
                <>
                  <IconWallet className="w-6 h-6" />
                  Proceed to Stripe Onboarding
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-bold tracking-widest uppercase">
              By continuing, you agree to the Stripe Connect Account Agreement.
            </p>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default LinkStripeModal;
