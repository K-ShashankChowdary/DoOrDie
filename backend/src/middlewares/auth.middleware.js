import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

/**
 * AUTHENTICATION MIDDLEWARE (JWT)
 * 
 * Why: Secures routes by verifying Bearer tokens or HTTP-Only cookies. 
 * Re-hydrates req.user from PostgreSQL using Prisma.
 */
export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        // 1. Extract token from Cookies or Authorization header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request: No token provided");
        }

        // 2. Verify signature
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // 3. Find user in PostgreSQL
        const user = await prisma.user.findUnique({
            where: { id: decodedToken?.id || decodedToken?._id },
            select: {
                id: true,
                fullName: true,
                email: true,
                upiId: true,
                createdAt: true
            }
        });

        if (!user) {
            throw new ApiError(401, "Invalid Access Token: User not found");
        }

        // 4. Attach to request
        req.user = user;
        next();

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Access token has expired. Please log in again.");
        }
        if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid access token structure.");
        }
        throw new ApiError(401, error?.message || "Authentication failed");
    }
});
