import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import contractService from "../../services/contract.service";
import { useAuth } from "../../context/AuthContext";
import SubmitProofModal from "../SubmitProofModal";
import ReviewProofModal from "../ReviewProofModal";
import CheckoutModal from "../modals/CheckoutModal";
import {
  IconAlertCircle,
  IconCalendar,
  IconCreditCard,
  IconIndianRupee,
  IconUpload,
  IconCheckCircle,
  IconTrash,
} from "../icons";

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

/**
 * TaskCard component for managing individual staking tasks.
 * 
 * Why: This component handles the lifecycle of a task from PENDING_PAYMENT to completion.
 * It provides the trigger for the Stripe CheckoutModal for auth-and-hold staking.
 */
const TaskCard = ({ task, onRefetch }) => {
  const { user } = useAuth();
  const { _id, title, description, stakeAmount, deadline, status } = task;
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState(null);

  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-refresh when the deadline exactly hits
  useEffect(() => {
    if (status === "ACTIVE") {
      const msUntilDeadline = new Date(deadline).getTime() - Date.now();
      if (msUntilDeadline > 0 && msUntilDeadline <= 2147483647) {
        const timer = setTimeout(() => {
          if (onRefetch) onRefetch();
        }, msUntilDeadline + 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [deadline, status, onRefetch]);

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

  /**
   * Initializes the Stripe payment flow by requesting a client_secret from the backend.
   * 
   * Why: The client_secret is a unique identifier for the PaymentIntent and is required
   * for the frontend Stripe SDK to securely confirm the payment.
   */
  const handleStartPayment = async () => {
    setInitError(null);
    setIsInitializing(true);
    try {
      const res = await contractService.startTask({ contractId: _id });
      setClientSecret(res.data.client_secret);
      setIsCheckoutOpen(true);
    } catch (err) {
      setInitError(err.response?.data?.message || err.message || "Failed to initialize payment");
    } finally {
      setIsInitializing(false);
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
    <div className={`task-card-new${isOverdue ? " task-card-new--overdue" : ""}`}>
      {/* Top accent bar */}
      <div className="task-card-new__bar" style={{ background: cfg.accent }} />

      <div className="task-card-new__inner">
        {/* Header */}
        <div className="task-card-new__head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="task-card-new__title">{title}</h3>
            {description && <p className="task-card-new__desc">{description}</p>}
          </div>
          <span className={cfg.chipCls}>
            {cfg.pulse && <span className="pulse-dot-sm" />}
            {cfg.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="task-card-new__meta">
          <div className="task-meta-item">
            <div className="task-meta-item__icon">
              <IconIndianRupee className="w-4 h-4" />
            </div>
            <div>
              <p className="task-meta-item__label">Stake</p>
              <p className="task-meta-item__value">₹{stakeAmount}</p>
            </div>
          </div>

          <div className={`task-meta-item${isOverdue || isExpiredPending ? " task-meta-item--danger" : ""}`}>
            <div className="task-meta-item__icon">
              <IconCalendar className="w-4 h-4" />
            </div>
            <div>
              <p className="task-meta-item__label">Due</p>
              <p className="task-meta-item__value">{format(deadlineDate, "MMM dd, yyyy")}</p>
              <p className="task-meta-item__sub">{format(deadlineDate, "HH:mm")}</p>
            </div>
          </div>
        </div>

        {/* Action Section */}
        {status === "PENDING_PAYMENT" && (
          <div className="task-card-new__pay">
            {isExpiredPending ? (
              <div className="task-card-new__expired">
                <IconAlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
                <span>Deadline passed — activation no longer possible.</span>
              </div>
            ) : (
              <>
                {initError && (
                  <div className="alert alert-error text-xs py-2" role="alert">
                    <IconAlertCircle className="w-4 h-4 text-red-600" />
                    <span>{initError}</span>
                  </div>
                )}
                <button
                  type="button"
                  id={`pay-btn-${_id}`}
                  onClick={handleStartPayment}
                  disabled={isInitializing}
                  className="task-card-new__pay-btn"
                >
                  {isInitializing ? (
                    <>
                      <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />
                      Loading Secure Checkout…
                    </>
                  ) : (
                    <>
                      <IconCreditCard className="w-4 h-4" />
                      Secure Stake Hold (₹{stakeAmount})
                    </>
                  )}
                </button>
                {isCreator && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting || isInitializing}
                    className="task-card-new__pay-btn !bg-white hover:!bg-slate-50 !text-slate-500 hover:!text-red-500 !border-slate-200 shadow-sm mt-2 transition-colors"
                  >
                    {isDeleting ? (
                       <span className="spinner w-4 h-4 !border-2 !border-slate-400 !border-t-transparent" />
                    ) : (
                      <IconTrash className="w-4 h-4" />
                    )}
                    <span className="font-semibold">Discard Draft</span>
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
              <span>Awaiting settlement...</span>
            </div>
          </div>
        )}

        {status === "ACTIVE" && isCreator && !isOverdue && (
          <div className="task-card-new__pay mt-4">
            <button type="button" onClick={() => setIsProofModalOpen(true)} className="task-card-new__pay-btn">
              <IconUpload className="w-4 h-4" />
              Upload Proof
            </button>
          </div>
        )}

        {status === "VALIDATING" && !isCreator && (
          <div className="task-card-new__pay mt-4">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="task-card-new__pay-btn !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
            >
              <IconCheckCircle className="w-4 h-4" />
              Review Proof
            </button>
          </div>
        )}
      </div>

      <SubmitProofModal isOpen={isProofModalOpen} onClose={() => setIsProofModalOpen(false)} contractId={_id} onSuccess={onRefetch} />
      <ReviewProofModal task={task} isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} onSuccess={onRefetch} />
      
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        clientSecret={clientSecret}
        taskTitle={title}
        stakeAmount={stakeAmount}
        onSuccess={onRefetch}
      />
    </div>
  );
};

export default TaskCard;
