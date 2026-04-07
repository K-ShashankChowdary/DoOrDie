import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";
import { queueService } from "../services/queue.service.js";
import { getUploadSignature as generateCloudinarySignature } from "../utils/cloudinary.js";
import { stripeService } from "../services/stripe.service.js";

// Razorpay initialization removed — purely Stripe-based financial architecture.

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

  // Enforce Stripe validator account linking and detail submission
  if (!isValidatorExist.stripeOnboardingComplete) {
    throw new ApiError(
      400,
      "The selected Validator has not completed their Stripe onboarding to receive payouts."
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
// 3. Generate Stripe PaymentIntent (Auth-and-Hold)
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

  if (contract.status !== "PENDING_PAYMENT") {
    throw new ApiError(400, "This contract is already active or completed");
  }

  if (contract.deadline < new Date()) {
    throw new ApiError(
      400,
      "The deadline for this contract has already passed. Payment cannot be initiated.",
    );
  }

  // Create a PaymentIntent with capture_method: 'manual' (Auth-and-Hold)
  const paymentIntent = await stripeService.createAuthHold(
    contract.stakeAmount,
    {
      contractId: contract._id.toString(),
      creatorId: req.user._id.toString(),
      type: 'task_stake_hold'
    }
  );

  if (!paymentIntent) {
    throw new ApiError(500, "Failed to create Stripe PaymentIntent");
  }

  // Save the PaymentIntent ID so we can capture or cancel it later
  contract.stripePaymentIntentId = paymentIntent.id;
  await contract.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { 
          clientSecret: paymentIntent.client_secret, 
          contractId: contract._id 
        },
        "Stripe PaymentIntent generated (Hold mode)",
      ),
    );
});

// ============================================================================
// 4. Verify Stripe Payment (Hold Confirmation)
// ============================================================================
const verifyPayment = asyncHandler(async (req, res) => {
  const { stripePaymentIntentId } = req.params;

  if (!stripePaymentIntentId) {
    throw new ApiError(400, "Missing Stripe PaymentIntent ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const contract = await Contract.findOne({
      stripePaymentIntentId
    }).session(session);

    if (!contract) {
      throw new ApiError(404, "Contract associated with this PaymentIntent not found");
    }

    if (contract.status === "ACTIVE") {
      await session.abortTransaction();
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { contractId: contract._id, status: contract.status },
            "Payment already verified and task is active.",
          ),
        );
    }

    // Update the contract document
    contract.status = "ACTIVE";
    await contract.save({ validateBeforeSave: false, session });
    await session.commitTransaction();

    // 2. Add the BullMQ delayed job to auto-capture (fail) if deadline lapses
    // This is a safety measure in case the validator never verifies the proof.
    const delay = Math.max(0, new Date(contract.deadline).getTime() - Date.now());
    
    // We use a Promise.race with a timeout to prevent Redis connection issues from hanging the response.
    try {
      await Promise.race([
        queueService.scheduleTaskDeadline(contract._id, delay),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Queue Timeout")), 5000))
      ]);
      console.log(`[Queue] Hold confirmed & deadline scheduled for contract ${contract._id} (Delay: ${delay}ms)`);
    } catch (queueError) {
      // We log the error but don't fail the request since the transaction is already committed.
      // The task is active, but we should alert for manual settlement if the queue is down.
      console.error(`[Queue] CRITICAL: Failed to schedule deadline for ${contract._id}:`, queueError.message);
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { contractId: contract._id, status: contract.status },
          "Hold confirmed! Task is now ACTIVE with funds authorized via Stripe.",
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Stripe hold verification failed.",
    );
  } finally {
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

  // Note: We'll keep the grace period queue name for compatibility with existing workers
  // but use the centralized service for scheduling if possible.
  // For now, focusing on the core financial flow.
  await queueService.scheduleTaskDeadline(contract._id, gracePeriodDelay); // Re-using deadline queue for ghosting

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
      { $set: { status: isApproved ? "COMPLETED" : "REJECTED" } },
      { new: true, session },
    ).populate("validator");

    if (!contract) {
      throw new ApiError(
        400,
        "Cannot verify proof. Contract is not in VALIDATING state or already verified.",
      );
    }

    // The state is successfully locked in DB. Proceed with irreversible Stripe API calls.
    if (isApproved) {
      // Success: Release (Cancel) the hold, returning money to creator
      if (contract.stripePaymentIntentId) {
        await stripeService.cancelHold(contract.stripePaymentIntentId);
        console.log(`[Stripe] Authorized hold CANCELED (released) for contract ${contract._id}`);
      } else {
        console.error(`[Stripe] CRITICAL: Contract ${contract._id} approved but missing PaymentIntent ID.`);
      }
    } else {
      // Failure: Capture hold and transfer to validator (Connect Transfer)
      if (contract.stripePaymentIntentId && contract.validator?.stripeAccountId) {
        
        // Dynamic platform fee calculation
        const platformFeePercentage = Number(process.env.PLATFORM_FEE_PERCENTAGE) || 10;
        const totalStake = contract.stakeAmount;
        const platformFee = totalStake * (platformFeePercentage / 100);
        const payoutAmount = totalStake - platformFee;

        // Capture hold and transfer in one atomic-like service call
        const transfer = await stripeService.captureHoldAndTransfer(
           contract.stripePaymentIntentId,
           payoutAmount,
           contract.validator.stripeAccountId,
           `Stake payout from task resolution: ${contract._id}`
        );
        
        contract.stripeTransferId = transfer.id;
        await contract.save({ validateBeforeSave: false, session });
        
        console.log(`[Stripe] Payout CAPTURED and TRANSFERRED to validator. (Fee: ${platformFeePercentage}%)`);
      } else {
        console.warn(`[Stripe] Payout failed. Missing PaymentIntent or Validator Stripe Account for ${contract._id}`);
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

// Delete an unpaid contract (Triggered by Creator)
const deleteContract = asyncHandler(async (req, res) => {
  const { contractId } = req.params;

  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Only creator can delete their own contract
  if (contract.creator.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only delete your own tasks");
  }

  // Only allow deletion for:
  // 1. Unpaid drafts (PENDING_PAYMENT), regardless of deadline.
  // 2. Finalized tasks (COMPLETED, REJECTED, FAILED).
  // Restriction: Prevents deleting ACTIVE or VALIDATING tasks where funds are on hold.
  const deletableStatuses = ["PENDING_PAYMENT", "COMPLETED", "REJECTED", "FAILED"];
  if (!deletableStatuses.includes(contract.status)) {
    throw new ApiError(400, `Tasks in ${contract.status} status cannot be deleted as they have active funds on hold.`);
  }

  await Contract.findByIdAndDelete(contractId);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Contract deleted successfully"));
});

// Webhook logic has been moved to src/controllers/webhook.controller.js
// for better separation of concerns and high-resiliency ingestion.

export {
  createContract,
  generatePaymentOrder,
  verifyPayment,
  getUserContracts,
  getContractById,
  uploadProof,
  verifyProof,
  getUploadSignature,
  deleteContract,
};
