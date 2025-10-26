import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../../../../backend/services/apiService';

const OrderProcessingPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(null);

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    try {
      const response = await apiService.get(`/orders/seller/pending/${currentUser.uid}`);
      if (response.success) {
        setOrders(response.orders);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      toast.error('Failed to fetch pending orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // Redirect if not seller
    if (currentUser.role !== 'seller') {
      navigate('/');
      return;
    }

    fetchPendingOrders();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchPendingOrders, 10000);

    return () => clearInterval(interval);
  }, [currentUser, navigate]);

  const handleAcceptOrder = async (orderId) => {
    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/accept/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order accepted successfully!');
        fetchPendingOrders(); // Refresh list
      } else {
        toast.error(response.message || 'Failed to accept order');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error('Failed to accept order');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId) => {
    setProcessingOrder(orderId);
    try {
      const response = await apiService.put(`/orders/seller/reject/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order rejected successfully!');
        fetchPendingOrders(); // Refresh list
      } else {
        toast.error(response.message || 'Failed to reject order');
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Failed to reject order');
    } finally {
      setProcessingOrder(null);
    }
  };

  const isDeadlinePassed = (deadline) => {
    return new Date() > new Date(deadline);
  };

  const getTimeRemaining = (deadline) => {
    const remaining = new Date(deadline) - new Date();
    if (remaining <= 0) return 'Expired';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Order Processing
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review and accept or reject incoming orders
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => navigate('/seller')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="mt-8 text-center">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending orders</h3>
              <p className="mt-1 text-sm text-gray-500">All caught up! New orders will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {orders.map((order) => (
              <div key={order.orderId} className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Order #{order.orderId}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Placed on {new Date(order.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Time remaining</div>
                      <div className={`text-lg font-semibold ${isDeadlinePassed(order.sellerApprovalDeadline) ? 'text-red-600' : 'text-green-600'}`}>
                        {getTimeRemaining(order.sellerApprovalDeadline)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Order Items */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Order Items</h4>
                      <div className="space-y-4">
                        {order.products.map((product, index) => (
                          <div key={index} className="flex items-center space-x-4">
                            <img
                              src={product.image || '/placeholder-product.jpg'}
                              alt={product.name}
                              className="h-16 w-16 object-cover rounded-lg"
                            />
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-gray-900">{product.name}</h5>
                              <p className="text-sm text-gray-500">
                                Quantity: {product.quantity} × ₹{product.price}
                              </p>
                              <p className="text-sm font-medium text-gray-900">
                                Subtotal: ₹{(product.quantity * product.price).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Details */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Order Details</h4>
                      <dl className="space-y-3">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Subtotal</dt>
                          <dd className="text-sm font-medium text-gray-900">₹{order.subtotal.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Delivery Fee</dt>
                          <dd className="text-sm font-medium text-gray-900">₹{order.deliveryFee.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                          <dt className="text-sm font-medium text-gray-900">Total</dt>
                          <dd className="text-sm font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Payment Method</dt>
                          <dd className="text-sm font-medium text-gray-900">{order.paymentMethod}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Payment Status</dt>
                          <dd className={`text-sm font-medium ${
                            order.paymentStatus === 'paid' ? 'text-green-600' :
                            order.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {order.paymentStatus === 'paid' ? 'Paid' :
                             order.paymentStatus === 'pending' ? 'Pending' : 'Failed'}
                          </dd>
                        </div>
                      </dl>

                      {/* Delivery Address */}
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-900 mb-2">Delivery Address</h5>
                        <div className="text-sm text-gray-600">
                          <p>{order.deliveryAddress.name}</p>
                          <p>{order.deliveryAddress.house}, {order.deliveryAddress.street}</p>
                          <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}</p>
                          <p>{order.deliveryAddress.country}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {!isDeadlinePassed(order.sellerApprovalDeadline) && (
                  <div className="px-4 py-4 bg-gray-50 text-right sm:px-6 flex justify-end space-x-3">
                    <button
                      onClick={() => handleRejectOrder(order.orderId)}
                      disabled={processingOrder === order.orderId}
                      className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {processingOrder === order.orderId ? 'Processing...' : 'Reject Order'}
                    </button>
                    <button
                      onClick={() => handleAcceptOrder(order.orderId)}
                      disabled={processingOrder === order.orderId}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {processingOrder === order.orderId ? 'Processing...' : 'Accept Order'}
                    </button>
                  </div>
                )}

                {isDeadlinePassed(order.sellerApprovalDeadline) && (
                  <div className="px-4 py-4 bg-red-50 text-center sm:px-6">
                    <p className="text-sm text-red-600 font-medium">
                      Approval deadline has passed. This order will be auto-rejected.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderProcessingPage;