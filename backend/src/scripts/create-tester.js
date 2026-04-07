import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/user.model.js';
import bcrypt from 'bcrypt';

dotenv.config({ path: 'backend/.env' });

const createTester = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const email = "tester@door-die.app";
        const password = "TestPass123!";
        
        // Remove existing tester if any
        await User.deleteOne({ email });

        const hashedPassword = await bcrypt.hash(password, 10);

        const tester = await User.create({
            fullName: "Stripe Reviewer",
            email,
            password: hashedPassword,
            upiId: "tester@okaxis"
        });

        console.log("------------------------------------------");
        console.log("✅ Tester Account Created Successfully!");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log("------------------------------------------");
        console.log("Note: Use this account to show Razorpay the checkout flow.");

        process.exit(0);
    } catch (error) {
        console.error("Error creating tester account:", error);
        process.exit(1);
    }
};

createTester();
