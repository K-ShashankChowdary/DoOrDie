import { Worker } from "bullmq";
import { redisService as connection } from "../services/redis.service.js";
import { walletService } from "../services/wallet.service.js";
import { ApiError } from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import logger from "../utils/logger.js";

/**
 * GRACE PERIOD WORKER — validator ghosted for 24h after proof → creator wins (refund).
 *
 * Scheduled when proof is uploaded (contract.controller). Idempotent: if the validator
 * already decided, or the contract left VALIDATING, we skip.
 */
const gracePeriodWorker = new Worker(
    "validator-grace-period",
    async (job) => {
        const { contractId } = job.data;
        logger.info(`Grace period job start`, { contractId, jobId: job.id });

        try {
            const contract = await prisma.contract.findUnique({ where: { id: contractId } });
            if (!contract) {
                logger.info(`Grace skip: contract deleted`, { contractId });
                return;
            }

            if (contract.status !== "VALIDATING") {
                logger.info(`Grace skip: not VALIDATING`, { contractId, status: contract.status });
                return;
            }

            try {
                await walletService.settleContract(contractId, true);
                logger.info(`Grace settlement complete (creator refund)`, { contractId });
            } catch (error) {
                if (error instanceof ApiError && error.statusCode === 409) {
                    logger.info(`Grace settle idempotent skip`, { contractId, message: error.message });
                    return;
                }
                throw error;
            }
        } catch (error) {
            logger.error(`Grace period worker failure`, {
                contractId,
                error: error?.stack || error?.message,
            });
            throw error;
        }
    },
    { connection, skipConfigCheck: true }
);

gracePeriodWorker.on("completed", (job) => {
    logger.info(`Grace period job completed`, { jobId: job.id });
});

gracePeriodWorker.on("failed", (job, err) => {
    logger.error(`Grace period job failed`, { jobId: job?.id, error: err?.message });
});

console.log("[Worker] Grace Period worker started and listening to 'validator-grace-period'...");

export { gracePeriodWorker };
