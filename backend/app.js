import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./src/middlewares/errorHandler.js";

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
    console.log(`\x1b[36m[${new Date().toLocaleTimeString()}] -> ${req.method} ${req.originalUrl}\x1b[0m`);
    res.on("finish", () => {
        const duration = Date.now() - start;
        const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}[${new Date().toLocaleTimeString()}] <- ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms\x1b[0m`);
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