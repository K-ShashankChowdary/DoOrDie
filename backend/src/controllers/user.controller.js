import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Generate a deterministic 10-digit phone-like value per user.
// This avoids Razorpay "phone already exists" conflicts from shared hardcoded values.
const buildRazorpayPhoneForUser = (userId) => {
    const hex = String(userId).replace(/[^a-f0-9]/gi, "").slice(-9);
    const numericTail = parseInt(hex || "0", 16).toString().padStart(9, "0").slice(-9);
    return `9${numericTail}`;
};

// Helper function to generate both JWT tokens and save the refresh token to the database
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        // Fetch the user from the database using their ID
        const user = await User.findById(userId);
        
        // Call the schema methods to generate short-lived access and long-lived refresh tokens
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Save the newly generated refresh token directly into the user's database document
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
};

// Register a new user in the system
const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, upiId, phone, legalBusinessName, customerFacingBusinessName, businessType } = req.body;

    // Check if any required field is empty or just whitespace
    if ([fullName, email, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Verify the email isn't already taken by another user
    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User with email already exists");
    }

    // Create the new user in the database (password hashing is handled by the Mongoose pre-save hook)
    const user = await User.create({ fullName, email, password, upiId: upiId || "" });

    // Optional: Link Razorpay immediately if phone is provided
    if (phone) {
        try {
            const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) || req.ip || "127.0.0.1";
            await linkRazorpayAccountInternal(user, {
                phone,
                legalBusinessName,
                customerFacingBusinessName,
                businessType,
                ip
            });
        } catch (error) {
            console.error("Failed to link Razorpay during registration:", error.message);
            // We don't throw here to avoid failing registration if Razorpay fails, 
            // but we might want to inform the user or log it.
        }
    }

    // Automatically log the user in by generating their session tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    
    // Fetch the created user again but exclude sensitive fields like password before sending to the frontend
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // Send the tokens securely via HTTP-only cookies and return the user data as JSON
    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(201, { user: createdUser, accessToken, refreshToken }, "User registered and logged in successfully")
        );
});

// Log in an existing user
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Ensure they actually provided an email and password
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    // Attempt to find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // Use the schema method to compare the entered password with the hashed password in the DB
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // Refresh their session by issuing entirely new tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    
    // Grab their data without sensitive fields to send back
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Attach the secure cookies and respond
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully")
        );
});

// Log out the user securely
const logoutUser = asyncHandler(async (req, res) => {
    // Delete the refresh token straight from the database so it immediately stops working everywhere
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } }, // MongoDB operator to completely remove the field
        { new: true }
    );

    // Tell the browser to delete the HTTP-only cookies
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

//silent refresh
// Generate a new access token without requiring the user to log in again
const refreshAccessToken = asyncHandler(async (req, res) => {
    // Grab the refresh token either from their cookies or from the request body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        // Cryptographically verify that the token was created by us and hasn't expired
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        // NOTE: must NOT exclude refreshToken here — we need it for the comparison below
        const user = await User.findById(decodedToken?._id).select("-password");

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // Compare the token to the one stored in the DB to ensure it hasn't been revoked
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        // Issue a fresh set of tokens
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        // Strip sensitive fields before sending the user object back
        const safeUser = user.toObject();
        delete safeUser.refreshToken;
        delete safeUser.password;

        // Update the user's cookies with the new tokens so their session seamlessly stays active
        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new ApiResponse(200, { user: safeUser, accessToken, refreshToken: newRefreshToken }, "Access token refreshed")
            );
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Refresh token has expired. Please log in again.");
        }
        if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid refresh token.");
        }
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

// Search for other users to assign as validators for a contract
const searchUsers = asyncHandler(async (req, res) => {
    const { query } = req.query;
    
    // If they typed nothing, just return an empty array instead of wasting database resources
    if (!query || query.trim() === "") {
        return res.status(200).json(new ApiResponse(200, [], "Empty query"));
    }

    // Escape regex characters to prevent Regular Expression Denial of Service (ReDoS) attacks
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Perform a case-insensitive search across fullName, email, and upiId,
    // excluding the requester themselves to prevent self-validation.
    const users = await User.find({
        _id: { $ne: req.user._id },
        $or: [
            { fullName: { $regex: escapedQuery, $options: "i" } },
            { email: { $regex: escapedQuery, $options: "i" } },
            { upiId: { $regex: escapedQuery, $options: "i" } }
        ]
    }).select("_id fullName email");

    return res.status(200).json(new ApiResponse(200, users, "Users retrieved successfully"));
});

