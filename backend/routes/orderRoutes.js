import express from 'express';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import crypto from 'crypto';
import { calculateTotal } from '../utils/deliveryUtils.js';
import { getSellerProductModel } from '../models/Product.js';

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_RL7iTlLIMH8nZY',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rwk1544M3HCWZOAb7E6A2X07'
});

// Create order
router.post('/create', async (req, res) => {
  try {
    const { userId, products, subtotal, deliveryFee, totalAmount, paymentMethod, deliveryAddress, storeDetails, cartItems } = req.body;

    if (!userId || !products || !Array.isArray(products) || products.length === 0 || typeof subtotal !== 'number' || typeof deliveryFee !== 'number' || typeof totalAmount !== 'number' || !paymentMethod || !deliveryAddress || !storeDetails) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate totalAmount
    const calculatedTotal = subtotal + deliveryFee;
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return res.status(400).json({ success: false, message: 'Invalid total amount calculation' });
    }

    // Generate unique order ID
    const orderId = `FC${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    // Generate order number (shorter, more user-friendly)
    const orderNumber = `FC${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

    // Fetch seller details from User database if sellerId is provided
    let enrichedStoreDetails = { ...storeDetails };
    if (storeDetails.sellerId) {
      try {
        const seller = await User.findOne({ uid: storeDetails.sellerId });
        if (seller) {
          enrichedStoreDetails = {
            ...storeDetails,
            storeName: seller.storeName || '',
            storeAddress: seller.storeAddress || '',
            sellerPhone: seller.phone || '',
            sellerEmail: seller.email || '',
            sellerName: seller.name || '',
            // Add any other relevant seller information
          };
        }
      } catch (sellerError) {
        console.error('Error fetching seller details:', sellerError);
        // Continue with original storeDetails if seller fetch fails
      }
    }

    const orderData = {
      orderId,
      orderNumber,
      userId,
      products,
      subtotal,
      deliveryFee,
      totalAmount,
      paymentMethod,
      deliveryAddress,
      storeDetails: enrichedStoreDetails,
      statusTimeline: [{
        status: 'Order Placed',
        timestamp: new Date()
      }]
    };

    if (paymentMethod === 'COD') {
      // Create order directly for COD
      const order = new Order({
        ...orderData,
        status: 'Pending Seller Approval',
        paymentStatus: 'pending' // For COD, payment is pending until delivery
      });

      await order.save();

      // Create payment record for COD
      const payment = new Payment({
        userId,
        orderId,
        paymentId: `COD_${orderId}`,
        amount: totalAmount,
        currency: 'INR',
        paymentStatus: 'pending',
        cartItems: cartItems || products.map(p => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantity,
          price: p.price
        })),
        deliveryAddress,
        subtotal,
        deliveryFee,
        totalAmount
      });

      await payment.save();

      res.json({
        success: true,
        orderId: order.orderId,
        message: 'Order placed successfully'
      });
    } else if (['Razorpay', 'UPI', 'Wallet'].includes(paymentMethod)) {
      // Create Razorpay order
      const options = {
        amount: totalAmount * 100, // Razorpay expects amount in paisa
        currency: 'INR',
        receipt: orderId,
        payment_capture: 1
      };

      const razorpayOrder = await razorpay.orders.create(options);

      // Save order with razorpay details
      const order = new Order({
        ...orderData,
        status: 'Pending Seller Approval',
        razorpayOrderId: razorpayOrder.id,
        paymentStatus: 'pending'
      });

      await order.save();

      // Create payment record for Razorpay
      const payment = new Payment({
        userId,
        orderId,
        paymentId: razorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        paymentStatus: 'pending',
        cartItems: cartItems || products.map(p => ({
          productId: p.id,
          productName: p.name,
          quantity: p.quantity,
          price: p.price
        })),
        deliveryAddress,
        subtotal,
        deliveryFee,
        totalAmount
      });

      await payment.save();

      res.json({
        success: true,
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          orderId: order.orderId
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// Verify Razorpay payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Generate expected signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', razorpay.key_secret)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment verified, update order
      const order = await Order.findOneAndUpdate(
        { orderId },
        {
          razorpayPaymentId: razorpay_payment_id,
          paymentStatus: 'paid',
          $push: {
            statusTimeline: {
              status: 'Payment Confirmed',
              timestamp: new Date()
            }
          }
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // Update payment record
      await Payment.findOneAndUpdate(
        { orderId },
        {
          paymentStatus: 'paid',
          paymentId: razorpay_payment_id
        }
      );

      res.json({
        success: true,
        orderId: order.orderId,
        message: 'Payment verified and order confirmed'
      });
    } else {
      // Payment failed
      await Order.findOneAndUpdate(
        { orderId },
        {
          paymentStatus: 'failed',
          $push: {
            statusTimeline: {
              status: 'Payment Failed',
              timestamp: new Date()
            }
          }
        }
      );

      // Update payment record
      await Payment.findOneAndUpdate(
        { orderId },
        { paymentStatus: 'failed' }
      );

      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
});

// Get order status
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        timestamp: order.timestamp
      }
    });
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order status' });
  }
});

