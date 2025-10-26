import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'failed', 'refunded']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  cartItems: [{
    productId: String,
    productName: String,
    quantity: Number,
    price: Number,
    category: String,
    isVeg: Boolean
  }],
  deliveryAddress: {
    name: String,
    phone: String,
    address: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  subtotal: {
    type: Number,
    default: 0
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  }
});

// Index for faster queries
paymentSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model('Payment', paymentSchema);