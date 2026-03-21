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

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); 
app.use(cookieParser());

//routes Import
import userRouter from "./src/routes/user.routes.js";
import contractRouter from "./src/routes/contract.routes.js";

// Routes mounting
app.use("/api/v1/users", userRouter);
app.use("/api/v1/contracts", contractRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    if (!(err instanceof ApiError)) {
        const statusCode = err.statusCode || 500;
        const message = err.message || "Internal Server Error";
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