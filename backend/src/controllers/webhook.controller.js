import { stripeService } from "../services/stripe.service.js";
import { redisService } from "../services/redis.service.js";
import { queueService } from "../services/queue.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Handle Stripe Webhook ingestion with high resiliency.
 * 
 * Why: We use Redis-based idempotency to ensure each event is processed exactly once.
 * We delegate logic to BullMQ so we can acknowledge receipt to Stripe in <3s.
 */
export const stripeWebhook = asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    // 1. Signature Verification
    // This ensures the request actually came from Stripe.
    try {
        event = stripeService.constructEvent(req.body, sig);
    } catch (err) {
        console.error(`[Webhook Error] Signature verification failed: ${err.message}`);
        throw new ApiError(400, `Webhook Error: ${err.message}`);
    }

    // 2. Idempotency Check (Redis)
    // Stripe can send the same event multiple times. 
    // We check if this event ID has already been seen in the last 24 hours.
    const idempotencyKey = `stripe_event:${event.id}`;
    const isNewEvent = await redisService.set(idempotencyKey, "processed", "NX", "EX", 86400);

    if (!isNewEvent) {
        console.log(`[Webhook] Event ${event.id} already processed. Skipping.`);
        return res.status(200).json({ received: true, duplicate: true });
    }

    // 3. Delegate to Background Queue
    // We push the full event to BullMQ and return 200 OK immediately.
    // This prevents Stripe from timing out during long-running DB operations.
    await queueService.enqueueStripeEvent(event);

    return res.status(200).json({ received: true });
});
