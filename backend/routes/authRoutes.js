import express from 'express';
import User from '../models/User.js';
import { logUserActivity } from '../middleware/activityLogger.js';

const router = express.Router();

// Register User (no JWT issuance; frontend uses Firebase ID token)
router.post('/register', async (req, res) => {
  try {
    const { 
      uid, name, email, password, role, phone, 
      storeName, businessLicense, storeAddress, sellerCategory,
      vehicleType, licenseNumber, adminLevel, provider 
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { uid }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email or UID' 
      });
    }

    // Seller requires a storeAddress
    if (role === 'seller' && (!storeAddress || String(storeAddress).trim() === '')) {
      return res.status(400).json({ success: false, message: 'storeAddress is required for seller accounts' });
    }

    // Create new user with role-specific fields
    const userData = {
      uid,
      name,
      email,
      role,
      phone,
      provider: provider || 'email',
      // Auto-verify customers only; others require admin verification
      emailVerified: role === 'customer'
    };

    // Add password only if not Google user
    if (!provider || provider !== 'google') {
      userData.password = password;
    }

    // Add role-specific fields
    if (role === 'store') {
      userData.storeName = storeName;
      userData.businessLicense = businessLicense;
      userData.storeAddress = storeAddress;
    } else if (role === 'seller') {
      // Map businessLicense to licenseInfo.licenseNumber for sellers
      userData.licenseInfo = {
        licenseNumber: businessLicense
      };
      userData.sellerCategory = sellerCategory;
      userData.storeAddress = storeAddress; // enforce presence above
    } else if (role === 'delivery') {
      userData.vehicleType = vehicleType;
      userData.licenseNumber = licenseNumber;
    } else if (role === 'admin') {
      userData.adminLevel = adminLevel;
    }

    const user = new User(userData);

    await user.save();

    // Log user registration activity
    await logUserActivity(
      user.uid,
      user.email,
      user.role,
      'user-registration',
      { provider: user.provider, accountStatus: user.accountStatus }
    );

    // Return user data (without password). No JWT returned now.
    const userResponse = {
      _id: user._id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      provider: user.provider,
      emailVerified: user.emailVerified,
      storeName: user.storeName
    };

    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Login User (no JWT issuance; frontend should use Firebase sign-in to obtain ID token)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Return user data (without password). No JWT returned.
    const userResponse = {
      _id: user._id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      provider: user.provider,
      emailVerified: user.emailVerified,
      storeName: user.storeName,
      businessLicense: user.businessLicense,
      storeAddress: user.storeAddress,
      sellerCategory: user.sellerCategory,
      vehicleType: user.vehicleType,
      licenseNumber: user.licenseNumber,
      adminLevel: user.adminLevel,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get User Profile
router.get('/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Change Password
router.post('/change-password', async (req, res) => {
  try {
    const { uid, newPassword } = req.body;

    if (!uid || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'UID and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by UID
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Refresh Token endpoint removed (Firebase ID tokens are refreshed client-side)

// Test endpoint for connectivity
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend connection successful',
    timestamp: new Date().toISOString(),
    server: 'FreshCart Backend',
    version: '1.0.0'
  });
});

export default router;