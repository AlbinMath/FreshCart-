import admin from '../config/firebaseAdmin.js';
import User from '../models/User.js';

// Verify Firebase ID Token from Authorization: Bearer <token>
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let idToken = null;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.slice(7);
    } else if (req.query && req.query.token) {
      idToken = req.query.token;
    }

    if (!idToken) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(idToken, true);

    // Attach decoded info to request
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      // Optional custom claims: role, userId if you set them
      role: decoded.role || decoded.claims?.role,
      id: decoded.userId || decoded.claims?.userId,
    };

    // If database userId not present, try to look up by uid
    if (!req.user.id) {
      const dbUser = await User.findOne({ uid: decoded.uid }).select('_id role email');
      if (dbUser) {
        req.user.id = dbUser._id.toString();
        req.user.role = req.user.role || dbUser.role;
        req.user.email = req.user.email || dbUser.email;
      }
    }

    return next();
  } catch (error) {
    const code = error?.code || error?.errorInfo?.code;
    if (code === 'auth/id-token-revoked') {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }
    if (code === 'auth/argument-error' || code === 'auth/invalid-id-token') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Middleware to check if seller has approved license
export const requireApprovedLicense = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Only apply to seller/store roles
    if (!['seller', 'store'].includes(req.user.role)) {
      return next();
    }

    // Find user and check license status
    const user = await User.findById(req.user.id).select('licenseInfo role');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if license is approved
    if (!user.licenseInfo || user.licenseInfo.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Business license must be approved to access seller features',
        licenseStatus: user.licenseInfo?.status || 'not_uploaded',
        rejectionReason: user.licenseInfo?.rejectionReason || null
      });
    }

    next();
  } catch (error) {
    console.error('License check middleware error:', error);
    return res.status(500).json({ success: false, message: 'License verification error' });
  }
};