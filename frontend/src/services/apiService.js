/**
 * Centralized API Service for FreshCart
 * Handles all HTTP requests to the backend with consistent error handling and authentication
 */

import { auth } from '../firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Get authentication headers (async to get Firebase ID token)
   * @returns {Promise<Object>} Headers object with authorization
   */
  async getAuthHeaders() {
    let token = null;
    try {
      const user = auth.currentUser;
      if (user) {
        token = await user.getIdToken();
      }
    } catch (error) {
      console.error('Error getting Firebase ID token:', error);
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
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(error);
    }

    return data;
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, options = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: { ...headers, ...options.headers },
      ...options
    });
    return this.handleResponse(response);
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data = {}, options = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
      ...options
    });
    return this.handleResponse(response);
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, data = {}, options = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
      ...options
    });
    return this.handleResponse(response);
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, options = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: { ...headers, ...options.headers },
      ...options
    });
    return this.handleResponse(response);
  }

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response data
   */
  async patch(endpoint, data = {}, options = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers: { ...headers, ...options.headers },
      body: JSON.stringify(data),
      ...options
    });
    return this.handleResponse(response);
  }
}

const apiService = new ApiService();
export default apiService;