import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import contractService from "../services/contract.service";
import { useAuth } from "../context/AuthContext";
import SubmitProofModal from "./SubmitProofModal";
import ReviewProofModal from "./ReviewProofModal";
import {
  IconAlertCircle,
  IconCalendar,
  IconCreditCard,
  IconIndianRupee,
  IconUpload,
  IconCheckCircle,
  IconTrash,
} from "./icons";

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const STATUS = {
  PENDING_PAYMENT: {
    label: "To activate",
    chipCls: "status-chip warning",
    accent: "#f59e0b",
    pulse: false,
  },
  ACTIVE: {
    label: "In progress",
    chipCls: "status-chip info",
    accent: "#2563eb",
    pulse: true,
  },
  VALIDATING: {
    label: "In review",
    chipCls: "status-chip info",
    accent: "#0ea5e9",
    pulse: false,
  },
  COMPLETED: {
    label: "Done ✓",
    chipCls: "status-chip success",
    accent: "#10b981",
    pulse: false,
  },
  FAILED: {
    label: "Missed",
    chipCls: "status-chip danger",
    accent: "#ef4444",
    pulse: false,
  },
  REJECTED: {
    label: "Rejected",
    chipCls: "status-chip danger",
    accent: "#ef4444",
    pulse: false,
  },
};

