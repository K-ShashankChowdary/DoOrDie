import { Worker } from "bullmq";
import { redisService as connection } from "../services/redis.service.js";
import { User } from "../models/user.model.js";
import { Contract } from "../models/contract.model.js";
import { queueService } from "../services/queue.service.js";

/**
 * Stripe Webhook Worker: Processes enqueued Stripe events asynchronously.
 * 
 * Why: This keeps the Webhook Controller responsive (returning 200 OK within 3s)
 * while allowing safely-retried, complex DB operations to run in the background.
 */
const stripeWorker = new Worker(
    "stripe-webhook-queue",
    async (job) => {
        const { event } = job.data;
        console.log(`[Stripe Worker] Processing event: ${event.type} (${event.id})`);

        switch (event.type) {
            /**
             * payment_intent.created
             * Fired when we initiate the stake hold. 
             * No action needed, but we acknowledge it.
             */
            case "payment_intent.created":
                console.log(`[Stripe Worker] Payment intent created: ${event.data.object.id}`);
                break;

            /**
             * payment_intent.amount_capturable_updated
             * This event fires when an auth-and-hold (manual capture) is authorized.
             * It's our signal to transition the task to ACTIVE.
             */
            case "payment_intent.amount_capturable_updated": {
                const paymentIntent = event.data.object;
                const piId = paymentIntent.id;

                // 1. Find the contract associated with this PaymentIntent
                // We use findOneAndUpdate to atomically check-and-update the status
                // to prevent race conditions with the manual polling endpoint.
                const contract = await Contract.findOneAndUpdate(
                    { stripePaymentIntentId: piId, status: "PENDING_PAYMENT" },
                    { $set: { status: "ACTIVE" } },
                    { returnDocument: 'after' }
                );

                if (!contract) {
                    console.log(`[Stripe Worker] PI ${piId} already handled (Status: ACTIVE). Skipping webhook redundancy.`);
                    return;
                }

                // 2. Schedule the settlement deadline job
                const delay = Math.max(0, new Date(contract.deadline).getTime() - Date.now());
                await queueService.scheduleTaskDeadline(contract._id, delay);

                console.log(`[Stripe Worker] Task ${contract._id} ACTIVATED successfully (Async Flow).`);
                break;
            }

            /**
             * charge.succeeded
             * Fired when the hold is authorized.
             */
            case "charge.succeeded":
                console.log(`[Stripe Worker] Charge authorized for hold: ${event.data.object.id}`);
                break;

            /**
             * payment_intent.succeeded OR charge.captured
             * Fired after we manually capture the funds.
             */
            case "payment_intent.succeeded":
            case "charge.captured":
                console.log(`[Stripe Worker] SUCCESS: Payment hold has been fully CAPTURED: ${event.data.object.id}`);
                break;

            /**
             * payment_intent.payment_failed
             * Handle cases where the hold authorization fails.
             */
            case "payment_intent.payment_failed": {
                const piId = event.data.object.id;
                console.warn(`[Stripe Worker] ALERT: Payment failed for PI: ${piId}`);
                break;
            }

            /**
             * transfer.created OR transfer.paid
             * Fired when funds are moved to a validator's connected account.
             */
            case "transfer.created":
            case "transfer.paid":
                console.log(`[Stripe Worker] SUCCESS: Funds TRANSFERRED to validator account: ${event.data.object.id}`);
                break;

            /**
             * transfer.failed
             * Fired when a transfer cannot be completed (insufficient platform funds or bank rejection).
             */
            case "transfer.failed": {
                const transfer = event.data.object;
                console.error(`[Stripe Worker] CRITICAL: Transfer ${transfer.id} FAILED. Reason: ${transfer.failure_code || "Unknown"}`);
                // In a production app, we would send an email/Slack alert to the admin here.
                break;
            }

            /**
             * payment.created
             * Fired on the connected account when funds land.
             */
            case "payment.created":
                console.log(`[Stripe Worker] CONFIRMED: Payment landed in connected account: ${event.data.object.id}`);
                break;

            /**
             * account.updated
             * This event fires when a connected account is updated.
             * We use it to track when onboarding is complete.
             */
            case "account.updated": {
                const account = event.data.object;
                
                // If the account is fully enabled for transfers, mark onboarding as complete
                if (account.details_submitted) {
                    await User.findOneAndUpdate(
                        { stripeAccountId: account.id },
                        { $set: { stripeOnboardingComplete: true } }
                    );
                    console.log(`[Stripe Worker] Onboarding COMPLETE for account: ${account.id}`);
                }
                break;
            }

            default:
                console.log(`[Stripe Worker] Unhandled event type: ${event.type}`);
        }
    },
    { 
        connection,
        concurrency: 5 // Process multiple webhooks in parallel if volume is high.
    }
);

// Graceful shutdown handling
stripeWorker.on("error", (err) => console.error("[Stripe Worker] CRITICAL ERROR:", err));
stripeWorker.on("failed", (job, err) => console.warn(`[Stripe Worker] Job ${job.id} FAILED:`, err.message));

console.log("[Worker] Stripe Webhook worker started and listening to 'stripe-webhook-queue'...");

export default stripeWorker;
