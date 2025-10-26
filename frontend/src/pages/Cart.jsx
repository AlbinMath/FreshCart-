import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { calculateDeliveryFee, calculateTotal } from '../../../backend/utils/deliveryUtils';

import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';

function Cart() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingItems, setUpdatingItems] = useState(new Set());

  const userProfile = getUserProfile();

  // Calculate values with frontend fallback
  const subtotal = cart?.subtotal || (cart?.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0);
  
  // Use backend delivery fee if available, otherwise calculate on frontend
  let deliveryFee = cart?.deliveryFee;
  let total = cart?.totalAmount;
  
  // Always calculate on frontend for consistency and as fallback
  const frontendCalculation = calculateTotal(subtotal);
  
  // Use backend values only if they exist and match expected calculation
  // Otherwise, use frontend calculation
  if (deliveryFee === undefined || deliveryFee === null || 
      total === undefined || total === null ||
      (subtotal > 0 && Math.abs(deliveryFee - frontendCalculation.deliveryFee) > 0.01)) {
    deliveryFee = frontendCalculation.deliveryFee;
    total = frontendCalculation.totalAmount;
  }
  
  const savings = cart?.items?.reduce((sum, item) => {
    // Assuming originalPrice is stored in the item or we need to fetch it
    // For now, using a placeholder - in real implementation, you'd have MRP stored
    return sum + (item.price * item.quantity * 0.2); // Assuming 20% savings
  }, 0) || 0;

  // Redirect if not logged in or not a customer
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (userProfile?.role !== 'customer') {
      navigate('/');
      return;
    }
  }, [currentUser, userProfile, navigate]);

  // Fetch cart
  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cart`, {
        headers: {
          'x-uid': currentUser.uid,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.cart);
      } else {
        setError(data.message || 'Failed to fetch cart');
      }
    } catch (err) {
      console.error('Error fetching cart:', err);
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && userProfile?.role === 'customer') {
      fetchCart();
    }
  }, [currentUser, userProfile]);

  // Update item quantity
  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;

    setUpdatingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cart/update/${itemId}`, {
        method: 'PUT',
        headers: {
          'x-uid': currentUser.uid,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity: newQuantity })
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.cart);
      } else {
        setError(data.message || 'Failed to update quantity');
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
      setError('Failed to update quantity');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // Remove item from cart
  const removeItem = async (itemId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cart/remove/${itemId}`, {
        method: 'DELETE',
        headers: {
          'x-uid': currentUser.uid,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.cart);
      } else {
        setError(data.message || 'Failed to remove item');
      }
    } catch (err) {
      console.error('Error removing item:', err);
      setError('Failed to remove item');
    }
  };

  // Clear cart
  const clearCart = async () => {
    if (!confirm('Are you sure you want to clear your entire cart?')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cart/clear`, {
        method: 'DELETE',
        headers: {
          'x-uid': currentUser.uid,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setCart({
          customerUid: currentUser.uid,
          items: [],
          totalAmount: 0,
          itemCount: 0
        });
      } else {
        setError(data.message || 'Failed to clear cart');
      }
    } catch (err) {
      console.error('Error clearing cart:', err);
      setError('Failed to clear cart');
    }
  };



  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  if (!currentUser || userProfile?.role !== 'customer') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </button>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <ShoppingBag className="mr-3 text-green-600" />
              Your Cart ({cart?.itemCount || 0} items)
            </h1>
            {cart && cart.items.length > 0 && (
              <button
                onClick={clearCart}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Clear Cart
              </button>
            )}
          </div>

          { !cart || cart.items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-600 mb-2">Your cart is empty</h2>
              <p className="text-gray-500 mb-6">Add some fresh products to get started!</p>
              <Link
                to="/"
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cart.items.map((item) => (
                  <div key={item._id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-gray-400 text-2xl">📦</span>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{item.productName}</h3>
                            <p className="text-sm text-gray-500">{item.category}</p>
                          </div>
                          <button
                            onClick={() => removeItem(item._id)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-green-600 text-lg">{formatPrice(item.price)}</span>
                            <span className="text-sm text-gray-500 line-through">
                              {formatPrice(item.price * 1.2)} {/* Assuming MRP is 20% higher */}
                            </span>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item._id, item.quantity - 1)}
                              disabled={updatingItems.has(item._id)}
                              className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <span className="w-8 text-center font-medium">
                              {updatingItems.has(item._id) ? '...' : item.quantity}
                            </span>

                            <button
                              onClick={() => updateQuantity(item._id, item.quantity + 1)}
                              disabled={updatingItems.has(item._id)}
                              className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Item Total */}
                          <div className="text-right">
                            <div className="font-semibold text-lg">{formatPrice(item.price * item.quantity)}</div>
                            {item.quantity > 1 && (
                              <div className="text-xs text-gray-500">
                                ({formatPrice(item.price)} each)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal ({cart.itemCount} items)</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-green-600">
                      <span>You saved</span>
                      <span>-{formatPrice(savings)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Fee</span>
                      <span className={deliveryFee === 0 ? "text-green-600 font-medium" : "font-medium"}>
                        {deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
                      </span>
                    </div>

                    {/* Delivery Fee Breakdown */}
                    {subtotal > 0 && (
                      <div className="text-xs bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        {deliveryFee === 0 ? (
                          <div className="text-green-700">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-green-600">🎉</span>
                              <span className="font-medium">FREE Delivery!</span>
                            </div>
                            <span>Orders ≥ ₹500 qualify for free delivery</span>
                          </div>
                        ) : (
                          <div className="text-blue-700">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-blue-600">📦</span>
                              <span className="font-medium">Delivery Fee Calculation:</span>
                            </div>
                            <div className="space-y-1">
                              <div>
                                Current slab: {
                                  subtotal <= 200 ? "₹1-₹200 (40%)" :
                                  subtotal <= 400 ? "₹201-₹400 (20%)" :
                                  subtotal <= 499 ? "₹401-₹499 (10%)" : "₹500+ (FREE)"
                                }
                              </div>
                              <div>
                                Calculation: ₹{subtotal} × {
                                  subtotal <= 200 ? "40%" :
                                  subtotal <= 400 ? "20%" :
                                  subtotal <= 499 ? "10%" : "0%"
                                } = ₹{deliveryFee}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {deliveryFee > 0 && subtotal < 500 && (
                      <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                        💡 Add {formatPrice(500 - subtotal)} more for free delivery
                      </div>
                    )}

                    <hr className="my-3" />

                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="text-green-600">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/address-confirmation', { state: { cartItems: cart.items, subtotal, deliveryFee, totalAmount: total } })}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    Proceed to Checkout
                  </button>

                  {/* Delivery Fee Structure */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">📋 Delivery Fee Structure</h3>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>₹1 - ₹200:</span>
                        <span className="font-medium">40% of subtotal</span>
                      </div>
                      <div className="flex justify-between">
                        <span>₹201 - ₹400:</span>
                        <span className="font-medium">20% of subtotal</span>
                      </div>
                      <div className="flex justify-between">
                        <span>₹401 - ₹499:</span>
                        <span className="font-medium">10% of subtotal</span>
                      </div>
                      <div className="flex justify-between">
                        <span>₹500+:</span>
                        <span className="font-medium text-green-600">FREE Delivery</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-center text-sm text-gray-600">
                    🌱 Fresh products delivered in 30 minutes
                  </div>

                  {/* Debug Info - Remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 text-xs text-gray-400 bg-gray-100 p-2 rounded">
                      <div>Debug Info:</div>
                      <div>Subtotal: ₹{subtotal}</div>
                      <div>Backend Fee: ₹{cart?.deliveryFee ?? 'N/A'} | Backend Total: ₹{cart?.totalAmount ?? 'N/A'}</div>
                      <div>Frontend Fee: ₹{frontendCalculation.deliveryFee} | Frontend Total: ₹{frontendCalculation.totalAmount}</div>
                      <div>Used Fee: ₹{deliveryFee} | Used Total: ₹{total}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Cart;