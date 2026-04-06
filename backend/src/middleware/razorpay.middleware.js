import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";

export const verifyRazorpaySignature = (req, res, next) => {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        console.error("[Webhook Error] Missing signature or secret");
        return res.status(400).send("Verification failed");
    }

    // req.body is already the raw buffer from express.raw() in app.js
    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body)
        .digest("hex");

    if (expectedSignature !== signature) {
        console.error("[Webhook Error] Invalid HMAC signature");
        return res.status(400).send("Invalid signature");
    }

    // Signature verified! Attach the parsed body for the next handler
    try {
        req.parsedBody = JSON.parse(req.body.toString());
        next();
    } catch (error) {
        console.error("[Webhook Error] Failed to parse JSON body");
        next(new ApiError(400, "Invalid JSON payload"));
    }
};
