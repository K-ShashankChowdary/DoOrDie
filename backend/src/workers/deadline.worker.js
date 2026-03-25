import { Worker, Queue } from 'bullmq';
import { Contract } from '../models/contract.model.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// BullMQ Connection Setup
// We use ioredis to establish a robust connection to our Redis instance.
// maxRetriesPerRequest: null is required by BullMQ to prevent connection timeouts.
const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

// The Queue Instance: This allows other files (like contract.controller.js) 
// to push new delayed jobs into the queue.
export const contractDeadlineQueue = new Queue('contract-deadlines', { connection });

// The Worker Instance: Constantly polls Redis for jobs that are ready to process.
// When a delayed job reaches its execution time (the contract's deadline), this code runs automatically.
export const deadlineWorker = new Worker('contract-deadlines', async job => {
    const { contractId } = job.data;
    console.log(`[Worker] Checking deadline for contract: ${contractId}`);
    
    // We initiate a Mongoose ACID Transaction to safely evaluate the contract's outcome.
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Find the contract within the atomic lock
        const contract = await Contract.findById(contractId).session(session);
        
        if (!contract) {
            console.warn(`[Worker] Contract ${contractId} not found`);
            await session.abortTransaction();
            return;
        }

        // Core Game Logic: 
        // If the contract is exactly in 'ACTIVE' status when the deadline arrives, 
        // it means the creator completely failed to upload any proof in time.
        // If it was 'VALIDATING' (proof uploaded), 'COMPLETED', or 'FAILED', we ignore it.
        if (contract.status === "ACTIVE") {
            contract.status = "FAILED";
            await contract.save({ session, validateBeforeSave: false });
            console.log(`[Worker] Contract ${contractId} missed deadline. Status automatically updated to FAILED.`);
            
            // FUTURE ROADMAP: Insert Wallet/Money transfer logic here
            // e.g., transferring the lost stake to the Validator or the house.
        } else {
             console.log(`[Worker] Contract ${contractId} is in status ${contract.status}. No automatic failure needed.`);
        }

        // Make it durable
        await session.commitTransaction();
    } catch (error) {
        console.error(`[Worker] Failed assessing contract ${contractId}:`, error);
        await session.abortTransaction();
        // Throwing the error alerts BullMQ to retry the job according to its retry strategy
        throw error;
    } finally {
        session.endSession();
    }
}, { connection });

deadlineWorker.on('completed', job => {
    console.log(`[Worker] Deadline check job ${job.id} has completed!`);
});

deadlineWorker.on('failed', (job, err) => {
    console.error(`[Worker] Deadline check job ${job?.id} has failed with ${err.message}`);
});