// Get user orders
router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 Fetching orders for user:', userId);
    
    const orders = await Order.find({ userId }).sort({ timestamp: -1 });
    console.log(`📄 Found ${orders.length} orders`);

    // Map orders to include all necessary fields including customerOTP
    const enrichedOrders = orders.map(order => {
      const mapped = {
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        userId: order.userId,
        products: order.products,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.status,
        timestamp: order.timestamp,
        paymentStatus: order.paymentStatus,
        storeDetails: order.storeDetails,
        deliveryAddress: order.deliveryAddress,
        statusTimeline: order.statusTimeline,
        deliveryOTP: order.deliveryOTP,
        customerOTP: order.customerOTP,
        qrCodeUrl: order.qrCodeUrl,
        deliveryPartnerId: order.deliveryPartnerId,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        updatedAt: order.updatedAt
      };
      
      if (order.customerOTP) {
        console.log(`  ✅ Order ${order.orderNumber} has customerOTP: ${order.customerOTP}`);
      }
      
      return mapped;
    });

    // Group orders by status
    const groupedOrders = {
      processing: enrichedOrders.filter(order => order.status === 'Pending Seller Approval' || order.status === 'Processing' || order.status === 'delivery_pending' || order.status === 'ready_for_delivery'),
      underDelivery: enrichedOrders.filter(order => order.status === 'out_for_delivery' || order.status === 'Under Delivery'),
      completed: enrichedOrders.filter(order => order.status === 'Completed' || order.status === 'delivered' || order.status === 'delivery_completed'),
      cancelled: enrichedOrders.filter(order => order.status === 'Cancelled')
    };

    console.log('📦 Orders grouped:');
    console.log(`  Processing: ${groupedOrders.processing.length}`);
    console.log(`  Under Delivery: ${groupedOrders.underDelivery.length}`);
    console.log(`  Completed: ${groupedOrders.completed.length}`);
    console.log(`  Cancelled: ${groupedOrders.cancelled.length}`);

    res.json({
      success: true,
      orders: groupedOrders
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Update order status (for admin/delivery)
router.put('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId },
      {
        status,
        $push: {
          statusTimeline: {
            status,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// Cancel order (for customers - only processing orders within 6 minutes)
router.put('/cancel/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;

    // Find the order and check if it can be cancelled
    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Processing' && order.status !== 'Pending Seller Approval') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled. Only pending or processing orders can be cancelled.'
      });
    }

    // Check if order is within 6 minutes
    const orderTime = new Date(order.timestamp);
    const now = new Date();
    const sixMinutes = 6 * 60 * 1000; // 6 minutes in milliseconds

    if (now - orderTime > sixMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled. Cancellation window has expired (6 minutes).'
      });
    }

    // Update order status to cancelled and add timeline entry
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId, userId },
      {
        status: 'Cancelled',
        $push: {
          statusTimeline: {
            status: 'Order Cancelled',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Handle refund for online payments
    if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'paid') {
      // Update payment status to refunded
      await Payment.findOneAndUpdate(
        { orderId },
        { paymentStatus: 'refunded' }
      );

      // Credit wallet
      const refundAmount = order.totalAmount;
      await User.findOneAndUpdate(
        { uid: userId },
        {
          $inc: { balance: refundAmount },
          $push: {
            walletTransactions: {
              type: 'credit',
              amount: refundAmount,
              description: `Refund for order ${orderId}`,
              reference: `REFUND_${orderId}`,
              status: 'completed'
            }
          }
        }
      );
    }

    res.json({
      success: true,
      order: {
        orderId: updatedOrder.orderId,
        status: updatedOrder.status,
        refundProcessed: order.paymentMethod === 'Razorpay' && order.paymentStatus === 'paid'
      },
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

// Get pending orders for seller
router.get('/seller/pending/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const orders = await Order.find({
      'storeDetails.sellerId': sellerId,
      status: 'Pending Seller Approval'
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error fetching seller pending orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Accept order by seller
router.put('/seller/accept/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body; // For verification

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending Seller Approval') {
      return res.status(400).json({ success: false, message: 'Order is not pending approval' });
    }

    // Check if deadline passed
    if (new Date() > order.sellerApprovalDeadline) {
      return res.status(400).json({ success: false, message: 'Approval deadline has passed' });
    }

    // Update order status
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'delivery_pending',
        $push: {
          statusTimeline: {
            status: 'Accepted by Seller',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Update seller wallet
    const sellerEarnings = order.subtotal; // Seller gets the subtotal, platform gets delivery fee

    await User.findOneAndUpdate(
      { uid: sellerId },
      {
        $inc: { balance: sellerEarnings },
        $push: {
          walletTransactions: {
            type: 'credit',
            amount: sellerEarnings,
            description: `Earnings from order ${orderId}`,
            reference: `ORDER_${orderId}`,
            status: 'completed'
          }
        }
      }
    );

    // Update product stocks
    try {
      const ProductModel = getSellerProductModel(sellerId);
      console.log(`Updating stock for seller: ${sellerId}`);
      
      for (const product of order.products) {
        console.log(`Attempting to update product ${product.id} - reducing stock by ${product.quantity}`);
        
        // Try to find and update the product
        const updatedProduct = await ProductModel.findByIdAndUpdate(
          product.id,
          { $inc: { stock: -product.quantity } },
          { new: true }
        );
        
        if (updatedProduct) {
          console.log(`✅ Stock updated for ${product.name}: ${updatedProduct.stock + product.quantity} → ${updatedProduct.stock}`);
        } else {
          console.warn(`⚠️ Product not found: ${product.id} (${product.name})`);
        }
      }
    } catch (stockError) {
      console.error('Error updating product stocks:', stockError);
      // Don't fail the order acceptance if stock update fails
      // Log it for admin review
    }

    // Notify customer about acceptance
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Accepted',
      message: `Your order has been accepted by the seller and is now pending delivery.`,
      data: {
        orderId
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ success: false, message: 'Failed to accept order' });
  }
});

// Reject order by seller
router.put('/seller/reject/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body; // For verification

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending Seller Approval') {
      return res.status(400).json({ success: false, message: 'Order is not pending approval' });
    }

    // Update order status to cancelled
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'Cancelled',
        $push: {
          statusTimeline: {
            status: 'Rejected by Seller',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Notify customer about rejection
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Rejected',
      message: `Your order ${orderId} has been rejected by the seller.`,
      data: {
        orderId,
        reason: 'Rejected by seller'
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ success: false, message: 'Failed to reject order' });
  }
});

// Get accepted (seller approval) orders for seller
router.get('/seller/accepted/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const orders = await Order.find({
      'storeDetails.sellerId': sellerId,
      status: { $in: ['delivery_pending', 'ready_for_delivery'] }
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error fetching seller accepted orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Process order (set to Processing status) by seller
router.put('/seller/process/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body;

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivery_pending') {
      return res.status(400).json({ success: false, message: 'Order is not pending delivery' });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'Processing',
        $push: {
          statusTimeline: {
            status: 'Order Processing Started',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Notify customer about processing start
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Processing Started',
      message: `Your order ${orderId} is now being processed by the seller.`,
      data: {
        orderId
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order processing started successfully'
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ success: false, message: 'Failed to process order' });
  }
});

// Mark order as ready for delivery by seller
router.put('/seller/ready-delivery/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body;

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'delivery_pending') {
      return res.status(400).json({ success: false, message: 'Order is not pending delivery' });
    }

    // Generate OTP if not exists
    const otp = order.deliveryOTP || Math.floor(100000 + Math.random() * 900000).toString();

    // Generate QR code URL if not exists
    const qrUrl = order.qrCodeUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/track/${order.orderId}`;

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'ready_for_delivery',
        deliveryOTP: otp,
        qrCodeUrl: qrUrl,
        $push: {
          statusTimeline: {
            status: 'Ready for Delivery',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Notify customer about order being ready for delivery
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Ready for Delivery',
      message: `Your order ${orderId} is now ready for delivery.`,
      data: {
        orderId
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order marked as ready for delivery'
    });
  } catch (error) {
    console.error('Error marking order ready for delivery:', error);
    res.status(500).json({ success: false, message: 'Failed to mark order ready for delivery' });
  }
});

// Get full order details for processing (with OTP/QR generation)
router.get('/seller/full/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.query;

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Generate OTP if not exists
    let otp = order.deliveryOTP;
    if (!otp) {
      otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      order.deliveryOTP = otp;
    }

    // Generate QR code URL if not exists
    let qrUrl = order.qrCodeUrl;
    if (!qrUrl) {
      qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/track/${order.orderId}`;
      order.qrCodeUrl = qrUrl;
    }

    // Save if updated
    if (!order.deliveryOTP || !order.qrCodeUrl) {
      await order.save();
    }

    // Get buyer contact info (assuming User model has phone, email)
    const User = (await import('../models/User.js')).default;
    const buyer = await User.findOne({ uid: order.userId });

    res.json({
      success: true,
      order: {
        ...order.toObject(),
        deliveryOTP: otp,
        qrCodeUrl: qrUrl,
        buyerContact: buyer ? {
          phone: buyer.phone,
          email: buyer.email,
          name: buyer.displayName || buyer.name
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching full order details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
});

// Get available orders for delivery partners
router.get('/delivery/available', async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'ready_for_delivery'
    })
    .populate('userId', 'displayName phone email')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({
      success: true,
      orders: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee,
        products: order.products,
        customerInfo: {
          name: order.userId?.displayName || order.userId?.email || order.customerInfo?.name || 'Customer',
          phone: order.userId?.phone || order.customerInfo?.phone || ''
        },
        deliveryAddress: order.deliveryAddress,
        storeDetails: order.storeDetails,
        deliveryPartnerId: order.deliveryPartnerId,
        deliveryPartnerInfo: order.deliveryPartnerInfo,
        createdAt: order.createdAt,
        deliveryOTP: order.status === 'out_for_delivery' ? order.deliveryOTP : null,
        qrCodeUrl: order.status === 'out_for_delivery' ? order.qrCodeUrl : null
      }))
    });
  } catch (error) {
    console.error('Error fetching available orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available orders' });
  }
});

