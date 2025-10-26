import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import deliveryVerificationService from '../services/deliveryVerificationService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const auth = authenticateToken;
import cors from 'cors';

// Enable CORS for all routes
router.use(cors());

// Debug log to confirm routes are being loaded
console.log('🚚 Loading delivery verification routes...');

// Test route to verify routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Delivery verification routes are working!' });
});

// Create upload directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'uploads', 'delivery-verification');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${req.params.uid}-${req.body.documentType}-${req.body.imageType}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Middleware to check if user is delivery partner
const checkDeliveryRole = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only delivery partners can access this resource.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking user role'
    });
  }
};

// Middleware to check if user is admin
const checkAdminRole = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin access required.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking admin role'
    });
  }
};

// GET /api/delivery-verification/:uid/status - Get verification status
router.get('/:uid/status', async (req, res) => {
  try {
    console.log('📥 GET verification status for UID:', req.params.uid);
    const { uid } = req.params;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can access this verification
    // if (req.user.uid !== uid && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied'
    //   });
    // }

    console.log('🔍 About to call service method...');
    const result = await deliveryVerificationService.getVerificationStatus(uid);
    console.log('📤 Verification status result:', result);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error getting verification status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get verification status'
    });
  }
});

// POST /api/delivery-verification/:uid - Create or update verification
router.post('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can update this verification
    // if (req.user.uid !== uid) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You can only update your own verification'
    //   });
    // }

    const verificationData = req.body;
    console.log('📥 Received verification data for UID:', uid);
    console.log('📋 Data:', JSON.stringify(verificationData, null, 2));
    
    // Basic validation - only check if we have at least some data
    if (!verificationData.fullName && !verificationData.phoneNumber && !verificationData.address &&
        !verificationData.drivingLicense?.licenseNumber && !verificationData.vehicle?.registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least some basic information'
      });
    }

    const verification = await deliveryVerificationService.createOrUpdateVerification(uid, verificationData);
    
    res.json({
      success: true,
      message: 'Verification saved successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error saving verification:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to save verification'
    });
  }
});

// POST /api/delivery-verification/:uid/upload - Upload verification documents
router.post('/:uid/upload', upload.single('file'), async (req, res) => {
  try {
    const { uid } = req.params;
    const { documentType, imageType } = req.body;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can upload to this verification
    // if (req.user.uid !== uid) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You can only upload to your own verification'
    //   });
    // }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate documentType and imageType
    const validDocumentTypes = ['license', 'vehicle'];
    const validImageTypes = {
      license: ['front', 'back'],
      vehicle: ['front', 'back', 'rc']
    };

    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    if (!validImageTypes[documentType].includes(imageType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid image type for ${documentType}`
      });
    }

    const verification = await deliveryVerificationService.uploadDocument(
      uid, 
      documentType, 
      imageType, 
      req.file
    );
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload document'
    });
  }
});

// DELETE /api/delivery-verification/:uid/document - Delete uploaded document
router.delete('/:uid/document', async (req, res) => {
  try {
    const { uid } = req.params;
    const { documentType, imageType } = req.query;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can delete from this verification
    // if (req.user.uid !== uid) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You can only delete from your own verification'
    //   });
    // }

    if (!documentType || !imageType) {
      return res.status(400).json({
        success: false,
        message: 'documentType and imageType are required'
      });
    }

    const verification = await deliveryVerificationService.deleteDocument(uid, documentType, imageType);
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete document'
    });
  }
});

// POST /api/delivery-verification/:uid/submit - Submit verification for review
router.post('/:uid/submit', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can submit this verification
    // if (req.user.uid !== uid) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You can only submit your own verification'
    //   });
    // }

    const verification = await deliveryVerificationService.submitForReview(uid);
    
    res.json({
      success: true,
      message: 'Verification submitted for review successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit verification'
    });
  }
});

// ADMIN ROUTES

// GET /api/delivery-verification/admin/all - Get all verifications for admin review
router.get('/admin/all', auth, checkAdminRole, async (req, res) => {
  try {
    const { page, limit, status, search, sortBy, sortOrder } = req.query;
    
    const filter = {};
    if (search) filter.search = search;

    const pagination = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      sortBy: sortBy || 'submittedAt',
      sortOrder: sortOrder || 'desc'
    };

    const result = await deliveryVerificationService.getAllVerifications(filter, pagination);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting verifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get verifications'
    });
  }
});

// POST /api/delivery-verification/admin/review/:id - Review verification (approve/reject)
router.post('/admin/review/:id', auth, checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments, rejectionReason } = req.body;
    
    if (!action || !['approve', 'reject', 'request_resubmission'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve, reject, or request_resubmission'
      });
    }

    if ((action === 'reject' || action === 'request_resubmission') && !comments && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Comments or rejection reason required for rejection/resubmission request'
      });
    }

    const verification = await deliveryVerificationService.reviewVerification(
      id, 
      req.user.uid, 
      action, 
      comments, 
      rejectionReason
    );
    
    res.json({
      success: true,
      message: `Verification ${action}d successfully`,
      data: verification
    });
  } catch (error) {
    console.error('Error reviewing verification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to review verification'
    });
  }
});

// GET /api/delivery-verification/admin/stats - Get verification statistics
router.get('/admin/stats', auth, checkAdminRole, async (req, res) => {
  try {
    const stats = await deliveryVerificationService.getVerificationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting verification stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get verification statistics'
    });
  }
});

// POST /api/delivery-verification/admin/cleanup - Clean up orphaned files
router.post('/admin/cleanup', auth, checkAdminRole, async (req, res) => {
  try {
    const result = await deliveryVerificationService.cleanupOrphanedFiles();
    
    res.json({
      success: true,
      message: result.message,
      data: { cleanedFiles: result.cleaned }
    });
  } catch (error) {
    console.error('Error cleaning up files:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cleanup files'
    });
  }
});

// GET /api/delivery-verification/:uid/check-access - Check if user can access dashboard
router.get('/:uid/check-access', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // For now, allow access for testing - TODO: add auth back
    // Check if user can access this verification
    // if (req.user.uid !== uid && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied'
    //   });
    // }

    const result = await deliveryVerificationService.isUserVerified(uid);
    
    res.json({
      success: true,
      data: {
        canAccessDashboard: result.isVerified,
        isVerified: result.isVerified,
        status: result.status,
        message: result.isVerified 
          ? 'Access granted' 
          : 'Verification required to access dashboard and accept orders'
      }
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed per upload'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed (JPEG, PNG, GIF, etc.)'
    });
  }
  
  next(error);
});

console.log('🚚 Delivery verification routes loaded successfully');
export default router;
