import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { stripeService } from "../services/stripe.service.js";

/**
 * Middleware to verify Stripe webhook signatures.
 * This ensures the request actually came from Stripe and hasn't been tampered with.
 * Note: This requires the raw request body, which usually means using 
 * express.raw({ type: 'application/json' }) for the webhook route.
 */
export const verifyStripeSignature = asyncHandler(async (req, res, next) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        throw new ApiError(400, "Missing Stripe signature header");
    }

    try {
        // Stripe's SDK requires the raw body to verify the signature (HMAC-SHA256)
        const event = stripeService.constructEvent(req.body, sig);
        
        // Attach the verified event to the request object for the controller to use
        req.stripeEvent = event;
        next();
    } catch (err) {
        console.error(`[Stripe Webhook Error] Signature verification failed: ${err.message}`);
        throw new ApiError(400, `Webhook Error: ${err.message}`);
    }
});
