import { Router } from "express";
import { razorpayWebhook } from "../controllers/contract.controller.js";

const router = Router();

// /api/v1/webhooks/razorpay
router.route("/razorpay").post(razorpayWebhook);

export default router;
