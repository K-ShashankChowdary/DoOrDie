import crypto from "crypto";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";
import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";
import { contractDeadlineQueue } from "../workers/deadline.worker.js";
import { validatorGraceQueue } from "../workers/gracePeriod.worker.js";
import { getUploadSignature as generateCloudinarySignature } from "../utils/cloudinary.js";

// ============================================================================
// 1. Initialize Razorpay
// ============================================================================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ============================================================================
// 2. Create the Contract (Initial Draft)
// ============================================================================
const createContract = asyncHandler(async (req, res) => {
  const { title, description, stakeAmount, deadline, validator } = req.body;

  if (!title || !stakeAmount || !deadline || !validator) {
    throw new ApiError(
      400,
      "Title, Stake Amount, Deadline, and Validator are required",
    );
  }

  // Ensure the user isn't betting less than the platform minimum of ₹50
  if (stakeAmount < 50) {
    throw new ApiError(400, "Minimum stake amount is ₹50");
  }

  const parsedDeadline = new Date(deadline);
  if (isNaN(parsedDeadline.getTime())) {
    throw new ApiError(400, "Invalid date format for deadline");
  }
  if (parsedDeadline < new Date()) {
    throw new ApiError(400, "Deadline must be in the future");
  }

  // Validate that the validator exists and is not the creator
  const isValidatorExist = await User.findById(validator);
  if (!isValidatorExist) {
    throw new ApiError(404, "Selected Validator does not exist");
  }

  // Prevent users from picking themselves as the judge, which would allow them to cheat
  if (req.user._id.toString() === validator.toString()) {
    throw new ApiError(400, "You cannot be your own validator");
  }

  // Enforce validator account linking
  if (!isValidatorExist.razorpayLinkedAccountId) {
    throw new ApiError(
      400,
      "The selected Validator does not have a linked Razorpay account to receive payouts."
    );
  }

  // Create the contract but keep it PENDING until they actually pay
  const contract = await Contract.create({
    title,
    description,
    stakeAmount,
    deadline,
    validator,
    creator: req.user._id,
    status: "PENDING_PAYMENT",
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { contract },
        "Contract drafted. Ready for payment.",
      ),
    );
});

// ============================================================================
// 3. Generate Razorpay Order (Triggered when user clicks "Pay")
// ============================================================================
const generatePaymentOrder = asyncHandler(async (req, res) => {
  const { contractId } = req.params;

  const contract = await Contract.findById(contractId);

  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Security Check: Only the creator can pay for their own contract
  if (contract.creator.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only pay for your own contracts");
  }

  // Prevent the user from generating new payment links for contracts that have already been paid for or resolved
  if (contract.status !== "PENDING_PAYMENT") {
    throw new ApiError(400, "This contract is already active or completed");
  }

  // Prevent users from generating payment if they missed the deadline
  if (contract.deadline < new Date()) {
    throw new ApiError(
      400,
      "The deadline for this contract has already passed. Payment cannot be initiated.",
    );
  }

  // Razorpay requires the payment amount to be in the smallest currency sub-unit (paise for INR).
  // We multiply the rupee amount by 100 and use Math.round to avoid floating point inaccuracies.
  const options = {
    amount: Math.round(contract.stakeAmount * 100),
    currency: "INR",
    receipt: `rc_${contract._id}`,
  };

  const order = await razorpay.orders.create(options);

  if (!order) {
    throw new ApiError(500, "Failed to create Razorpay order");
  }

  // Save the order ID to the database so we can track it during verification
  contract.razorpayOrderId = order.id;
  await contract.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { order, contractId: contract._id },
        "Payment order generated successfully",
      ),
    );
});

