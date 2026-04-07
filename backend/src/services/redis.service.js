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
};

// Create a new Redis instance with mandatory BullMQ options
const connectionOptions = {
    ...redisConfig,
    maxRetriesPerRequest: null, // Force null for BullMQ compatibility
    connectTimeout: 10000,      // 10 second timeout to avoid indefinite hangs
};

const redisClient = process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, { 
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        tls: process.env.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined
      })
    : new Redis(connectionOptions);

redisClient.on("connect", () => {
    console.log("Redis connected successfully.");
});

redisClient.on("error", (err) => {
    console.error("Redis Connection Error:", err);
});

export const redisService = redisClient;
