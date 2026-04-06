import { Worker } from "bullmq";
import { Contract } from "../models/contract.model.js";
import { stripeService } from "../services/stripe.service.js";
import { redisService as connection } from "../services/redis.service.js";

/**
 * Worker to handle automated task settlement when the deadline expires.
 * 
 * Why: This ensures that creators are held accountable even if a validator 
 * doesn't manually review the task, and that validators receive their 
 * stake payout for any failed tasks.
 */
export const deadlineWorker = new Worker("task-deadline-queue", async (job) => {
    const { contractId } = job.data;
    console.log(`[Worker] Processing deadline for contract: ${contractId}`);

    // 1. Retrieve the contract with the validator populated
    const contract = await Contract.findById(contractId).populate("validator");
    if (!contract) {
        console.warn(`[Worker] Contract ${contractId} not found. Skipping.`);
        return;
    }

    // 2. Handle Case: Task was already COMPLETED by a validator
    // In this case, we simply release the hold and void the PaymentIntent.
    if (contract.status === "COMPLETED") {
        console.log(`[Worker] Contract ${contractId} was COMPLETED. Releasing hold.`);
        if (contract.stripePaymentIntentId) {
            await stripeService.cancelHold(contract.stripePaymentIntentId);
        }
        return;
    }

    // 3. Handle Case: Task is still ACTIVE (or VALIDATING) after the deadline
    // We use the Atomic Update Pattern to ensure only one process manages the failure.
    // Why: Prevents race conditions where a validator completes a task at the same instant.
    const failedContract = await Contract.findOneAndUpdate(
        { 
            _id: contractId, 
            status: { $in: ["ACTIVE", "VALIDATING"] } 
        },
        { 
            $set: { status: "FAILED" } 
        },
        { new: true }
    ).populate("validator");

    if (!failedContract) {
        console.log(`[Worker] Contract ${contractId} status changed externally. No action needed.`);
        return;
    }

    // 4. Capture Stake & Remit to Validator
    // Only proceed if we have the necessary Stripe identifiers.
    if (failedContract.stripePaymentIntentId && failedContract.validator?.stripeAccountId) {
        // Calculate payouts
        const platformFeePercentage = Number(process.env.PLATFORM_FEE_PERCENTAGE) || 10;
        const totalStake = failedContract.stakeAmount;
        const platformFee = totalStake * (platformFeePercentage / 100);
        const payoutAmount = totalStake - platformFee;

        console.log(`[Worker] Capturing hold for ${contractId}. Fee: ${platformFeePercentage}%. Payout: ₹${payoutAmount}.`);

        // Capture hold and transfer directly to the validator's Connect account
        const transfer = await stripeService.captureHoldAndTransfer(
            failedContract.stripePaymentIntentId,
            payoutAmount,
            failedContract.validator.stripeAccountId,
            `Payout for failed task: ${failedContract.title}`
        );

        // Record the transfer ID for auditing
        failedContract.stripeTransferId = transfer.id;
        await failedContract.save();

        console.log(`[Worker] Settlement complete for ${contractId}. Transfer: ${transfer.id}`);
    } else {
        console.error(`[Worker] Critical Failure: Missing payment intent or validator account for ${contractId}`);
    }
}, { connection });

// Observer event listeners for observability
deadlineWorker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
});

deadlineWorker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});
