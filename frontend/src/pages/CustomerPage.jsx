import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, ArrowLeft, X, MapPin, Eye, ChevronDown, ChevronUp, ShieldCheck, Copy } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { orderService } from '../../../backend/services/orderService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "react-hot-toast";

const createEmptyOrderBuckets = () => ({
  processing: [],
  underDelivery: [],
  completed: [],
  cancelled: []
});

const normalizeStatusValue = (status) => {
  if (!status) return "";
  return status.toString().trim().toLowerCase();
};

const processingStatuses = new Set([
  "processing",
  "pending",
  "pending seller approval",
  "order confirmed",
  "confirmed",
  "preparing",
  "preparing order",
  "awaiting payment",
  "payment pending",
  "ready to dispatch",
  "ready_to_dispatch"
]);

const deliveryStatuses = new Set([
  "under delivery",
  "under_delivery",
  "out_for_delivery",
  "out for delivery",
  "ready_for_delivery",
  "ready for delivery",
  "delivery_pending",
  "delivery pending",
  "assigned_pending_otp",
  "assigned pending otp",
  "picked_up",
  "picked up",
  "in transit",
  "en route"
]);

const completedStatuses = new Set([
  "completed",
  "delivered",
  "delivered_to_customer",
  "delivered to customer",
  "order completed",
  "order delivered",
  "delivery_completed",
  "delivery completed"
]);

const cancelledStatuses = new Set([
  "cancelled",
  "order cancelled",
  "cancelled_by_customer",
  "cancelled by customer",
  "cancelled_by_seller",
  "cancelled by seller",
  "refunded",
  "failed",
  "payment_failed",
  "payment failed",
  "rejected",
  "returned"
]);

const categorizeOrders = (ordersData) => {
  const buckets = createEmptyOrderBuckets();

  const placeOrderInBucket = (order) => {
    if (!order) return;
    const normalizedStatus = normalizeStatusValue(order.status);

    if (completedStatuses.has(normalizedStatus)) {
      buckets.completed.push(order);
      return;
    }

    if (cancelledStatuses.has(normalizedStatus)) {
      buckets.cancelled.push(order);
      return;
    }

    if (deliveryStatuses.has(normalizedStatus)) {
      buckets.underDelivery.push(order);
      return;
    }

    if (processingStatuses.has(normalizedStatus)) {
      buckets.processing.push(order);
      return;
    }

    if (normalizedStatus.includes("delivery")) {
      buckets.underDelivery.push(order);
    } else if (
      normalizedStatus.includes("cancel") ||
      normalizedStatus.includes("reject") ||
      normalizedStatus.includes("fail")
    ) {
      buckets.cancelled.push(order);
    } else if (
      normalizedStatus.includes("complete") ||
      normalizedStatus.includes("deliver")
    ) {
      buckets.completed.push(order);
    } else {
      buckets.processing.push(order);
    }
  };

  if (Array.isArray(ordersData)) {
    ordersData.forEach(placeOrderInBucket);
  } else if (ordersData && typeof ordersData === "object") {
    Object.values(ordersData).forEach((group) => {
      if (Array.isArray(group)) {
        group.forEach(placeOrderInBucket);
      }
    });
  }

  return buckets;
};

