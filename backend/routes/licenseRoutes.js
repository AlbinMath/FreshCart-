import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

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

// Require seller (token optional). If no token, identify by headers: x-actor-email or x-actor-uid
const requireSeller = [
  tryAuth,
  async (req, res, next) => {
    try {
      // Resolve user identity from token or headers
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

      if (!userDoc) {
        return res.status(403).json({ success: false, message: 'Seller identification required' });
      }

      if (!['seller', 'store'].includes(userDoc.role)) {
        return res.status(403).json({ success: false, message: 'Seller access required' });
      }

      req.sellerId = userDoc._id.toString();
      next();
    } catch (e) {
      console.error('requireSeller error:', e);
      res.status(500).json({ success: false, message: 'Authentication error' });
    }
  }
];


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/licenses/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files (JPG/PNG)
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG) are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to validate license info
const validateLicenseInfo = (licenseNumber, file, isUpdate = false) => {
  const errors = [];
  
  // Validate license number format (2 letters + 6 digits)
  const licenseRegex = /^[A-Za-z]{2}\d{6}$/; // e.g., AB123456
  if (!licenseNumber || !licenseRegex.test(licenseNumber)) {
    errors.push('License number must be in the format: 2 letters followed by 6 digits (e.g., AB123456)');
  }
  
  // For new uploads, file is required
  if (!isUpdate && !file) {
    errors.push('License file is required');
  }
  
  return errors;
};

