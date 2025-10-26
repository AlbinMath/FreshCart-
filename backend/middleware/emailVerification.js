import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Middleware to check email verification status and create notifications
export const checkEmailVerification = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user.id).select('emailVerified lastEmailVerificationNotification notificationPreferences');
    
    if (!user) {
      return next();
    }

    // Check if email is not verified and user has email verification reminders enabled
    if (!user.emailVerified && user.notificationPreferences?.emailVerificationReminders !== false) {
      const now = new Date();
      const lastNotification = user.lastEmailVerificationNotification;
      
      // Send notification if:
      // 1. Never sent before, OR
      // 2. Last notification was more than 24 hours ago
      const shouldNotify = !lastNotification || 
        (now.getTime() - lastNotification.getTime()) > (24 * 60 * 60 * 1000);

      if (shouldNotify) {
        try {
          // Check if there's already an unread email verification notification
          const existingNotification = await Notification.findOne({
            userId: user._id,
            type: 'email_verification_required',
            isRead: false
          });

          if (!existingNotification) {
            // Create new email verification notification
            await Notification.createEmailVerificationNotification(user._id, user.email);
            
            // Update last notification timestamp
            user.lastEmailVerificationNotification = now;
            await user.save();
          }
        } catch (notificationError) {
          console.error('Error creating email verification notification:', notificationError);
          // Don't fail the request if notification creation fails
        }
      }
    }

    next();
  } catch (error) {
    console.error('Email verification check error:', error);
    // Don't fail the request if email verification check fails
    next();
  }
};

// Middleware specifically for seller dashboard to enforce email verification
export const requireEmailVerification = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(req.user.id).select('emailVerified email');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        emailVerified: false,
        email: user.email
      });
    }

    next();
  } catch (error) {
    console.error('Email verification requirement check error:', error);
    return res.status(500).json({ success: false, message: 'Email verification check failed' });
  }
};

