import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import { logActivity } from '../middleware/activityLogger.js';
import ProductApprovalService from '../services/productApprovalService.js';
import Notification from '../models/Notification.js';
import DeliveryVerification from '../models/DeliveryVerification.js';
import { authenticateToken } from '../middleware/auth.js';
import deliveryVerificationService from '../services/deliveryVerificationService.js';
import Order from '../models/Order.js';


const router = express.Router();

// Try authenticate if Authorization header is present; otherwise continue
const tryAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, next);
    }
    return next();
  } catch (e) {
    return next();
  }
};

// Require admin (token optional). If no token, identify by headers: x-actor-email or x-actor-uid
const requireAdmin = [
  tryAuth,
  async (req, res, next) => {
    try {
      let userDoc = null;

      if (req.user) {
        userDoc = req.user.id
          ? await User.findById(req.user.id).select('_id role email uid')
          : await User.findOne({ uid: req.user.uid }).select('_id role email uid');
      } else {
        const actorUid = req.headers['x-actor-uid'];
        const actorEmail = (req.headers['x-actor-email'] || '').toString().toLowerCase();
        if (actorUid) {
          userDoc = await User.findOne({ uid: actorUid }).select('_id role email uid');
        } else if (actorEmail) {
          userDoc = await User.findOne({ email: actorEmail }).select('_id role email uid');
        }
      }

      if (!userDoc || userDoc.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
      }

      // Normalize req.user for downstream handlers
      req.user = req.user || {};
      req.user.id = userDoc._id.toString();
      req.user.role = 'admin';
      req.user.email = req.user.email || userDoc.email;
      req.user.uid = req.user.uid || userDoc.uid;

      return next();
    } catch (e) {
      console.error('requireAdmin error:', e);
      return res.status(500).json({ success: false, message: 'Authentication error' });
    }
  }
];