// @route   POST /api/license/upload
// @desc    Upload seller's business license (new sellers)
// @access  Private (Seller)
router.post('/upload', requireSeller, upload.single('licenseFile'), async (req, res) => {
  try {
    const { licenseNumber, expiryDate } = req.body;
    const sellerId = req.sellerId;

    // Validate input
    const validationErrors = validateLicenseInfo(licenseNumber, req.file);
    if (validationErrors.length > 0) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Find the seller
    const seller = await User.findById(sellerId);
    if (!seller) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Delete old file if it exists (ignore errors)
    if (seller.licenseInfo?.file?.path) {
      try {
        if (fs.existsSync(seller.licenseInfo.file.path)) {
          fs.unlinkSync(seller.licenseInfo.file.path);
        }
      } catch (e) {
        console.warn('Could not delete old license file:', e.message);
      }
    }

    // Prepare license info
    const licenseInfo = {
      licenseNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: 'pending',
      rejectionReason: '',
      verifiedAt: null,
      verifiedBy: null,
      file: {
        url: `/uploads/licenses/${req.file.filename}`,
        path: req.file.path,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    };

    // Update seller's license info and root license number (required by schema)
    seller.licenseInfo = licenseInfo;
    seller.licenseNumber = licenseNumber;
    await seller.save();

    // Notifications removed — skipping admin license notification creation

    res.json({ 
      success: true, 
      message: 'License uploaded successfully',
      licenseInfo: seller.licenseInfo
    });

  } catch (error) {
    console.error('Error uploading license:', error);
    // Clean up uploaded file if an error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Return validation issues as 400 for better UX
    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: details.length ? details : [error.message]
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/license/update
// @desc    Update seller's business license (existing sellers)
// @access  Private (Seller)
router.put('/update', requireSeller, upload.single('licenseFile'), async (req, res) => {
  try {
    const { licenseNumber, expiryDate } = req.body;
    const sellerId = req.sellerId;
    const isFileUploaded = !!req.file;

    // For updates, file is optional
    const validationErrors = validateLicenseInfo(licenseNumber, req.file, true);
    if (validationErrors.length > 0) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Find the seller
    const seller = await User.findById(sellerId);
    if (!seller) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Prepare license info update
    const updateData = {
      'licenseInfo.licenseNumber': licenseNumber,
      'licenseInfo.expiryDate': expiryDate ? new Date(expiryDate) : null,
      'licenseInfo.status': 'pending', // Reset status to pending for review
      'licenseInfo.rejectionReason': '', // Clear any previous rejection reason
      'licenseInfo.verifiedAt': null,
      'licenseInfo.verifiedBy': null,
      // Keep root-level licenseNumber in sync to satisfy schema requirements
      'licenseNumber': licenseNumber
    };

    // If file was uploaded, update file info
    if (isFileUploaded) {
      // Delete old file if it exists (ignore errors)
      if (seller.licenseInfo?.file?.path) {
        try {
          if (fs.existsSync(seller.licenseInfo.file.path)) {
            fs.unlinkSync(seller.licenseInfo.file.path);
          }
        } catch (e) {
          console.warn('Could not delete old license file:', e.message);
        }
      }

      updateData['licenseInfo.file'] = {
        url: `/uploads/licenses/${req.file.filename}`,
        path: req.file.path,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      };
    }

    // Update seller's license info
    const updatedSeller = await User.findByIdAndUpdate(
      sellerId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({ 
      success: true, 
      message: 'License updated successfully',
      licenseInfo: updatedSeller.licenseInfo
    });

  } catch (error) {
    console.error('Error updating license:', error);
    // Clean up uploaded file if an error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/license/status
// @desc    Get seller's license status
// @access  Private (Seller)
router.get('/status', requireSeller, async (req, res) => {
  try {
    const seller = await User.findById(req.sellerId)
      .select('licenseInfo')
      .lean();

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    res.json({ 
      success: true, 
      licenseInfo: seller.licenseInfo || null 
    });

  } catch (error) {
    console.error('Error getting license status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/license/link
// @desc    Submit a URL to an external license document (no file upload)
// @access  Private (Seller)
router.post('/link', requireSeller, async (req, res) => {
  try {
    const { licenseNumber, licenseUrl, expiryDate } = req.body;

    const errors = [];
    // Allow both uppercase and lowercase two letters followed by six digits
    const licenseRegex = /^[A-Za-z]{2}\d{6}$/;
    if (!licenseNumber || !licenseRegex.test(licenseNumber)) {
      errors.push('License number must be in the format: 2 letters followed by 6 digits (e.g., AB123456 or ab123456)');
    }
    if (!licenseUrl || typeof licenseUrl !== 'string' || !/^https?:\/\//i.test(licenseUrl)) {
      errors.push('A valid URL starting with http(s):// is required');
    }
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const seller = await User.findById(req.sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Clear any previous file and save external link
    seller.licenseInfo = {
      licenseNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: 'pending',
      rejectionReason: '',
      verifiedAt: null,
      verifiedBy: null,
      file: { url: '', path: '', filename: '', mimetype: '', size: 0 },
      externalLink: licenseUrl
    };
    await seller.save();

    res.json({ success: true, message: 'License link submitted', licenseInfo: seller.licenseInfo });
  } catch (error) {
    console.error('Error submitting license link:', error);
    res.status(500).json({ success: false, message: 'Server error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// @route   GET /api/license/requirements
// @desc    Get license verification requirements
// @access  Public
router.get('/requirements', (req, res) => {
  res.json({
    success: true,
    requirements: {
      licenseNumber: {
        format: '2 letters followed by 6 digits (e.g., AB123456)',
        pattern: '^[A-Za-z]{2}\\d{6}$',
        required: true
      },
      file: {
        types: ['image/jpeg', 'image/png'],
        maxSize: '5MB',
        required: true
      }
    }
  });
});

// Admin routes for license verification
// Require authenticated admin
const requireAdmin = [
  authenticateToken,
  async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
      next();
    } catch (e) {
      console.error('requireAdmin error:', e);
      res.status(500).json({ success: false, message: 'Authentication error' });
    }
  }
];

// @route   GET /api/admin/pending-licenses
// @desc    Get all pending license applications for admin review
// @access  Private (Admin)
router.get('/admin/pending-licenses', requireAdmin, async (req, res) => {
  try {
    const licenses = await User.find({
      role: { $in: ['seller', 'store'] },
      'licenseInfo.status': { $exists: true }
    })
    .select('_id name email role storeName businessLicense licenseInfo createdAt')
    .sort({ 'licenseInfo.createdAt': -1 })
    .lean();

    const formattedLicenses = licenses.map(user => ({
      _id: user._id,
      sellerName: user.name,
      storeName: user.storeName,
      email: user.email,
      role: user.role,
      businessLicense: user.businessLicense,
      licenseNumber: user.licenseInfo?.licenseNumber,
      status: user.licenseInfo?.status || 'pending',
      documentUrl: user.licenseInfo?.file?.url,
      rejectionReason: user.licenseInfo?.rejectionReason,
      verifiedAt: user.licenseInfo?.verifiedAt,
      verifiedBy: user.licenseInfo?.verifiedBy,
      createdAt: user.licenseInfo?.createdAt || user.createdAt
    }));

    res.json(formattedLicenses);
  } catch (error) {
    console.error('Error fetching pending licenses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/license/:licenseId/approve
// @desc    Approve a seller's business license
// @access  Private (Admin)
router.post('/admin/license/:licenseId/approve', requireAdmin, async (req, res) => {
  try {
    const { licenseId } = req.params;
    const adminId = req.user.id;

    const seller = await User.findById(licenseId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    if (!seller.licenseInfo) {
      return res.status(400).json({ success: false, message: 'No license information found' });
    }

    // Update license status to approved
    seller.licenseInfo.status = 'approved';
    seller.licenseInfo.verifiedAt = new Date();
    seller.licenseInfo.verifiedBy = adminId;
    seller.licenseInfo.rejectionReason = '';

    await seller.save();

    // Create notification for seller about license approval
    try {
      await Notification.createLicenseStatusNotification(seller._id, 'approved');
    } catch (notificationError) {
      console.error('Error creating license approval notification:', notificationError);
      // Don't fail the approval if notification creation fails
    }

    res.json({ 
      success: true, 
      message: 'License approved successfully',
      licenseInfo: seller.licenseInfo
    });

  } catch (error) {
    console.error('Error approving license:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/license/:licenseId/reject
// @desc    Reject a seller's business license
// @access  Private (Admin)
router.post('/admin/license/:licenseId/reject', requireAdmin, async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rejection reason is required' 
      });
    }

    const seller = await User.findById(licenseId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    if (!seller.licenseInfo) {
      return res.status(400).json({ success: false, message: 'No license information found' });
    }

    // Update license status to rejected
    seller.licenseInfo.status = 'rejected';
    seller.licenseInfo.rejectionReason = rejectionReason.trim();
    seller.licenseInfo.verifiedAt = new Date();
    seller.licenseInfo.verifiedBy = adminId;

    await seller.save();

    // Create notification for seller about license rejection
    try {
      await Notification.createLicenseStatusNotification(seller._id, 'rejected', rejectionReason.trim());
    } catch (notificationError) {
      console.error('Error creating license rejection notification:', notificationError);
      // Don't fail the rejection if notification creation fails
    }

    res.json({ 
      success: true, 
      message: 'License rejected successfully',
      licenseInfo: seller.licenseInfo
    });

  } catch (error) {
    console.error('Error rejecting license:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