const TaskCard = ({ task, onRefetch }) => {
  const { user } = useAuth();
  const { _id, title, description, stakeAmount, deadline, status } = task;
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-refresh when the deadline exactly hits
  useEffect(() => {
    if (status === "ACTIVE") {
      const msUntilDeadline = new Date(deadline).getTime() - Date.now();
      if (msUntilDeadline > 0 && msUntilDeadline <= 2147483647) {
        // Set a timer to trigger exactly when the deadline hits.
        // We add a tiny 2-second buffer to guarantee the backend worker has already processed it.
        const timer = setTimeout(() => {
          if (onRefetch) onRefetch();
        }, msUntilDeadline + 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [deadline, status, onRefetch]);

  // Check if current user is the creator of this task
  const taskCreatorId = typeof task.creator === 'object' ? task.creator?._id : task.creator;
  const isCreator = user && user._id === taskCreatorId;

  const cfg = STATUS[status] || STATUS.PENDING_PAYMENT;
  const deadlineDate = new Date(deadline);
  const isOverdue = deadlineDate < new Date() && status === "ACTIVE";
  const isExpiredPending = deadlineDate < new Date() && status === "PENDING_PAYMENT";

  // Force close the proof modal if the deadline hits while it's open
  useEffect(() => {
    if (isOverdue && isProofModalOpen) {
      setIsProofModalOpen(false);
    }
  }, [isOverdue, isProofModalOpen]);

  const handlePay = async () => {
    setPayError(null);
    setPaying(true);
    try {
      const orderRes = await contractService.generatePaymentOrder(_id);
      const { order } = orderRes.data;
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load Razorpay. Check your internet connection.");
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: "DoOrDie",
          description: title,
          order_id: order.id,
          theme: { color: "#2563eb" },
          handler: async (resp) => {
            try {
              await contractService.verifyPayment({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              if (onRefetch) await onRefetch();
              resolve();
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => reject(new Error("DISMISSED")) },
        });
        rzp.on("payment.failed", (res) => reject(new Error(res.error?.description || "Payment failed")));
        rzp.open();
      });
    } catch (err) {
      if (err.message !== "DISMISSED") {
        setPayError(err.response?.data?.message || err.message || "Payment failed");
      }
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this pending task?")) return;
    setIsDeleting(true);
    try {
      await contractService.deleteContract(_id);
      if (onRefetch) onRefetch();
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`task-card-new${isOverdue ? " task-card-new--overdue" : ""}`}
    >
      {/* Top accent bar */}
      <div
        className="task-card-new__bar"
        style={{ background: cfg.accent }}
      />

      <div className="task-card-new__inner">
        {/* ── Header ── */}
        <div className="task-card-new__head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="task-card-new__title">{title}</h3>
            {description && (
              <p className="task-card-new__desc">{description}</p>
            )}
          </div>
          <span className={cfg.chipCls}>
            {cfg.pulse && <span className="pulse-dot-sm" />}
            {cfg.label}
          </span>
        </div>

        {/* ── Meta row ── */}
        <div className="task-card-new__meta">
          {/* Amount */}
          <div className="task-meta-item">
            <div className="task-meta-item__icon">
              <IconIndianRupee className="w-4 h-4" />
            </div>
            <div>
              <p className="task-meta-item__label">Stake</p>
              <p className="task-meta-item__value">₹{stakeAmount}</p>
            </div>
          </div>

          {/* Deadline */}
          <div className={`task-meta-item${isOverdue || isExpiredPending ? " task-meta-item--danger" : ""}`}>
            <div className="task-meta-item__icon">
              <IconCalendar className="w-4 h-4" />
            </div>
            <div>
              <p className="task-meta-item__label">Due</p>
              <p className="task-meta-item__value">
                {format(deadlineDate, "MMM dd, yyyy")}
              </p>
              <p className="task-meta-item__sub">
                {format(deadlineDate, "HH:mm")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Pay section ── */}
        {status === "PENDING_PAYMENT" && (
          <div className="task-card-new__pay">
            {isExpiredPending ? (
              <div className="task-card-new__expired">
                <IconAlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                <span>Deadline passed — this task can no longer be activated.</span>
              </div>
            ) : (
              <>
                {payError && (
                  <div className="alert alert-error text-xs py-2" role="alert">
                    <IconAlertCircle className="w-4 h-4 text-red-600" />
                    <span>{payError}</span>
                  </div>
                )}
                <button
                  type="button"
                  id={`pay-btn-${_id}`}
                  onClick={handlePay}
                  disabled={paying}
                  className="task-card-new__pay-btn"
                >
                  {paying ? (
                    <>
                      <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <IconCreditCard className="w-4 h-4" />
                      Pay ₹{stakeAmount} to start
                    </>
                  )}
                </button>
                {isCreator && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting || paying}
                    className="task-card-new__pay-btn !bg-white hover:!bg-slate-50 !text-slate-500 hover:!text-red-500 !border-slate-200 shadow-sm mt-2 transition-colors"
                  >
                    {isDeleting ? (
                       <span className="spinner w-4 h-4 !border-2 !border-slate-400 !border-t-transparent" />
                    ) : (
                      <IconTrash className="w-4 h-4" />
                    )}
                    <span className="font-semibold">Delete Task</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {status === "ACTIVE" && isOverdue && (
          <div className="task-card-new__pay mt-4">
            <div className="task-card-new__expired">
              <IconAlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
              <span>Deadline passed — awaiting settlement.</span>
            </div>
          </div>
        )}

        {status === "ACTIVE" && isCreator && !isOverdue && (
          <div className="task-card-new__pay mt-4">
            <button
              type="button"
              onClick={() => setIsProofModalOpen(true)}
              className="task-card-new__pay-btn"
            >
              <IconUpload className="w-4 h-4" />
              Submit Proof of Work
            </button>
          </div>
        )}

        {status === "VALIDATING" && !isCreator && (
          <div className="task-card-new__pay mt-4">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="task-card-new__pay-btn !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600 shadow-[var(--elev-1)] shadow-emerald-600/20"
            >
              <IconCheckCircle className="w-4 h-4" />
              Review Proof
            </button>
          </div>
        )}
      </div>

      <SubmitProofModal 
          isOpen={isProofModalOpen} 
          onClose={() => setIsProofModalOpen(false)} 
          contractId={_id}
          onSuccess={onRefetch}
      />

      <ReviewProofModal
          task={task}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={onRefetch}
      />
    </div>
  );
};

export default TaskCard;