// ============================================================================
// 4. Verify Payment (Triggered by Razorpay after successful checkout)
// ============================================================================
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required Razorpay payment details");
  }

  // Use Razorpay's official SDK utility to verify the payment signature (HMAC-SHA256).
  // This replaces the manual crypto block and ensures we use the same algorithm
  // as Razorpay's own servers, with no room for implementation drift.
  const isValidSignature = validatePaymentVerification(
    { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
    razorpay_signature,
    process.env.RAZORPAY_KEY_SECRET,
  );

  if (!isValidSignature) {
    throw new ApiError(
      400,
      "Invalid payment signature. Potential fraud detected.",
    );
  }

  // ============================================================================
  // ACID PROPERTIES IMPLEMENTATION
  // ============================================================================
  // A - ATOMICITY: Ensures all database writes inside the transaction succeed, or none do.
  // I - ISOLATION: Ensures this transaction executes independently, safely locking the documents.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Find contract within the transaction lock
    // The `.session(session)` flag specifically tells Mongoose to execute this query "in isolation"
    const contract = await Contract.findOne({
      razorpayOrderId: razorpay_order_id,
    }).session(session);

    // C - CONSISTENCY: The database rules (e.g. required fields, enums) are strictly enforced,
    // ensuring the DB state perfectly transitions from one valid state to another valid state.
    if (!contract) {
      throw new ApiError(404, "Contract associated with this order not found");
    }

    // Idempotency check: If Razorpay's webhook triggers this endpoint multiple times for the same payment,
    // we want to cleanly exit without throwing an error or running the transaction again.
    if (
      contract.status === "ACTIVE" ||
      contract.razorpayPaymentId === razorpay_payment_id
    ) {
      // Clean rollback if the rules dictate we shouldn't proceed
      await session.abortTransaction();
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { contractId: contract._id, status: contract.status },
            "Payment already verified.",
          ),
        );
    }

    // 4. Update the contract document
    contract.status = "ACTIVE";
    contract.razorpayPaymentId = razorpay_payment_id;

    // Pass the session explicitly so it operates within the isolated transaction
    await contract.save({ validateBeforeSave: false, session });

    // FUTURE ROADMAP: If we ever need to create a TransactionHistory document or
    // update a User's total staked balance, we would do it right here with `{ session }`.
    // Example: await Transaction.create([{ ... }], { session });

    // 5. Commit!
    // D - DURABILITY: Once transaction is committed, changes are written to disk permanently.
    // Even if the server crashes right after this line, the contract status stays "ACTIVE".
    await session.commitTransaction();

    // Add the BullMQ delayed job to auto-fail if deadline lapses
    const delay = Math.max(
      0,
      new Date(contract.deadline).getTime() - Date.now(),
    );
    await contractDeadlineQueue.add(
      "check-contract-deadline",
      { contractId: contract._id },
      { delay },
    );
    console.log(`[Queue] Added 'check-contract-deadline' job for contract ${contract._id} (Execution in ${Math.round(delay / 60000)} minutes)`);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { contractId: contract._id, status: contract.status },
          "Payment verified! Contract is now ACTIVE under full ACID transaction.",
        ),
      );
  } catch (error) {
    // A - ATOMICITY (Rollback): If any error occurs inside the `try` block (e.g., Mongoose validation fails,
    // or a network timeout happens), we abort the transaction so partial states aren't left behind.
    await session.abortTransaction();
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Payment verification transaction failed.",
    );
  } finally {
    // Always release the session properly to free up database resources
    session.endSession();
  }
});

// Get all contracts for the user (as creator or validator)
const getUserContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.find({
    $or: [{ creator: req.user._id }, { validator: req.user._id }],
  })
    .populate("creator", "fullName email")
    .populate("validator", "fullName email")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { contracts }, "Contracts retrieved successfully"),
    );
});

// Get details for a specific contract by ID
const getContractById = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const contract = await Contract.findById(contractId)
    .populate("creator", "fullName email")
    .populate("validator", "fullName email");

  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Security check: Only creator or validator can view this
  if (
    contract.creator._id.toString() !== req.user._id.toString() &&
    contract.validator._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Not authorized to view this contract");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { contract }, "Contract details found"));
});

// Upload proof and change status to VALIDATING.
// Proof is flexible: the creator can supply any combination of:
//   - proofImages: string[] — Cloudinary URLs uploaded client-side
//   - proofLinks:  string[] — external links (GitHub, Notion, etc.)
//   - proofText:   string  — free-form textual explanation
// At least one field must be non-empty.
const uploadProof = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const { proofImages = [], proofLinks = [], proofText = "" } = req.body;

  // Validate: at least one proof field must carry real content
  const hasImages = Array.isArray(proofImages) && proofImages.length > 0;
  const hasLinks = Array.isArray(proofLinks) && proofLinks.length > 0;
  const hasText = typeof proofText === "string" && proofText.trim().length > 0;

  if (!hasImages && !hasLinks && !hasText) {
    throw new ApiError(
      400,
      "At least one proof item (image, link, or text) is required",
    );
  }

  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Only the creator may submit proof
  if (contract.creator.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the creator can upload proof");
  }

  // Contract must be ACTIVE to accept proof
  if (contract.status !== "ACTIVE") {
    throw new ApiError(
      400,
      `Cannot upload proof. Contract status is ${contract.status}`,
    );
  }

  // Persist proof fields and transition status.
  // Transitioning to VALIDATING pauses the deadline worker (it skips VALIDATING contracts).
  if (hasImages) contract.proofImages = proofImages;
  if (hasLinks) contract.proofLinks = proofLinks;
  if (hasText) contract.proofText = proofText.trim();
  contract.status = "VALIDATING";
  await contract.save({ validateBeforeSave: false });

  // Arm the grace-period worker: auto-refund creator if validator ghosts for 48 hrs after deadline
  const gracePeriodDelay = Math.max(
    0,
    new Date(contract.deadline).getTime() + 48 * 60 * 60 * 1000 - Date.now(),
  );
  await validatorGraceQueue.add(
    "check-grace-period",
    { contractId: contract._id },
    { delay: gracePeriodDelay },
  );
  console.log(`[Queue] Added 'check-grace-period' job for contract ${contract._id} (Execution in ${Math.round(gracePeriodDelay / (1000 * 60 * 60))} hours)`);

  return res
    .status(200)
    .json(
      new ApiResponse(200, { contract }, "Proof uploaded. Pending validation."),
    );
});

