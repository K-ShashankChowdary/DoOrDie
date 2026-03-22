import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    searchUsers
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

export default router;