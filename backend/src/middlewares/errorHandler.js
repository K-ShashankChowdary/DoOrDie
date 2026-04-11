import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

/**
 * GLOBAL ERROR HANDLER
 * 
 * Why: Centralizes all error formatting to ensure a consistent API response 
 * structure (ApiResponse) even during critical failures.
 */
const globalErrorHandler = (err, req, res, next) => {
    let error = err;

    // 1. Normalize errors that aren't already ApiError instances
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || "Internal Server Error";
        
        // Log the actual crash stack for debugging in the terminal
        console.error(`[CRITICAL_ERROR] ${error.stack || error}`);
        
        error = new ApiError(statusCode, message, error?.errors || [], error.stack);
    }

    // 2. Log full details for developers (Internal logging)
    logger.error(`${req.method} ${req.originalUrl} - ${error.message}`, {
        stack: error.stack,
        errors: error.errors
    });

    // 3. Send sanitized response to the client
    const response = {
        success: false,
        message: error.message,
        errors: error.errors,
        // Include stack trace only in development
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {})
    };

    return res.status(error.statusCode).json(response);
};

export { globalErrorHandler };
