import { apiService } from './apiService.js';

export const orderService = {
  // Create order
  createOrder: async (orderData) => {
    return await apiService.post('/orders/create', orderData);
  },

  // Verify Razorpay payment
  verifyPayment: async (paymentData) => {
    return await apiService.post('/orders/verify-payment', paymentData);
  },

  // Get order status
  getOrderStatus: async (orderId) => {
    return await apiService.get(`/orders/status/${orderId}`);
  },

  // Get user orders
  getUserOrders: async (userId) => {
    return await apiService.get(`/orders/list/${userId}`);
  },

  // Cancel order
  cancelOrder: async (orderId, userId) => {
    return await apiService.put(`/orders/cancel/${orderId}`, { userId });
  }
};