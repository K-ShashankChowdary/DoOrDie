import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApiError } from "./src/utils/ApiError.js";



const app = express();

// Global Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// Route webhooks BEFORE express.json() so they get raw Buffer for HMAC validation
import webhookRouter from "./src/routes/webhook.routes.js";
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhookRouter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); 
app.use(cookieParser());

// Request & Response Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`\x1b[36m[${new Date().toLocaleTimeString()}] -> ${req.method} ${req.originalUrl}\x1b[0m`);
    
    res.on("finish", () => {
        const duration = Date.now() - start;
        const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m'; // Red for errors, green for success
        console.log(`${color}[${new Date().toLocaleTimeString()}] <- ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms\x1b[0m`);
    });
    
    next();
});

//routes Import
import userRouter from "./src/routes/user.routes.js";
import contractRouter from "./src/routes/contract.routes.js";
import taskRouter from "./src/routes/task.routes.js";

// Routes mounting
app.use("/api/v1/users", userRouter);
app.use("/api/v1/contracts", contractRouter);
app.use("/api/v1/tasks", taskRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    if (!(err instanceof ApiError)) {
        let statusCode = err.statusCode || 500;
        let message = err.message || "Internal Server Error";

        // Handle Mongoose Validation and Cast Errors natively
        if (err.name === "ValidationError" || err.name === "CastError") {
            statusCode = 400;
            message = err.message;
        }

        if (err.code === 11000) { // MongoDB duplicate key
            statusCode = 409;
            message = "Duplicate key error: " + Object.keys(err.keyValue).join(', ') + " already exists.";
        }

        err = new ApiError(statusCode, message, err?.errors || [], err.stack);
    }

    const response = {
        success: false,
        message: err.message,
        statusCode: err.statusCode,
        errors: err.errors,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    };

    return res.status(err.statusCode).json(response);
});

export { app };