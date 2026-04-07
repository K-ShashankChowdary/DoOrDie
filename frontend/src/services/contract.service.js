import api from './api';

const contractService = {
    // Return all contracts mapping to the current authenticated user (creator/validator)
    getUserContracts: async () => {
        const response = await api.get('/contracts');
        return response.data;
    },

    // View specific contract status
    getContractById: async (contractId) => {
        const response = await api.get(`/contracts/${contractId}`);
        return response.data;
    },

    // Draft a new contract, pushing it into the PENDING_PAYMENT state
    createContract: async (contractData) => {
        const response = await api.post('/contracts/new', contractData);
        return response.data;
    },

    // Step 1 of payment: Create a new task and get a Stripe PaymentIntent client_secret
    startTask: async (taskData) => {
        const response = await api.post('/tasks/start', taskData);
        return response.data;
    },

    // Get Cloudinary signed validation data for secure uploads
    getUploadSignature: async () => {
        const response = await api.get('/contracts/upload-signature');
        return response.data;
    },

    // Submit Proof (images, links, text)
    uploadProof: async (contractId, proofData) => {
        const response = await api.post(`/contracts/${contractId}/upload-proof`, proofData);
        return response.data;
    },

    // Used dynamically in CreateTaskModal to search users via the backend
    searchValidators: async (query) => {
        const response = await api.get(`/users/search?query=${query}`);
        return response.data;
    },

    // Accept or reject the proof (Validator only)
    verifyProof: async (contractId, approvalData) => {
        const response = await api.post(`/contracts/${contractId}/verify-proof`, approvalData);
        return response.data;
    }
};

export default contractService;
