import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    searchUsers,
    linkStripeAccount,
    verifyStripeStatus
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
//signup ans signin
router.route("/signup").post(registerUser);
router.route("/login").post(loginUser);

// logout
router.route("/logout").post(verifyJWT, logoutUser);

// Silent Refresh
router.route("/refresh-token").post(refreshAccessToken);

// Search Users
router.route("/search").get(verifyJWT, searchUsers);

// Link Stripe account (Used so user can act as a validator)
router.route("/stripe-onboard").post(verifyJWT, linkStripeAccount);

// Verify Stripe status
router.route("/verify-stripe").get(verifyJWT, verifyStripeStatus);

export default router;