import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../../services/apiService';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const OrderFullProcessingPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [processingAction, setProcessingAction] = useState(null);

  // Fetch full order details
  const fetchOrderDetails = async () => {
    try {
      const response = await apiService.get(`/orders/seller/full/${orderId}?sellerId=${currentUser.uid}`);
      if (response.success) {
        setOrder(response.order);
        // Generate QR code
        generateQRCode(response.order.qrCodeUrl);
      } else {
        toast.error(response.message || 'Failed to fetch order details');
        navigate('/seller');
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to fetch order details');
      navigate('/seller');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR code
  const generateQRCode = async (url) => {
    try {
      const dataUrl = await QRCode.toDataURL(url);
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Create PDF
  const createPDF = () => {
    if (!order) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Product Sticker', 20, 20);

    let y = 40;
    order.products.forEach((product, index) => {
      doc.setFontSize(12);
      doc.text(`${product.name} - Qty: ${product.quantity} - ₹${product.price}`, 20, y);
      y += 10;
    });

    doc.text(`Delivery Address: ${order.deliveryAddress.house}, ${order.deliveryAddress.street}`, 20, y);
    y += 10;
    doc.text(`${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.zipCode}`, 20, y);
    y += 10;

    doc.text(`OTP: ${order.deliveryOTP}`, 20, y + 10);

    // Add QR code image
    if (qrCodeDataUrl) {
      doc.addImage(qrCodeDataUrl, 'PNG', 20, y + 20, 50, 50);
    }

    doc.save(`order-${order.orderId}-sticker.pdf`);
  };

  // Update status to out for delivery
  const handleOutForDelivery = async () => {
    setProcessingAction('out_for_delivery');
    try {
      const response = await apiService.put(`/orders/seller/out-for-delivery/${orderId}`, {
        sellerId: currentUser.uid
      });

      if (response.success) {
        toast.success('Order status updated to out for delivery');
        setOrder(response.order);
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setProcessingAction(null);
    }
  };

  // Deliver order
  const handleDeliver = async () => {
    const otp = prompt('Enter delivery OTP:');
    if (!otp) return;

    setProcessingAction('deliver');
    try {
      const response = await apiService.put(`/orders/seller/deliver/${orderId}`, {
        sellerId: currentUser.uid,
        otp
      });

      if (response.success) {
        toast.success('Order delivered successfully');
        setOrder(response.order);
      } else {
        toast.error(response.message || 'Failed to deliver order');
      }
    } catch (error) {
      console.error('Error delivering order:', error);
      toast.error('Failed to deliver order');
    } finally {
      setProcessingAction(null);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    if (!["store", "seller"].includes(currentUser.role)) {
      navigate('/');
      return;
    }

    fetchOrderDetails();
  }, [currentUser, navigate, orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Order not found</p>
          <button
            onClick={() => navigate('/seller')}
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Order Processing - #{order.orderId}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Full order details and processing controls
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => navigate('/seller')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Order Information</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Order Time</dt>
                <dd className="mt-1 text-sm text-gray-900">{new Date(order.timestamp).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.status}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.paymentMethod}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Payment Status</dt>
                <dd className={`mt-1 text-sm font-medium ${
                  order.paymentStatus === 'paid' ? 'text-green-600' :
                  order.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {order.paymentStatus}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Products</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
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
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Address</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="text-sm text-gray-600">
              <p>{order.deliveryAddress.name}</p>
              <p>{order.deliveryAddress.house}, {order.deliveryAddress.street}</p>
              <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}</p>
              <p>{order.deliveryAddress.country}</p>
            </div>
          </div>
        </div>

        {order.buyerContact && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Buyer Contact Info</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.buyerContact.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.buyerContact.phone}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.buyerContact.email}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Verification</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-2">OTP</dt>
                <dd className="text-lg font-mono font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded">
                  {order.deliveryOTP}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-2">QR Code</dt>
                <dd>
                  {qrCodeDataUrl && (
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-32 h-32" />
                  )}
                </dd>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={createPDF}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Create PDF Sticker
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Actions</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="flex space-x-4">
              {order.status === 'Processing' && (
                <button
                  onClick={handleOutForDelivery}
                  disabled={processingAction}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {processingAction === 'out_for_delivery' ? 'Processing...' : 'Mark Out for Delivery'}
                </button>
              )}
              {order.status === 'out_for_delivery' && (
                <button
                  onClick={handleDeliver}
                  disabled={processingAction}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {processingAction === 'deliver' ? 'Processing...' : 'Mark as Delivered'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFullProcessingPage;