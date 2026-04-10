import { PrismaClient } from "@prisma/client";

// ============================================================================
// Database: Prisma Client Singleton
// ============================================================================
// Why: Reuse a single connection across the app to prevent exhausting 
// the PostgreSQL connection pool.
const prisma = new PrismaClient();

export default prisma;
