import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        // Skip retry logic if the auth endpoints themselves fail
        if (
            error.response?.status === 401 && 
            !originalRequest._retry && 
            !originalRequest.url.includes('/users/refresh-token') &&
            !originalRequest.url.includes('/users/login')
        ) {
            originalRequest._retry = true;
            try {
                await api.post('/users/refresh-token');
                // Retry the original request with new cookies provided by the browser
                return api(originalRequest);
            } catch (err) {
                // Refresh failed; let the UI AuthContext handle the redirect if needed
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
