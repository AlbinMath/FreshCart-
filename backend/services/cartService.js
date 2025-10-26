const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const cartService = {
  // Get customer's cart
  getCart: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/cart`, {
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch cart');
    }
    return data.cart;
  },

  // Add item to cart
  addToCart: async (uid, productData) => {
    const response = await fetch(`${API_BASE_URL}/cart/add`, {
      method: 'POST',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to add item to cart');
    }
    return data.cart;
  },

  // Update cart item quantity
  updateCartItem: async (uid, itemId, quantity) => {
    const response = await fetch(`${API_BASE_URL}/cart/update/${itemId}`, {
      method: 'PUT',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update cart item');
    }
    return data.cart;
  },

  // Remove item from cart
  removeFromCart: async (uid, itemId) => {
    const response = await fetch(`${API_BASE_URL}/cart/remove/${itemId}`, {
      method: 'DELETE',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to remove item from cart');
    }
    return data.cart;
  },

  // Clear cart
  clearCart: async (uid) => {
    const response = await fetch(`${API_BASE_URL}/cart/clear`, {
      method: 'DELETE',
      headers: {
        'x-uid': uid,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to clear cart');
    }
    return data;
  }
};