import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../db/prisma.js";
import { walletService } from "../services/wallet.service.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
};

/**
 * TOKEN GENERATOR
 */
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new ApiError(404, "User not found to generate tokens");
        
        const accessToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d" }
        );
        
        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "10d" }
        );

        await prisma.user.update({
            where: { id: userId },
            data: { refreshToken }
        });

        return { accessToken, refreshToken };
    } catch (error) {
        console.error(`[Token Error] ${error.message}`);
        throw new ApiError(error.statusCode || 500, error.message || "Token generation failed");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, upiId } = req.body;

    if ([fullName, email, password].some(f => !f?.trim())) {
        throw new ApiError(400, "Missing required fields");
    }

    const existedUser = await prisma.user.findUnique({ where: { email } });
    if (existedUser) throw new ApiError(409, "User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
        data: {
            fullName,
            email,
            password: hashedPassword,
            upiId: upiId || "",
            stripeOnboardingComplete: true,
            stripeAccountId: null,
            wallet: { create: {} }
        },
        include: { wallet: true }
    });

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    const createdUser = { ...user };
    delete createdUser.password;
    delete createdUser.refreshToken;

    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(201, { user: createdUser, accessToken, refreshToken }, "Registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, "User not found");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new ApiError(401, "Invalid credentials");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    const loggedInUser = { ...user };
    delete loggedInUser.password;
    delete loggedInUser.refreshToken;

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "Logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
    await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshToken: null }
    });

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, { user: req.user }, "User fetched"));
});

const getUserBalance = asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
        where: { userId: req.user.id }
    });
    return res.status(200).json(new ApiResponse(200, { 
        available: Number(wallet?.availableBalance || 0),
        pending: Number(wallet?.lockedBalance || 0)
    }, "Wallet balance fetched"));
});

/** Demo: add funds instantly (no external payment). */
const createTopupSession = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 50) {
        throw new ApiError(400, "Top-up amount must be at least ₹50.");
    }
    await walletService.demoCreditWallet(req.user.id, numericAmount);
    return res.status(200).json(new ApiResponse(200, { demo: true }, "Funds added (demo wallet)."));
});

/** Demo: withdraw instantly (simulated bank transfer). */
const requestWithdrawal = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
        throw new ApiError(400, "Withdrawal amount must be at least ₹100.");
    }
    const withdrawal = await walletService.demoWithdraw(req.user.id, numericAmount);
    return res.status(200).json(new ApiResponse(200, { withdrawalId: withdrawal.id, demo: true }, "Withdrawal completed (demo)."));
});

const getWithdrawalHistory = asyncHandler(async (req, res) => {
    const withdrawals = await prisma.withdrawal.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
    return res.status(200).json(new ApiResponse(200, { withdrawals }, "Withdrawal history fetched"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "No refresh token provided");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const userId = decodedToken?.id || decodedToken?._id;
        
        if (!userId) {
            console.error("[Token Refresh] No ID found in token payload:", decodedToken);
            throw new ApiError(401, "Invalid token payload");
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user.id);

        const loggedInUser = { ...user };
        delete loggedInUser.password;
        delete loggedInUser.refreshToken;

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken: newRefreshToken }, "Token refreshed"));
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token");
    }
});

const searchUsers = asyncHandler(async (req, res) => {
    const { query } = req.query;
    const users = await prisma.user.findMany({
        where: {
            id: { not: req.user.id },
            OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } }
            ]
        },
        select: { id: true, fullName: true, email: true }
    });
    return res.status(200).json(new ApiResponse(200, users, "Users found"));
});

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    getCurrentUser,
    getUserBalance, 
    createTopupSession,
    requestWithdrawal,
    getWithdrawalHistory,
    refreshAccessToken, 
    searchUsers 
};
