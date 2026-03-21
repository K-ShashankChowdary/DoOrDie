import { Router } from "express";
import { createContract } from "../controllers/contract.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Protected route
router.route("/new").post(createContract);

export default router;