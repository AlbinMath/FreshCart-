import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DeliveryTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [completionOtp, setCompletionOtp] = useState("");
  const [completionOtpError, setCompletionOtpError] = useState("");
  const [completionOtpSuccess, setCompletionOtpSuccess] = useState(false);
  const [deliveryCompleted, setDeliveryCompleted] = useState(false);
  const [deliveryStarted, setDeliveryStarted] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);

  const copyOtpToClipboard = () => {
    if (order?.customerOTP) {
      navigator.clipboard.writeText(order.customerOTP).then(() => {
        setOtpCopied(true);
        setTimeout(() => setOtpCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy OTP:', err);
      });
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    
    loadOrderDetails();
  }, [orderId, currentUser, navigate]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Validate orderId before making the request
      if (!orderId) {
        setError("Order ID is missing");
        setLoading(false);
        return;
      }
      
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setOrder(data.order);
        const status = data.order.status;
        const hasDeliveryStarted = status === 'out_for_delivery' || status === 'delivered' || status === 'assigned_pending_otp';
        const isDeliveryCompleted = status === 'delivered';
        setDeliveryStarted(hasDeliveryStarted);
        setDeliveryCompleted(isDeliveryCompleted);
        setCompletionOtp("");
        setCompletionOtpError("");
        setCompletionOtpSuccess(isDeliveryCompleted);
      } else {
        setError(data.message || "Failed to load order details");
      }
    } catch (err) {
      console.error("Error loading order:", err);
      setError("Failed to load order details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const validateOtpFormat = (value) => /^\d{6}$/.test(value);

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpSuccess(false);
    
    if (!validateOtpFormat(otp)) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:5000/api/orders/delivery/verify-otp/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryPartnerId: currentUser.uid,
          otp: otp
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setOtpSuccess(true);
        setDeliveryStarted(true);
        setOtp("");
        loadOrderDetails();
        alert('Delivery started successfully! You can now navigate to the customer address.');
        setCompletionOtp("");
        setCompletionOtpError("");
        setCompletionOtpSuccess(false);
        setDeliveryCompleted(false);
      } else {
        if (data.message === 'Invalid OTP') {
          setOtpError("Invalid OTP. Please check the OTP provided by the seller.");
        } else if (data.message === 'Order not found') {
          setOtpError("Order not found. Please check the order details.");
        } else if (data.message === 'Order is not ready for delivery') {
          setOtpError("Order is not ready for delivery. Please wait for the seller to mark it ready.");
        } else if (data.message === 'Order already assigned to another delivery partner') {
          setOtpError("This order is already assigned to another delivery partner.");
        } else {
          setOtpError(data.message || "An unexpected error occurred while verifying the OTP.");
        }
      }
    } catch (err) {
      console.error("Error validating OTP:", err);
      setOtpError("An error occurred while validating the OTP. Please try again.");
    }
  };

  const handleCompletionOtpSubmit = async (e) => {
    e.preventDefault();
    setCompletionOtpError("");
    setCompletionOtpSuccess(false);

    // Validate OTP format - must be exactly 6 digits
    if (!validateOtpFormat(completionOtp)) {
      const errorMsg = `Invalid OTP format. Please enter exactly 6 digits. You entered: ${completionOtp.length} characters`;
      console.error('OTP Validation Failed:', { 
        otp: completionOtp, 
        length: completionOtp.length,
        isValid: validateOtpFormat(completionOtp)
      });
      alert(errorMsg);
      setCompletionOtpError(errorMsg);
      return;
    }

    console.log('Submitting delivery completion:', {
      orderId,
      otp: completionOtp,
      otpLength: completionOtp.length,
      order: {
        status: order?.status,
        customerOTP: order?.customerOTP,
        orderNumber: order?.orderNumber
      }
    });

    try {
      const response = await fetch(`http://localhost:5000/api/orders/delivery/complete/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerOTPInput: completionOtp
        })
      });

      const data = await response.json();
      
      console.log('Backend response:', {
        ok: response.ok,
        status: response.status,
        data
      });

      if (response.ok && data.success) {
        const completionTimestamp = data?.order?.deliveryCompletedAt || new Date().toISOString();

        setCompletionOtpSuccess(true);
        setDeliveryCompleted(true);
        setCompletionOtp("");
        setCompletionOtpError("");
        
        // Update local order state with the response from backend
        setOrder((prevOrder) =>
          prevOrder
            ? {
                ...prevOrder,
                status: 'delivered',
                deliveryCompletedAt: completionTimestamp,
                paymentStatus: data.order?.paymentStatus || prevOrder.paymentStatus,
                statusTimeline: Array.isArray(prevOrder.statusTimeline)
                  ? [
                      ...prevOrder.statusTimeline,
                      {
                        status: 'Delivered',
                        timestamp: completionTimestamp
                      }
                    ]
                  : [
                      {
                        status: 'Delivered',
                        timestamp: completionTimestamp
                      }
                    ]
              }
            : prevOrder
        );
        
        alert('✅ Delivery completed successfully! Order status updated to Delivered.');
      } else {
        const errorMessage = data.message || "Invalid OTP";
        console.error('Delivery completion failed:', {
          status: response.status,
          message: data.message,
          providedOTP: completionOtp,
          expectedOTP: order?.customerOTP
        });
        alert(`Error: ${errorMessage}`);
        setCompletionOtpError(errorMessage);
      }
    } catch (err) {
      console.error("Error completing delivery:", err);
      const errorMsg = "Network error. Please check your connection and try again.";
      alert(errorMsg);
      setCompletionOtpError(errorMsg);
    }
  };

  const getDirectionsUrl = (address) => {
    if (!address) return "#";
    
    // If coordinates are available, use them for more precise directions
    if (address.coordinates && address.coordinates.lat && address.coordinates.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${address.coordinates.lat},${address.coordinates.lng}`;
    }
    
    // Build a more complete address string
    const addressParts = [];
    if (address.house) addressParts.push(address.house);
    if (address.street) addressParts.push(address.street);
    if (address.area) addressParts.push(address.area);
    if (address.city) addressParts.push(address.city);
    if (address.state) addressParts.push(address.state);
    if (address.zipCode) addressParts.push(address.zipCode);
    
    const addressString = addressParts.join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;
  };

  // New function to get directions from seller to customer
  const getSellerToCustomerDirectionsUrl = (sellerAddress, customerAddress) => {
    if (!sellerAddress || !customerAddress) return "#";
    
    // Use coordinates if available for more precise directions
    let origin, destination;
    
    // For seller
    if (sellerAddress.coordinates && sellerAddress.coordinates.lat && sellerAddress.coordinates.lng) {
      origin = `${sellerAddress.coordinates.lat},${sellerAddress.coordinates.lng}`;
    } else {
      // Build seller address string
      const sellerParts = [];
      if (sellerAddress.address) sellerParts.push(sellerAddress.address);
      if (sellerAddress.city) sellerParts.push(sellerAddress.city);
      if (sellerAddress.state) sellerParts.push(sellerAddress.state);
      if (sellerAddress.zipCode) sellerParts.push(sellerAddress.zipCode);
      
      origin = sellerParts.join(', ');
    }
    
    // For customer
    if (customerAddress.coordinates && customerAddress.coordinates.lat && customerAddress.coordinates.lng) {
      destination = `${customerAddress.coordinates.lat},${customerAddress.coordinates.lng}`;
    } else {
      // Build customer address string
      const customerParts = [];
      if (customerAddress.house) customerParts.push(customerAddress.house);
      if (customerAddress.street) customerParts.push(customerAddress.street);
      if (customerAddress.area) customerParts.push(customerAddress.area);
      if (customerAddress.city) customerParts.push(customerAddress.city);
      if (customerAddress.state) customerParts.push(customerAddress.state);
      if (customerAddress.zipCode) customerParts.push(customerAddress.zipCode);
      
      destination = customerParts.join(', ');
    }
    
    // Return Google Maps directions URL
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Order Details</h2>
          <p className="text-gray-600">Please wait while we fetch your delivery information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Order</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/delivery')}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-medium transition-all shadow-lg hover:shadow-xl"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">The requested order could not be found.</p>
            <button
              onClick={() => navigate('/delivery')}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-medium transition-all shadow-lg hover:shadow-xl"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Delivery Tracking</h1>
            <p className="text-gray-600 mt-1">Track your delivery progress in real-time</p>
          </div>
          <button
            onClick={() => navigate('/delivery')}
            className="px-5 py-2.5 bg-white text-gray-700 rounded-xl border border-gray-300 hover:bg-gray-50 font-medium flex items-center transition-all shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Order #{order.orderNumber || order._id?.slice(-6) || orderId?.slice(-6)}</h2>
              <div className="flex items-center mt-2">
                <span className="text-gray-600 mr-2">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                  order.status === 'assigned_pending_otp' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status === 'out_for_delivery' ? 'Out for Delivery' :
                   order.status === 'delivered' ? 'Delivered' :
                   order.status === 'assigned_pending_otp' ? 'Assigned - Pending OTP' : order.status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">₹{order.totalAmount}</p>
              <p className="text-sm text-gray-600">{order.products?.length || 0} items</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delivery Route</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Seller Address */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100 shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <h3 className="text-lg font-semibold text-green-800">Seller (Pickup)</h3>
                </div>
                {order.storeDetails ? (
                  <div className="space-y-2">
                    <p className="font-bold text-gray-900">{order.storeDetails.storeName || 'Seller'}</p>
                    {order.storeDetails.sellerPhone && (
                      <p className="text-sm text-gray-700">📞 {order.storeDetails.sellerPhone}</p>
                    )}
                    <div className="text-sm text-gray-700 bg-white p-3 rounded-lg">
                      <p>{order.storeDetails.storeAddress || 'Address not available'}</p>
                      <p className="mt-1">
                        {order.storeDetails.city && `${order.storeDetails.city}, `}
                        {order.storeDetails.state && `${order.storeDetails.state} `}
                        {order.storeDetails.zipCode && `${order.storeDetails.zipCode}`}
                      </p>
                      {order.storeDetails.coordinates && (
                        <p className="mt-2 text-xs text-gray-600">
                          📍 {order.storeDetails.coordinates.lat?.toFixed(6)}, {order.storeDetails.coordinates.lng?.toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No seller information available</p>
                )}
              </div>

              {/* Customer Address */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <h3 className="text-lg font-semibold text-blue-800">Customer (Delivery)</h3>
                </div>
                {order.deliveryAddress ? (
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{order.deliveryAddress?.name || order.customerInfo?.name || 'Customer'}</p>
                          {order.customerInfo?.phone && (
                            <p className="text-green-700 font-medium mt-1 flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                              </svg>
                              {order.customerInfo.phone}
                            </p>
                          )}
                        </div>
                        {order.customerInfo?.phone && (
                          <a 
                            href={`tel:${order.customerInfo.phone}`} 
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                            </svg>
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-700 bg-white p-4 rounded-lg shadow-sm">
                      <h4 className="font-semibold text-gray-900 mb-2">Delivery Address</h4>
                      <p className="mb-1">
                        {order.deliveryAddress?.house && `${order.deliveryAddress.house}, `}
                        {order.deliveryAddress?.street && `${order.deliveryAddress.street}, `}
                        {order.deliveryAddress?.area && `${order.deliveryAddress.area}, `}
                        {order.deliveryAddress?.city && `${order.deliveryAddress.city}, `}
                        {order.deliveryAddress?.state && `${order.deliveryAddress.state} `}
                        {order.deliveryAddress?.zipCode && `${order.deliveryAddress.zipCode},`}
                        {order.deliveryAddress?.phone && `${order.deliveryAddress.phone}`}
                      </p>
                      {order.deliveryAddress?.landmark && (
                        <p className="mt-2 text-gray-600">
                          <span className="font-medium">Landmark:</span> {order.deliveryAddress.landmark}
                        </p>
                      )}
                      {order.deliveryAddress?.apartment && (
                        <p className="mt-1 text-gray-600">
                          <span className="font-medium">Apartment:</span> {order.deliveryAddress.apartment}
                        </p>
                      )}
                      {order.deliveryAddress?.coordinates && (
                        <p className="mt-2 text-xs text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          {order.deliveryAddress.coordinates.lat?.toFixed(6)}, {order.deliveryAddress.coordinates.lng?.toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No delivery address available</p>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Completion OTP Section - Show when delivery is in progress */}
          {deliveryStarted && !deliveryCompleted && order.status === 'out_for_delivery' && (
            <div className="border-t pt-6 mt-6">
              {/* Display Customer OTP to Delivery Partner */}
              {order.customerOTP && (
                <div className="mb-8">
                  {/* Step 1: Instruction Banner */}
                  <div className="mb-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl shadow-md p-5 border-2 border-red-300">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-500 text-white font-bold">1</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-red-900 mb-1">📢 Ask Customer for OTP</h4>
                        <p className="text-xs text-red-800">
                          When you reach the customer, ask them for the <strong>6-digit OTP code</strong> they received. This code must be provided to confirm delivery.
                        </p>
                      </div>
                    </div>
                  </div>

                  

                  {/* Step 3: Validation */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-5 border-2 border-blue-300">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-500 text-white font-bold">3</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-blue-900 mb-1">✅ Enter OTP Below to Confirm</h4>
                        <p className="text-xs text-blue-800">
                          Once the customer provides the OTP, enter it in the form below to complete the delivery.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Complete Delivery
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Enter the 6-digit OTP provided by the customer to confirm delivery completion.
                </p>
              </div>
              
              <div className="max-w-md mx-auto">
                <form onSubmit={handleCompletionOtpSubmit} className="space-y-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm p-6 border border-green-200">
                    <div className="mb-1">
                      <label htmlFor="completionOtp" className="block text-sm font-medium text-gray-700 mb-3">
                        Enter Customer OTP
                      </label>
                      <div className="flex justify-center">
                        <input
                          type="text"
                          id="completionOtp"
                          value={completionOtp}
                          onChange={(e) => setCompletionOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          className="w-48 text-2xl text-center tracking-widest p-4 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 font-mono"
                          maxLength="6"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">6-digit code from customer</p>
                    </div>
                    
                    {completionOtpError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span>{completionOtpError}</span>
                        </div>
                      </div>
                    )}
                    
                    {completionOtpSuccess && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>Delivery completed successfully!</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Information */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-blue-800">Customer Information</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg">
                        <p className="font-medium text-gray-900">{order.deliveryAddress?.name || order.customerInfo?.name || 'Customer'}</p>
                        {order.customerInfo?.phone && (
                          <p className="text-sm text-gray-600 mt-1">
                            📞 {order.customerInfo.phone}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-700 bg-white p-3 rounded-lg">
                        <p className="font-medium text-gray-900 mb-1">Delivery Address</p>
                        <p>
                          {order.deliveryAddress?.house && `${order.deliveryAddress.house}, `}
                          {order.deliveryAddress?.street && `${order.deliveryAddress.street}, `}
                          {order.deliveryAddress?.area && `${order.deliveryAddress.area}, `}
                          {order.deliveryAddress?.city && `${order.deliveryAddress.city}, `}
                          {order.deliveryAddress?.state && `${order.deliveryAddress.state} `}
                          {order.deliveryAddress?.zipCode && `${order.deliveryAddress.zipCode}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={completionOtp.length !== 6}
                    className={`w-full py-4 px-4 rounded-xl text-white font-semibold text-lg transition-all ${
                      completionOtp.length === 6 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {completionOtp.length === 6 ? 'Confirm Delivery' : 'Enter 6-digit OTP'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* OTP Section */}
          {(!deliveryStarted && order.status !== 'assigned_pending_otp') || order.status === 'assigned_pending_otp' ? (
            <div className="border-t pt-6 mt-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {order.status === 'assigned_pending_otp' ? 'Verify OTP to Start Delivery' : 'Start Delivery'}
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Enter the 6-digit OTP provided by the seller to start the delivery.
                </p>
              </div>
              
              <div className="max-w-md mx-auto">
                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="mb-1">
                      <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-3">
                        Enter OTP
                      </label>
                      <div className="flex justify-center">
                        <input
                          type="text"
                          id="otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          className="w-48 text-2xl text-center tracking-widest p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 font-mono"
                          maxLength="6"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">6-digit code provided by seller</p>
                    </div>
                    
                    {otpError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span>{otpError}</span>
                        </div>
                      </div>
                    )}
                    
                    {otpSuccess && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>OTP validated successfully! Delivery started.</span>
                        </div>
                        <p className="mt-1">You can now navigate to the customer's address using the directions button below.</p>
                      </div>
                    )}
                  </div>

                  {/* Customer Information Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-blue-800">Delivery Address</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-gray-900">{order.deliveryAddress?.name || order.customerInfo?.name || 'Customer'}</p>
                        {order.customerInfo?.phone && (
                          <p className="text-sm text-gray-600 mt-1">
                            📞 {order.customerInfo.phone}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-700 bg-white p-3 rounded-lg">
                        <p>
                          {order.deliveryAddress?.house && `${order.deliveryAddress.house}, `}
                          {order.deliveryAddress?.street && `${order.deliveryAddress.street}, `}
                          {order.deliveryAddress?.area && `${order.deliveryAddress.area}, `}
                          {order.deliveryAddress?.city && `${order.deliveryAddress.city}, `}
                          {order.deliveryAddress?.state && `${order.deliveryAddress.state} `}
                          {order.deliveryAddress?.zipCode && `${order.deliveryAddress.zipCode}`}
                          
                        </p>
                        {order.deliveryAddress?.landmark && (
                          <p className="mt-1 text-gray-600">
                            <span className="font-medium">Landmark:</span> {order.deliveryAddress.landmark}
                          </p>
                        )}
                        {order.deliveryAddress?.apartment && (
                          <p className="mt-1 text-gray-600">
                            <span className="font-medium">Apartment:</span> {order.deliveryAddress.apartment}
                          </p>
                        )}
                        {order.deliveryAddress?.coordinates && (
                          <p className="mt-1 text-gray-600 text-xs">
                            <span className="font-medium">📍</span> {order.deliveryAddress.coordinates.lat?.toFixed(6)}, {order.deliveryAddress.coordinates.lng?.toFixed(6)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3">
                    {order.deliveryAddress?.coordinates && (
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${order.deliveryAddress.coordinates.lat},${order.deliveryAddress.coordinates.lng}`, '_blank')}
                        className="flex items-center justify-center py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span className="text-sm font-medium">View on Map</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={otp.length !== 6}
                    className={`w-full py-4 px-4 rounded-xl text-white font-semibold text-lg transition-all ${
                      otp.length === 6 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {otp.length === 6 ? 'Start Delivery' : 'Enter 6-digit OTP'}
                  </button>
                </form>
              </div>
            </div>
          ) : deliveryStarted && !deliveryCompleted && order.status !== 'out_for_delivery' ? (
            <div className="border-t pt-6 mt-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Delivery in Progress</h3>
                <p className="text-gray-600 max-w-md mx-auto">Your delivery is currently in progress. Use the buttons below to navigate to the customer.</p>
              </div>
              
              <div className="max-w-md mx-auto grid grid-cols-1 gap-3">
                {order.deliveryAddress?.coordinates && (
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${order.deliveryAddress.coordinates.lat},${order.deliveryAddress.coordinates.lng}`, '_blank')}
                    className="flex items-center justify-center py-3 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span className="text-sm font-medium">View on Map</span>
                  </button>
                )}
              </div>
            </div>
          ) : deliveryCompleted ? (
            <div className="border-t pt-6 mt-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Delivery Completed!</h3>
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  Order has been successfully delivered to the customer.
                </p>
                <button
                  onClick={() => navigate('/delivery')}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : null}

          {/* Order Items */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.products?.map((product, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-16 h-16 object-cover rounded-lg mr-4"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzc1NzU3NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                        }}
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <div className="flex items-center mt-1 space-x-3">
                        <span className="text-sm text-gray-600">Qty: {product.quantity}</span>
                        {product.isVeg !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${product.isVeg ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {product.isVeg ? 'Veg' : 'Non-Veg'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{product.price * product.quantity}</p>
                    <p className="text-sm text-gray-500">₹{product.price} each</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{order.subtotal || (order.totalAmount - order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900">₹{order.deliveryFee}</span>
              </div>
              <div className="flex justify-between py-3 mt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-green-600 text-lg">₹{order.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}