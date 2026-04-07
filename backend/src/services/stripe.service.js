import "dotenv/config";
import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
    throw new Error("CRITICAL: STRIPE_SECRET_KEY is missing in environment variables.");
}

if (secretKey.startsWith('pk_')) {
    throw new Error("CRITICAL: STRIPE_SECRET_KEY is incorrectly set to a Publishable Key (pk_). Please use a Secret Key (sk_).");
}

const stripe = new Stripe(secretKey);

/**
 * Service to handle all interactions with the Stripe API.
 * This includes PaymentIntents for the auth-and-hold flow and 
 * Connect account management for accountability partners (validators).
 */
export const stripeService = {
    /**
     * Creates a PaymentIntent with capture_method: 'manual'.
     * This places an authorization hold on the user's card for the stake amount.
     */
    createAuthHold: async (amount, metadata = {}) => {
        return await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amount in cents
            currency: 'usd',
            payment_method_types: ['card'],
            capture_method: 'manual',
            metadata
        });
    },

    /**
     * Captures an authorized PaymentIntent.
     * This moves the funds from the user's account to our platform account.
     * Then immediately creates a transfer to a connected account using source_transaction.
     * 
     * Why: source_transaction bypasses platform account balance limits and 
     * ensures the transfer is linked to the original charge.
     */
    captureHoldAndTransfer: async (paymentIntentId, amount, destinationAccountId, description) => {
        // 1. Capture the full hold
        const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId);
        
        // 2. Extract the charge ID for the source_transaction parameter
        const chargeId = capturedIntent.latest_charge;

        // 3. Create the transfer (minus platform fee, which is handled in the worker)
        // Important: currency must EXACTLY match the capturedIntent.currency 
        // to satisfy the source_transaction requirement.
        return await stripe.transfers.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: capturedIntent.currency,
            destination: destinationAccountId,
            source_transaction: chargeId, // Critical for linked flow
            description: description
        });
    },

    /**
     * Cancels an authorized PaymentIntent, releasing the hold (voiding).
     */
    cancelHold: async (paymentIntentId) => {
        return await stripe.paymentIntents.cancel(paymentIntentId);
    },

    /**
     * Transfers funds to a connected Express account.
     * Used to remit the stake (minus platform fees) to the validator.
     */
    createTransfer: async (amount, destinationAccountId, description) => {
        return await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            destination: destinationAccountId,
            description
        });
    },

    /**
     * Creates a new Stripe Express account for a collaborator.
     */
    createExpressAccount: async (email, metadata = {}) => {
        return await stripe.accounts.create({
            type: 'express',
            email,
            capabilities: {
                transfers: { requested: true },
            },
            metadata
        });
    },

    /**
     * Generates an onboarding link for a Stripe Express account.
     */
    createAccountOnboardingLink: async (accountId, refreshUrl, returnUrl) => {
        return await stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
        });
    },

    /**
     * Retrieves account details for a Stripe Connected account.
     * Used to verify if onboarding details have been submitted.
     */
    getAccount: async (accountId) => {
        return await stripe.accounts.retrieve(accountId);
    },

    /**
     * Verifies a Stripe webhook signature.
     */
    constructEvent: (payload, signature) => {
        return stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    }
};
