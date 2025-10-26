import mongoose from 'mongoose';

// Keep categories aligned with User.sellerCategory enum
export const PRODUCT_CATEGORIES = [
  'vegetables', 'fruits', 'dairy', 'meat', 'seafood', 'other'
];

// Base product schema (reused across seller-specific collections)
export const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  category: { type: String, required: true, enum: PRODUCT_CATEGORIES },
  price: { type: Number, required: true, min: 0 }, // Selling price
  mrpPrice: { type: Number, min: 0 }, // Maximum Retail Price (optional)
  stock: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 10, min: 0 }, // Threshold for low stock alerts
  images: [{ type: String, trim: true }],
  // Product status for admin verification
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: String, default: '' }, // Admin who approved/rejected
  approvalDate: { type: Date },
  rejectionReason: { type: String, default: '' },
  // Helpful for debugging or cross-seller aggregations, though each seller has its own collection
  sellerRef: {
    uid: { type: String, required: true, index: true },
    sellerUniqueNumber: { type: String, default: '' }
  }
}, { timestamps: true });

// Cache for dynamic models to prevent OverwriteModelError
const modelCache = new Map();

// Resolve a stable, safe collection name for a seller
function collectionNameForSeller(identifier) {
  // Ensure only allowed chars in collection name
  const safe = String(identifier || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `products_${safe}`; // e.g., products_ABC123
}

// Get or create a mongoose model bound to the seller-specific collection
export function getSellerProductModel(sellerIdentifier) {
  const collectionName = collectionNameForSeller(sellerIdentifier);
  // Use collectionName also as model key to keep them unique
  if (modelCache.has(collectionName)) return modelCache.get(collectionName);

  // Third arg sets the physical collection name
  const Model = mongoose.models[collectionName]
    || mongoose.model(collectionName, productSchema, collectionName);

  modelCache.set(collectionName, Model);
  return Model;
}