import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { User } from '../src/models/user.model.js';

dotenv.config({ path: 'backend/.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SIMULATION_COUNT = 5;
const STAKE_AMOUNT = 100; // $100

async function simulateTransactions() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(`${process.env.MONGODB_URI}/doordie`);

        // 1. Find the specific validator
        const validator = await User.findOne({ 
            email: 'user@gmail.com',
            stripeOnboardingComplete: true 
        });
        
        if (!validator) {
            console.error("No onboarded validator found. Please complete Stripe onboarding for at least one user first.");
            process.exit(1);
        }

        console.log(`Validator found: ${validator.fullName} (${validator.stripeAccountId})`);
        console.log(`Starting simulation of ${SIMULATION_COUNT} transactions...`);

        for (let i = 1; i <= SIMULATION_COUNT; i++) {
            console.log(`\n[Transaction ${i}/${SIMULATION_COUNT}] Preparing...`);

            // 1. Create a PaymentIntent with a Test Card (Instantly successful)
            // We use 'pm_card_visa' to bypass the frontend checkout
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(STAKE_AMOUNT * 100),
                currency: 'usd',
                payment_method: 'pm_card_visa', 
                confirm: true,
                capture_method: 'manual',
                automatic_payment_methods: {
                  enabled: true,
                  allow_redirects: 'never'
                }
            });

            console.log(`- Hold created: ${paymentIntent.id}`);

            // 2. Capture the full hold
            const capturedIntent = await stripe.paymentIntents.capture(paymentIntent.id);
            const chargeId = capturedIntent.latest_charge;
            console.log(`- Funds Captured from Platform: ${chargeId}`);

            // 3. Transfer 90% to the Validator (linked to the original charge)
            const payoutAmount = STAKE_AMOUNT * 0.9;
            const transfer = await stripe.transfers.create({
                amount: Math.round(payoutAmount * 100),
                currency: 'usd',
                destination: validator.stripeAccountId,
                source_transaction: chargeId,
                description: `Prowess payout simulation ${i} for ${validator.fullName}`
            });

            console.log(`- SUCCESS: $${payoutAmount} transferred to Validator account: ${transfer.id}`);
        }

        console.log("\n------------------------------------------------");
        console.log("✅ Simulation complete!");
        console.log(`${SIMULATION_COUNT} transactions were processed successfully.`);
        console.log(`Check your Stripe Dashboard for account: ${validator.stripeAccountId}`);
        console.log("------------------------------------------------");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Simulation FAILED:");
        console.error(error.message);
        process.exit(1);
    }
}

simulateTransactions();
