import express from 'express';
import User from '../models/User.js';
import { logActivity } from '../middleware/activityLogger.js';
import { authenticateToken } from '../middleware/auth.js';

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

      // Normalize req.user and req.admin
      req.user = req.user || {};
      req.user.id = userDoc._id.toString();
      req.user.role = 'admin';
      req.user.email = req.user.email || userDoc.email;
      req.user.uid = req.user.uid || userDoc.uid;
      req.admin = userDoc;

      return next();
    } catch (e) {
      console.error('requireAdmin error:', e);
      return res.status(500).json({ success: false, message: 'Authentication error' });
    }
  }
];

// Get all pending license verifications
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const query = {
      role: 'seller',
      'licenseInfo.status': 'pending'
    };
    
    const total = await User.countDocuments(query);
    const sellers = await User.find(query)
      .select('name email storeName licenseInfo createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      sellers
    });
    
  } catch (error) {
    console.error('Get pending licenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending licenses',
      error: error.message
    });
  }
});

// Verify seller license (approve/reject)
router.post('/verify/:sellerId', requireAdmin, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status, rejectionReason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "approved" or "rejected"'
      });
    }
    
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a license'
      });
    }
    
    const updateData = {
      'licenseInfo.status': status,
      'licenseInfo.verifiedAt': new Date(),
      'licenseInfo.verifiedBy': req.admin._id,
      'licenseInfo.rejectionReason': status === 'rejected' ? rejectionReason : ''
    };
    
    const seller = await User.findByIdAndUpdate(
      sellerId,
      updateData,
      { new: true }
    );
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    // Log activity
    await logActivity(
      req.admin._id,
      'license_verification',
      `${status} business license for ${seller.storeName || seller.name}`,
      {
        sellerId: seller._id,
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined
      }
    );
    
    res.status(200).json({
      success: true,
      message: `License ${status} successfully`,
      seller
    });
    
  } catch (error) {
    console.error('Verify license error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify license',
      error: error.message
    });
  }
});

// Get seller license details
router.get('/seller/:sellerId', requireAdmin, async (req, res) => {
  try {
    const { sellerId } = req.params;
    
    const seller = await User.findById(sellerId)
      .select('name email storeName phone licenseInfo createdAt')
      .populate('licenseInfo.verifiedBy', 'name email');
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }
    
    res.status(200).json({
      success: true,
      seller
    });
    
  } catch (error) {
    console.error('Get seller license error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller license details',
      error: error.message
    });
  }
});

export default router;
