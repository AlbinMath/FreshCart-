import mongoose from 'mongoose';

// Seller-Farmer Transaction Schema
export const sellerFarmerTransactionSchema = new mongoose.Schema({
  // Transaction details
  transactionId: { type: String, required: true, unique: true },
  
  // Seller information
  sellerId: { type: String, required: true, index: true },
  sellerName: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  
  // Farmer information
  farmerId: { type: String, required: true, index: true },
  farmerName: { type: String, required: true },
  farmerEmail: { type: String, required: true },
  
  // Product details
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  productCategory: { type: String, required: true },
  productDescription: { type: String, default: '' },
  productImagePath: { type: String, default: '' },
  
  // Purchase details
  quantityPurchased: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: { type: String, default: '' },
  paymentReference: { type: String, default: '' },
  
  // Delivery information
  deliveryAddress: { type: String, default: '' },
  deliveryDate: { type: Date },
  deliveryNotes: { type: String, default: '' },
  
  // Additional metadata
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better query performance
sellerFarmerTransactionSchema.index({ sellerId: 1, status: 1 });
sellerFarmerTransactionSchema.index({ farmerId: 1, status: 1 });
sellerFarmerTransactionSchema.index({ transactionId: 1 });
sellerFarmerTransactionSchema.index({ createdAt: -1 });

// Generate unique transaction ID
sellerFarmerTransactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.transactionId = `SFT-${timestamp}-${random}`;
  }
  next();
});

// Create the model
const SellerFarmerTransaction = mongoose.models.SellerFarmerTransaction || 
  mongoose.model('SellerFarmerTransaction', sellerFarmerTransactionSchema);

export default SellerFarmerTransaction;




