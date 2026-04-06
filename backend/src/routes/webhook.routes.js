import { Router } from "express";
import { razorpayWebhook } from "../controllers/contract.controller.js";
import { verifyRazorpaySignature } from "../middleware/razorpay.middleware.js";

const router = Router();

// /api/v1/webhooks/razorpay
router.route("/razorpay").post(verifyRazorpaySignature, razorpayWebhook);

export default router;
