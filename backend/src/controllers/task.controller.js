import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";
import { stripeService } from "../services/stripe.service.js";
import { queueService } from "../services/queue.service.js";

/**
 * Initiates the task lifecycle by creating an authorization hold (PaymentIntent).
 * 
 * Why: We use auth-and-hold so the creator's funds are reserved but not 
 * actually captured until the deadline passes and they fail the task.
 */
export const startTask = asyncHandler(async (req, res) => {
    const { title, description, deadline, stakeAmount, validatorId } = req.body;

    // 1. Basic validation
    if (!title || !stakeAmount || !deadline || !validatorId) {
        throw new ApiError(400, "All fields (title, amount, deadline, validator) are required.");
    }

    if (stakeAmount < 50) {
        throw new ApiError(400, "Minimum stake amount is ₹50.");
    }

    // 2. Validate validator existence and eligibility
    const validator = await User.findById(validatorId);
    if (!validator) {
        throw new ApiError(404, "Validator not found.");
    }

    if (!validator.stripeAccountId || !validator.stripeOnboardingComplete) {
        throw new ApiError(400, "The selected validator is not eligible to receive funds (Stripe Connect not configured).");
    }

    if (validatorId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot be your own validator.");
    }

    // 3. Calculate deadline delay
    const deadlineDate = new Date(deadline);
    const delayMs = deadlineDate.getTime() - Date.now();

    if (delayMs <= 0) {
        throw new ApiError(400, "Deadline must be in the future.");
    }

    // 4. Create Stripe PaymentIntent with capture_method: 'manual'
    // This places the auth-and-hold on the user's card.
    const paymentIntent = await stripeService.createAuthHold(stakeAmount, {
        creator_id: req.user._id.toString(),
        validator_id: validatorId,
        title: title
    });

    // 5. Build the contract record
    const contract = await Contract.create({
        title,
        description,
        deadline: deadlineDate,
        stakeAmount,
        creator: req.user._id,
        validator: validatorId,
        stripePaymentIntentId: paymentIntent.id,
        status: "PENDING_PAYMENT"
    });

    // 6. Schedule the automated settlement job in BullMQ
    // Even if the payment isn't confirmed yet, the job will check the status 
    // when it executes at the deadline.
    await queueService.scheduleTaskDeadline(contract._id, delayMs);

    return res.status(201).json(
        new ApiResponse(201, {
            contract,
            client_secret: paymentIntent.client_secret
        }, "Task initialized successfully. Reservation hold placed.")
    );
});
