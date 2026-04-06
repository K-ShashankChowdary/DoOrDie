import { Router } from "express";
import { startTask } from "../controllers/task.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// /api/v1/tasks/start
// Initiates a new task/contract with an authorization hold.
router.route("/start").post(verifyJWT, startTask);

export default router;
