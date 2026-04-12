import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// ============================================================================
// The Virtual Wallet Engine (Shadow Ledger)
// ============================================================================
// Why: All financial mutations MUST happen inside isolated Prisma transactions
// to maintain ACID compliance and prevent race conditions.
const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

/** Keep DB-friendly length; full detail stays in ledger description. */
const truncateReason = (s, max = 2000) => {
  if (s == null || typeof s !== "string") return s;
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
};

export const walletService = {
  /**
   * TOP-UP: Credits user wallet after a successful Stripe deposit.
   * Why: Uses StripeEvent idempotency and transaction isolation.
   */
  topUpUser: async (userId, amount, stripeEventId, stripeEventType = "checkout.session.completed") => {
    const decimalAmount = new Decimal(amount);

    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      const existingEvent = await tx.stripeEvent.findUnique({
        where: { id: stripeEventId },
      });

      if (existingEvent) {
        logger.warn(`[Wallet] StripeEvent ${stripeEventId} already processed.`);
        return;
      }

      // 2. Mark event as processed early (idempotency safety)
      await tx.stripeEvent.create({
        data: { id: stripeEventId, type: stripeEventType },
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

      logger.info(`[Wallet] Credited ₹${decimalAmount.toFixed(2)} to User ${userId}`);
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
    if (decimalAmount.lte(ZERO)) {
      throw new ApiError(400, "Stake amount must be greater than zero.");
    }

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

      const refreshedWallet = await tx.wallet.findUnique({ where: { userId } });
      if (!refreshedWallet) {
        throw new ApiError(500, "Wallet not found after stake lock.");
      }
      if (new Decimal(refreshedWallet.availableBalance).lt(ZERO) || new Decimal(refreshedWallet.lockedBalance).lt(ZERO)) {
        throw new ApiError(500, "Wallet invariant violation after stake lock.");
      }

      logger.info(`[Wallet] Stake of ₹${decimalAmount.toFixed(2)} locked for Contract ${contractId}`);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * ACTIVATION: Atomically lock creator stake and activate contract.
   * Why: Prevents partial state where funds are locked but contract is not ACTIVE.
   */
  activateContractWithWallet: async (userId, contractId) => {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT * FROM "Contract" WHERE "id" = ${contractId} FOR UPDATE`;
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract || contract.creatorId !== userId) {
        throw new ApiError(404, "Contract not found or unauthorized.");
      }
      if (contract.status !== "PENDING_DEPOSIT") {
        throw new ApiError(409, `Contract cannot be activated from ${contract.status} state.`);
      }

      const amount = new Decimal(contract.stakeAmount);
      if (amount.lte(ZERO)) {
        throw new ApiError(400, "Stake amount must be greater than zero.");
      }

      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || new Decimal(wallet.availableBalance).lt(amount)) {
        throw new ApiError(400, "Insufficient wallet balance to stake this amount.");
      }

      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: { decrement: amount },
          lockedBalance: { increment: amount },
        },
      });

      await tx.ledger.create({
        data: {
          userId,
          amount,
          balanceType: "LOCKED",
          type: "STAKE_LOCK",
          referenceId: contractId,
          description: `Stake locked for Task: ${contractId} (Amount: ₹${amount.toFixed(2)})`,
        },
      });

      const activatedContract = await tx.contract.update({
        where: { id: contractId },
        data: { status: "ACTIVE" },
      });

      return activatedContract;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * COMPENSATION: Revert activation when downstream scheduling fails.
   */
  rollbackActivation: async (contractId) => {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT * FROM "Contract" WHERE "id" = ${contractId} FOR UPDATE`;
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract || contract.status !== "ACTIVE") {
        return null;
      }

      const amount = new Decimal(contract.stakeAmount);
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${contract.creatorId} FOR UPDATE`;
      const creatorWallet = await tx.wallet.findUnique({ where: { userId: contract.creatorId } });
      if (!creatorWallet || new Decimal(creatorWallet.lockedBalance).lt(amount)) {
        throw new ApiError(500, "Cannot rollback activation due to missing locked funds.");
      }

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
          amount,
          balanceType: "AVAILABLE",
          type: "STAKE_UNLOCK",
          referenceId: contractId,
          description: `Activation rollback for Task: ${contractId} (Amount: ₹${amount.toFixed(2)})`,
        },
      });

      return await tx.contract.update({
        where: { id: contractId },
        data: { status: "PENDING_DEPOSIT" },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * WITHDRAWAL RESERVE: Move funds Available → Locked until Stripe transfer settles.
   * Why: Wallet "available" only drops when payout is confirmed (see completeWithdrawalById).
   */
  reserveWithdrawal: async (userId, amount) => {
    const decimalAmount = new Decimal(amount);
    if (decimalAmount.lte(ZERO)) {
      throw new ApiError(400, "Withdrawal amount must be greater than zero.");
    }

    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || new Decimal(wallet.availableBalance).lt(decimalAmount)) {
        throw new ApiError(400, "Insufficient available balance for withdrawal.");
      }

      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: { decrement: decimalAmount },
          lockedBalance: { increment: decimalAmount },
        },
      });

      const withdrawal = await tx.withdrawal.create({
        data: { userId, amount: decimalAmount, status: "PENDING" },
      });

      await tx.ledger.create({
        data: {
          userId,
          amount: decimalAmount,
          balanceType: "LOCKED",
          type: "STAKE_LOCK",
          referenceId: withdrawal.id,
          description: `Withdrawal held — pending Stripe payout (₹${decimalAmount.toFixed(2)})`,
        },
      });
      return withdrawal;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  attachTransferToWithdrawal: async (withdrawalId, stripeTransferId) => {
    return await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { stripeTransferId },
    });
  },

  completeWithdrawalById: async (withdrawalId) => {
    if (!withdrawalId) return;
    await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) return;
      if (withdrawal.status === "COMPLETED" || withdrawal.status === "FAILED") return;

      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${withdrawal.userId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
      if (!wallet) return;

      const amt = new Decimal(withdrawal.amount);
      const locked = new Decimal(wallet.lockedBalance);

      if (locked.gte(amt)) {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: { lockedBalance: { decrement: amt } },
        });
        await tx.ledger.create({
          data: {
            userId: withdrawal.userId,
            amount: amt.negated(),
            balanceType: "LOCKED",
            type: "WITHDRAWAL",
            referenceId: withdrawal.id,
            description: `Withdrawal completed — sent to bank (₹${amt.toFixed(2)})`,
          },
        });
      }
      // Legacy: older reserves debited available only; funds already left — only flip status.

      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "COMPLETED", failureReason: null },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  completeWithdrawalByTransferId: async (stripeTransferId) => {
    if (!stripeTransferId) return;
    const withdrawal = await prisma.withdrawal.findUnique({ where: { stripeTransferId } });
    if (!withdrawal || withdrawal.status === "COMPLETED" || withdrawal.status === "FAILED") {
      return;
    }
    await walletService.completeWithdrawalById(withdrawal.id);
  },

  failWithdrawalAndRefund: async (withdrawalId, reason = "Transfer failed") => {
    if (!withdrawalId) return;
    const safeReason = truncateReason(String(reason || "Transfer failed"));
    await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal || withdrawal.status === "FAILED") {
        return;
      }
      if (withdrawal.status === "COMPLETED") {
        throw new ApiError(409, "Cannot fail a completed withdrawal.");
      }

      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${withdrawal.userId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
      if (!wallet) return;

      const amt = new Decimal(withdrawal.amount);
      const locked = new Decimal(wallet.lockedBalance);

      if (locked.gte(amt)) {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: {
            lockedBalance: { decrement: amt },
            availableBalance: { increment: amt },
          },
        });
        await tx.ledger.create({
          data: {
            userId: withdrawal.userId,
            amount: amt,
            balanceType: "AVAILABLE",
            type: "STAKE_UNLOCK",
            referenceId: withdrawal.id,
            description: `Withdrawal cancelled — returned to wallet (${safeReason})`,
          },
        });
      } else {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: { availableBalance: { increment: withdrawal.amount } },
        });
        await tx.ledger.create({
          data: {
            userId: withdrawal.userId,
            amount: withdrawal.amount,
            balanceType: "AVAILABLE",
            type: "WITHDRAWAL",
            referenceId: withdrawal.id,
            description: `Withdrawal refund: ${safeReason}`,
          },
        });
      }

      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "FAILED", failureReason: safeReason },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  failWithdrawalByTransferId: async (stripeTransferId, reason = "Transfer failed") => {
    if (!stripeTransferId) return;
    const withdrawal = await prisma.withdrawal.findUnique({ where: { stripeTransferId } });
    if (!withdrawal) return;
    await walletService.failWithdrawalAndRefund(withdrawal.id, reason);
  },

  failWithdrawalById: async (withdrawalId, reason = "Transfer failed") => {
    if (!withdrawalId) return;
    await walletService.failWithdrawalAndRefund(withdrawalId, reason);
  },

  /**
   * SETTLE CONTRACT: Handle final fund distribution.
   * Safety: Implements Deterministic Locking Order to prevent deadlocks.
   */
  settleContract: async (contractId, isApproved) => {
    return await prisma.$transaction(async (tx) => {
      // Lock contract row first to serialize concurrent settlement attempts.
      await tx.$executeRaw`SELECT * FROM "Contract" WHERE "id" = ${contractId} FOR UPDATE`;
      const contract = await tx.contract.findUnique({ where: { id: contractId } });

      if (!contract) {
        throw new ApiError(404, "Contract not found.");
      }
      if (contract.status !== "VALIDATING") {
        throw new ApiError(409, `Settlement skipped. Contract is in ${contract.status} state.`);
      }

      const amount = new Decimal(contract.stakeAmount);
      if (amount.lte(ZERO)) {
        throw new ApiError(500, "Contract stake must be positive.");
      }

      // DEADLOCK PREVENTION: Sort User IDs before locking.
      // Why: If User A and User B settle tasks against each other simultaneously,
      // sorting IDs ensures they always lock in the same sequence (e.g., A then B),
      // which physically prevents the "circular wait" condition of a deadlock.
      const participants = [contract.creatorId, contract.validatorId].sort();
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" IN (${Prisma.join(participants)}) FOR UPDATE`;

      const creatorWallet = await tx.wallet.findUnique({ where: { userId: contract.creatorId } });
      if (!creatorWallet) {
        throw new ApiError(500, "Creator wallet not found for settlement.");
      }
      if (new Decimal(creatorWallet.lockedBalance).lt(amount)) {
        throw new ApiError(409, "Settlement skipped due to insufficient locked stake.");
      }

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

      const auditWallets = await tx.wallet.findMany({
        where: { userId: { in: participants } },
      });
      for (const wallet of auditWallets) {
        if (new Decimal(wallet.availableBalance).lt(ZERO) || new Decimal(wallet.lockedBalance).lt(ZERO)) {
          throw new ApiError(500, `Wallet invariant violation for user ${wallet.userId}.`);
        }
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  },

  /**
   * DEMO: Instant credit (no payment processor — portfolio / local demo).
   */
  demoCreditWallet: async (userId, amount) => {
    const decimalAmount = new Decimal(amount);
    if (decimalAmount.lte(ZERO)) {
      throw new ApiError(400, "Amount must be positive.");
    }
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
      await tx.wallet.upsert({
        where: { userId },
        create: { userId, availableBalance: decimalAmount },
        update: { availableBalance: { increment: decimalAmount } },
      });
      const ref = `demo-topup-${Date.now()}`;
      await tx.ledger.create({
        data: {
          userId,
          amount: decimalAmount,
          balanceType: "AVAILABLE",
          type: "TOPUP",
          referenceId: ref,
          description: `Demo top-up: ₹${decimalAmount.toFixed(2)}`,
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  },

  /**
   * DEMO: Instant withdrawal — debits available, records COMPLETED withdrawal.
   */
  demoWithdraw: async (userId, amount) => {
    const decimalAmount = new Decimal(amount);
    if (decimalAmount.lte(ZERO)) {
      throw new ApiError(400, "Amount must be positive.");
    }
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || new Decimal(wallet.availableBalance).lt(decimalAmount)) {
        throw new ApiError(400, "Insufficient available balance.");
      }
      await tx.wallet.update({
        where: { userId },
        data: { availableBalance: { decrement: decimalAmount } },
      });
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amount: decimalAmount,
          status: "COMPLETED",
        },
      });
      await tx.ledger.create({
        data: {
          userId,
          amount: decimalAmount.negated(),
          balanceType: "AVAILABLE",
          type: "WITHDRAWAL",
          referenceId: withdrawal.id,
          description: `Demo withdrawal: ₹${decimalAmount.toFixed(2)}`,
        },
      });
      return withdrawal;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
