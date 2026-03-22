import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";

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

  // Make sure it's actually pending
  if (contract.status !== "PENDING_PAYMENT") {
    throw new ApiError(400, "This contract is already active or completed");
  }

  // Create the Razorpay Order (Amount is in PAISE, so multiply by 100). Math.round to prevent floating point errors.
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required Razorpay payment details");
  }

  // 1. Create the expected signature using your secret key
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  // 2. Compare the signature Razorpay sent us against the one we just hashed
  const isAuthentic = expectedSignature === razorpay_signature;

  if (!isAuthentic) {
    throw new ApiError(
      400,
      "Invalid payment signature. Potential fraud detected.",
    );
  }

  // 3. The payment is legit! Find the contract linked to this order
  const contract = await Contract.findOne({
    razorpayOrderId: razorpay_order_id,
  });

  if (!contract) {
    throw new ApiError(404, "Contract associated with this order not found");
  }

  // Prevent replay attacks or redundant writes
  if (contract.status === "ACTIVE" || contract.razorpayPaymentId === razorpay_payment_id) {
    return res.status(200).json(
      new ApiResponse(200, { contractId: contract._id, status: contract.status }, "Payment already verified.")
    );
  }

  // 4. Lock it in. The stakes are now real.
  contract.status = "ACTIVE";
  contract.razorpayPaymentId = razorpay_payment_id;
  await contract.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { contractId: contract._id, status: contract.status },
        "Payment verified! Contract is now ACTIVE.",
      ),
    );
});

export { createContract, generatePaymentOrder, verifyPayment };