// Apply admin guard to all routes below
router.use(requireAdmin);

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    res.json(users);

  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get system statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const pendingVerification = await User.countDocuments({ emailVerified: false });
    const totalStores = await User.countDocuments({ role: 'store' });
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    res.json({
      totalUsers,
      verifiedUsers,
      pendingVerification,
      totalStores,
      totalSellers,
      totalCustomers,
      totalAdmins
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all stores (admin only)
router.get('/stores', async (req, res) => {
  try {
    const stores = await User.find({ role: 'store' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(stores);

  } catch (error) {
    console.error('Stores fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all sellers (admin only)
router.get('/sellers', async (req, res) => {
  try {
    const sellers = await User.find({ role: 'seller' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(sellers);

  } catch (error) {
    console.error('Sellers fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get single seller by id (admin only)
router.get('/sellers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    const seller = await User.findById(id).select('-password');
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, seller });
  } catch (error) {
    console.error('Seller fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Approve seller verification
router.patch('/sellers/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    const seller = await User.findById(id);
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    seller.isVerified = true;
    seller.verificationStatus = 'approved';
    // Also reflect in licenseInfo when present
    if (seller.licenseInfo) {
      seller.licenseInfo.status = 'approved';
      seller.licenseInfo.verifiedAt = new Date();
      seller.licenseInfo.verifiedBy = req.user?.id || seller.licenseInfo.verifiedBy;
      seller.licenseInfo.rejectionReason = '';
    }
    await seller.save();
    const sanitized = seller.toObject();
    delete sanitized.password;
    res.json({ success: true, message: 'Seller verification approved', seller: sanitized });
  } catch (error) {
    console.error('Approve seller error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Reject seller verification
router.patch('/sellers/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }
    const seller = await User.findById(id);
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    seller.isVerified = false;
    seller.verificationStatus = 'rejected';
    if (seller.licenseInfo) {
      seller.licenseInfo.status = 'rejected';
      seller.licenseInfo.verifiedAt = new Date();
      seller.licenseInfo.verifiedBy = req.user?.id || seller.licenseInfo.verifiedBy;
      seller.licenseInfo.rejectionReason = String(reason).trim();
    }
    await seller.save();
    const sanitized = seller.toObject();
    delete sanitized.password;
    res.json({ success: true, message: 'Seller verification rejected', seller: sanitized });
  } catch (error) {
    console.error('Reject seller error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// [Removed] Seller license approval endpoint has been disabled intentionally to remove the feature.
// router.put('/sellers/:userId/license-approval', async (req, res) => {
//   return res.status(410).json({ success: false, message: 'License approval feature removed' });
// });

// Get all products for admin verification
router.get('/products', async (req, res) => {
  try {
    const { getSellerProductModel } = await import('../models/Product.js');
    const sellers = await User.find({ role: 'seller' }).select('uid sellerUniqueNumber name email');
    
    let allProducts = [];
    
    for (const seller of sellers) {
      try {
        const ProductModel = getSellerProductModel(seller.sellerUniqueNumber || seller.uid);
        const products = await ProductModel.find({}).lean();
        
        // Add seller info and normalize status field for each product
        const productsWithSeller = products.map(product => ({
          ...product,
          status: product.status || product.approvalStatus || 'pending',
          sellerInfo: {
            uid: seller.uid,
            name: seller.name,
            email: seller.email,
            sellerUniqueNumber: seller.sellerUniqueNumber
          }
        }));
        
        allProducts = allProducts.concat(productsWithSeller);
      } catch (err) {
        console.log(`No products found for seller ${seller.uid}:`, err.message);
      }
    }
    
    // Sort by creation date (newest first)
    allProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(allProducts);

  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Approve/Reject product (admin only)
router.put('/products/:sellerId/:productId/approval', async (req, res) => {
  try {
    const { sellerId, productId } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'
    
    const { getSellerProductModel } = await import('../models/Product.js');
    const ProductModel = getSellerProductModel(sellerId);
    
    const updateData = {
      status: action === 'approve' ? 'approved' : 'rejected',
      approvedBy: req.user?.email || 'admin',
      approvalDate: new Date()
    };
    
    if (action === 'reject' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    const product = await ProductModel.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: `Product ${action}d successfully`,
      product
    });

  } catch (error) {
    console.error('Product approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Activate/Deactivate user (admin only)
router.put('/users/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { isActive: true } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log activity
    try { await Activity.create({ actorUid: req.headers['x-actor-uid'] || 'unknown', actorEmail: req.headers['x-actor-email'] || '', actorRole: 'admin', targetUserId: user._id, action: 'activate', details: {} }); } catch(e) {}

    res.json({
      success: true,
      message: 'User activated successfully',
      user
    });

  } catch (error) {
    console.error('User activation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Deactivate user (admin only)
router.put('/users/:userId/deactivate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { isActive: false } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log activity
    try { await Activity.create({ actorUid: req.headers['x-actor-uid'] || 'unknown', actorEmail: req.headers['x-actor-email'] || '', actorRole: 'admin', targetUserId: user._id, action: 'deactivate', details: {} }); } catch(e) {}

    res.json({
      success: true,
      message: 'User deactivated successfully',
      user
    });

  } catch (error) {
    console.error('User deactivation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Verify user email (admin only)
router.put('/users/:userId/verify-email', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { emailVerified: true } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    try { await Activity.create({ actorUid: req.headers['x-actor-uid'] || 'unknown', actorEmail: req.headers['x-actor-email'] || '', actorRole: 'admin', targetUserId: user._id, action: 'verify-email', details: {} }); } catch(e) {}

    res.json({ success: true, message: 'User email verified successfully', user });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Verify role (e.g., seller approval)
router.put('/users/:userId/verify-role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, verified } = req.body || {};

    // Basic check: only allow toggling for store/seller roles
    if (!['store','seller'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Only store/seller roles are verifiable' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== role) return res.status(400).json({ success: false, message: 'Role mismatch' });

    // Simple flag on accountStatus to reflect verification (pending -> active)
    if (typeof verified === 'boolean') {
      user.accountStatus = verified ? 'active' : 'pending';
    }
    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;

    try { await Activity.create({ actorUid: req.headers['x-actor-uid'] || 'unknown', actorEmail: req.headers['x-actor-email'] || '', actorRole: 'admin', targetUserId: user._id, action: 'verify-role', details: { role, verified } }); } catch(e) {}

    return res.json({ success: true, message: 'Role verification updated', user: sanitized });
  } catch (error) {
    console.error('Verify role error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Change user role (admin only)
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['customer', 'store', 'seller', 'admin', 'delivery'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    try { await Activity.create({ actorUid: req.headers['x-actor-uid'] || 'unknown', actorEmail: req.headers['x-actor-email'] || '', actorRole: 'admin', targetUserId: user._id, action: 'update-role', details: { role } }); } catch(e) {}

    res.json({ success: true, message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get activity logs (admin only)
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50, role, actorEmail } = req.query;
    const filter = {};
    if (role) filter.actorRole = role;
    if (actorEmail) filter.actorEmail = actorEmail.toLowerCase();
    const logs = await Activity.find(filter).sort({ createdAt: -1 }).limit(Math.min(parseInt(limit, 10) || 50, 200));
    res.json(logs);
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Get user analytics (admin only)
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case '1y':
        dateFilter = { createdAt: { $gte: new Date(now - 365 * 24 * 60 * 60 * 1000) } };
        break;
    }

    const newUsers = await User.countDocuments(dateFilter);
    const newStores = await User.countDocuments({ ...dateFilter, role: 'store' });
    const newSellers = await User.countDocuments({ ...dateFilter, role: 'seller' });

    res.json({
      period,
      newUsers,
      newStores,
      newSellers
    });

  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get activity statistics
router.get('/activities/stats', async (req, res) => {
  try {
    const [byRole, byAction, byStatus, recentActivities] = await Promise.all([
      // Group by role
      Activity.aggregate([
        { $group: { _id: '$actorRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Group by action type
      Activity.aggregate([
        { $group: { _id: '$actionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Group by status
      Activity.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Recent activities
      Activity.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        byRole,
        byAction,
        byStatus,
        recentActivities
      }
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity statistics',
      error: error.message
    });
  }
});

// Get activity details
router.get('/activities/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findById(req.params.id).lean();
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity details',
      error: error.message
    });
  }
});

// Delete activity
router.delete('/activities/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findByIdAndDelete(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete activity',
      error: error.message
    });
  }
});

// Clean up old activities
router.delete('/activities', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await Activity.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} activities older than ${days} days`
    });
  } catch (error) {
    console.error('Error cleaning up activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up activities',
      error: error.message
    });
  }
});

// Product Approval Routes
router.get('/products/pending', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await ProductApprovalService.getPendingProducts(parseInt(page), parseInt(limit));
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching pending products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending products',
      error: error.message
    });
  }
});

// Update product approval status
router.put('/products/:sellerUid/:productId/status', async (req, res) => {
  try {
    const { sellerUid, productId } = req.params;
    const { status, reason = '' } = req.body;
    const adminUid = req.user?.uid; // Assuming you have user info in req.user from auth middleware

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "approved" or "rejected"'
      });
    }

    const product = await ProductApprovalService.updateProductStatus(
      sellerUid,
      productId,
      { status, adminUid, reason }
    );

    res.json({
      success: true,
      message: `Product ${status} successfully`,
      data: product
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: error.message
    });
  }
});

// Get seller's products with optional status filter
router.get('/sellers/:sellerUid/products', async (req, res) => {
  try {
    const { sellerUid } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await ProductApprovalService.getSellerProducts(sellerUid, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch seller products',
      error: error.message
    });
  }
});

// Get notifications for admin
router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const adminUid = req.user?.uid;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ uid: adminUid })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Notification.countDocuments({ uid: adminUid, read: false })
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        page: parseInt(page),
        totalPages: Math.ceil(notifications.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const adminUid = req.user?.uid;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, uid: adminUid },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// DELIVERY VERIFICATION ADMIN ROUTES

// DELIVERY VERIFICATION ADMIN ROUTES

// GET /api/admin/delivery-verifications
router.get('/delivery-verifications', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (search) {
      filter.search = search;
    }

    const pagination = {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      status,
      sortBy,
      sortOrder
    };

    const { verifications, pagination: meta } = await deliveryVerificationService.getAllVerifications(filter, pagination);

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

    const transformed = verifications.map(verification => ({
      id: verification._id,
      uid: verification.uid,
      status: verification.status,
      fullName: verification.fullName || verification.userId?.name || '',
      email: verification.userId?.email || '',
      phone: verification.phoneNumber || verification.userId?.phone || '',
      address: verification.address || '',
      vehicleType: verification.vehicle?.type || '',
      vehicleNumber: verification.vehicle?.registrationNumber || '',
      vehicleMake: verification.vehicle?.make || '',
      vehicleModel: verification.vehicle?.model || '',
      vehicleYear: verification.vehicle?.year || '',
      vehicleColor: verification.vehicle?.color || '',
      emergencyContact: verification.emergencyContact || {},
      submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt,
      reviewedBy: verification.reviewedBy,
      rejectionReason: verification.rejectionReason,
      reviewComments: verification.reviewComments,
      completionPercentage: verification.completionPercentage,
      isDraft: verification.isDraft,
      verificationProgress: verification.completionPercentage,
      license: {
        licenseNumber: verification.drivingLicense?.licenseNumber || '',
        expiryDate: verification.drivingLicense?.expiryDate,
        frontImageUrl: verification.drivingLicense?.frontImage?.url || 
                       (verification.drivingLicense?.frontImage?.filename ? 
                        `${baseUrl}/uploads/delivery-verification/${verification.drivingLicense.frontImage.filename}` : ''),
        backImageUrl: verification.drivingLicense?.backImage?.url || 
                      (verification.drivingLicense?.backImage?.filename ? 
                       `${baseUrl}/uploads/delivery-verification/${verification.drivingLicense.backImage.filename}` : '')
      },
      vehicle: {
        type: verification.vehicle?.type || '',
        registrationNumber: verification.vehicle?.registrationNumber || '',
        make: verification.vehicle?.make || '',
        model: verification.vehicle?.model || '',
        year: verification.vehicle?.year || '',
        color: verification.vehicle?.color || '',
        frontImageUrl: verification.vehicle?.frontImage?.url || 
                       (verification.vehicle?.frontImage?.filename ? 
                        `${baseUrl}/uploads/delivery-verification/${verification.vehicle.frontImage.filename}` : ''),
        backImageUrl: verification.vehicle?.backImage?.url || 
                      (verification.vehicle?.backImage?.filename ? 
                       `${baseUrl}/uploads/delivery-verification/${verification.vehicle.backImage.filename}` : ''),
        rcUrl: verification.vehicle?.rcImage?.url || 
               (verification.vehicle?.rcImage?.filename ? 
                `${baseUrl}/uploads/delivery-verification/${verification.vehicle.rcImage.filename}` : '')
      }
    }));

    res.json({
      success: true,
      data: transformed,
      pagination: meta || null
    });
  } catch (error) {
    console.error('Error fetching delivery verification requests:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch delivery verification requests'
    });
  }
});

// GET /api/admin/delivery-verification/:id
router.get('/delivery-verification/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await DeliveryVerification.findById(id)
      .populate('userId', 'name email phone profilePicture uid')
      .populate('reviewedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verification not found'
      });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

    // Transform the response to match the frontend requirements
    const transformedData = {
      id: verification._id,
      userId: verification.userId?._id,
      uid: verification.uid,
      personalInfo: {
        fullName: verification.fullName || '',
        phone: verification.phoneNumber || '',
        email: verification.userId?.email || '',
        address: verification.address || ''
      },
      license: {
        number: verification.drivingLicense?.licenseNumber || '',
        expiryDate: verification.drivingLicense?.expiryDate || null,
        frontImageUrl: verification.drivingLicense?.frontImage?.url || 
                       (verification.drivingLicense?.frontImage?.filename ? 
                        `${baseUrl}/uploads/delivery-verification/${verification.drivingLicense.frontImage.filename}` : ''),
        backImageUrl: verification.drivingLicense?.backImage?.url || 
                      (verification.drivingLicense?.backImage?.filename ? 
                       `${baseUrl}/uploads/delivery-verification/${verification.drivingLicense.backImage.filename}` : '')
      },
      vehicle: {
        vehicleType: verification.vehicle?.type || '',
        registrationNumber: verification.vehicle?.registrationNumber || '',
        make: verification.vehicle?.make || '',
        model: verification.vehicle?.model || '',
        year: verification.vehicle?.year || null,
        color: verification.vehicle?.color || '',
        frontImageUrl: verification.vehicle?.frontImage?.url || 
                       (verification.vehicle?.frontImage?.filename ? 
                        `${baseUrl}/uploads/delivery-verification/${verification.vehicle.frontImage.filename}` : ''),
        backImageUrl: verification.vehicle?.backImage?.url || 
                      (verification.vehicle?.backImage?.filename ? 
                       `${baseUrl}/uploads/delivery-verification/${verification.vehicle.backImage.filename}` : ''),
        rcUrl: verification.vehicle?.rcImage?.url || 
               (verification.vehicle?.rcImage?.filename ? 
                `${baseUrl}/uploads/delivery-verification/${verification.vehicle.rcImage.filename}` : '')
      },
      emergencyContact: {
        name: verification.emergencyContact?.name || '',
        relationship: verification.emergencyContact?.relationship || '',
        phone: verification.emergencyContact?.phoneNumber || ''
      },
      verificationProgress: verification.completionPercentage || 0,
      status: verification.status,
      submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt,
      reviewedBy: verification.reviewedBy,
      approvedBy: verification.approvedBy,
      approvedAt: verification.approvedAt,
      rejectionReason: verification.rejectionReason || null,
      reviewComments: verification.reviewComments || '',
      isDraft: verification.isDraft || false,
      verificationHistory: verification.verificationHistory || []
    };

    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    console.error('Error fetching delivery verification details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch verification details'
    });
  }
});

// Get all orders (admin only)
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 50, sortBy = 'timestamp', sortOrder = 'desc', search } = req.query;
    
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Add search functionality for order number, customer email, etc.
    if (search && search.trim()) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    const [orders, totalCount] = await Promise.all([
      Order.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);
    
    console.log(`📦 Admin fetching ${orders.length} orders (page ${page}, filter: ${status || 'all'})`);
    
    // Enrich orders with user details
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          // Fetch customer details
          const customer = await User.findOne({ uid: order.userId }).select('name email phone profilePicture uid');
          
          // Fetch delivery partner details if assigned
          const deliveryPartner = order.deliveryPartnerId 
            ? await User.findOne({ uid: order.deliveryPartnerId }).select('name email phone uid')
            : null;
          
          // Fetch seller details from storeDetails
          let sellerDetails = order.storeDetails || {};
          if (order.storeDetails?.sellerId) {
            try {
              const seller = await User.findOne({ uid: order.storeDetails.sellerId }).select('name email phone storeName storeAddress');
              if (seller) {
                sellerDetails = {
                  ...sellerDetails,
                  sellerName: seller.name,
                  sellerEmail: seller.email,
                  sellerPhone: seller.phone,
                  storeName: seller.storeName || sellerDetails.storeName,
                  storeAddress: seller.storeAddress || sellerDetails.storeAddress
                };
              }
            } catch (sellerErr) {
              console.warn('Error fetching seller details:', sellerErr.message);
            }
          }
          
          return {
            ...order,
            // Customer information
            customerInfo: customer ? {
              uid: customer.uid,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              profilePicture: customer.profilePicture
            } : {
              uid: order.userId,
              name: 'Unknown Customer',
              email: 'N/A',
              phone: 'N/A'
            },
            // Delivery partner information (from fetched data or stored info)
            deliveryPartnerDetails: deliveryPartner ? {
              uid: deliveryPartner.uid,
              name: deliveryPartner.name,
              email: deliveryPartner.email,
              phone: deliveryPartner.phone
            } : order.deliveryPartnerInfo || null,
            // Enhanced store details
            storeDetails: sellerDetails,
            // Include OTPs for admin view (important for order verification)
            deliveryOTP: order.deliveryOTP || null,
            customerOTP: order.customerOTP || null,
            // Include QR code if available
            qrCodeUrl: order.qrCodeUrl || null
          };
        } catch (err) {
          console.error('Error enriching order:', order.orderId, err.message);
          // Return order with minimal enrichment on error
          return {
            ...order,
            customerInfo: {
              uid: order.userId,
              name: 'Unknown',
              email: 'N/A',
              phone: 'N/A'
            },
            deliveryPartnerDetails: order.deliveryPartnerInfo || null,
            storeDetails: order.storeDetails || {}
          };
        }
      })
    );
    
    // Calculate summary statistics
    const stats = {
      total: totalCount,
      pending: await Order.countDocuments({ status: 'Pending Seller Approval' }),
      deliveryPending: await Order.countDocuments({ status: 'delivery_pending' }),
      readyForDelivery: await Order.countDocuments({ status: 'ready_for_delivery' }),
      outForDelivery: await Order.countDocuments({ status: 'out_for_delivery' }),
      delivered: await Order.countDocuments({ status: { $in: ['delivered', 'Completed', 'delivery_completed'] } }),
      cancelled: await Order.countDocuments({ status: 'Cancelled' })
    };
    
    console.log('📊 Order statistics:', stats);
    
    res.json({
      success: true,
      orders: enrichedOrders,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Get order details by ID (admin only)
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`🔍 Admin fetching order details for: ${orderId}`);
    
    const order = await Order.findOne({ orderId }).lean();
    
    if (!order) {
      console.warn(`⚠️ Order not found: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Enrich with comprehensive user details
    const customer = await User.findOne({ uid: order.userId }).select('name email phone profilePicture uid');
    const deliveryPartner = order.deliveryPartnerId 
      ? await User.findOne({ uid: order.deliveryPartnerId }).select('name email phone uid')
      : null;
    
    // Fetch enhanced seller details
    let sellerDetails = order.storeDetails || {};
    if (order.storeDetails?.sellerId) {
      try {
        const seller = await User.findOne({ uid: order.storeDetails.sellerId }).select('name email phone storeName storeAddress');
        if (seller) {
          sellerDetails = {
            ...sellerDetails,
            sellerName: seller.name,
            sellerEmail: seller.email,
            sellerPhone: seller.phone,
            storeName: seller.storeName || sellerDetails.storeName,
            storeAddress: seller.storeAddress || sellerDetails.storeAddress
          };
        }
      } catch (sellerErr) {
        console.warn('Error fetching seller details:', sellerErr.message);
      }
    }
    
    const enrichedOrder = {
      ...order,
      // Customer information
      customerInfo: customer ? {
        uid: customer.uid,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        profilePicture: customer.profilePicture
      } : {
        uid: order.userId,
        name: 'Unknown Customer',
        email: 'N/A',
        phone: 'N/A'
      },
      // Delivery partner information
      deliveryPartnerDetails: deliveryPartner ? {
        uid: deliveryPartner.uid,
        name: deliveryPartner.name,
        email: deliveryPartner.email,
        phone: deliveryPartner.phone
      } : order.deliveryPartnerInfo || null,
      // Enhanced store details
      storeDetails: sellerDetails,
      // Include all OTPs and tracking info
      deliveryOTP: order.deliveryOTP || null,
      customerOTP: order.customerOTP || null,
      qrCodeUrl: order.qrCodeUrl || null,
      // Include payment details
      razorpayOrderId: order.razorpayOrderId || null,
      razorpayPaymentId: order.razorpayPaymentId || null
    };
    
    console.log(`✅ Successfully enriched order: ${orderId}`);
    
    res.json({
      success: true,
      order: enrichedOrder
    });
  } catch (error) {
    console.error('❌ Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

// Update order status (admin only) - for future admin controls
router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    
    console.log(`📝 Admin updating order ${orderId} status to: ${status}`);
    
    // Validate status
    const validStatuses = [
      'Pending Seller Approval',
      'delivery_pending',
      'approved',
      'Processing',
      'ready_for_delivery',
      'out_for_delivery',
      'Under Delivery',
      'delivery_completed',
      'delivered',
      'Completed',
      'Cancelled'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status',
        validStatuses
      });
    }
    
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update order status and add to timeline
    order.status = status;
    order.statusTimeline.push({
      status: `Admin updated status to ${status}`,
      timestamp: new Date(),
      notes: notes || `Status updated by admin`
    });
    
    await order.save();
    
    // Create notification for customer
    try {
      await Notification.create({
        userId: order.userId,
        type: 'order',
        title: 'Order Status Updated',
        message: `Your order ${order.orderNumber} status has been updated to: ${status}`,
        data: {
          orderId: order.orderId,
          status
        }
      });
    } catch (notifErr) {
      console.warn('Failed to create notification:', notifErr.message);
    }
    
    console.log(`✅ Order ${orderId} status updated successfully`);
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        orderId: order.orderId,
        status: order.status,
        statusTimeline: order.statusTimeline
      }
    });
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// POST /api/admin/delivery-verification/:id/review
router.post('/delivery-verification/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve or reject'
      });
    }

    if (action === 'reject' && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const adminUid = req.user?.uid || req.user?.id;
    if (!adminUid) {
      return res.status(403).json({
        success: false,
        message: 'Admin identity required'
      });
    }

    const updated = await deliveryVerificationService.reviewVerification(
      id,
      adminUid,
      action,
      comments,
      rejectionReason
    );

    // Notify delivery partner
    try {
      await notificationService.createNotification({
        uid: updated.uid,
        title: action === 'approve' ? 'Delivery Verification Approved' : 'Delivery Verification Rejected',
        message: action === 'approve'
          ? 'Congratulations! Your delivery partner verification has been approved.'
          : `Your delivery partner verification was rejected. Reason: ${updated.rejectionReason || 'No reason provided.'}`,
        category: 'delivery_verification',
        metadata: {
          verificationId: updated._id,
          status: updated.status,
          reviewedAt: updated.reviewedAt
        }
      });
    } catch (notifyError) {
      console.warn('Notification creation failed:', notifyError.message);
    }

    res.json({
      success: true,
      message: `Verification ${action}d successfully`,
      data: updated
    });
  } catch (error) {
    console.error(`Error reviewing delivery verification:`, error);
    res.status(500).json({
      success: false,
      message: error.message || `Failed to review verification`
    });
  }
});

export default router;
