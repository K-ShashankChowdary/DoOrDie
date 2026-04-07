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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="modal-panel w-full max-w-lg flex flex-col gap-10 bg-white/95 rounded-[2rem] p-10 shadow-[0_32px_80px_-15px_rgba(15,23,42,0.2)] border border-white/60 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
              Connect Payouts
            </h2>
            <p className="text-[15px] text-slate-500 font-medium leading-relaxed">
              Activate your Stripe account to receive your validator rewards.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="group p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 rounded-2xl transition-all duration-300"
            aria-label="Close dialog"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-300">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Alert */}
        {error && (
          <div className="flex items-center gap-4 p-5 bg-red-50 border border-red-100 rounded-2xl text-red-700 animate-in slide-in-from-top-4 duration-300">
            <div className="p-2 bg-red-100 rounded-lg">
                <IconAlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-bold leading-tight">{error}</span>
          </div>
        )}

        {/* Informative Body */}
        <div className="space-y-6">
          <div className="group relative overflow-hidden p-6 bg-slate-50/50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
            <div className="flex items-start gap-5 relative z-10">
                <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform duration-500">
                    <IconLock className="w-6 h-6" />
                </div>
                <div>
                    <p className="font-extrabold text-slate-900 mb-1">Financial Security</p>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        Redirecting to Stripe Express. No bank details ever touch our systems.
                    </p>
                </div>
            </div>
          </div>

          <div className="space-y-1 bg-slate-50/30 p-3 rounded-2xl border border-slate-50/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/50">
              <span className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">Account Type</span>
              <span className="text-sm text-slate-900 font-black">STRIPIE EXPRESS</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">Frequency</span>
              <span className="text-sm text-slate-900 font-black">AUTOMATIC</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`group w-full py-6 rounded-2xl font-black text-lg transition-all duration-300 flex items-center justify-center gap-4 relative overflow-hidden active:scale-[0.98]
                ${isSubmitting ? 'bg-slate-200 cursor-not-allowed' : 'text-white'}`}
              style={!isSubmitting ? { background: 'var(--brand-grad)', boxShadow: 'var(--shadow-brand)' } : {}}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <span className="spinner w-6 h-6 !border-slate-400 !border-t-slate-600" />
                  <span className="text-slate-500">Opening Stripe...</span>
                </div>
              ) : (
                <>
                  <span className="relative z-10 flex items-center gap-3">
                    <IconWallet className="w-6 h-6" />
                    Begin Onboarding
                  </span>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-bold tracking-[0.2em] uppercase px-4">
              Authorized by the <span className="text-slate-600">Stripe Connect</span> platform agreement
            </p>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default LinkStripeModal;
