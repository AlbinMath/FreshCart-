import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/apiService";

const OrderHistoryPage = () => {
  const { currentUser, getUserProfile } = useAuth();
  const profile = getUserProfile();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, delivered, cancelled
  
  // Wallet balance state
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Withdrawal request state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalMessage, setWithdrawalMessage] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [withdrawalStats, setWithdrawalStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
    totalWithdrawn: 0,
    totalPending: 0
  });
  const [showWithdrawalHistory, setShowWithdrawalHistory] = useState(false);

  // Load wallet balance
  const loadWalletBalance = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      setLoadingWallet(true);
      const response = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/wallet`, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWalletBalance(data.balance || 0);
      } else {
        console.error('Failed to load wallet balance:', data.message);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading wallet balance:', error);
      }
    } finally {
      setLoadingWallet(false);
    }
  }, [currentUser]);

  // Fetch order history
  const fetchOrderHistory = useCallback(async () => {
    if (!currentUser?.uid) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      // Get all orders for the seller, including delivered and cancelled ones
      const response = await apiService.get(`/orders/seller/${currentUser.uid}/history`);
      
      if (response.success) {
        setOrders(response.orders || []);
      } else {
        setError(response.message || "Failed to fetch order history");
      }
    } catch (err) {
      console.error("Error fetching order history:", err);
      setError("Failed to fetch order history");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const cancelled = orders.filter(o => o.status === 'Cancelled');
    
    // Calculate total earnings from delivered orders (subtotal only, delivery fee goes to platform/delivery partner)
    const totalEarnings = delivered.reduce((sum, order) => sum + (order.subtotal || 0), 0);
    
    // Calculate available balance: Total Earnings - Total Withdrawn (approved by admin)
    const availableBalance = totalEarnings - (withdrawalStats.totalWithdrawn || 0);
    
    // Calculate total items sold
    const totalItemsSold = delivered.reduce((sum, order) => {
      return sum + (order.products?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
    }, 0);
    
    // Get unique products sold
    const productsSoldMap = new Map();
    delivered.forEach(order => {
      order.products?.forEach(item => {
        const existing = productsSoldMap.get(item.id) || { name: item.name, quantity: 0, earnings: 0 };
        existing.quantity += item.quantity;
        existing.earnings += item.price * item.quantity;
        productsSoldMap.set(item.id, existing);
      });
    });
    
    const topProducts = Array.from(productsSoldMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    
    return {
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      totalEarnings, // Total earned from all delivered orders
      walletBalance: availableBalance, // Available balance = Total Earnings - Total Withdrawn
      totalWithdrawn: withdrawalStats.totalWithdrawn || 0, // Total withdrawn (approved by admin)
      totalItemsSold,
      topProducts
    };
  }, [orders, withdrawalStats.totalWithdrawn]);
  
  // Filter orders based on status
  const filteredOrders = useMemo(() => {
    if (filterStatus === "all") return orders;
    return orders.filter(order => {
      if (filterStatus === "delivered") return order.status === 'delivered';
      if (filterStatus === "cancelled") return order.status === 'Cancelled';
      return true;
    });
  }, [orders, filterStatus]);

  // Load withdrawal history
  const loadWithdrawalHistory = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const response = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/wallet/withdrawals`, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWithdrawalHistory(data.withdrawals || []);
        setWithdrawalStats(data.stats || {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          rejected: 0,
          totalWithdrawn: 0,
          totalPending: 0
        });
      } else {
        console.error('Failed to load withdrawal history:', data.message);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading withdrawal history:', error);
      }
    }
  }, [currentUser]);

  // Submit withdrawal request
  const submitWithdrawalRequest = async () => {
    setWithdrawalMessage('');
    const amount = parseFloat(withdrawalAmount);
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      setWithdrawalMessage('Please enter a valid amount');
      return;
    }

    if (amount < 100) {
      setWithdrawalMessage('Minimum withdrawal amount is ₹100');
      return;
    }

    // Validate UPI ID
    if (!upiId || !upiId.trim()) {
      setWithdrawalMessage('Please enter your UPI ID');
      return;
    }

    // UPI ID format validation
    const upiPattern = /^[\w.-]+@[\w.-]+$/;
    if (!upiPattern.test(upiId.trim())) {
      setWithdrawalMessage('Please enter a valid UPI ID (e.g., yourname@paytm)');
      return;
    }

    try {
      setWithdrawalLoading(true);
      const response = await fetch(`http://localhost:5000/api/users/${currentUser.uid}/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          paymentMethod: 'upi',
          upiDetails: {
            upiId: upiId.trim()
          }
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setWithdrawalMessage('Withdrawal request submitted successfully! Awaiting admin approval.');
        setWithdrawalAmount('');
        setUpiId('');
        loadWithdrawalHistory();
        setTimeout(() => {
          setShowWithdrawalModal(false);
          setWithdrawalMessage('');
        }, 2000);
      } else {
        setWithdrawalMessage(data.message || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      setWithdrawalMessage('Failed to submit withdrawal request. Please try again.');
    } finally {
      setWithdrawalLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadAllData = async () => {
      if (!currentUser || !profile) {
        return;
      }

      if (!["store", "seller"].includes(profile.role)) {
        navigate("/");
        return;
      }

      // Load data sequentially to prevent resource exhaustion
      try {
        // First load order history
        await fetchOrderHistory();
        
        if (!isMounted) return;
        
        // Then load wallet balance
        await loadWalletBalance();
        
        if (!isMounted) return;
        
        // Finally load withdrawal history
        await loadWithdrawalHistory();
      } catch (error) {
        console.error('Error loading page data:', error);
      }
    };

    loadAllData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, profile?.role]); // Only depend on uid and role to prevent re-renders

  

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/seller")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Order History & Earnings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              View all past orders, products sold, and earnings summary
            </p>
          </div>
          <div className="mt-4 flex gap-2 md:mt-0 md:ml-4">
            <button
              onClick={() => navigate("/seller")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate("/seller/settings")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Settings
            </button>
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button 
            onClick={() => setShowWithdrawalModal(true)}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Balance</p>
                <p className="text-2xl font-bold text-green-600 mt-1">₹{statistics.walletBalance.toFixed(2)}</p>
                {statistics.totalWithdrawn > 0 ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Total Earned: ₹{statistics.totalEarnings.toFixed(2)} | 
                    Withdrawn: ₹{statistics.totalWithdrawn.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">No withdrawals yet</p>
                )}
              </div>
              <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">From {statistics.deliveredOrders} delivered orders</p>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 font-medium">Click to request withdrawal</span>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Items Sold</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{statistics.totalItemsSold}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Total products delivered</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Orders</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{statistics.deliveredOrders}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Successfully delivered</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cancelled Orders</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{statistics.cancelledOrders}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Orders cancelled</p>
          </div>
        </div>
        
        {/* Top Selling Products */}
        {statistics.topProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {statistics.topProducts.map((product, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {product.quantity} sold
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 text-sm mb-1 truncate" title={product.name}>
                    {product.name}
                  </h4>
                  <p className="text-sm font-semibold text-green-600">₹{product.earnings.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Withdrawal History Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Withdrawal History</h3>
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Request Withdrawal
            </button>
          </div>
          
          {/* Withdrawal Summary Statistics */}
          {withdrawalHistory.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Total Requests</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{withdrawalStats.total}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-600 font-medium">Pending</p>
                <p className="text-xl font-bold text-yellow-700 mt-1">{withdrawalStats.pending}</p>
                <p className="text-xs text-yellow-600 mt-1">₹{withdrawalStats.totalPending.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Completed</p>
                <p className="text-xl font-bold text-green-700 mt-1">{withdrawalStats.completed}</p>
                <p className="text-xs text-green-600 mt-1">₹{withdrawalStats.totalWithdrawn.toFixed(2)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-600 font-medium">Rejected</p>
                <p className="text-xl font-bold text-red-700 mt-1">{withdrawalStats.rejected}</p>
              </div>
            </div>
          )}

          {withdrawalHistory.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">No withdrawal requests yet</p>
              <p className="text-sm text-gray-400 mt-1">Your withdrawal history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawalHistory.map((withdrawal, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">₹{withdrawal.amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(withdrawal.requestedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                      withdrawal.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {withdrawal.status?.charAt(0).toUpperCase() + withdrawal.status?.slice(1)}
                    </span>
                  </div>
                  {withdrawal.upiDetails?.upiId && (
                    <p className="text-xs text-gray-600">UPI: {withdrawal.upiDetails.upiId}</p>
                  )}
                  {withdrawal.reference && (
                    <p className="text-xs text-gray-500 mt-1">Ref: {withdrawal.reference}</p>
                  )}
                  {withdrawal.rejectedReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-700"><strong>Rejected:</strong> {withdrawal.rejectedReason}</p>
                    </div>
                  )}
                  {withdrawal.transactionId && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-700"><strong>Transaction ID:</strong> {withdrawal.transactionId}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Filter Tabs */}
            <div className="mb-4 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`${
                    filterStatus === "all"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  All Orders ({orders.length})
                </button>
                <button
                  onClick={() => setFilterStatus("delivered")}
                  className={`${
                    filterStatus === "delivered"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Delivered ({statistics.deliveredOrders})
                </button>
                <button
                  onClick={() => setFilterStatus("cancelled")}
                  className={`${
                    filterStatus === "cancelled"
                      ? "border-red-500 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Cancelled ({statistics.cancelledOrders})
                </button>
              </nav>
            </div>
            
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => {
                      const totalItems = order.products?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                      const productNames = order.products?.map(p => p.name).join(", ") || "";
                      
                      return (
                        <tr 
                          key={order._id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/seller/order-processing/${order._id}`)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{order.orderNumber || order._id.slice(-6)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={productNames}>
                            {productNames || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {totalItems}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            ₹{(order.subtotal || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            ₹{(order.totalAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                              order.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(order.timestamp).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Request Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Request Withdrawal</h3>
              <button
                onClick={() => {
                  setShowWithdrawalModal(false);
                  setWithdrawalMessage('');
                  setWithdrawalAmount('');
                  setUpiId('');
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {/* Earnings Summary */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-green-700 font-semibold mb-1">Available Balance</p>
                    <p className="text-4xl font-bold text-green-600">₹{statistics.walletBalance.toFixed(2)}</p>
                    <p className="text-xs text-green-600 mt-2">From {statistics.deliveredOrders} delivered orders</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                
                {/* Earnings Breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-green-200">
                  <div>
                    <p className="text-xs text-green-700 font-medium">Total Earned</p>
                    <p className="text-lg font-bold text-green-800">₹{statistics.totalEarnings.toFixed(2)}</p>
                  </div>
                  {statistics.totalWithdrawn > 0 && (
                    <div>
                      <p className="text-xs text-orange-600 font-medium">Withdrawn</p>
                      <p className="text-lg font-bold text-orange-700">₹{statistics.totalWithdrawn.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setShowWithdrawalHistory(false)}
                    className={`${
                      !showWithdrawalHistory
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    New Request
                  </button>
                  <button
                    onClick={() => {
                      setShowWithdrawalHistory(true);
                      loadWithdrawalHistory();
                    }}
                    className={`${
                      showWithdrawalHistory
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Withdrawal History
                  </button>
                </nav>
              </div>

              {/* New Request Form */}
              {!showWithdrawalHistory ? (
                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Withdrawal Amount (₹)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">₹</span>
                      </div>
                      <input
                        type="number"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="block w-full pl-8 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        min="100"
                        step="100"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum withdrawal: ₹100</p>
                  </div>

                  {/* UPI ID Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UPI ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@paytm"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter your UPI ID (e.g., yourname@paytm, yourname@gpay)</p>
                  </div>

                  {/* Message Display */}
                  {withdrawalMessage && (
                    <div className={`p-3 rounded-lg ${
                      withdrawalMessage.includes('successfully') || withdrawalMessage.includes('Awaiting')
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      <p className="text-sm">{withdrawalMessage}</p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">Withdrawal Information</h4>
                        <ul className="mt-2 text-xs text-blue-700 space-y-1">
                          <li>• Minimum withdrawal amount is ₹100</li>
                          <li>• Your request will be sent to admin for approval</li>
                          <li>• Processing time: 1-3 business days</li>
                          <li>• Amount will be transferred to your UPI ID</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={submitWithdrawalRequest}
                    disabled={withdrawalLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {withdrawalLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Submit Withdrawal Request'
                    )}
                  </button>
                </div>
              ) : (
                /* Withdrawal History */
                <div>
                  {/* Withdrawal Summary Statistics */}
                  {withdrawalHistory.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium">Total Requests</p>
                        <p className="text-xl font-bold text-blue-700 mt-1">{withdrawalStats.total}</p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-600 font-medium">Pending</p>
                        <p className="text-xl font-bold text-yellow-700 mt-1">{withdrawalStats.pending}</p>
                        <p className="text-xs text-yellow-600 mt-1">₹{withdrawalStats.totalPending.toFixed(2)}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium">Completed</p>
                        <p className="text-xl font-bold text-green-700 mt-1">{withdrawalStats.completed}</p>
                        <p className="text-xs text-green-600 mt-1">₹{withdrawalStats.totalWithdrawn.toFixed(2)}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-600 font-medium">Rejected</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{withdrawalStats.rejected}</p>
                      </div>
                    </div>
                  )}

                  {withdrawalHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500">No withdrawal requests yet</p>
                      <p className="text-sm text-gray-400 mt-1">Your withdrawal history will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {withdrawalHistory.map((withdrawal, index) => (
                        <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-900">₹{withdrawal.amount?.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(withdrawal.requestedAt).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                              withdrawal.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {withdrawal.status?.charAt(0).toUpperCase() + withdrawal.status?.slice(1)}
                            </span>
                          </div>
                          {withdrawal.upiDetails?.upiId && (
                            <p className="text-xs text-gray-600">UPI: {withdrawal.upiDetails.upiId}</p>
                          )}
                          {withdrawal.reference && (
                            <p className="text-xs text-gray-500 mt-1">Ref: {withdrawal.reference}</p>
                          )}
                          {withdrawal.rejectedReason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <p className="text-xs text-red-700"><strong>Rejected:</strong> {withdrawal.rejectedReason}</p>
                            </div>
                          )}
                          {withdrawal.transactionId && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                              <p className="text-xs text-green-700"><strong>Transaction ID:</strong> {withdrawal.transactionId}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;