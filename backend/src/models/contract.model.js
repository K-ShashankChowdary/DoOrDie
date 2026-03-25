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
            enum: ["PENDING_PAYMENT", "ACTIVE", "VALIDATING", "COMPLETED", "FAILED"],
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
        //Images a proof for validator to verify or for ai to verify
        proofImageUrl: {
            type: String, 
            default: ""
        },
        //payments order ID
        razorpayOrderId: {
            type: String,
        },
        //payments paymentId
        razorpayPaymentId: {
            type: String,
        }
    },
    {
        timestamps: true
    }
);
// Indexes for optimized querying
contractSchema.index({ creator: 1, status: 1 });

// Pre-save hook to ensure absolute deadline immutability (except for marking it as FAILED)
contractSchema.pre("save", function (next) {
    if (!this.isNew && this.deadline < new Date()) {
        if (this.isModified("status") && this.status === "FAILED") {
            return next();
        }
        return next(new Error("Cannot modify contract: Deadline has already passed."));
    }
    next();
});

export const Contract = mongoose.model("Contract", contractSchema);