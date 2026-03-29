import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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
    const { fullName, email, password, upiId } = req.body;

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
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        // Compare the token to the one stored in the DB to ensure it hasn't been revoked
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        // Issue a fresh set of tokens
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        // Update the user's cookies with the new tokens so their session seamlessly stays active
        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new ApiResponse(200, { user, accessToken, refreshToken: newRefreshToken }, "Access token refreshed")
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

    // Perform a case-insensitive search across fullName, email, and upiId
    const users = await User.find({
        $or: [
            { fullName: { $regex: escapedQuery, $options: "i" } },
            { email: { $regex: escapedQuery, $options: "i" } },
            { upiId: { $regex: escapedQuery, $options: "i" } }
        ]
    }).select("_id fullName email");

    return res.status(200).json(new ApiResponse(200, users, "Users retrieved successfully"));
});

export { registerUser, loginUser, logoutUser, refreshAccessToken, searchUsers };