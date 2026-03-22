import { Router } from "express";
import { 
    createContract, 
    generatePaymentOrder, 
    verifyPayment 
} from "../controllers/contract.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

//verifyJWT middleware to ALL routes in this file
router.use(verifyJWT); 

//initial contract (Status: PENDING_PAYMENT)
// POST: /api/v1/contracts/new
router.route("/new").post(createContract);

// Generate the Razorpay Order (Triggered when user clicks "Pay")
// POST: /api/v1/contracts/pay/:contractId
router.route("/pay/:contractId").post(generatePaymentOrder);

//Verify the Razorpay Signature (Triggered after successful checkout)
// POST: /api/v1/contracts/verify-payment
router.route("/verify-payment").post(verifyPayment);

export default router;