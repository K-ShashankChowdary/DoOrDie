import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { User } from '../src/models/user.model.js';

dotenv.config({ path: 'backend/.env' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function auditBalance() {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/doordie`);
        const email = 'kshashankchowdary14@gmail.com';
        const user = await User.findOne({ email });

        if (!user || !user.stripeAccountId) {
            console.error("User not found or no Stripe account linked.");
            process.exit(1);
        }

        // Check Platform Balance
        const platformBalance = await stripe.balance.retrieve();
        console.log("\n--- Master Platform Balance ---");
        console.log(`Available: $${platformBalance.available.reduce((a, c) => a + (c.amount/100), 0)}`);
        console.log(`Pending:   $${platformBalance.pending.reduce((a, c) => a + (c.amount/100), 0)}`);

        console.log(`\n🔍 Auditing Account: ${user.stripeAccountId} (${email})`);

        // 1. List Transactions (NOW FIXED TO DIRECT FETCH)
        const res = await fetch('https://api.stripe.com/v1/balance', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Stripe-Account': user.stripeAccountId
            }
        });
        const balance = await res.json();
        console.log("\n--- Real Balance ---");
        console.log(`Available: $${balance.available.reduce((a, c) => a + (c.amount/100), 0)}`);
        console.log(`Pending:   $${balance.pending.reduce((a, c) => a + (c.amount/100), 0)}`);

        // 2. List Transactions
        const transactions = await stripe.balanceTransactions.list({
            limit: 20
        }, {
            stripe_account: user.stripeAccountId
        });

        console.log(`\n--- Last ${transactions.data.length} Ledger Entries ---`);
        transactions.data.forEach((txn, i) => {
            console.log(`${i+1}. [${txn.id}] | $${txn.amount/100} | ${txn.status} | ${txn.type}`);
        });

        // 3. List Transfers
        const transfers = await stripe.transfers.list({
            destination: user.stripeAccountId,
            limit: 20
        });

        console.log(`\n--- Last ${transfers.data.length} Transfers ---`);
        let totalReceived = 0;
        transfers.data.forEach((t, i) => {
            const amt = t.amount / 100;
            totalReceived += amt;
            console.log(`${i+1}. [${t.id}] | $${amt} | ${new Date(t.created * 1000).toLocaleString()}`);
        });

        console.log(`\nTotal found in transfers: $${totalReceived}`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

auditBalance();
