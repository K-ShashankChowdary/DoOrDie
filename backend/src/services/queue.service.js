import { Queue } from "bullmq";
import { redisService as connection } from "./redis.service.js";

/**
 * BullMQ Service to manage application-wide queues and job producers.
 * 
 * Why: Centralizing queue instances avoids connection overhead and ensures 
 * a consistent retry/delay policy across the application.
 */

// 1. Webhook Queue: Used for asynchronous processing of Stripe webhook events.
// Ensures the webhook controller returns 200 OK within Stripe's 3s timeout.
export const stripeWebhookQueue = new Queue("stripe-webhook-queue", { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
    }
});

// 2. Task Deadline Queue: Handles automated contract settlement when deadlines pass.
export const taskDeadlineQueue = new Queue("task-deadline-queue", { 
    connection,
    defaultJobOptions: {
        removeOnComplete: true, // Clean up once the contract is settled.
        attempts: 10, // Higher retry count for financial operations.
        backoff: {
            type: "exponential",
            delay: 60000, // Wait 1 min before retrying financial failures.
        }
    }
});

/**
 * Singleton Service methods for enqueuing jobs consistently.
 */
export const queueService = {
    /**
     * Enqueues a validated Stripe event for background processing.
     * @param {Object} event - The full Stripe event object.
     */
    enqueueStripeEvent: async (event) => {
        return await stripeWebhookQueue.add(`stripe_event_${event.id}`, { event });
    },

    /**
     * Schedules a task-deadline settlement job.
     * @param {String} contractId - The unique ID of the contract/task.
     * @param {Number} delayMs - Delay in milliseconds until the deadline.
     */
    scheduleTaskDeadline: async (contractId, delayMs) => {
        return await taskDeadlineQueue.add(
            "settle_contract", 
            { contractId }, 
            { 
                delay: Math.max(0, delayMs),
                jobId: `settle_${contractId}` // Ensures only one settlement job exists per contract.
            }
        );
    }
};
