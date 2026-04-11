import { Router } from "express";
import { 
    createContract, 
    generatePaymentOrder, 
    getUserContracts,
    getContractById,
    uploadProof,
    verifyProof,
    getUploadSignature,
    deleteContract
} from "../controllers/contract.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

//verifyJWT middleware to ALL routes in this file
router.use(verifyJWT); 

// Initial contract draft (Status: PENDING_PAYMENT)
// POST: /api/v1/contracts/new
router.route("/new").post(createContract);

// Lock stake from wallet and activate task (demo)
// POST: /api/v1/contracts/pay/:contractId
router.route("/pay/:contractId").post(generatePaymentOrder);

// Get Cloudinary Upload Signature
// GET: /api/v1/contracts/upload-signature
router.route("/upload-signature").get(getUploadSignature);

// Get all contracts associated with the logged-in user (Creator or Validator)
// GET: /api/v1/contracts
router.route("/").get(getUserContracts);

// Get specific details for a single contract
// GET: /api/v1/contracts/:contractId
router.route("/:contractId").get(getContractById);

// Delete an unpaid pending contract
// DELETE: /api/v1/contracts/:contractId
router.route("/:contractId").delete(deleteContract);

// Upload visual proof of completion (Triggered by Creator)
// POST: /api/v1/contracts/:contractId/upload-proof
router.route("/:contractId/upload-proof").post(uploadProof);

// Accept or reject the proof (Triggered by Validator)
// POST: /api/v1/contracts/:contractId/verify-proof
router.route("/:contractId/verify-proof").post(verifyProof);

export default router;