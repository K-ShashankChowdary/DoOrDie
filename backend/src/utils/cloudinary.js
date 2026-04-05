import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const getUploadSignature = () => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    // Optional: restrict uploads to a specific folder
    const signature = cloudinary.utils.api_sign_request({
        timestamp: timestamp,
        folder: 'doordie_proofs'
    }, process.env.CLOUDINARY_API_SECRET);

    return { 
        timestamp, 
        signature, 
        cloudName: process.env.CLOUDINARY_CLOUD_NAME, 
        apiKey: process.env.CLOUDINARY_API_KEY 
    };
};
