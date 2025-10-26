import { getSellerProductModel } from '../models/Product.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

class ProductApprovalService {
  static async getPendingProducts(page = 1, limit = 10) {
    const allPendingProducts = [];
    
    // Get all sellers
    const sellers = await User.find({ role: { $in: ['seller', 'store'] } });
    
    // Check each seller's product collection for pending products
    for (const seller of sellers) {
      const ProductModel = getSellerProductModel(seller.uid);
      const products = await ProductModel.find({ 
        $or: [
          { status: 'pending' },
          { status: { $exists: false }, approvalStatus: 'pending' }
        ]
      }).lean();
      
      // Add seller info to each product
      const productsWithSeller = products.map(product => ({
        ...product,
        status: product.status || product.approvalStatus || 'pending',
        seller: {
          uid: seller.uid,
          displayName: seller.displayName || seller.email,
          storeName: seller.storeName
        }
      }));
      
      allPendingProducts.push(...productsWithSeller);
    }
    
    // Implement pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = allPendingProducts.slice(startIndex, endIndex);
    
    return {
      products: paginatedProducts,
      total: allPendingProducts.length,
      page,
      totalPages: Math.ceil(allPendingProducts.length / limit)
    };
  }
  
  static async updateProductStatus(sellerUid, productId, { approvalStatus, adminUid, reason = '' }) {
    const ProductModel = getSellerProductModel(sellerUid);
    const updateData = {
      approvalStatus,
      approvedBy: adminUid,
      approvalDate: new Date()
    };
    
    if (approvalStatus === 'rejected') {
      updateData.rejectionReason = reason;
    }
    
    const product = await ProductModel.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true }
    );
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Notify seller about the status update
    const notification = new Notification({
      userId: sellerUid,
      type: 'product-approval-update',
      title: `Product ${approvalStatus}`,
      message: `Your product "${product.name}" has been ${approvalStatus}`,
      data: {
        productId: product._id,
        approvalStatus,
        reason: approvalStatus === 'rejected' ? reason : undefined
      }
    });
    await notification.save();
    
    return product;
  }

  static async getSellerProducts(sellerUid, { approvalStatus, page = 1, limit = 10 } = {}) {
    const ProductModel = getSellerProductModel(sellerUid);
    const query = {};

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }
    
    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ProductModel.countDocuments(query)
    ]);
    
    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

export default ProductApprovalService;
