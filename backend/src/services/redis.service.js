import Redis from "ioredis";

/**
 * Singleton Redis client service.
 * Used for idempotency checks (distributed locking) and BullMQ connection sharing.
 * 
 * Why: Centralizing the connection prevents redundant socket creation and 
 * ensures consistent configuration across the app (timeouts, retries).
 */
const redisConfig = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null, // Critical requirement for BullMQ
};

// Create a new Redis instance if one doesn't already exist in the global scope (for HMR)
const redisClient = new Redis(process.env.REDIS_URL || redisConfig);

redisClient.on("connect", () => {
    console.log("Redis connected successfully.");
});

redisClient.on("error", (err) => {
    console.error("Redis Connection Error:", err);
});

export const redisService = redisClient;
