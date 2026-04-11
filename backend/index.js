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

            // Failsafe: Force kill after 10s if hung
            setTimeout(() => {
                console.error("[SYSTEM] Shutdown timed out. Forcing exit.");
                process.exit(1);
            }, 10000);

            server.close(async (err) => {
                if (err) {
                    logger.error("Error closing HTTP server", { error: err });
                } else {
                    logger.info("HTTP server stopped.");
                }

                try {
                    console.log("[SYSTEM] Closing workers...");
                    await Promise.all([
                        deadlineWorker.close(),
                        gracePeriodWorker.close()
                    ]);
                    console.log("[SYSTEM] Workers shut down cleanly.");

                    await prisma.$disconnect();
                    console.log("[SYSTEM] Prisma disconnected.");

                    process.exit(0);
                } catch (shutdownError) {
                    console.error("[SYSTEM] Error during coordinated shutdown:", shutdownError);
                    process.exit(1);
                }
            });
        };

        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

        process.on("unhandledRejection", (err) => {
            logger.error("Unhandled Rejection", { error: err });
            gracefulShutdown("UnhandledRejection");
        });

    } catch (err) {
        console.error("Critical System Failure during initialization:", err);
        process.exit(1);
    }
};

startServer();