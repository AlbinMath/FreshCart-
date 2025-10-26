import axios from 'axios';

// Centralized authentication service to prevent conflicts
class AuthService {
  constructor() {
    this.isRefreshing = false;
    this.failedQueue = [];
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue the request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axios(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
              throw new Error('No token available for refresh');
            }

            const refreshResponse = await axios.post(
              `${this.getApiBase()}/auth/refresh-token`,
              { token: currentToken },
              { withCredentials: true }
            );

            if (refreshResponse.data?.token) {
              const newToken = refreshResponse.data.token;
              localStorage.setItem('token', newToken);
              
              // Process queued requests
              this.processQueue(null, newToken);
              
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
            throw new Error('No token received from refresh');
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            this.processQueue(refreshError, null);
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  processQueue(error, token = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
    
    this.failedQueue = [];
  }

  handleAuthFailure() {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('remember_me');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('userProfile_') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });

    // Only redirect if not already on login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  getApiBase() {
    const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim();
    const ROOT_URL = RAW_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
    return `${ROOT_URL}/api`;
  }

  // Method to clear auth state (called by logout)
  clearAuthState() {
    this.isRefreshing = false;
    this.failedQueue = [];
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
