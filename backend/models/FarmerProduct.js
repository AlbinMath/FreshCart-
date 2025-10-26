import mongoose from 'mongoose';

// Farmer Product Schema - matches your MySQL table structure
export const farmerProductSchema = new mongoose.Schema({
  // Basic product information
  productName: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['vegetables', 'fruits', 'dairy', 'meat', 'seafood', 'other'] 
  },
  description: { type: String, trim: true, default: '' },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  imagePath: { type: String, trim: true, default: '' },
  
  // Farmer details
  farmerId: { type: String, required: true, index: true },
  farmerName: { type: String, required: true },
  farmerEmail: { type: String, required: true },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: String, default: '' },
  approvalDate: { type: Date },
  rejectionReason: { type: String, default: '' },
  
  // Seller acceptance tracking
  acceptedBySellers: [{
    sellerId: { type: String, required: true },
    sellerName: { type: String, required: true },
    acceptedAt: { type: Date, default: Date.now },
    storeDetails: {
      storeName: { type: String },
      storeAddress: { type: String }
    }
  }],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better query performance
farmerProductSchema.index({ farmerId: 1, status: 1 });
farmerProductSchema.index({ category: 1, status: 1 });
farmerProductSchema.index({ submissionDate: -1 });
farmerProductSchema.index({ 'acceptedBySellers.sellerId': 1 });

// Create the model
const FarmerProduct = mongoose.models.FarmerProduct || mongoose.model('FarmerProduct', farmerProductSchema);

export default FarmerProduct;