import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { stripeService } from "../services/stripe.service.js";
import jwt from "jsonwebtoken";

// Helper function to generate both JWT tokens and save the refresh token to the database
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

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
    const { fullName, email, password, upiId } = req.body;

    if ([fullName, email, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User with email already exists");
    }

    const user = await User.create({ fullName, email, password, upiId: upiId || "" });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

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

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

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
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Generate a new access token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password");

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        const safeUser = user.toObject();
        delete safeUser.refreshToken;
        delete safeUser.password;

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new ApiResponse(200, { user: safeUser, accessToken, refreshToken: newRefreshToken }, "Access token refreshed")
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

// Search for other users
const searchUsers = asyncHandler(async (req, res) => {
    const { query } = req.query;
    
    if (!query || query.trim() === "") {
        return res.status(200).json(new ApiResponse(200, [], "Empty query"));
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/**
 * Creates a Stripe Express account for the user and returns an onboarding link.
 * This replaces the previous Razorpay Route linking logic.
 */
const linkStripeAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Reuse existing account if it exists
    let accountId = user.stripeAccountId;

    if (!accountId) {
        const account = await stripeService.createExpressAccount(user.email, {
            userId: user._id.toString()
        });
        accountId = account.id;
        user.stripeAccountId = accountId;
        await user.save({ validateBeforeSave: false });
    }

    // Generate onboarding link
    // Note: In production, these URLs should be dynamic base on the frontend deployment
    const refreshUrl = `${req.protocol}://${req.get('host')}/api/v1/users/stripe/refresh`;
    const returnUrl = `${req.protocol}://${req.get('host')}/api/v1/users/stripe/return`;

    const accountLink = await stripeService.createAccountOnboardingLink(
        accountId,
        refreshUrl,
        returnUrl
    );

    return res.status(200).json(
        new ApiResponse(200, { onboardingUrl: accountLink.url }, "Stripe onboarding link generated")
    );
});

export { registerUser, loginUser, logoutUser, refreshAccessToken, searchUsers, linkStripeAccount };
