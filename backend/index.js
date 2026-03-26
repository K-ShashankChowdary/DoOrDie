import "dotenv/config";
import { createServer } from "http";
import connectDB from "./src/db/index.js";
import { app } from "./app.js";
import "./src/workers/deadline.worker.js";
import "./src/workers/gracePeriod.worker.js";

const startServer = async () => {
    try {
        // Ensure database connectivity before starting the server
        await connectDB();

        const httpServer = createServer(app);
        const port = process.env.PORT || 8000;

        httpServer.listen(port, () => {
            console.log(`Server is operating on port: ${port}`);
        });

        // Global process error handling
        process.on("unhandledRejection", (err) => {
            console.error("Unhandled Rejection:", err);
            httpServer.close(() => process.exit(1));
        });

    } catch (err) {
        console.error("Critical System Failure during initialization:", err);
        process.exit(1);
    }
};

startServer();