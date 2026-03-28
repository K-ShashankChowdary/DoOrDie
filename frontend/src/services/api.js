import axios from 'axios';

// Setting up my base Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    withCredentials: true, // Need this so the browser sends/receives my httpOnly cookies
});

// Request interceptor - keeping it here in case I need to attach extra headers later
api.interceptors.request.use(
    (config) => {
        // I could add an Authorization header here if I switch to Bearer tokens,
        // but since I'm relying on httpOnly cookies for auth, the browser
        // just sends the credentials automatically for me.
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Flag to stop multiple simultaneous refresh requests
let isRefreshing = false;
// Queue for requests that have to wait while the token refreshes
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Response interceptor to catch 401 Unauthorized errors (when my token expires)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If the error is 401, not a retry, and I have a valid request config
        // Also making sure I don't intercept my auth endpoints so I don't cause an infinite loop
        if (
            error.response &&
            error.response.status === 401 &&
            !originalRequest._retry &&
            originalRequest.url !== '/users/refresh-token' &&
            originalRequest.url !== '/users/login' &&
            originalRequest.url !== '/users/signup'
        ) {
            
            if (isRefreshing) {
                // If a refresh is already happening, just queue this request up
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                .then(() => {
                    return api(originalRequest);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Hit the backend to get a new access token
                // Since I'm using the 'api' instance here, it automatically sends the refresh cookie
                await api.post('/users/refresh-token');
                
                // Token refreshed correctly, process the backed-up queue
                processQueue(null);
                
                // Finally, retry the original request that failed
                return api(originalRequest);
                
            } catch (refreshError) {
                // If the refresh token is also invalid/expired, reject everything
                processQueue(refreshError, null);
                
                // Might want to add a custom event dispatch here later to force logout across the UI
                // window.dispatchEvent(new Event('auth:unauthorized'));
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
