import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import contractService from '../services/contract.service';

const SubmitProofModal = ({ contractId, isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [link, setLink] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const hasValidProof = file || link.trim() !== '' || description.trim() !== '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!hasValidProof) {
            setError('Please provide at least one form of proof (image, link, or description)');
            return;
        }

        setIsSubmitting(true);
        try {
            let uploadedImageUrl = null;

            if (file) {
                // 1. Get Signature & Cloudinary creds from backend
                const sigRes = await contractService.getUploadSignature();
                const { signature, timestamp, cloudName, apiKey } = sigRes.data;

                // 2. Upload to Cloudinary
                const formData = new FormData();
                formData.append('file', file);
                formData.append('signature', signature);
                formData.append('timestamp', timestamp);
                formData.append('api_key', apiKey);
                formData.append('folder', 'doordie_proofs'); // Must match backend

                const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });

                const cloudinaryData = await cloudinaryRes.json();
                
                if (!cloudinaryRes.ok) {
                    throw new Error(cloudinaryData.error?.message || 'Failed to upload image to Cloudinary');
                }

                uploadedImageUrl = cloudinaryData.secure_url;
            }

            // 3. Submit proof to backend
            const proofData = {
                proofImages: uploadedImageUrl ? [uploadedImageUrl] : [],
                proofLinks: link.trim() ? [link.trim()] : [],
                proofText: description.trim(),
            };

            await contractService.uploadProof(contractId, proofData);
            
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to submit proof');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm slide-in">
            <div className="modal-panel w-full max-w-md flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Submit Proof</h2>
                    <button onClick={onClose} className="modal-close">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[70vh] px-1">
                    {error && (
                        <div className="alert alert-error mb-4" role="alert">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label">
                                Upload Screenshot / Image
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-600
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-xl file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-600
                                    hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                    transition-all"
                            />
                        </div>

                        <div>
                            <label className="label">
                                External Link (Optional)
                            </label>
                            <input
                                type="url"
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                placeholder="GitHub PR, Notion file, Loom video..."
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="label">
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explain what you accomplished..."
                                rows="3"
                                className="input resize-none"
                            ></textarea>
                        </div>

                        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
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
                                disabled={isSubmitting || !hasValidProof}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                {isSubmitting && <span className="spinner w-4 h-4 !border-2 !border-white/30 !border-t-white" />}
                                {isSubmitting ? 'Submitting...' : 'Submit Proof'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SubmitProofModal;
