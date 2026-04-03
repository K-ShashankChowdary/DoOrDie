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

    // Step 1 of payment: Ask the backend to create a Razorpay Order for this contract
    generatePaymentOrder: async (contractId) => {
        const response = await api.post(`/contracts/pay/${contractId}`);
        return response.data;
    },

    // Step 2 of payment: Send Razorpay's callback data to the backend for HMAC verification
    verifyPayment: async (paymentData) => {
        const response = await api.post('/contracts/verify-payment', paymentData);
        return response.data;
    },

    // Used dynamically in CreateTaskModal to search users via the backend
    searchValidators: async (query) => {
        const response = await api.get(`/users/search?query=${query}`);
        return response.data;
    }
};

export default contractService;
