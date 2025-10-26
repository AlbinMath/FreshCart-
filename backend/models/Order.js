import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  products: [{
    id: String,
    name: String,
    price: Number,
    quantity: Number,
    image: String,
    isVeg: Boolean
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  deliveryFee: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Razorpay', 'UPI', 'Wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending Seller Approval', 'delivery_pending', 'approved', 'Processing', 'ready_for_delivery', 'out_for_delivery', 'Under Delivery', 'delivery_completed', 'delivered', 'Completed', 'Cancelled'],
    default: 'Pending Seller Approval'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // For Razorpay
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'due_on_delivery'],
    default: 'pending'
  },
  storeDetails: {
    type: Object, // Store seller/store info
    required: true
  },
  deliveryAddress: {
    type: Object, // Store the full address object
    required: true
  },
  statusTimeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  sellerApprovalDeadline: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    }
  },
  deliveryOTP: {
    type: String
  },
  customerOTP: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },
  deliveryPartnerId: {
    type: String
  },
  deliveryPartnerInfo: {
    uid: {
      type: String
    },
    name: {
      type: String
    },
    phone: {
      type: String
    },
    email: {
      type: String
    }
  },
  deliveryCompletedAt: {
    type: Date
  }
});

// Create connection to ordersDB
const ordersConnection = mongoose.createConnection(process.env.MONGODB_URI, {
  dbName: 'ordersDB'
});

const Order = ordersConnection.model('Order', orderSchema);

export default Order;