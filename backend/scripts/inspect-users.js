import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { User } from '../src/models/user.model.js';

dotenv.config({ path: 'backend/.env' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function inspectUsers() {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/doordie`);
        const emails = ['user@gmail.com', 'kshashankchowdary14@gmail.com'];
        const users = await User.find({ email: { $in: emails } });
        
        for (const u of users) {
          console.log(`\n--- User: ${u.email} ---`);
          console.log(`Stripe ID: ${u.stripeAccountId}`);
          if (u.stripeAccountId) {
            const b = await stripe.balance.retrieve({}, { stripe_account: u.stripeAccountId });
            console.log("Balance:", JSON.stringify(b, null, 2));
          } else {
            console.log("No Stripe Account ID");
          }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectUsers();