export default function CustomerPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(() => createEmptyOrderBuckets());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      try {
        const result = await orderService.getUserOrders(currentUser.uid);
        setOrders(categorizeOrders(result.orders));
      } catch (err) {
        console.error('Error fetching orders:', err);
        setOrders(createEmptyOrderBuckets());
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser, navigate]);

  const getOrderKey = (order) => order?._id || order?.orderId || order?.orderNumber;

  const toggleOrderDetails = (orderKey) => {
    if (!orderKey) return;
    setExpandedOrders((prev) => ({
      ...prev,
      [orderKey]: !prev?.[orderKey]
    }));
  };

  const isOrderExpanded = (orderKey) => !!expandedOrders?.[orderKey];

  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status
      .toString()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '₹0.00';
    return `₹${Number(value).toFixed(2)}`;
  };

  const statusVariantMap = {
    completed: 'default',
    delivered: 'default',
    'under delivery': 'secondary',
    out_for_delivery: 'secondary',
    'out for delivery': 'secondary',
    ready_for_delivery: 'secondary',
    'ready for delivery': 'secondary',
    processing: 'outline',
    'pending seller approval': 'outline',
    delivery_pending: 'outline',
    'delivery pending': 'outline',
    cancelled: 'destructive'
  };

  const handleCopyToClipboard = async (value) => {
    if (!value) {
      toast.error('Nothing to copy');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined' && window?.clipboardData?.setData) {
        window.clipboardData.setData('Text', value);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      toast.success('OTP copied to clipboard');
    } catch (error) {
      console.error('Failed to copy OTP', error);
      toast.error('Unable to copy OTP');
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    try {
      setCancellingOrder(orderId);
      const result = await orderService.cancelOrder(orderId, currentUser.uid);

      if (result.success) {
        // Update the local state to reflect the cancelled order
        setOrders(prevOrders => {
          const sourceBuckets = categorizeOrders(result.orders);
          return sourceBuckets;
        });
        alert('Order cancelled successfully');
      } else {
        alert(result.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setCancellingOrder(null);
    }
  };

  const handleTrackOrder = (order) => {
    setTrackingOrder(order);
  };

  const handleCloseTracking = () => {
    setTrackingOrder(null);
  };

  const TrackingModal = ({ order, isOpen, onClose }) => {
    if (!order) return null;

    const formatTimeAgo = (timestamp) => {
      const now = new Date();
      const time = new Date(timestamp);
      const diffInMinutes = Math.floor((now - time) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    };

    const getStatusSteps = (order) => {
      const timeline = order.statusTimeline || [];
      const steps = [
        { label: 'Order Placed', completed: true },
        { label: 'Order Confirmed', completed: false },
        { label: 'Preparing Order', completed: false },
        { label: 'Out for Delivery', completed: false },
        { label: 'Delivered', completed: false }
      ];

      // Map timeline entries to steps
      timeline.forEach(entry => {
        const stepIndex = steps.findIndex(step => 
          step.label.toLowerCase().includes(entry.status.toLowerCase()) ||
          (entry.status === 'Order Placed' && step.label === 'Order Placed') ||
          (entry.status === 'Order Confirmed' && step.label === 'Order Confirmed') ||
          (entry.status === 'Processing' && step.label === 'Preparing Order') ||
          (entry.status === 'Under Delivery' && step.label === 'Out for Delivery') ||
          (entry.status === 'Completed' && step.label === 'Delivered')
        );
        
        if (stepIndex !== -1) {
          steps[stepIndex].completed = true;
          steps[stepIndex].time = formatTimeAgo(entry.timestamp);
        }
      });

      // Set completion based on current status
      if (order.status === 'Under Delivery') {
        steps[0].completed = true; // Order Placed
        steps[1].completed = true; // Order Confirmed
        steps[2].completed = true; // Preparing Order
      } else if (order.status === 'Completed') {
        steps.forEach(step => step.completed = true);
      }

      return steps;
    };

    const steps = getStatusSteps(order);

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Track Order #{order.orderId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Order Status Timeline */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Order Status</h3>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step.completed ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${step.completed ? 'text-green-600' : 'text-gray-600'}`}>
                        {step.label}
                      </p>
                      {step.completed && (
                        <p className="text-sm text-gray-500">{step.time}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Info */}
            {(order.status === 'Under Delivery' || order.status === 'Completed') && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Delivery Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>Estimated Delivery:</strong> Today, {new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString()}</p>
                  <p><strong>Delivery Partner:</strong> FreshCart Express</p>
                  <p><strong>Current Location:</strong> Near your location</p>
                </div>
              </div>
            )}

            {/* Order Details */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Order Details</h3>
              <div className="space-y-3">
                {order.products.map((product, index) => (
                  <div key={index} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-b-0">
                    {/* Product Image */}
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      {product.productImage ? (
                        <img
                          src={product.productImage}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-gray-400 text-lg">📦</span>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={product.isVeg ? "secondary" : "destructive"} className="text-xs">
                          {product.isVeg ? 'V' : 'N'}
                        </Badge>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <p className="text-sm text-gray-500">{product.category}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">₹{product.price} × {product.quantity}</span>
                        <span className="font-medium text-green-600">₹{product.price * product.quantity}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-semibold text-lg">₹{order.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Delivery Address</h3>
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">{order.deliveryAddress?.name || 'Customer'}</p>
                  <p className="text-gray-600 text-sm">{order.deliveryAddress?.address}</p>
                  {order.deliveryAddress?.landmark && (
                    <p className="text-gray-600 text-sm">Landmark: {order.deliveryAddress.landmark}</p>
                  )}
                  <p className="text-gray-600 text-sm">{order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}</p>
                  <p className="text-gray-600 text-sm">{order.deliveryAddress?.phone}</p>
                </div>
              </div>
            </div>

            {/* Store Details */}
            {order.storeDetails && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">Store Information</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Store ID: {order.storeDetails.sellerUid}</p>
                  <p className="text-sm text-gray-600">Collection: {order.storeDetails.sellerCollection}</p>
                </div>
              </div>
            )}

            {/* Payment Information */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Payment Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{order.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total Amount:</span>
                  <span>₹{order.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Payment Method:</span>
                  <span>{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Payment Status:</span>
                  <span className={`capitalize ${
                    order.paymentStatus === 'paid' ? 'text-green-600' :
                    order.paymentStatus === 'failed' ? 'text-red-600' :
                    order.paymentStatus === 'refunded' ? 'text-blue-600' :
                    'text-orange-600'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const OrderCard = ({ order, onCancelOrder, onTrackOrder }) => {
    const orderKey = getOrderKey(order);

    const canCancel = () => {
      if (!order || order.status !== 'Processing') return false;
      const orderTime = order?.timestamp ? new Date(order.timestamp) : null;
      if (!orderTime || Number.isNaN(orderTime.getTime())) return false;
      const now = new Date();
      const sixMinutes = 6 * 60 * 1000;
      return (now - orderTime) <= sixMinutes;
    };

    const getTimeRemaining = () => {
      if (!order || order.status !== 'Processing') return null;
      const orderTime = order?.timestamp ? new Date(order.timestamp) : null;
      if (!orderTime || Number.isNaN(orderTime.getTime())) return null;
      const now = new Date();
      const sixMinutes = 6 * 60 * 1000;
      const timeRemaining = sixMinutes - (now - orderTime);

      if (timeRemaining <= 0) return null;

      const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
      const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      return `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`;
    };

    const deliveryStatus = order?.status?.toLowerCase();
    const deliveryInProgress = [
      'under delivery',
      'out_for_delivery',
      'out for delivery',
      'ready_for_delivery',
      'ready for delivery'
    ].includes(deliveryStatus);

    const currentStatus = formatStatus(order?.status);
    const badgeVariant = statusVariantMap[order?.status?.toLowerCase?.()] || 'outline';

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-medium">Order #{order?.orderId || order?.orderNumber || '--'}</p>
              <p className="text-sm text-gray-500">
                {formatDateTime(order?.timestamp)}
              </p>
              {order?.status === 'Processing' && getTimeRemaining() && (
                <p className="text-xs text-orange-600 mt-1">
                  Cancel within: {getTimeRemaining()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant={badgeVariant} className="capitalize">
                {currentStatus}
              </Badge>
              
              {canCancel() && onCancelOrder && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancelOrder(order.orderId)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleOrderDetails(orderKey)}
                className="text-gray-600 hover:text-gray-800"
              >
                {isOrderExpanded(orderKey) ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" /> Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" /> View details
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {order?.products?.slice?.(0, 2).map((product, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  {product?.productImage ? (
                    <img
                      src={product.productImage}
                      alt={product?.name || `Item ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">📦</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={product?.isVeg ? "secondary" : "destructive"} className="text-xs">
                      {product?.isVeg ? 'V' : 'N'}
                    </Badge>
                    <span className="font-medium text-sm truncate">{product?.name || 'Product'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{product?.category || 'Fresh Item'}</span>
                    <span className="text-xs text-gray-600">₹{product?.price} × {product?.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
            {order?.products?.length > 2 && (
              <p className="text-sm text-gray-500">+{order.products.length - 2} more items</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                {order?.paymentMethod === 'COD' ? (
                  <>
                    <Truck className="h-4 w-4" />
                    Cash on Delivery
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Paid Online
                  </>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {formatDateTime(order?.updatedAt || order?.timestamp)}
              </span>
            </div>
            <div className="text-right text-sm">
              <div className="text-gray-600">
                Subtotal: {formatCurrency(order?.subtotal)} + Delivery: {order?.deliveryFee === 0 ? 'FREE' : formatCurrency(order?.deliveryFee)}
              </div>
              <div className="font-semibold text-green-600">Total: {formatCurrency(order?.totalAmount)}</div>
            </div>
          </div>

          {isOrderExpanded(orderKey) && (
            <div className="mt-6 border-t pt-4 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Items ({order?.products?.length || 0})</h3>
                <div className="space-y-3">
                  {order?.products?.map?.((product, index) => (
                    <div key={index} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        {product?.productImage ? (
                          <img
                            src={product.productImage}
                            alt={product?.name || `Product ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-gray-400 text-lg">📦</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={product?.isVeg ? "secondary" : "destructive"} className="text-xs">
                            {product?.isVeg ? 'Vegetarian' : 'Non-Veg'}
                          </Badge>
                          <span className="font-medium text-sm text-gray-800">{product?.name || 'Product'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{product?.category || 'Fresh produce item'}</p>
                        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600">
                          <span>Qty: {product?.quantity}</span>
                          <span>Price: {formatCurrency(product?.price)}</span>
                          <span>Total: {formatCurrency((product?.price || 0) * (product?.quantity || 0))}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" /> Delivery Address
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium text-gray-800">{order?.deliveryAddress?.name || 'Customer'}</p>
                    <p>{order?.deliveryAddress?.address || 'Address not available'}</p>
                    {order?.deliveryAddress?.landmark && <p>Landmark: {order.deliveryAddress.landmark}</p>}
                    <p>{[order?.deliveryAddress?.city, order?.deliveryAddress?.state, order?.deliveryAddress?.pincode].filter(Boolean).join(', ') || ''}</p>
                    {order?.deliveryAddress?.phone && (
                      <p>📞 {order.deliveryAddress.phone}</p>
                    )}
                  </div>
                </div>

                {order?.storeDetails && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Store Information</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Store:</strong> {order?.storeDetails?.storeName || 'FreshCart Partner Store'}</p>
                      {order?.storeDetails?.sellerCollection && (
                        <p><strong>Collection:</strong> {order.storeDetails.sellerCollection}</p>
                      )}
                      {order?.storeDetails?.sellerUid && (
                        <p><strong>Seller UID:</strong> {order.storeDetails.sellerUid}</p>
                      )}
                      {order?.storeDetails?.sellerPhone && (
                        <p><strong>Contact:</strong> {order.storeDetails.sellerPhone}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(deliveryInProgress || order?.deliveryPartnerId) && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Truck className="h-5 w-5" />
                      <div>
                        <h3 className="font-semibold text-blue-900 text-sm">Delivery in Progress</h3>
                        <p className="text-xs">Your order is being handled by our delivery partner.</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white text-blue-700 border border-blue-200">
                      {formatStatus(order?.status)}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="text-xs uppercase text-blue-500 font-semibold tracking-wide mb-1">Estimated Delivery</p>
                      <p className="text-sm text-gray-700">
                        {order?.estimatedDeliveryTime
                          ? formatDateTime(order.estimatedDeliveryTime)
                          : 'Typically within 2 hours'}
                      </p>
                      {order?.deliveryPartnerId && (
                        <p className="text-xs text-gray-500 mt-2">Delivery Partner ID: {order.deliveryPartnerId}</p>
                      )}
                    </div>

                    {(order?.customerOTP && (order?.status === 'out_for_delivery' || order?.status === 'Under Delivery' || order?.status === 'assigned_pending_otp')) && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                            <p className="text-xs uppercase text-green-600 font-bold tracking-wide">🔐 Your Delivery OTP</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs text-green-600 hover:bg-green-100"
                            onClick={() => handleCopyToClipboard(order?.customerOTP)}
                          >
                            <Copy className="h-4 w-4 mr-1" /> Copy
                          </Button>
                        </div>
                        <p className="text-3xl font-bold text-green-700 tracking-widest font-mono mb-2">
                          {order?.customerOTP}
                        </p>
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs text-gray-700 font-medium">
                            ⚠️ <strong>IMPORTANT:</strong> Share this OTP ONLY with your delivery partner to confirm delivery.
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            The delivery partner will ask you for this code. Do not share it with anyone else.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(order?.status === 'ready_for_delivery' || order?.status === 'delivery_pending') && (
                    <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" />
                      We will notify you as soon as a delivery partner picks up your order.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Payment Summary</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order?.subtotal)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>{order?.deliveryFee === 0 ? 'FREE' : formatCurrency(order?.deliveryFee)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Payment Method</span>
                    <span>{order?.paymentMethod || 'Not specified'}</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span>Status</span>
                    <Badge variant="outline" className="capitalize">
                      {order?.paymentStatus || 'unknown'}
                    </Badge>
                  </p>
                  <p className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(order?.totalAmount)}</span>
                  </p>
                </div>
              </div>

              {order?.statusTimeline?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Status Timeline</h3>
                  <div className="space-y-2">
                    {order.statusTimeline.map((entry, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-1">{index === order.statusTimeline.length - 1 ? '🟢' : '⚪'}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{formatStatus(entry?.status)}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(entry?.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const allOrders = [
    ...(orders?.processing || []),
    ...(orders?.underDelivery || []),
    ...(orders?.completed || []),
    ...(orders?.cancelled || [])
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">My Orders</h1>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                All Orders ({allOrders.length})
              </TabsTrigger>
              <TabsTrigger value="processing" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Processing ({orders?.processing?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="underDelivery" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Under Delivery ({orders?.underDelivery?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Completed ({orders?.completed?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="flex items-center gap-2">
                <X className="h-4 w-4" />
                Cancelled ({orders?.cancelled?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {allOrders.length > 0 ? (
                allOrders.map(order => (
                  <OrderCard
                    key={getOrderKey(order) || order?._id || order?.orderId}
                    order={order}
                    onCancelOrder={handleCancelOrder}
                    onTrackOrder={handleTrackOrder}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-gray-500 mb-4">Start shopping to see your orders here</p>
                    <Button onClick={() => navigate('/')}>Start Shopping</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="processing" className="mt-6">
              {orders?.processing?.length > 0 ? (
                orders.processing.map(order => (
                  <OrderCard
                    key={getOrderKey(order) || order?._id || order?.orderId}
                    order={order}
                    onCancelOrder={handleCancelOrder}
                    onTrackOrder={handleTrackOrder}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No processing orders</h3>
                    <p className="text-gray-500">Your orders being prepared will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="underDelivery" className="mt-6">
              {orders?.underDelivery?.length > 0 ? (
                orders.underDelivery.map(order => (
                  <OrderCard
                    key={getOrderKey(order) || order?._id || order?.orderId}
                    order={order}
                    onCancelOrder={null}
                    onTrackOrder={handleTrackOrder}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No orders under delivery</h3>
                    <p className="text-gray-500">Orders on the way will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              {orders?.completed?.length > 0 ? (
                orders.completed.map(order => (
                  <OrderCard
                    key={getOrderKey(order) || order?._id || order?.orderId}
                    order={order}
                    onCancelOrder={null}
                    onTrackOrder={null}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No completed orders</h3>
                    <p className="text-gray-500">Your delivered orders will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="mt-6">
              {orders?.cancelled?.length > 0 ? (
                orders.cancelled.map(order => (
                  <OrderCard
                    key={getOrderKey(order) || order?._id || order?.orderId}
                    order={order}
                    onCancelOrder={null}
                    onTrackOrder={null}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <X className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No cancelled orders</h3>
                    <p className="text-gray-500">Your cancelled orders will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Tracking Modal */}
          <TrackingModal
            order={trackingOrder}
            isOpen={!!trackingOrder}
            onClose={handleCloseTracking}
          />
        </div>
      </div>
    </div>
  );}
