import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        //grab the token from the cookies OR the Authorization header (useful for mobile apps)
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request: No token provided");
        }

        // verify the token using the secret in your .env
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find the user in the DB
        const user = await User.findById(decodedToken._id).select("-password");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        // Attach the user object to the request so the next controller can use it
        req.user = user;
        next();
    } catch (error) {
        // Normalize JWT-specific errors so raw library messages don't leak to the client
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Access token has expired. Please log in again.");
        }
        if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid access token.");
        }
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});