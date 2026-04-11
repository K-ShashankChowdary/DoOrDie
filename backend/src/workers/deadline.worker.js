import { Worker } from "bullmq";
import { redisService as connection } from "../services/redis.service.js";
import { walletService } from "../services/wallet.service.js";
import { ApiError } from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import logger from "../utils/logger.js";

/** Normal proof submission (not the internal deadline bridge state). */
function hasProofSubmitted(contract) {
    const text = contract.proofText?.trim();
    const imgs = Array.isArray(contract.proofImages) && contract.proofImages.length > 0;
    const links = Array.isArray(contract.proofLinks) && contract.proofLinks.length > 0;
    return !!(text || imgs || links);
}

/**
 * DEADLINE WORKER — no proof by deadline → creator forfeits (validator + platform fee).
 *
 * settleContract only accepts VALIDATING; we bridge ACTIVE → VALIDATING when the deadline
 * passes with no proof. If settlement fails after the bridge, retries must still settle
 * from VALIDATING + empty proof (recovery).
 */
const deadlineWorker = new Worker(
    "task-deadline-queue",
    async (job) => {
        const { contractId } = job.data;
        logger.info(`Deadline job start`, { contractId, jobId: job.id });

        try {
            let contract = await prisma.contract.findUnique({ where: { id: contractId } });
            if (!contract) {
                logger.info(`Deadline skip: contract deleted`, { contractId });
                return;
            }

            const deadlineMs = new Date(contract.deadline).getTime();
            if (deadlineMs > Date.now() + 3000) {
                logger.warn(`Deadline job ran before deadline`, { contractId, deadline: contract.deadline });
                return;
            }

            if (contract.status === "ACTIVE") {
                const transitioned = await prisma.contract.updateMany({
                    where: { id: contractId, status: "ACTIVE" },
                    data: { status: "VALIDATING" },
                });
                if (transitioned.count !== 1) {
                    contract = await prisma.contract.findUnique({ where: { id: contractId } });
                    if (!contract || contract.status !== "VALIDATING" || hasProofSubmitted(contract)) {
                        logger.info(`Deadline skip: could not bridge ACTIVE (race or already settled)`, {
                            contractId,
                            status: contract?.status,
                        });
                        return;
                    }
                }
            } else if (contract.status === "VALIDATING") {
                if (hasProofSubmitted(contract)) {
                    logger.info(`Deadline skip: proof exists — validator / grace path`, { contractId });
                    return;
                }
            } else {
                logger.info(`Deadline skip: status`, { contractId, status: contract.status });
                return;
            }

            try {
                await walletService.settleContract(contractId, false);
                logger.info(`Deadline settlement complete`, { contractId });
            } catch (err) {
                if (err instanceof ApiError && err.statusCode === 409) {
                    logger.info(`Deadline settle idempotent skip`, { contractId, message: err.message });
                    return;
                }
                throw err;
            }
        } catch (error) {
            logger.error(`Deadline processing failure`, {
                contractId,
                error: error?.stack || error?.message,
            });
            throw error;
        }
    },
    { connection, skipConfigCheck: true }
);

deadlineWorker.on("completed", (job) => {
    logger.info(`Deadline job completed`, { jobId: job.id });
});

deadlineWorker.on("failed", (job, err) => {
    logger.error(`Deadline job failed`, { jobId: job?.id, error: err?.message });
});

console.log("[Worker] Deadline worker started and listening to 'task-deadline-queue'...");

export { deadlineWorker };
