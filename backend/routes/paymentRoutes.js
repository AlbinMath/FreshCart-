import express from 'express';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Cart from '../models/Cart.js';

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: 'rzp_test_RL7iTlLIMH8nZY',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret_key_here' // In production, use env variable
});

// Middleware: require authenticated customer
async function requireCustomer(req, res, next) {
  try {
    const uid = req.headers['x-uid'] || req.body.uid || req.query.uid;
    if (!uid) return res.status(401).json({ success: false, message: 'UID required' });

    const user = await User.findOne({ uid });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can make payments' });
    }

    req.customer = user;
    next();
  } catch (err) {
    console.error('Customer auth error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Create Razorpay order
router.post('/create-order', requireCustomer, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    // Get user's cart to validate
    const cart = await Cart.findOne({ customerUid: req.customer.uid });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Validate cart total matches the amount
    if (cart.totalAmount !== amount) {
      return res.status(400).json({ success: false, message: 'Cart total does not match payment amount' });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paisa
      currency: 'INR',
      receipt: `receipt_${Date.now()}_${req.customer.uid}`,
      notes: {
        userId: req.customer.uid,
        email: req.customer.email
      }
    };

    const order = await razorpay.orders.create(options);

    // Save payment record with status 'created'
    const payment = new Payment({
      userId: req.customer.uid,
      orderId: order.id,
      paymentId: '', // Will be filled on success
      amount: amount,
      status: 'created',
      cartItems: cart.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        category: item.category
      }))
    });

    await payment.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: 'rzp_test_RL7iTlLIMH8nZY' // Public key for frontend
      }
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// Handle payment success
router.post('/payment-success', requireCustomer, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification data missing' });
    }

    // Verify payment signature
    const crypto = await import('crypto');
    const expectedSignature = crypto.default
      .createHmac('sha256', razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Update payment status to failed
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: 'failed', paymentId: razorpay_payment_id }
      );
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: 'paid'
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Clear the cart after successful payment
    await Cart.findOneAndDelete({ customerUid: req.customer.uid });

    res.json({
      success: true,
      message: 'Payment successful',
      payment: {
        id: payment._id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.amount,
        status: payment.status
      }
    });
  } catch (err) {
    console.error('Payment success error:', err);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
});

// Handle payment failure
router.post('/payment-failed', requireCustomer, async (req, res) => {
  try {
    const { orderId, paymentId, error } = req.body;

    await Payment.findOneAndUpdate(
      { orderId },
      {
        paymentId: paymentId || '',
        status: 'failed',
        notes: error?.description || 'Payment failed'
      }
    );

    res.json({ success: true, message: 'Payment failure recorded' });
  } catch (err) {
    console.error('Payment failed error:', err);
    res.status(500).json({ success: false, message: 'Failed to record payment failure' });
  }
});

// Get payment history for customer
router.get('/history', requireCustomer, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.customer.uid })
      .sort({ timestamp: -1 })
      .select('orderId paymentId amount status timestamp cartItems');

    res.json({ success: true, payments });
  } catch (err) {
    console.error('Get payment history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
  }
});

export default router;