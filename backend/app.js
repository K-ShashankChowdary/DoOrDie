import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./src/middlewares/errorHandler.js";
import logger from "./src/utils/logger.js";

const app = express();

/**
 * GLOBAL MIDDLEWARES
 */
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); 
app.use(cookieParser());

/**
 * LOGGING MIDDLEWARE
 */
app.use((req, res, next) => {
    const start = Date.now();
    logger.info(`[REQ] -> ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 400) {
            logger.warn(`[RES] <- ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms`);
        } else {
            logger.info(`[RES] <- ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms`);
        }
    });
    next();
});

/**
 * API ROUTES
 */
import userRouter from "./src/routes/user.routes.js";
import contractRouter from "./src/routes/contract.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/contracts", contractRouter);

// DIAGNOSTIC ROUTES
app.get("/ping", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.get("/api/v1/test-error", (req, res) => { throw new Error("Test Global Error Handler"); });

/**
 * GLOBAL ERROR HANDLER
 * Why: Catch-all for all async/sync errors and returns standardized JSON.
 */
app.use(globalErrorHandler);

export { app };