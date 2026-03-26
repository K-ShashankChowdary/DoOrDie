import { Worker, Queue } from 'bullmq';
import { Contract } from '../models/contract.model.js';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import Razorpay from 'razorpay';

// BullMQ Connection Setup
const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// The Queue Instance
export const validatorGraceQueue = new Queue('validator-grace-period', { connection });

// The Worker Instance: Auto-refunds creator if validator fails to evaluate proof within 24 hours of deadline
export const gracePeriodWorker = new Worker('validator-grace-period', async job => {
    const { contractId } = job.data;
    console.log(`[Worker] Checking grace period for contract: ${contractId}`);
    
    // Mongoose ACID Transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const contract = await Contract.findById(contractId).session(session);
        
        if (!contract) {
            console.warn(`[Worker] Contract ${contractId} not found`);
            await session.abortTransaction();
            return;
        }

        // If the contract is still stuck in VALIDATING state
        if (contract.status === "VALIDATING") {
            
            // 1. Process Full Refund to Creator
            if (contract.razorpayPaymentId) {
                // Omitting 'amount' acts as a full refund
                await razorpay.payments.refund(contract.razorpayPaymentId, {
                    notes: {
                        reason: "Validator no-show grace period expired. Auto-refunding creator.",
                        contractId: contract._id.toString()
                    }
                });
                console.log(`[Worker] Refund issued for payment ${contract.razorpayPaymentId}`);
            }

            // 2. Mark as completed (Creator wins by default)
            contract.status = "COMPLETED";
            await contract.save({ session, validateBeforeSave: false });
            console.log(`[Worker] Contract ${contractId} grace period expired. Status automatically updated to COMPLETED.`);
            
        } else {
             console.log(`[Worker] Contract ${contractId} is in status ${contract.status}. No grace period action needed.`);
        }

        await session.commitTransaction();
    } catch (error) {
        console.error(`[Worker] Failed assessing grace period for contract ${contractId}:`, error);
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}, { connection });

gracePeriodWorker.on('completed', job => {
    console.log(`[Worker] Grace period check job ${job.id} has completed!`);
});

gracePeriodWorker.on('failed', (job, err) => {
    console.error(`[Worker] Grace period check job ${job?.id} has failed: ${err.message}`);
});
