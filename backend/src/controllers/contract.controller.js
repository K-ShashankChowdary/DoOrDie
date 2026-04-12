import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import prisma from "../db/prisma.js";
import { walletService } from "../services/wallet.service.js";
import { queueService } from "../services/queue.service.js";
import logger from "../utils/logger.js";
import { Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * 1. CREATE CONTRACT (DRAFT)
 * Why: Creates a task in PENDING_DEPOSIT state. Funds are not yet locked.
 */
const createContract = asyncHandler(async (req, res) => {
    const { title, description, deadline, stakeAmount, validatorId } = req.body;

    if (!title || !deadline || !stakeAmount || !validatorId) {
        throw new ApiError(400, "Missing required fields for contract creation.");
    }

    const contract = await prisma.contract.create({
        data: {
            title,
            description,
            deadline: new Date(deadline),
            stakeAmount: new Prisma.Decimal(stakeAmount),
            creatorId: req.user.id,
            validatorId,
            status: "PENDING_DEPOSIT"
        }
    });

    logger.info("Contract created", { id: contract.id, title, stakeAmount, creator: req.user.id, validator: validatorId, status: "PENDING_DEPOSIT" });

    return res.status(201).json(new ApiResponse(201, { contract }, "Task draft created. Activate it from your dashboard when you’re ready (wallet stake)."));
});

/**
 * 2. ACTIVATE CONTRACT WITH WALLET STAKE
 * Why: Locks stake in wallet and activates task without Stripe task payment flow.
 */
const activateTask = asyncHandler(async (req, res) => {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
        where: { id: contractId }
    });

    if (!contract || contract.creatorId !== req.user.id) {
        throw new ApiError(404, "Contract not found or unauthorized.");
    }

    // Check if user has enough wallet balance
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    const amount = new Prisma.Decimal(contract.stakeAmount);

    if (wallet && new Prisma.Decimal(wallet.availableBalance).gte(amount)) {
        // FAST PATH: If user has enough balance, atomically lock+activate via wallet engine.
        const activatedContract = await walletService.activateContractWithWallet(req.user.id, contract.id);
        const delay = Math.max(0, new Date(activatedContract.deadline).getTime() - Date.now());
        try {
            await queueService.scheduleTaskDeadline(contract.id, delay);
        } catch (error) {
            logger.error("Failed to schedule deadline after activation. Rolling back activation.", {
                contractId: contract.id,
                error: error?.stack || error?.message
            });
            await walletService.rollbackActivation(contract.id);
            throw new ApiError(503, "Temporary queue issue. Please retry activation.");
        }

        logger.info("Stake locked and task activated", { contractId: contract.id, creator: req.user.id, amount: amount.toString(), newStatus: "ACTIVE" });

        return res.status(200).json(new ApiResponse(200, { activated: true, contract: activatedContract }, "Stake locked from wallet balance. Task is now ACTIVE."));
    }

    logger.warn(`Stake failed due to insufficient balance`, { contractId: contract.id, userId: req.user.id });
    return res.status(400).json(new ApiResponse(400, { needsTopUp: true }, "Insufficient wallet balance. Please top up your wallet first."));
});

/**
 * 3. UPLOAD PROOF (CREATOR)
 */
const uploadProof = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const { proofText, proofImages, proofLinks } = req.body;

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract || contract.creatorId !== req.user.id || contract.status !== "ACTIVE") {
        throw new ApiError(400, "Invalid contract state for proof submission.");
    }

    const updatedContract = await prisma.contract.update({
        where: { id: contractId },
        data: {
            proofText,
            proofImages,
            proofLinks,
            status: "VALIDATING"
        }
    });

    // Schedule grace period for validator review (Ghosting Prevention)
    // If they don't review in 24 hours, creator is automatically REFUNDED.
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; 
    await queueService.scheduleGracePeriod(contractId, GRACE_PERIOD_MS);

    logger.info("Proof submitted", { contractId, creator: req.user.id, newStatus: "VALIDATING" });

    return res.status(200).json(new ApiResponse(200, updatedContract, "Proof submitted. Validator has been notified."));
});

/**
 * 4. VERIFY PROOF (VALIDATOR)
 */
const verifyProof = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const { isApproved, approved } = req.body; // Accept both for robustness
    const decision = isApproved !== undefined ? isApproved : approved;

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract || contract.validatorId !== req.user.id || contract.status !== "VALIDATING") {
        throw new ApiError(400, "Invalid contract state for verification.");
    }

    logger.info(`Validator ${decision ? 'APPROVED' : 'REJECTED'} proof`, { contractId, validator: req.user.id, stake: contract.stakeAmount });

    // Use Wallet Engine to settle
    await walletService.settleContract(contract.id, decision);

    logger.info("Settlement complete", { contractId, finalStatus: decision ? 'COMPLETED' : 'REJECTED' });

    return res.status(200).json(new ApiResponse(200, {}, decision ? "Task approved. Stake refunded to creator." : "Task rejected. Stake awarded to you."));
});

const getUserContracts = asyncHandler(async (req, res) => {
    const contracts = await prisma.contract.findMany({
        where: {
            OR: [
                { creatorId: req.user.id },
                { validatorId: req.user.id }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(new ApiResponse(200, { contracts }, "Contracts fetched."));
});

const getContractById = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({
        where: { id: req.params.contractId },
        include: { creator: { select: { fullName: true } }, validator: { select: { fullName: true } } }
    });
    if (!contract) throw new ApiError(404, "Contract not found");
    return res.status(200).json(new ApiResponse(200, contract, "Contract fetched."));
});

const getUploadSignature = asyncHandler(async (req, res) => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        {
            timestamp: timestamp,
            folder: 'doordie_proofs',
        },
        process.env.CLOUDINARY_API_SECRET
    );

    return res.status(200).json(new ApiResponse(200, {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY
    }, "Signature generated."));
});

const deleteContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.contractId } });
    const deletableStatuses = ["PENDING_DEPOSIT", "PENDING_PAYMENT", "COMPLETED", "REJECTED", "FAILED"];
    if (!contract || contract.creatorId !== req.user.id || !deletableStatuses.includes(contract.status)) {
        throw new ApiError(400, "Cannot delete this contract.");
    }
    await prisma.contract.delete({ where: { id: req.params.contractId } });
    return res.status(200).json(new ApiResponse(200, {}, "Contract deleted."));
});

export { 
    createContract, 
    activateTask, 
    uploadProof, 
    verifyProof, 
    getUserContracts, 
    getContractById, 
    getUploadSignature, 
    deleteContract 
};
