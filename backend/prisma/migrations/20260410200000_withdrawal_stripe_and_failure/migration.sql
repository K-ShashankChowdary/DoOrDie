-- Withdrawal table was created without stripeTransferId / failureReason in init migration.
-- Align database with schema.prisma for Connect transfers and failure messages.

ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;

ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Withdrawal_stripeTransferId_key" ON "Withdrawal"("stripeTransferId");