// Get orders assigned to a specific delivery partner
router.get('/delivery/my-orders', async (req, res) => {
  try {
    const { deliveryPartnerId } = req.query;
    
    if (!deliveryPartnerId) {
      return res.status(400).json({ success: false, message: 'deliveryPartnerId is required' });
    }

    // Get both out_for_delivery and delivered orders for this delivery partner
    const orders = await Order.find({
      deliveryPartnerId: deliveryPartnerId,
      status: { $in: ['out_for_delivery', 'delivered'] }
    })
    .populate('userId', 'displayName phone email')
    .sort({ createdAt: -1 })
    .limit(100); // Increased limit to accommodate both active and today's completed deliveries

    res.json({
      success: true,
      orders: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee,
        products: order.products,
        customerInfo: {
          name: order.userId?.displayName || order.userId?.email || order.customerInfo?.name || 'Customer',
          phone: order.userId?.phone || order.customerInfo?.phone || ''
        },
        deliveryAddress: order.deliveryAddress,
        storeDetails: order.storeDetails,
        deliveryPartnerId: order.deliveryPartnerId,
        deliveryPartnerInfo: order.deliveryPartnerInfo,
        createdAt: order.createdAt,
        deliveryCompletedAt: order.deliveryCompletedAt,
        deliveryOTP: order.deliveryOTP,
        customerOTP: order.customerOTP,
        qrCodeUrl: order.qrCodeUrl
      }))
    });
  } catch (error) {
    console.error('Error fetching delivery partner orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery partner orders' });
  }
});

// Get store overview orders (active orders for delivery partners)
router.get('/delivery/store-overview', async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'delivery_pending'
    })
    .populate('userId', 'displayName phone email')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({
      success: true,
      orders: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee,
        products: order.products,
        customerInfo: {
          name: order.userId?.displayName || order.userId?.email || order.customerInfo?.name || 'Customer',
          phone: order.userId?.phone || order.customerInfo?.phone || ''
        },
        deliveryAddress: order.deliveryAddress,
        storeInfo: order.storeDetails,
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching store overview orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch store overview orders' });
  }
});

// Accept order for delivery (delivery partner)
router.put('/delivery/accept/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryPartnerId } = req.body;

    const order = await Order.findOne({ _id: orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'ready_for_delivery') {
      return res.status(400).json({ success: false, message: 'Order is not ready for delivery' });
    }

    // Fetch delivery partner details from User database
    const deliveryPartner = await User.findOne({ uid: deliveryPartnerId });
    
    if (!deliveryPartner) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    }

    // Prepare delivery partner info to store in order
    const deliveryPartnerInfo = {
      uid: deliveryPartner.uid,
      name: deliveryPartner.name,
      phone: deliveryPartner.phone || '',
      email: deliveryPartner.email || ''
    };

    // Only assign the delivery partner, don't change status yet
    // Status will be updated to 'out_for_delivery' after OTP verification
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        deliveryPartnerId: deliveryPartnerId,
        deliveryPartnerInfo: deliveryPartnerInfo,
        $push: {
          statusTimeline: {
            status: 'Delivery Partner Assigned',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Notify customer about delivery partner assignment
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Delivery Partner Assigned',
      message: `A delivery partner has been assigned to your order ${orderId}.`,
      data: {
        orderId
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Delivery partner assigned successfully. Please verify OTP to start delivery.'
    });
  } catch (error) {
    console.error('Error accepting order for delivery:', error);
    res.status(500).json({ success: false, message: 'Failed to accept order for delivery' });
  }
});

// Update order status to out_for_delivery
router.put('/seller/out-for-delivery/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body;

    const order = await Order.findOne({ _id: orderId, 'storeDetails.sellerId': sellerId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Order is not in processing status' });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'out_for_delivery',
        $push: {
          statusTimeline: {
            status: 'Out for Delivery',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // Notify customer
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Out for Delivery',
      message: `Your order ${orderId} is now out for delivery.`,
      data: {
        orderId
      }
    });

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order status updated to out for delivery'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// Update order status to delivery completed (triggered by delivery partner after customer OTP confirmation)
router.put('/delivery/complete/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerOTPInput } = req.body;

    console.log('📦 Delivery completion request:', { 
      orderId, 
      otpProvided: customerOTPInput ? 'YES' : 'NO',
      otpValue: customerOTPInput,
      otpType: typeof customerOTPInput
    });

    if (!customerOTPInput) {
      console.log('❌ No OTP provided');
      return res.status(400).json({ success: false, message: 'OTP is required' });
    }

    // Validate OTP format (must be exactly 6 digits)
    const otpString = String(customerOTPInput).trim();
    if (!/^\d{6}$/.test(otpString)) {
      console.log('❌ Invalid OTP format:', { otpString, length: otpString.length });
      return res.status(400).json({ success: false, message: 'Invalid OTP format. Must be 6 digits.' });
    }

    // Find order by either _id or orderId string
    let order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderId: orderId }
      ]
    });

    if (!order) {
      console.log('❌ Order not found:', { orderId });
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    console.log('✅ Order found:', { 
      orderNumber: order.orderNumber,
      status: order.status, 
      hasCustomerOTP: !!order.customerOTP,
      customerOTPValue: order.customerOTP,
      customerOTPType: typeof order.customerOTP
    });

    // Check if order status is correct
    if (order.status !== 'out_for_delivery') {
      console.log('❌ Order not out for delivery. Current status:', order.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order status is "${order.status}". Must be "out_for_delivery" to complete delivery.` 
      });
    }

    if (!order.customerOTP) {
      console.log('❌ No customerOTP in order');
      return res.status(400).json({ success: false, message: 'Customer OTP not generated for this order' });
    }

    // Normalize OTP for comparison (convert to string to handle any type issues)
    const providedOTP = String(customerOTPInput).trim();
    const storedOTP = String(order.customerOTP).trim();
    
    console.log('🔐 Comparing OTPs:', { 
      provided: providedOTP,
      providedLength: providedOTP.length,
      stored: storedOTP,
      storedLength: storedOTP.length,
      match: providedOTP === storedOTP,
      providedCharCodes: providedOTP.split('').map(c => c.charCodeAt(0)),
      storedCharCodes: storedOTP.split('').map(c => c.charCodeAt(0))
    });

    // Check if OTP matches the customerOTP for the selected order
    if (providedOTP !== storedOTP) {
      console.log('❌ OTP mismatch!');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP. Please check the OTP and try again.' 
      });
    }

    console.log('✅ OTP Verification Successful! Updating order status to delivered');

    // Update order status to delivered
    order.status = 'delivered';
    order.deliveryCompletedAt = new Date();
    
    // Ensure statusTimeline exists and is an array
    if (!Array.isArray(order.statusTimeline)) {
      order.statusTimeline = [];
    }
    
    order.statusTimeline.push({
      status: 'Delivered',
      timestamp: new Date()
    });

    // Update payment status if payment method is COD
    if (order.paymentMethod === 'cod' || order.paymentMethod === 'COD') {
      order.paymentStatus = 'paid';
      console.log('💰 Payment status updated to paid (COD payment received)');
    }

    try {
      await order.save();
      console.log('✅ Order saved successfully:', { 
        status: order.status, 
        deliveryCompletedAt: order.deliveryCompletedAt,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod
      });
    } catch (saveError) {
      console.error('❌ Error saving order:', saveError);
      throw new Error(`Failed to save order: ${saveError.message}`);
    }

    // Credit delivery fee to delivery partner's wallet using DeliveryWallet model
    try {
      const deliveryFee = order.deliveryFee || 0;
      const deliveryPartnerId = order.deliveryPartnerId;
      
      if (deliveryPartnerId && deliveryFee > 0) {
        console.log('💰 Crediting delivery fee to delivery partner wallet:', { 
          deliveryPartnerId, 
          deliveryFee 
        });
        
        // Get or create delivery wallet
        let wallet = await DeliveryWallet.findOne({ userId: deliveryPartnerId });
        
        if (!wallet) {
          wallet = new DeliveryWallet({
            userId: deliveryPartnerId,
            totalEarnings: 0,
            totalWithdrawn: 0,
            balance: 0,
            transactions: []
          });
        }
        
        // Add earnings to wallet
        wallet.addEarnings(
          deliveryFee,
          order.orderId || order._id.toString(),
          `Delivery earnings for order ${order.orderNumber || order.orderId}`
        );
        
        await wallet.save();
        
        console.log('✅ Delivery fee credited successfully. New balance:', wallet.balance);
        console.log('   Total earnings:', wallet.totalEarnings);
      }
    } catch (walletError) {
      console.error('⚠️ Warning: Failed to credit delivery fee to wallet:', walletError);
      // Don't fail the entire request if wallet update fails
    }

    try {
      await Notification.create({
        userId: order.userId,
        type: 'order',
        title: 'Order Delivered',
        message: `Your order ${order.orderNumber || orderId} has been delivered successfully.`,
        data: {
          orderId: order._id,
          status: 'Delivered'
        }
      });
    } catch (notifError) {
      console.error('⚠️ Warning: Failed to create notification:', notifError);
      // Don't fail the entire request if notification fails
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        customerOTP: order.customerOTP,
        deliveryPartnerId: order.deliveryPartnerId,
        deliveryCompletedAt: order.deliveryCompletedAt,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus
      },
      message: 'Order delivered successfully'
    });
  } catch (error) {
    console.error('Error completing delivery:', error);
    res.status(500).json({ success: false, message: 'Invalid OTP', error: error.message });
  }
});

// New endpoint: Verify OTP for delivery partner
router.put('/delivery/verify-otp/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryPartnerId, otp } = req.body;

    console.log('🔍 Verify OTP Request:', { orderId, deliveryPartnerId, otp });

    // Find the order by either _id or orderId string
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderId: orderId }
      ]
    });

    if (!order) {
      console.log('❌ Order not found');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    console.log('✅ Order found:', { orderNumber: order.orderNumber, status: order.status, deliveryOTP: order.deliveryOTP });

    // Check if order is ready for delivery
    if (order.status !== 'ready_for_delivery') {
      console.log('❌ Order not ready for delivery, current status:', order.status);
      return res.status(400).json({ success: false, message: 'Order is not ready for delivery' });
    }

    // Check if OTP matches (this is the seller's OTP for pickup)
    if (order.deliveryOTP !== otp) {
      console.log('❌ Invalid OTP. Expected:', order.deliveryOTP, 'Received:', otp);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    console.log('✅ OTP verified successfully');

    // Fetch delivery partner details if not already stored
    let deliveryPartnerInfo = order.deliveryPartnerInfo;
    
    if (!deliveryPartnerInfo || !deliveryPartnerInfo.uid) {
      const deliveryPartner = await User.findOne({ uid: deliveryPartnerId });
      
      if (deliveryPartner) {
        deliveryPartnerInfo = {
          uid: deliveryPartner.uid,
          name: deliveryPartner.name,
          phone: deliveryPartner.phone || '',
          email: deliveryPartner.email || ''
        };
      }
    }

    // Generate customer OTP for delivery completion
    const customerOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔢 Generated customerOTP:', customerOTP);

    // Update order status to out_for_delivery and assign to delivery partner
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: 'out_for_delivery',
        deliveryPartnerId: deliveryPartnerId,
        deliveryPartnerInfo: deliveryPartnerInfo,
        customerOTP: customerOTP,
        $push: {
          statusTimeline: {
            status: 'Out for Delivery',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    console.log('✅ Order updated:', { 
      status: updatedOrder.status, 
      customerOTP: updatedOrder.customerOTP, 
      deliveryPartnerId: updatedOrder.deliveryPartnerId 
    });

    // Notify customer
    await Notification.create({
      userId: order.userId,
      type: 'order',
      title: 'Order Out for Delivery',
      message: `Your order ${order.orderNumber || orderId} is now out for delivery.`,
      data: {
        orderId: order._id
      }
    });

    console.log('✅ Customer notified');

    res.json({
      success: true,
      order: updatedOrder,
      message: 'OTP verified successfully. Order is now out for delivery.'
    });
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
});

// Get order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Fetching order:', orderId);
    
    // Try to find by orderId first, then by _id
    const order = await Order.findOne({ 
      $or: [
        { orderId: orderId },
        { _id: orderId }
      ]
    }).populate('userId', 'displayName phone email');

    if (!order) {
      console.log('❌ Order not found');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    console.log('✅ Order found:', {
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryOTP: order.deliveryOTP,
      customerOTP: order.customerOTP,
      deliveryPartnerId: order.deliveryPartnerId
    });

    const responseData = {
      _id: order._id,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      products: order.products,
      customerInfo: {
        name: order.userId?.displayName || order.userId?.email || order.customerInfo?.name || 'Customer',
        phone: order.userId?.phone || order.customerInfo?.phone || ''
      },
      deliveryAddress: order.deliveryAddress,
      storeDetails: order.storeDetails,
      statusTimeline: order.statusTimeline,
      deliveryOTP: order.deliveryOTP,
      customerOTP: order.customerOTP,
      qrCodeUrl: order.qrCodeUrl,
      deliveryPartnerId: order.deliveryPartnerId,
      deliveryPartnerInfo: order.deliveryPartnerInfo,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    };

    console.log('📤 Response includes customerOTP:', !!responseData.customerOTP);

    res.json({
      success: true,
      order: responseData
    });
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// Get order history for seller (all orders including delivered and cancelled)
router.get('/seller/:sellerId/history', async (req, res) => {
  try {
    const { sellerId } = req.params;
    // Get all orders for this seller, sorted by timestamp descending
    const orders = await Order.find({
      'storeDetails.sellerId': sellerId
    })
    .sort({ timestamp: -1 })
    .limit(100); // Limit to 100 most recent orders

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error fetching seller order history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order history' });
  }
});

// Get delivery partner earnings history
router.get('/delivery/:deliveryPartnerId/earnings', async (req, res) => {
  try {
    const { deliveryPartnerId } = req.params;
    
    console.log('🔍 Fetching earnings for delivery partner:', deliveryPartnerId);
    
    // Get all delivered orders for this delivery partner
    const orders = await Order.find({
      deliveryPartnerId: deliveryPartnerId,
      status: 'delivered'
    })
    .populate('userId', 'displayName phone email')
    .sort({ deliveryCompletedAt: -1 })
    .limit(100);

    console.log(`✅ Found ${orders.length} delivered orders`);

    // Group orders by date and calculate earnings
    const earningsByDate = {};
    let totalEarnings = 0;
    const today = new Date().toISOString().split('T')[0];
    let todayEarnings = 0;
    let todayDeliveries = 0;

    orders.forEach(order => {
      const deliveryDate = order.deliveryCompletedAt 
        ? new Date(order.deliveryCompletedAt).toISOString().split('T')[0]
        : new Date(order.timestamp).toISOString().split('T')[0];
      
      const deliveryFee = order.deliveryFee || 0;
      totalEarnings += deliveryFee;

      if (deliveryDate === today) {
        todayEarnings += deliveryFee;
        todayDeliveries++;
      }

      if (!earningsByDate[deliveryDate]) {
        earningsByDate[deliveryDate] = {
          date: deliveryDate,
          deliveries: [],
          totalEarnings: 0,
          deliveryCount: 0
        };
      }

      earningsByDate[deliveryDate].deliveries.push({
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        deliveryFee: deliveryFee,
        totalAmount: order.totalAmount,
        customerInfo: {
          name: order.userId?.displayName || order.userId?.email || 'Customer',
          phone: order.userId?.phone || ''
        },
        deliveryAddress: order.deliveryAddress,
        deliveryCompletedAt: order.deliveryCompletedAt,
        timestamp: order.timestamp
      });

      earningsByDate[deliveryDate].totalEarnings += deliveryFee;
      earningsByDate[deliveryDate].deliveryCount++;
    });

    // Convert to array and sort by date descending
    const earningsArray = Object.values(earningsByDate).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    console.log('📊 Earnings summary:', {
      totalEarnings,
      todayEarnings,
      todayDeliveries,
      daysWithDeliveries: earningsArray.length
    });

    res.json({
      success: true,
      data: {
        totalEarnings,
        todayEarnings,
        todayDeliveries,
        earningsByDate: earningsArray,
        totalDeliveries: orders.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching delivery partner earnings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
});

export default router;