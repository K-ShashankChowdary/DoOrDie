import { Worker, Queue } from "bullmq";
import { Contract } from "../models/contract.model.js";
import { stripeService } from "../services/stripe.service.js";
import { redisService as connection } from "../services/redis.service.js";

/**
 * Worker to automatically handle ghosting validators.
 * If a validator fails to evaluate proof within the grace period, 
 * the creator "wins" by default and their hold is released.
 */
export const gracePeriodWorker = new Worker("validator-grace-period", async (job) => {
    const { contractId } = job.data;
    console.log(`[Worker] Checking grace period for contract: ${contractId}`);

    // 1. Use Atomic Update Pattern to ensure we only process if still in VALIDATING
    // Why: Prevents race conditions where a validator finishes review at the same instant.
    const releasedContract = await Contract.findOneAndUpdate(
        { 
            _id: contractId, 
            status: "VALIDATING" 
        },
        { 
            $set: { status: "COMPLETED" } 
        },
        { new: true }
    );

    if (!releasedContract) {
        console.log(`[Worker] Contract ${contractId} is not in VALIDATING status. Skipping.`);
        return;
    }

    // 2. Release the Authorized Hold (Funds go back to creator)
    if (releasedContract.stripePaymentIntentId) {
        await stripeService.cancelHold(releasedContract.stripePaymentIntentId);
        console.log(`[Worker] Stripe Authorized hold CANCELED (released) for contract ${releasedContract._id} (Grace Period Expired)`);
    } else {
        console.error(`[Worker] CRITICAL: Contract ${releasedContract._id} missing stripePaymentIntentId.`);
    }

    console.log(`[Worker] Contract ${contractId} grace period expired. Status: COMPLETED (Creator Won).`);
}, { connection });

gracePeriodWorker.on("completed", (job) => {
    console.log(`[Worker] Grace period check job ${job.id} has completed!`);
});

gracePeriodWorker.on("failed", (job, err) => {
    console.error(`[Worker] Grace period check job ${job?.id} has failed: ${err.message}`);
});
