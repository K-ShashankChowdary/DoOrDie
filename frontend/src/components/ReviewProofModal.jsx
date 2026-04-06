import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import contractService from '../services/contract.service';
import { IconCheckCircle, IconAlertCircle } from './icons';

const ReviewProofModal = ({ task, isOpen, onClose, onSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const { _id, proofImages, proofLinks, proofText } = task;

    const handleVerify = async (isApproved) => {
        setError('');
        setIsSubmitting(true);
        try {
            await contractService.verifyProof(_id, { isApproved });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to verify proof');
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm slide-in">
            <div className="modal-panel w-full max-w-lg flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Review Proof</h2>
                        <p className="text-sm text-slate-500 mt-1">Review the creator's submitted work</p>
                    </div>
                    <button onClick={onClose} disabled={isSubmitting} className="modal-close">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[70vh] px-1 pb-2 space-y-6">
                    {error && (
                        <div className="alert alert-error" role="alert">
                            <IconAlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Proof Images */}
                    {proofImages && proofImages.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Image Attachments</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {proofImages.map((img, idx) => (
                                    <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 flex justify-center py-2">
                                        <a href={img} target="_blank" rel="noopener noreferrer">
                                            <img 
                                                src={img} 
                                                alt={`Proof ${idx + 1}`} 
                                                className="max-w-full max-h-64 object-contain"
                                            />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proof Links */}
                    {proofLinks && proofLinks.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">External Links</h3>
                            <div className="flex flex-col gap-2">
                                {proofLinks.map((link, idx) => (
                                    <a 
                                        key={idx} 
                                        href={link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-2 rounded-lg truncate"
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proof Text */}
                    {proofText && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Creator's Note</h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-slate-700 whitespace-pre-wrap text-sm">{proofText}</p>
                            </div>
                        </div>
                    )}

                    {/* Fallback if somehow empty */}
                    {(!proofImages?.length && !proofLinks?.length && !proofText) && (
                        <div className="text-center py-6 text-slate-500 italic">
                            No proof data provided by creator.
                        </div>
                    )}
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => handleVerify(false)}
                        disabled={isSubmitting}
                        className="btn bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Reject
                    </button>
                    <button
                        type="button"
                        onClick={() => handleVerify(true)}
                        disabled={isSubmitting}
                        className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />
                        ) : (
                            <IconCheckCircle className="w-5 h-5" />
                        )}
                        {isSubmitting ? 'Processing...' : 'Approve'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ReviewProofModal;
