const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const paymentService = {
  // Create Razorpay order
  createOrder: async (amount, uid) => {
    const response = await fetch(`${API_BASE_URL}/payment/create-order`, {
      method: 'POST',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });
    return response.json();
  },

  // Verify payment success
  verifyPayment: async (paymentData, uid) => {
    const response = await fetch(`${API_BASE_URL}/payment/payment-success`, {
      method: 'POST',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    return response.json();
  },

  // Record payment failure
  recordPaymentFailure: async (failureData, uid) => {
    const response = await fetch(`${API_BASE_URL}/payment/payment-failed`, {
      method: 'POST',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(failureData)
    });
    return response.json();
  },

  // Get payment history
  getPaymentHistory: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/payment/history`, {
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },

  // Place order (for COD or after payment)
  placeOrder: async (orderData, uid) => {
    const response = await fetch(`${API_BASE_URL}/orders/place`, {
      method: 'POST',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    return response.json();
  }
};