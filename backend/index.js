import "dotenv/config";
import { createServer } from "http";
import { app } from "./app.js";
import { deadlineWorker } from "./src/workers/deadline.worker.js";
import { gracePeriodWorker } from "./src/workers/gracePeriod.worker.js";
import prisma from "./src/db/prisma.js";
import logger from "./src/utils/logger.js";

const startServer = async () => {
    try {
        const httpServer = createServer(app);
        const port = process.env.PORT || 8000;

        const server = httpServer.listen(port, () => {
            logger.info(`Server operating on port: ${port}`);
        });

        const gracefulShutdown = async (signal) => {
            logger.warn(`Received ${signal}. Initiating graceful shutdown...`);

            // Failsafe: Force kill after 5s if hung
            setTimeout(() => {
                logger.error("[SYSTEM] Shutdown timed out. Forcing exit.");
                process.exit(1);
            }, 5000);

            // Stop accepting new connections
            server.close(() => {
                logger.info("HTTP server stopped accepting new connections.");
            });

            // Force close lingering keep-alive connections so it doesn't hang
            if (server.closeAllConnections) {
                server.closeAllConnections();
            }

            try {
                logger.info("[SYSTEM] Closing workers...");
                await Promise.all([
                    deadlineWorker.close(),
                    gracePeriodWorker.close()
                ]);
                logger.info("[SYSTEM] Workers shut down cleanly.");

                await prisma.$disconnect();
                logger.info("[SYSTEM] Prisma disconnected.");

                process.exit(0);
            } catch (shutdownError) {
                logger.error("[SYSTEM] Error during coordinated shutdown:", { error: shutdownError });
                process.exit(1);
            }
        };

        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

        process.on("unhandledRejection", (err) => {
            logger.error("Unhandled Rejection", { error: err });
            gracefulShutdown("UnhandledRejection");
        });

    } catch (err) {
        logger.error("Critical System Failure during initialization:", { error: err });
        process.exit(1);
    }
};

startServer();