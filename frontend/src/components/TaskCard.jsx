import React, { useState } from 'react';
import { format } from 'date-fns';
import contractService from '../services/contract.service';

// Lazily injects the Razorpay script tag once and resolves when it's ready.
const loadRazorpayScript = () =>
    new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

const TaskCard = ({ task, onRefetch }) => {
    const { _id, title, description, stakeAmount, deadline, status, validator, creator } = task;

    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState(null);

    const getStatusBadge = (s) => {
        switch (s) {
            case 'PENDING_PAYMENT': return <span className="badge badge-warning">Awaiting Payment</span>;
            case 'ACTIVE':         return <span className="badge badge-info">Active</span>;
            case 'VALIDATING':     return <span className="badge badge-info text-purple-600 bg-purple-100">Validating</span>;
            case 'COMPLETED':      return <span className="badge badge-success">Completed</span>;
            case 'FAILED':         return <span className="badge badge-danger">Failed</span>;
            default:               return <span className="badge badge-warning">{s}</span>;
        }
    };

    const isOverdue = new Date(deadline) < new Date() && status === 'ACTIVE';

    // ── Payment flow ──────────────────────────────────────────────────────────
    const handlePay = async () => {
        setPayError(null);
        setPaying(true);

        try {
            // 1. Create a Razorpay Order on the backend
            const orderRes = await contractService.generatePaymentOrder(_id);
            const { order, contractId } = orderRes.data;

            // 2. Inject Razorpay checkout script
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                throw new Error('Failed to load Razorpay. Check your internet connection.');
            }

            // 3. Open Razorpay checkout modal
            await new Promise((resolve, reject) => {
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount: order.amount,          // already in paise from backend
                    currency: order.currency,
                    name: 'DoOrDie',
                    description: title,
                    order_id: order.id,
                    theme: { color: '#E53E3E' },

                    handler: async (razorpayResponse) => {
                        try {
                            // 4. Verify signature on our backend (HMAC SHA-256)
                            await contractService.verifyPayment({
                                razorpay_order_id:   razorpayResponse.razorpay_order_id,
                                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                                razorpay_signature:  razorpayResponse.razorpay_signature,
                            });

                            // 5. Refetch all tasks so the dashboard reflects the real DB state
                            if (onRefetch) await onRefetch();
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    },

                    modal: {
                        // User closed the popup without paying — treat as cancellation, not error
                        ondismiss: () => reject(new Error('DISMISSED')),
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.on('payment.failed', (res) => {
                    reject(new Error(res.error?.description || 'Payment failed'));
                });
                rzp.open();
            });

        } catch (err) {
            if (err.message !== 'DISMISSED') {
                setPayError(err.response?.data?.message || err.message || 'Payment failed');
            }
        } finally {
            setPaying(false);
        }
    };

    return (
        <div className={`card glass flex flex-col justify-between ${isOverdue ? 'border-red-400/50 shadow-sm shadow-red-500/10' : ''}`}>
            <div>
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-slate-800 line-clamp-1">{title}</h3>
                    {getStatusBadge(status)}
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {description || 'No description provided.'}
                </p>
            </div>

            <div className="pt-4 border-t border-slate-100 text-sm flex items-center justify-between">
                <div>
                    <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Stake</span>
                    <span className="font-bold text-slate-700">₹{stakeAmount}</span>
                </div>

                <div className="text-right">
                    <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Deadline</span>
                    <span className={`font-medium ${isOverdue ? 'text-brand-red' : 'text-slate-600'}`}>
                        {format(new Date(deadline), 'MMM dd, yyyy - HH:mm')}
                    </span>
                </div>
            </div>

            {status === 'PENDING_PAYMENT' && (
                <div className="mt-4 space-y-2">
                    {payError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                            {payError}
                        </p>
                    )}
                    <button
                        onClick={handlePay}
                        disabled={paying}
                        className="btn btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                    >
                        {paying
                            ? <><span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white"></span> Processing…</>
                            : `Pay ₹${stakeAmount} to Activate`
                        }
                    </button>
                </div>
            )}
        </div>
    );
};

export default TaskCard;
