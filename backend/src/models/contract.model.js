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
        //Gemini Vision check
        proofImageUrl: {
            type: String, 
            default: ""
        },
        //payment ids
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String,
        }
    },
    {
        timestamps: true
    }
);

export const Contract = mongoose.model("Contract", contractSchema);