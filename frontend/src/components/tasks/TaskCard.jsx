import React, { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import contractService from "../../services/contract.service";
import { useAuth } from "../../context/AuthContext";
import SubmitProofModal from "../SubmitProofModal";
import ReviewProofModal from "../ReviewProofModal";
import {
  IconAlertCircle,
  IconCalendar,
  IconWallet,
  IconIndianRupee,
  IconUpload,
  IconCheckCircle,
  IconTrash,
  IconActivity,
  IconClock,
} from "../icons";

const STATUS = {
  PENDING_DEPOSIT: {
    label: "To activate",
    chipCls: "status-chip warning",
    accent: "#f59e0b",
    pulse: false,
  },
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
  PAYOUT_FAILED: {
    label: "Payout Failed",
    chipCls: "status-chip danger",
    accent: "#ef4444",
    pulse: true,
  },
};

/**
 * TaskCard component for managing individual staking tasks.
 * 
 * Why: This component handles the lifecycle of a task from pending deposit to completion.
 * Activation now uses wallet balance directly.
 */
const TaskCard = ({ task, onRefetch }) => {
  const { user } = useAuth();
  const { id, title, description, stakeAmount, deadline, status } = task;
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);

  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

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

  const taskCreatorId = typeof task.creator === 'object' ? task.creator?.id : task.creatorId || task.creator;
  const isCreator =
    user &&
    user.id != null &&
    taskCreatorId != null &&
    String(user.id) === String(taskCreatorId);

  const isExpiredPending = new Date(deadline) < new Date() && (status === "PENDING_PAYMENT" || status === "PENDING_DEPOSIT");
  
  const cfg = isExpiredPending ? {
    label: "Expired",
    chipCls: "status-chip danger",
    accent: "#ef4444",
    pulse: false,
  } : (STATUS[status] || STATUS.PENDING_DEPOSIT);
  
  const deadlineDate = new Date(deadline);
  const isOverdue = deadlineDate < new Date() && status === "ACTIVE";

  const deadlineHint = useMemo(() => {
    const t = new Date();
    if (status !== "ACTIVE") return null;
    const end = new Date(deadline);
    if (end < t) {
      return { tone: "danger", text: "Deadline passed — settlement runs automatically." };
    }
    const ms = end.getTime() - t.getTime();
    const dist = formatDistanceToNow(end, { addSuffix: true });
    if (ms < 86_400_000) {
      return { tone: "warn", text: `Due ${dist}`, sub: "Submit proof before this time or your stake goes to your validator." };
    }
    return { tone: "calm", text: `Due ${dist}`, sub: "Upload proof before the deadline to keep your stake." };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- timeTick forces countdown text refresh every 30s
  }, [status, deadline, timeTick]);

  // Force close the proof modal if the deadline hits while it's open
  useEffect(() => {
    if (isOverdue && isProofModalOpen) {
      setIsProofModalOpen(false);
    }
  }, [isOverdue, isProofModalOpen]);

  // Activate task by locking stake from wallet balance.
  const handleStartPayment = async () => {
    setError(null);
    setIsInitializing(true);
    try {
      const res = await contractService.activateContract(id);

      if (res?.data?.activated) {
        if (onRefetch) onRefetch();
        return;
      }
      if (res?.data?.needsTopUp) {
        setError("Insufficient wallet balance. Please top up your wallet and try again.");
        return;
      }
      setError("Unable to activate task right now. Please try again.");
    } catch (err) {
      const body = err.response?.data;
      if (body?.data?.needsTopUp) {
        setError("Insufficient wallet balance. Please top up your wallet and try again.");
        return;
      }
      setError(body?.message || err.message || "Failed to activate task");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await contractService.deleteContract(id);
      if (onRefetch) onRefetch();
    } catch (err) {
      console.error("Failed to delete task:", err);
      setError(err.response?.data?.message || err.message || "Failed to delete task");
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
          <div className="flex flex-col items-end gap-2">
            <span className={cfg.chipCls}>
              {cfg.pulse && <span className="pulse-dot-sm" />}
              {cfg.label}
            </span>
            {isCreator && (["PENDING_PAYMENT", "PENDING_DEPOSIT", "COMPLETED", "REJECTED", "FAILED"].includes(status)) && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete Task"
                className="p-2 transition-all duration-200 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 group/del"
              >
                {isDeleting ? (
                  <span className="spinner w-4 h-4 !border-2 !border-slate-300 !border-t-red-500" />
                ) : (
                  <IconTrash className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error text-xs py-2 mb-4" role="alert">
            <IconAlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Meta row */}
        <div className="task-card-new__meta">
          <div className="task-meta-item">
            <div className="task-meta-item__icon">
              <IconIndianRupee className="w-4 h-4" />
            </div>
            <div>
              <p className="task-meta-item__label">Stake</p>
              <p className="text-xl font-bold stat-value leading-none">₹{task.stakeAmount}</p>
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

        {deadlineHint && (
          <div
            className={`task-card-new__timeline task-card-new__timeline--${deadlineHint.tone}`}
            role="status"
          >
            <div className="task-card-new__timeline-icon" aria-hidden>
              <IconClock className="w-4 h-4" />
            </div>
            <div className="task-card-new__timeline-text">
              <p className="task-card-new__timeline-title">{deadlineHint.text}</p>
              {deadlineHint.sub && (
                <p className="task-card-new__timeline-sub">{deadlineHint.sub}</p>
              )}
            </div>
          </div>
        )}

        {status === "VALIDATING" && isCreator && (
          <div className="task-card-new__timeline task-card-new__timeline--grace" role="status">
            <div className="task-card-new__timeline-icon" aria-hidden>
              <IconCheckCircle className="w-4 h-4" />
            </div>
            <div className="task-card-new__timeline-text">
              <p className="task-card-new__timeline-title">Proof submitted — awaiting validator</p>
              <p className="task-card-new__timeline-sub">
                They have 24 hours to approve or reject. If they don’t respond in time, your stake is refunded automatically.
              </p>
            </div>
          </div>
        )}

        {/* Action Section */}
        {(status === "PENDING_PAYMENT" || status === "PENDING_DEPOSIT") && (
          <div className="task-card-new__pay">
            {isExpiredPending ? (
              <div className="task-card-new__expired items-center text-center">
                <IconAlertCircle className="w-5 h-5 text-red-500 mb-1" />
                <span className="font-semibold">Activation window closed.</span>
                <p className="text-[11px] opacity-70 mt-1">This draft can no longer be activated. Use the trash icon top-right to remove it.</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  id={`pay-btn-${id}`}
                  onClick={handleStartPayment}
                  disabled={isInitializing}
                  className="task-card-new__pay-btn"
                >
                  {isInitializing ? (
                    <>
                      <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <IconWallet className="w-4 h-4" />
                      Activate with Wallet (₹{stakeAmount})
                    </>
                  )}
                </button>
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

        {status === "ACTIVE" && !isOverdue && (
          <div className="task-card-new__pay mt-4">
            {isCreator ? (
              <button type="button" onClick={() => setIsProofModalOpen(true)} className="task-card-new__pay-btn">
                <IconUpload className="w-4 h-4" />
                Upload Proof
              </button>
            ) : (
              <div className="task-card-new__expired !bg-blue-50/50 !border-blue-100 !text-blue-700">
                <IconActivity className="w-4 h-4 animate-pulse" />
                <span className="font-semibold">Creator is currently working...</span>
              </div>
            )}
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

      <SubmitProofModal isOpen={isProofModalOpen} onClose={() => setIsProofModalOpen(false)} contractId={id} onSuccess={onRefetch} />
      <ReviewProofModal task={task} isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} onSuccess={onRefetch} />
    </div>
  );
};

export default TaskCard;
