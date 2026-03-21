import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Contract } from "../models/contract.model.js";
import { User } from "../models/user.model.js";

const createContract = asyncHandler(async (req, res) => {
    const { title, description, deadline, stakeAmount, validatorId } = req.body;

    // 1. Validate incoming data
    if (!title || !deadline || !stakeAmount || !validatorId) {
        throw new ApiError(400, "Title, deadline, stake amount, and validator are required");
    }

    if (stakeAmount < 50) {
        throw new ApiError(400, "Minimum stake amount is ₹50");
    }

    // 2. Ensure the validator actually exists in the database
    const validatorExists = await User.findById(validatorId);
    if (!validatorExists) {
        throw new ApiError(404, "Validator not found in the system");
    }

    // 3. Prevent users from validating their own contracts (No cheating)
    if (req.user._id.toString() === validatorId) {
        throw new ApiError(400, "You cannot be the validator for your own contract");
    }

    // 4. Create the contract in the database
    const contract = await Contract.create({
        title,
        description: description || "",
        deadline,
        stakeAmount,
        creator: req.user._id, 
        validator: validatorId,
        status: "PENDING_PAYMENT" // Default state
    });

    if (!contract) {
        throw new ApiError(500, "Failed to create the contract");
    }

    return res.status(201).json(
        new ApiResponse(201, contract, "Contract drafted successfully. Ready for payment.")
    );
});

export { createContract };