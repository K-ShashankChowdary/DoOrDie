import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";

// ============================================================================
// The Virtual Wallet Engine (Shadow Ledger)
// ============================================================================
// Why: All financial mutations MUST happen inside isolated Prisma transactions
// to maintain ACID compliance and prevent race conditions.
const Decimal = Prisma.Decimal;

export const walletService = {
  /**
   * TOP-UP: Credits user wallet after a successful Stripe deposit.
   * Why: Uses StripeEvent idempotency and transaction isolation.
   */
  topUpUser: async (userId, amount, stripeEventId) => {
    const decimalAmount = new Decimal(amount);

    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      const existingEvent = await tx.stripeEvent.findUnique({
        where: { id: stripeEventId },
      });

      if (existingEvent) {
        console.warn(`[Wallet] StripeEvent ${stripeEventId} already processed.`);
        return;
      }

      // 2. Mark event as processed early (idempotency safety)
      await tx.stripeEvent.create({
        data: { id: stripeEventId, type: "checkout.session.completed" },
      });

      // 3. ROW-LEVEL LOCK: Ensure we have exclusive access to this user's wallet
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

      // 4. Upsert wallet
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, availableBalance: decimalAmount },
        update: { availableBalance: { increment: decimalAmount } },
      });

      // 5. Create Ledger entry
      await tx.ledger.create({
        data: {
          userId,
          amount: decimalAmount,
          balanceType: "AVAILABLE",
          type: "TOPUP",
          referenceId: stripeEventId,
          description: `Stripe Top-up: ₹${decimalAmount.toFixed(2)}`,
        },
      });

      console.log(`[Wallet] Credited ₹${decimalAmount.toFixed(2)} to User ${userId}`);
      return wallet;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable 
    });
  },

  /**
   * STAKE LOCK: Move funds from Available -> Locked for a new task.
   * Lock: Uses PESSIMISTIC LOCKING (SELECT FOR UPDATE) to prevent race conditions.
   */
  lockStake: async (userId, contractId, amount) => {
    const decimalAmount = new Decimal(amount);

    return await prisma.$transaction(async (tx) => {
      // 1. PESSIMISTIC LOCK: Lock the wallet row immediately
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet || new Decimal(wallet.availableBalance).lt(decimalAmount)) {
        throw new ApiError(400, "Insufficient wallet balance to stake this amount.");
      }

      // 2. Atomic Update
      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: { decrement: decimalAmount },
          lockedBalance: { increment: decimalAmount },
        },
      });

      // 3. Ledger: Record the lock
      await tx.ledger.create({
        data: {
          userId,
          amount: decimalAmount,
          balanceType: "LOCKED",
          type: "STAKE_LOCK",
          referenceId: contractId,
          description: `Stake locked for Task: ${contractId} (Amount: ₹${decimalAmount.toFixed(2)})`,
        },
      });

      console.log(`[Wallet] Stake of ₹${decimalAmount.toFixed(2)} locked for Contract ${contractId}`);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * SETTLE CONTRACT: Handle final fund distribution.
   * Safety: Implements Deterministic Locking Order to prevent deadlocks.
   */
  settleContract: async (contractId, isApproved) => {
    return await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract || contract.status !== "VALIDATING") {
        throw new ApiError(400, "Contract not found or not in VALIDATING state.");
      }

      const amount = new Decimal(contract.stakeAmount);

      // DEADLOCK PREVENTION: Sort User IDs before locking.
      // Why: If User A and User B settle tasks against each other simultaneously,
      // sorting IDs ensures they always lock in the same sequence (e.g., A then B),
      // which physically prevents the "circular wait" condition of a deadlock.
      const participants = [contract.creatorId, contract.validatorId].sort();
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" IN (${Prisma.join(participants)}) FOR UPDATE`;

      if (isApproved) {
        // SUCCESS: Refund the creator
        await tx.wallet.update({
          where: { userId: contract.creatorId },
          data: {
            lockedBalance: { decrement: amount },
            availableBalance: { increment: amount },
          },
        });

        await tx.ledger.create({
          data: {
            userId: contract.creatorId,
            amount: amount,
            balanceType: "AVAILABLE",
            type: "STAKE_UNLOCK",
            referenceId: contractId,
            description: `Stake returned for approved task: ${contractId} (₹${amount.toFixed(2)})`,
          },
        });
        
        await tx.contract.update({
          where: { id: contractId },
          data: { status: "COMPLETED" },
        });

      } else {
        // FAILURE: Deduct Creator -> Pay Validator + Platform Fee
        const feePercent = new Decimal(process.env.PLATFORM_FEE_PERCENTAGE || "10");
        const platformFee = amount.mul(feePercent).div(100);
        const validatorPayout = amount.sub(platformFee);

        // 1. Deduct full amount from creator
        await tx.wallet.update({
          where: { userId: contract.creatorId },
          data: { lockedBalance: { decrement: amount } },
        });

        // 2. Credit Validator
        await tx.wallet.upsert({
          where: { userId: contract.validatorId },
          create: { userId: contract.validatorId, availableBalance: validatorPayout },
          update: { availableBalance: { increment: validatorPayout } },
        });

        // 3. Ledger: Tri-party split audit trail
        // Why: We split the total stake into two distinct entries for the creator 
        // to ensure the SUM from the ledger matches the Wallet balance exactly.
        await tx.ledger.createMany({
          data: [
            {
              userId: contract.creatorId,
              amount: validatorPayout.negated(),
              balanceType: "LOCKED",
              type: "PENALTY_PAYOUT",
              referenceId: contractId,
              description: `Forfeited to Validator: ₹${validatorPayout.toFixed(2)}`,
            },
            {
              userId: contract.creatorId,
              amount: platformFee.negated(),
              balanceType: "LOCKED",
              type: "PLATFORM_FEE",
              referenceId: contractId,
              description: `Platform Protocol Fee: ₹${platformFee.toFixed(2)}`,
            },
            {
              userId: contract.validatorId,
              amount: validatorPayout,
              balanceType: "AVAILABLE",
              type: "PENALTY_PAYOUT",
              referenceId: contractId,
              description: `Task validator payout received: ₹${validatorPayout.toFixed(2)}`,
            }
          ]
        });

        await tx.contract.update({
          where: { id: contractId },
          data: { status: "REJECTED" },
        });
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * AUDIT: Verify Ledger totals vs Wallet balances.
   */
  getAuditReport: async (userId) => {
    const ledgerSum = await prisma.ledger.aggregate({
      where: { userId },
      _sum: { amount: true }
    });
    
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    const totalLedger = new Decimal(ledgerSum._sum.amount || 0);
    const totalWallet = wallet ? new Decimal(wallet.availableBalance).add(new Decimal(wallet.lockedBalance)) : new Decimal(0);

    return {
      userId,
      ledgerBalance: totalLedger.toFixed(2),
      walletBalance: totalWallet.toFixed(2),
      isConsistent: totalLedger.equals(totalWallet)
    };
  }
};
