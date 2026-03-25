import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { contractDeadlineQueue } from "../workers/deadline.worker.js";

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
    throw new ApiError(400, "Title, Stake Amount, Deadline, and Validator are required");
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

  // Razorpay requires the payment amount to be in the smallest currency sub-unit (paise for INR). 
  // We multiply the rupee amount by 100 and use Math.round to avoid floating point inaccuracies.
  const options = {
    amount: Math.round(contract.stakeAmount * 100),
    currency: "INR",
    receipt: `receipt_contract_${contract._id}`,
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required Razorpay payment details");
  }

  // Construct the expected signature by hashing the order ID and payment ID using our secret key.
  // This proves that the payload actually came from Razorpay and hasn't been tampered with.
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Invalid payment signature. Potential fraud detected.");
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
    if (contract.status === "ACTIVE" || contract.razorpayPaymentId === razorpay_payment_id) {
      // Clean rollback if the rules dictate we shouldn't proceed
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json(
        new ApiResponse(200, { contractId: contract._id, status: contract.status }, "Payment already verified.")
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
    const delay = Math.max(0, new Date(contract.deadline).getTime() - Date.now());
    await contractDeadlineQueue.add('check-contract-deadline', { contractId: contract._id }, { delay });

    return res.status(200).json(
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
    throw new ApiError(error.statusCode || 500, error.message || "Payment verification transaction failed.");
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
    .json(new ApiResponse(200, { contracts }, "Contracts retrieved successfully"));
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

  return res.status(200).json(new ApiResponse(200, { contract }, "Contract details found"));
});

// Upload proof image and change status to VALIDATING
const uploadProof = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const { proofImageUrl } = req.body;

  if (!proofImageUrl) {
    throw new ApiError(400, "Proof image URL is required");
  }

  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Only the person who created the task is allowed to submit the proof of completion
  if (contract.creator.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the creator can upload proof");
  }

  // If the contract is already failed (deadline passed) or already validating, reject the upload
  if (contract.status !== "ACTIVE") {
    throw new ApiError(400, `Cannot upload proof. Contract status is ${contract.status}`);
  }

  // Transitioning to VALIDATING inherently pauses the contract. 
  // If the BullMQ deadline worker runs while in this state, it will spare the contract from automatically failing.
  contract.proofImageUrl = proofImageUrl;
  contract.status = "VALIDATING";
  await contract.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { contract }, "Proof uploaded. Pending validation."));
});

// Verify proof image (approve or reject) and update status
const verifyProof = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const { isApproved } = req.body;

  if (typeof isApproved !== "boolean") {
    throw new ApiError(400, "isApproved boolean is required");
  }

  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  // Only the assigned third-party judge can evaluate the proof
  if (contract.validator.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the assigned validator can verify this proof");
  }

  // We can only evaluate proofs that have actually been uploaded by the creator
  if (contract.status !== "VALIDATING") {
    throw new ApiError(400, `Cannot verify proof. Contract is not in VALIDATING state.`);
  }

  // The validator has made their decision.
  // True means the creator achieved their goal (COMPLETED).
  // False means the creator failed their goal and forfeits their stake (FAILED).
  contract.status = isApproved ? "COMPLETED" : "FAILED";
  await contract.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { contract },
        `Contract ${contract.status} successfully`
      )
    );
});

export {
  createContract,
  generatePaymentOrder,
  verifyPayment,
  getUserContracts,
  getContractById,
  uploadProof,
  verifyProof,
};
