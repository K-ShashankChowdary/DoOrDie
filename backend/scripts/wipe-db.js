import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const wipeDatabase = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('Error: MONGODB_URI not found in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB (doordie)...');
        // Appends /doordie to ensure we wipe the correct database
        await mongoose.connect(`${uri}/doordie`);
        console.log('Connected.');

        console.log('Wiping collections...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            console.log(`Dropping collection: ${collection.name}`);
            await mongoose.connection.db.dropCollection(collection.name);
        }
        
        console.log('SUCCESS: All collections dropped.');
        process.exit(0);
    } catch (error) {
        console.error('FAILED to wipe database:', error);
        process.exit(1);
    }
};

wipeDatabase();
