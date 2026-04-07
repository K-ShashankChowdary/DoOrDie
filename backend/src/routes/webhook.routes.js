import { Router } from "express";
import { stripeWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// /api/v1/webhooks/stripe OR /webhook (via alias)
// Ingestion endpoint for Stripe events. 
router.route("/").post(stripeWebhook);
router.route("/stripe").post(stripeWebhook);

export default router;