// Verify proof image (approve or reject) and update status
const verifyProof = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const { isApproved } = req.body;

  if (typeof isApproved !== "boolean") {
    throw new ApiError(400, "isApproved boolean is required");
  }

  // Pre-fetch the contract to check validator ID before taking the lock
  let contract = await Contract.findById(contractId);
  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Only the assigned third-party judge can evaluate the proof
  if (contract.validator.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "Only the assigned validator can verify this proof",
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Use atomic findOneAndUpdate to instantly lock the document and transition the state.
    // This prevents double-spend race conditions if the validator double-clicks the "Reject" button.
    contract = await Contract.findOneAndUpdate(
      { _id: contractId, status: "VALIDATING" },
      { $set: { status: isApproved ? "COMPLETED" : "FAILED" } },
      { new: true, session },
    ).populate("validator");

    if (!contract) {
      throw new ApiError(
        400,
        "Cannot verify proof. Contract is not in VALIDATING state or already verified.",
      );
    }

    // The state is successfully locked in DB. Proceed with irreversible Razorpay API calls.
    if (isApproved) {
      // Success: Full Refund to the creator
      if (contract.razorpayPaymentId) {
        await razorpay.payments.refund(contract.razorpayPaymentId, {
          notes: { reason: "Task successfully completed by creator." },
        });
      } else {
        // This should never happen in production — it means a contract was approved
        // without ever being paid for. Log it loudly for audit purposes.
        console.error(
          `[Payout] CRITICAL: Contract ${contract._id} was approved but has no razorpayPaymentId. No refund issued.`,
        );
      }
    } else {
      // Failure: Transfer stake to validator
      if (contract.validator.razorpayLinkedAccountId) {
        await razorpay.transfers.create({
          account: contract.validator.razorpayLinkedAccountId,
          amount: Math.round(contract.stakeAmount * 100),
          currency: "INR",
          notes: { reason: "Creator failed task, validator earns stake." },
        });
      } else {
        console.warn(
          `[Payout] Validator ${contract.validator._id} has no linked Razorpay account for payout.`,
        );
      }
    }

    await session.commitTransaction();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { contract },
          `Contract ${contract.status} successfully`,
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to process payout transaction.",
    );
  } finally {
    session.endSession();
  }
});

// Generate Cloudinary signature for frontend uploads
const getUploadSignature = asyncHandler(async (req, res) => {
  const signatureData = generateCloudinarySignature();

  return res
    .status(200)
    .json(
      new ApiResponse(200, signatureData, "Cloudinary upload signature generated"),
    );
});

// Handle Razorpay webhooks (e.g., payment.captured) to ensure robust payment status
const razorpayWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not defined in env");
    return res.status(500).send("Webhook configuration missing");
  }

  const signature = req.headers["x-razorpay-signature"];

  // req.body is the raw buffer since we used express.raw
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(req.body)
    .digest("hex");

  if (expectedSignature !== signature) {
    return res.status(400).send("Invalid signature");
  }

  // Parse the JSON payload now that signature is verified
  const body = JSON.parse(req.body.toString());

  if (body.event === "payment.captured") {
    const paymentEntity = body.payload.payment.entity;
    const razorpay_order_id = paymentEntity.order_id;
    const razorpay_payment_id = paymentEntity.id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const contract = await Contract.findOne({
        razorpayOrderId: razorpay_order_id,
      }).session(session);

      if (!contract) {
        await session.abortTransaction();
        return res.status(200).send("Contract not found associated with webhook payment");
      }

      if (
        contract.status === "ACTIVE" ||
        contract.razorpayPaymentId === razorpay_payment_id
      ) {
        await session.abortTransaction();
        return res.status(200).send("Payment already authenticated and verified");
      }

      contract.status = "ACTIVE";
      contract.razorpayPaymentId = razorpay_payment_id;

      await contract.save({ validateBeforeSave: false, session });
      await session.commitTransaction();

      const delay = Math.max(
        0,
        new Date(contract.deadline).getTime() - Date.now(),
      );
      await contractDeadlineQueue.add(
        "check-contract-deadline",
        { contractId: contract._id },
        { delay },
      );
      console.log(`[Queue] Webhook verified payment. Added job for contract ${contract._id}`);
      
    } catch (error) {
      await session.abortTransaction();
      console.error("[Webhook] Processing error: ", error);
      // Razorpay expects a 200 unless we want them to violently retry. 
      // It's usually safer to return 500 when our DB transaction fails, so Razorpay retries reliably.
      throw new ApiError(500, "Webhook internal processing failed");
    } finally {
      session.endSession();
    }
  }

  return res.status(200).send("Webhook processed successfully");
});

export {
  createContract,
  generatePaymentOrder,
  verifyPayment,
  getUserContracts,
  getContractById,
  uploadProof,
  verifyProof,
  getUploadSignature,
  razorpayWebhook,
};
