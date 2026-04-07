import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import contractService from '../services/contract.service';

const SubmitProofModal = ({ contractId, isOpen, onClose, onSuccess }) => {
    const [files, setFiles] = useState([]);
    const [link, setLink] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        // Map to internal format with previews
        const newFiles = selectedFiles.map(file => ({
            file,
            id: Math.random().toString(36).substr(2, 9),
            preview: URL.createObjectURL(file)
        }));
        setFiles(prev => [...prev, ...newFiles]);
        // Clear input so same file can be selected again if removed
        e.target.value = '';
    };

    const removeFile = (id) => {
        setFiles(prev => {
            const filtered = prev.filter(f => f.id !== id);
            // Clean up object URLs to prevent memory leaks
            const removed = prev.find(f => f.id === id);
            if (removed) URL.revokeObjectURL(removed.preview);
            return filtered;
        });
    };

    const hasValidProof = files.length > 0 || link.trim() !== '' || description.trim() !== '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!hasValidProof) {
            setError('Please provide at least one form of proof (image, link, or description)');
            return;
        }

        setIsSubmitting(true);
        try {
            let uploadedImageUrls = [];

            if (files.length > 0) {
                // 1. Get Signature & Cloudinary creds from backend
                const sigRes = await contractService.getUploadSignature();
                const { signature, timestamp, cloudName, apiKey } = sigRes.data;

                // 2. Upload all files to Cloudinary in parallel
                const uploadPromises = files.map(async (fileObj) => {
                    const formData = new FormData();
                    formData.append('file', fileObj.file);
                    formData.append('signature', signature);
                    formData.append('timestamp', timestamp);
                    formData.append('api_key', apiKey);
                    formData.append('folder', 'doordie_proofs');

                    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                        method: 'POST',
                        body: formData,
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
                    return data.secure_url;
                });

                uploadedImageUrls = await Promise.all(uploadPromises);
            }

            // 3. Submit proof to backend
            const proofData = {
                proofImages: uploadedImageUrls,
                proofLinks: link.trim() ? [link.trim()] : [],
                proofText: description.trim(),
            };

            await contractService.uploadProof(contractId, proofData);
            
            // Clean up URLs
            files.forEach(f => URL.revokeObjectURL(f.preview));
            
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
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Submit Proof</h2>
                        <p className="text-sm text-slate-500 mt-1">Upload evidence of your work</p>
                    </div>
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

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-3">
                            <label className="label">
                                Screenshot / Images
                            </label>
                            
                            {/* Selected Files Preview */}
                            {files.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {files.map((f) => (
                                        <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                                            <img src={f.preview} alt="preview" className="w-full h-full object-cover" />
                                            <button 
                                                type="button"
                                                onClick={() => removeFile(f.id)}
                                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="proof-upload"
                                />
                                <label 
                                    htmlFor="proof-upload"
                                    className="flex flex-col items-center justify-center w-full py-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                                >
                                    <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    <span className="text-sm font-medium text-slate-600">Click to add photos</span>
                                    <span className="text-xs text-slate-400 mt-1">Select multiple if needed</span>
                                </label>
                            </div>
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
                                {isSubmitting ? `Uploading (${files.length})...` : 'Submit Proof'}
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
