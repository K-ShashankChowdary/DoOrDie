/**
 * LIGHTWEIGHT LOGGER (Console-based)
 * 
 * Why: Using console directly to avoid dependency issues (winston) 
 * during this restoration phase.
 */
const logger = {
    info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, meta),
    warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, meta),
    error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, meta),
    debug: (msg, meta = {}) => console.debug(`[DEBUG] ${msg}`, meta),
};

export default logger;
