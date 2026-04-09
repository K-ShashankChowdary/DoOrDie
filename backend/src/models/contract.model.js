import mongoose, { Schema } from "mongoose";

const contractSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        deadline: {
            type: Date,
            required: true
        },
        stakeAmount: {
            type: Number,
            required: true,
            min: [50, "Minimum stake is ₹50"] // Enforcing the minimum risk
        },
        status: {
            type: String,
            enum: ["PENDING_PAYMENT", "ACTIVE", "VALIDATING", "COMPLETED", "FAILED", "REJECTED", "PAYOUT_FAILED"],
            default: "PENDING_PAYMENT"
        },
        creator: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        validator: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        // Proof fields — at least one must be present when uploading proof.
        // Images: array of Cloudinary URLs uploaded directly from the frontend.
        proofImages: {
            type: [String],
            default: []
        },
        // Links: array of external URLs (GitHub commit, Notion page, etc.)
        proofLinks: {
            type: [String],
            default: []
        },
        // Text: description / explanation from the creator.
        proofText: {
            type: String,
        },
        stripePaymentIntentId: {
            type: String,
            trim: true,
        },
        stripeTransferId: {
            type: String,
            trim: true,
        },
        payoutError: {
            type: String,
            trim: true,
        }
    },
    {
        timestamps: true
    }
);
// Indexes for optimized querying
contractSchema.index({ creator: 1, status: 1 });

// Pre-save hook to block late proof submissions (race condition protection)
// but allow validators or background workers to resolve contracts after the deadline.
contractSchema.pre("save", function () {
    if (!this.isNew && this.deadline < new Date()) {
        const isLateProofUpload =
            this.isModified("proofImages") ||
            this.isModified("proofLinks") ||
            this.isModified("proofText") ||
            (this.isModified("status") && this.status === "VALIDATING");

        if (isLateProofUpload) {
            throw new Error("Cannot upload proof: Deadline has already passed.");
        }
    }
});

export const Contract = mongoose.model("Contract", contractSchema);