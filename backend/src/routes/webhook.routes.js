import { Router } from "express";
import { stripeWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// /api/v1/webhooks/stripe
// Ingestion endpoint for Stripe events. 
// Handled with internal signature verification and Redis idempotency.
router.route("/stripe").post(stripeWebhook);

export default router;
