import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
    logoutUser, 
    getCurrentUser,
    refreshAccessToken,
    searchUsers,
    getUserBalance,
    createTopupSession,
    requestWithdrawal,
    getWithdrawalHistory
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
//signup ans signin
router.route("/signup").post(registerUser);
router.route("/login").post(loginUser);

// logout
router.route("/logout").post(verifyJWT, logoutUser);

// current user
router.route("/me").get(verifyJWT, getCurrentUser);

// Silent Refresh
router.route("/refresh-token").post(refreshAccessToken);

// Search Users
router.route("/search").get(verifyJWT, searchUsers);

// Wallet balance
router.route("/balance").get(verifyJWT, getUserBalance);
router.route("/wallet/topup").post(verifyJWT, createTopupSession);
router.route("/wallet/withdraw").post(verifyJWT, requestWithdrawal);
router.route("/wallet/withdrawals").get(verifyJWT, getWithdrawalHistory);

export default router;