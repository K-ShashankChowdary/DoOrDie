import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { IconAlertCircle, IconWallet } from "./icons";

const LinkRazorpayModal = ({ user, isOpen, onClose }) => {
  const { linkRazorpay } = useAuth();

  const [phone, setPhone] = useState("");
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [customerFacingBusinessName, setCustomerFacingBusinessName] = useState("");
  const [tncAccepted, setTncAccepted] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPhone("");
    setLegalBusinessName(user?.fullName || "");
    setCustomerFacingBusinessName(user?.fullName || "");
    setTncAccepted(true);
    setError("");
    setIsSubmitting(false);
  }, [isOpen, user]);

  if (!isOpen) return null;

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Phone number is required.");
      return;
    }

    if (normalized.length < 10 || normalized.length > 15) {
      setError("Enter a valid phone number (10-15 digits).");
      return;
    }

    if (!tncAccepted) {
      setError("Please accept the T&C to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await linkRazorpay({
        phone: normalized,
        legalBusinessName,
        customerFacingBusinessName,
      });
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to link account"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm slide-in">
      <div className="modal-panel w-full max-w-lg flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Link Payout Account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Required to receive validator payouts automatically.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="modal-close"
            aria-label="Close dialog"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlertCircle className="w-5 h-5 flex-shrink-0 text-red-600/90" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={user?.email || ""}
              disabled
            />
          </div>

          <div className="space-y-2">
            <label className="label">Phone (Razorpay account)</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
            />
            <p className="text-xs text-slate-500">
              Enter 10-15 digits. If you include `91`, it will be normalized.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label">Legal business name</label>
              <input
                type="text"
                className="input"
                value={legalBusinessName}
                onChange={(e) => setLegalBusinessName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <label className="label">Customer facing name</label>
              <input
                type="text"
                className="input"
                value={customerFacingBusinessName}
                onChange={(e) =>
                  setCustomerFacingBusinessName(e.target.value)
                }
                placeholder="Your name"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tncAccepted}
              onChange={(e) => setTncAccepted(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              I accept the T&C (required by Razorpay).
            </span>
          </label>

          <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />
              ) : (
                <IconWallet className="w-4 h-4" />
              )}
              {isSubmitting ? "Linking..." : "Link Account"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default LinkRazorpayModal;

