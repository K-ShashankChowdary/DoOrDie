import { Queue } from "bullmq";
import { redisService as connection } from "./redis.service.js";

/**
 * BullMQ Service — task deadlines and grace period (Stripe webhooks removed for demo mode).
 */
export const taskDeadlineQueue = new Queue("task-deadline-queue", { 
    connection,
    defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 10,
        backoff: { type: "exponential", delay: 60000 }
    },
    skipConfigCheck: true
});

export const gracePeriodQueue = new Queue("validator-grace-period", {
    connection,
    defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 10,
        backoff: { type: "exponential", delay: 60000 }
    },
    skipConfigCheck: true
});

export const queueService = {
    scheduleTaskDeadline: async (contractId, delayMs) => {
        return await taskDeadlineQueue.add(
            "settle_contract", 
            { contractId }, 
            { 
                delay: Math.max(0, delayMs),
                jobId: `settle_${contractId}`
            }
        );
    },

    scheduleGracePeriod: async (contractId, delayMs) => {
        return await gracePeriodQueue.add(
            "ghosting_check",
            { contractId },
            {
                delay: Math.max(0, delayMs),
                jobId: `grace_${contractId}`
            }
        );
    }
};
