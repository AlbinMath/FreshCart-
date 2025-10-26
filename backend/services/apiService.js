/**
 * Centralized API Service for FreshCart
 * Handles all HTTP requests to the backend with consistent error handling and authentication
 */

import { auth } from '../../frontend/src/firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Wait for Firebase auth to be ready
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @returns {Promise<Object|null>} Firebase user or null
   */
  async waitForAuth(maxWaitTime = 2000) {
    const startTime = Date.now();
    
    // If user is already available, return immediately
    if (auth.currentUser) {
      return auth.currentUser;
    }
    
    // Wait for auth state to be ready
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
      
      // Timeout fallback
      setTimeout(() => {
        unsubscribe();
        resolve(auth.currentUser);
      }, maxWaitTime);
    });
  }

  /**
   * Get authentication headers (async to get Firebase ID token)
   * @returns {Promise<Object>} Headers object with authorization
   * @throws {Error} If user is not authenticated
   */
  async getAuthHeaders() {
    let token = null;
    try {
      // Wait for auth to be ready (with timeout)
      const user = await this.waitForAuth(2000);
      
      if (!user) {
        const error = new Error('User not authenticated');
        error.isAuthError = true;
        error.status = 401;
        throw error;
      }
      
      // Get fresh token (will auto-refresh if expired)
      token = await user.getIdToken(false); // false = don't force refresh unless expired
      
      if (!token) {
        const error = new Error('Failed to get authentication token');
        error.isAuthError = true;
        error.status = 401;
        throw error;
      }
    } catch (error) {
      // Don't log auth errors to console (they're expected during initialization)
      if (!error.isAuthError) {
        console.error('Error getting Firebase ID token:', error);
      }
      throw error; // Re-throw to let caller handle it
    }
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Get headers with UID
   * @param {string} uid - User ID
   * @returns {Object} Headers object with UID
   */
  getUidHeaders(uid) {
    return {
      'Content-Type': 'application/json',
      'x-uid': uid
    };
  }

  /**
   * Handle API response
   * @param {Response} response - Fetch response
   * @returns {Promise<Object>} Parsed response data
   */
  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      // Create a more specific error for 401 Unauthorized
      if (response.status === 401) {
        const error = new Error(data.message || 'Unauthorized');
        error.status = 401;
        error.isAuthError = true;
        throw error;
      }
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  }

  /**
   * Make GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      ...options
    });

    return this.handleResponse(response);
  }

  /**
   * Make POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data = {}, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
      ...options
    });

    return this.handleResponse(response);
  }

  /**
   * Make PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, data = {}, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
      ...options
    });

    return this.handleResponse(response);
  }

  /**
   * Make DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
      credentials: 'include',
      ...options
    });

    return this.handleResponse(response);
  }

  /**
   * Make request with UID header
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {string} uid - User ID
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} Response data
   */
  async requestWithUid(method, endpoint, uid, data = null) {
    const options = {
      method: method.toUpperCase(),
      headers: this.getUidHeaders(uid),
      credentials: 'include'
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    return this.handleResponse(response);
  }

  /**
   * Upload file
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with file
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async uploadFile(endpoint, formData, options = {}) {
    const authHeaders = await this.getAuthHeaders();
    const headers = {};

    if (authHeaders.Authorization) {
      headers['Authorization'] = authHeaders.Authorization;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
      ...options
    });

    return this.handleResponse(response);
  }
}

// Create and export singleton instance
export const apiService = new ApiService();
export default apiService;