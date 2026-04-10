-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('AVAILABLE', 'LOCKED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('TOPUP', 'STAKE_LOCK', 'STAKE_UNLOCK', 'PENALTY_PAYOUT', 'PLATFORM_FEE', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING_DEPOSIT', 'ACTIVE', 'VALIDATING', 'COMPLETED', 'REJECTED', 'FAILED', 'PAYOUT_FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "upiId" TEXT,
    "stripeAccountId" TEXT,
    "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceType" "BalanceType" NOT NULL,
    "type" "LedgerType" NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "stakeAmount" DECIMAL(12,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "creatorId" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "proofImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proofLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proofText" TEXT,
    "payoutError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Ledger_userId_idx" ON "Ledger"("userId");

-- CreateIndex
CREATE INDEX "Ledger_referenceId_idx" ON "Ledger"("referenceId");

-- CreateIndex
CREATE INDEX "Contract_creatorId_status_idx" ON "Contract"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Contract_validatorId_status_idx" ON "Contract"("validatorId", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