// Internal helper to link Razorpay account
const linkRazorpayAccountInternal = async (user, data) => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new ApiError(500, "Razorpay keys are not configured on the server");
    }

    if (user.razorpayLinkedAccountId) {
        return user.razorpayLinkedAccountId;
    }

    const {
        phone,
        legalBusinessName,
        customerFacingBusinessName,
        businessType,
        ip: incomingIp
    } = data || {};

    const name = user.fullName && user.fullName.trim().length >= 4
        ? user.fullName.trim()
        : (user.fullName ? user.fullName.trim().padEnd(4, ".") : "User Default");
    
    const ip = incomingIp || "127.0.0.1";
    const generatedPhone = buildRazorpayPhoneForUser(user._id);

    let normalizedPhone = phone ? String(phone).replace(/\D/g, "") : "";
    if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
        normalizedPhone = normalizedPhone.slice(2);
    }
    
    if (phone && (normalizedPhone.length < 10 || normalizedPhone.length > 15)) {
        throw new ApiError(400, "A valid phone number is required (10-15 digits)");
    }

    const finalPhone = normalizedPhone || generatedPhone;
    
    // Ensure legal_business_name is at least 4 characters as per docs
    const finalLegalBusinessName = legalBusinessName && String(legalBusinessName).trim().length >= 4
        ? String(legalBusinessName).trim()
        : name.padEnd(4, "."); // Fallback with padding if needed

    const finalCustomerFacingBusinessName = customerFacingBusinessName && String(customerFacingBusinessName).trim().length >= 3
        ? String(customerFacingBusinessName).trim()
        : name;

    const finalBusinessType = String(businessType).toLowerCase() === "individual" ? "individual" : "individual"; // Defaulting to individual for simple signup

    let accountPayload = {
        email: user.email,
        phone: finalPhone,
        type: "route",
        reference_id: String(user._id).slice(-20), // Max 20 chars for internal ref if needed
        legal_business_name: finalLegalBusinessName,
        customer_facing_business_name: finalCustomerFacingBusinessName,
        business_type: finalBusinessType,
        contact_name: name,
        contact_email: user.email,
        ip,
        profile: {
            category: "others",
            subcategory: "others",
        },
        tnc_accepted: true,
    };

    try {
        let account;
        try {
            account = await razorpay.accounts.create(accountPayload);
        } catch (createErr) {
            console.error("Razorpay API specific error:", JSON.stringify(createErr, null, 2));
            const msg = createErr?.error?.description || createErr?.message || "";
            
            // Specific check for Route feature (common blocker)
            if (msg.includes("Route") || msg.includes("feature not enabled")) {
                throw new ApiError(400, "Razorpay 'Route' feature is NOT enabled on your merchant account. Please enable it in your Razorpay Dashboard under 'Route' section to allow validator payouts.");
            }

            const phoneConflict = /phone/i.test(msg) && /(exist|already|duplicate|taken)/i.test(msg);
            if (!phoneConflict) {
                throw createErr;
            }

            const fallbackTail = String(Date.now()).slice(-9).padStart(9, "0");
            accountPayload = { ...accountPayload, phone: `9${fallbackTail}` };
            account = await razorpay.accounts.create(accountPayload);
        }

        if (!account?.id) {
            throw new ApiError(500, "Failed to create Razorpay account");
        }

        user.razorpayLinkedAccountId = account.id;
        await user.save({ validateBeforeSave: false });
        return account.id;
    } catch (error) {
        console.error("Razorpay inner linking error:", error);
        let errorMessage = error?.error?.description || error?.message || "Failed to create Razorpay account";
        let statusCode = error?.statusCode || error?.status || 500;
        throw new ApiError(statusCode >= 400 && statusCode < 600 ? statusCode : 500, errorMessage);
    }
};

// Create a Razorpay linked account seamlessly for the user
const linkRazorpayAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) || req.ip || "127.0.0.1";
    const accountId = await linkRazorpayAccountInternal(user, { ...req.body, ip });

    return res
        .status(200)
        .json(new ApiResponse(200, { razorpayLinkedAccountId: accountId }, "Razorpay account successfully linked"));
});

export { registerUser, loginUser, logoutUser, refreshAccessToken, searchUsers, linkRazorpayAccount };
