import mongoose from 'mongoose';
import { calculateTotal } from '../utils/deliveryUtils.js';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sellerCollection: {
    type: String,
    required: true
  },
  sellerUid: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  category: {
    type: String,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  customerUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  itemCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  this.itemCount = this.items.reduce((sum, item) => {
    return sum + item.quantity;
  }, 0);

  const totals = calculateTotal(this.subtotal);
  this.deliveryFee = totals.deliveryFee;
  this.totalAmount = totals.totalAmount;

  next();
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;