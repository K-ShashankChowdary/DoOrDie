import React, { useState, useEffect } from "react";
import contractService from "../services/contract.service";
import {
  IconAlertCircle,
  IconAlignLeft,
  IconCalendar,
  IconFileText,
  IconIndianRupee,
  IconUserSearch,
} from "./icons";

const CreateTaskModal = ({ onClose, onTaskCreated }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stakeAmount: 50,
    deadline: "",
    validator: null, // holds the selected User object
  });

  // Search Validator state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debounce search query to not overwhelm API
  useEffect(() => {
    const fetchValidators = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await contractService.searchValidators(searchQuery);
        setSearchResults(res.data);
      } catch (err) {
        console.error("Failed to search validators", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timerId = setTimeout(() => {
      fetchValidators();
    }, 300);

    return () => clearTimeout(timerId);
  }, [searchQuery]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectValidator = (user) => {
    setFormData((prev) => ({ ...prev, validator: user }));
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.validator) {
      setError("Choose someone to hold you accountable.");
      return;
    }

    if (formData.stakeAmount < 50) {
      setError("Amount must be at least ₹50.");
      return;
    }

    setLoading(true);
    try {
      const result = await contractService.createContract({
        title: formData.title,
        description: formData.description,
        stakeAmount: Number(formData.stakeAmount),
        deadline: formData.deadline,
        validatorId: formData.validator.id,
      });
      onTaskCreated(result.data.contract);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to create task",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div
        className="modal-panel relative w-full max-w-lg slide-in z-10 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
      >
        <div className="flex justify-between items-start gap-4 sm:gap-6 mb-6">
          <div className="space-y-2 min-w-0 pr-1 sm:pr-2">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[color:var(--brand-red)]">
              New task
            </p>
            <h2 id="create-task-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Add a task
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Set a due date, an amount (min ₹50), and who confirms you finished.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close flex-shrink-0"
            aria-label="Close dialog"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-6" role="alert">
            <IconAlertCircle className="w-5 h-5 shrink-0 text-red-600/90" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="form-field">
            <label className="label flex items-center gap-2">
              <IconFileText className="w-3.5 h-3.5 text-slate-400" />
              Task Title
            </label>
            <input
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="e.g. Finish React Dashboard"
            />
          </div>

          <div className="form-field">
            <label className="label flex items-center gap-2">
              <IconAlignLeft className="w-3.5 h-3.5 text-slate-400" />
              Description (optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input min-h-[80px]"
              placeholder="Notes for you and your accountability partner…"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="form-field">
              <label className="label flex items-center gap-2">
                <IconIndianRupee className="w-3.5 h-3.5 text-slate-400" />
                Amount (₹, min 50)
              </label>
              <input
                required
                type="number"
                name="stakeAmount"
                min="50"
                value={formData.stakeAmount}
                onChange={handleChange}
                className="input font-medium"
              />
            </div>
            <div className="form-field">
              <label className="label flex items-center gap-2">
                <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
                Due date
              </label>
              <input
                required
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          {/* Validator Selection Block */}
          <div className="relative border-t border-slate-200/80 pt-8 rounded-xl bg-gradient-to-b from-slate-50/80 to-transparent -mx-1 px-1 pb-1 sm:px-2 space-y-4">
            <div className="form-field">
              <label className="label flex items-center gap-2">
                <IconUserSearch className="w-3.5 h-3.5 text-slate-400" />
                Accountability partner
              </label>

              {formData.validator ? (
                <div className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200/90 rounded-xl shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {formData.validator.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {formData.validator.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, validator: null }))
                    }
                    className="text-[color:var(--brand-red)] text-sm font-medium hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400">
                    <IconUserSearch className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-11"
                    placeholder="Search by name, email, or UPI..."
                    autoComplete="off"
                  />
                  {isSearching && (
                    <span className="absolute right-3 top-1/2 z-[1] -translate-y-1/2 w-4 h-4 spinner !border-slate-300 !border-t-[color:var(--brand-red)]"></span>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200/90 shadow-[var(--elev-3)] rounded-xl overflow-hidden z-20 ring-1 ring-slate-900/5">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="p-3 hover:bg-slate-50/90 cursor-pointer flex justify-between items-center gap-3 transition-colors border-b border-slate-100 last:border-0"
                          onClick={() => handleSelectValidator(user)}
                        >
                          <div>
                            <p className="font-medium text-slate-800 text-sm">
                              {user.fullName}
                            </p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary !py-1 !px-3 !text-xs"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              They confirm when you complete this task.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner w-5 h-5 !border-2 !border-white/30 !border-t-white mix-blend-screen"></span>
            ) : (
              "Add task"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
