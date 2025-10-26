import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import User from '../models/User.js';
import DeliveryAddress from '../models/DeliveryAddress.js';
import DeliverySettings from '../models/DeliverySettings.js';
import { logUserActivity } from '../middleware/activityLogger.js';
import DeletedUser from '../models/DeletedUser.js';
import BranchLinkRequest from '../models/BranchLinkRequest.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import Activity from '../models/Activity.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const SCHEDULE_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'];

const formatTimeHHMM = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const normalizeScheduleEntry = (entry) => {
  const plain = typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry };
  const idString = entry?._id ? entry._id.toString() : plain?._id ? String(plain._id) : undefined;
  return {
    ...plain,
    _id: idString,
    id: idString,
    status: plain.status || 'scheduled'
  };
};

const normalizeScheduleList = (schedules = []) => schedules.map(normalizeScheduleEntry);

const getCurrentDateISO = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const getCurrentTimeHHMM = () => formatTimeHHMM(new Date());

const isScheduleCurrentlyActive = (schedule) => {
  if (!schedule) return false;
  if (schedule.status === 'completed' || schedule.status === 'cancelled') return false;
  if (schedule.completedAt) return false;
  return true;
};

const findLatestActiveScheduleIndex = (schedules = []) => {
  if (!Array.isArray(schedules)) return -1;
  for (let idx = schedules.length - 1; idx >= 0; idx -= 1) {
    if (isScheduleCurrentlyActive(schedules[idx])) {
      return idx;
    }
  }
  return -1;
};

const calculateDurationMinutes = (start, end) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : null;
};

// Get current authenticated user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'User not resolved' });
    }

    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json(user);

  } catch (error) {
    console.error('Get current user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get user profile
router.get('/:uid', async (req, res) => {
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

// Update user profile
router.put('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    console.log('Profile update request for UID:', uid);
    console.log('Update data received:', updates);

    // Remove sensitive fields that shouldn't be updated
    delete updates.password;
    delete updates.uid;
    delete updates.email;
    delete updates.role;
    delete updates.provider;
    delete updates.sellerUniqueNumber; // read-only, auto-generated

    console.log('Sanitized update data:', updates);

    // Validate phone number format
    if (updates.phone && !/^\+?[\d\s\-\(\)]+$/.test(updates.phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Validate date of birth
    if (updates.dateOfBirth) {
      const dob = new Date(updates.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      
      if (age < 13 || age > 120) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date of birth'
        });
      }
    }

    // Validate profile picture URL
    if (updates.profilePicture && updates.profilePicture.trim() !== '') {
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
      if (!urlPattern.test(updates.profilePicture)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid profile picture URL. Must be a valid image URL'
        });
      }
    }

    // Get current user to validate role-specific updates
    const currentUser = await User.findOne({ uid });
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For seller role, enforce profile rules
    if (currentUser.role === 'seller') {
      // Check email verification for email providers (not Google users)
      if (currentUser.provider === 'email' && !currentUser.emailVerified) {
        return res.status(403).json({ 
          success: false, 
          message: 'Email verification required. Please verify your email before updating profile.',
          requiresEmailVerification: true
        });
      }
      
      // Sellers must manage only storeAddress; block direct address array updates
      if (typeof updates.addresses !== 'undefined') {
        delete updates.addresses;
        console.log('Blocked addresses update for seller');
      }
      delete updates.gender;
    }

    // Validate role-specific fields
    if (currentUser.role === 'store') {
      if (updates.businessLicense) {
        const businessLicensePattern = /^[a-zA-Z]{2}\d{6}$/;
        if (!businessLicensePattern.test(updates.businessLicense.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Business license must be in format: 2 letters followed by 6 digits (e.g., ss100001)'
          });
        }
      }
    } else if (currentUser.role === 'seller') {
      if (updates.businessLicense) {
        const businessLicensePattern = /^[a-zA-Z]{2}\d{6}$/;
        if (!businessLicensePattern.test(updates.businessLicense.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Business license must be in format: 2 letters followed by 6 digits (e.g., ss100001)'
          });
        }
      }
    } else if (currentUser.role === 'delivery') {
      if (updates.licenseNumber && updates.licenseNumber.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'License number must be at least 8 characters'
        });
      }
    }

    const user = await User.findOneAndUpdate(
      { uid },
      { $set: updates },
      { 
        new: true, 
        runValidators: false, // Disable validators for profile updates
        context: 'query' 
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      console.error('Validation errors:', validationErrors);
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        details: 'Please check the required fields for your user role'
      });
    }

    // Handle cast errors (invalid data types)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        error: `Invalid ${error.path}: ${error.value}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      type: error.name
    });
  }
});

// Upgrade role to seller and persist seller/store fields
router.put('/:uid/upgrade-to-seller', async (req, res) => {
  try {
    const { uid } = req.params;
    const { phone, storeName, businessLicense, storeAddress, sellerCategory } = req.body || {};

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before upgrading to seller.',
        requiresEmailVerification: true
      });
    }

    // Allowed transitions: customer -> seller, store -> seller, seller -> seller (idempotent)
    const allowedFrom = ['customer', 'store', 'seller'];
    if (!allowedFrom.includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Role upgrade to seller not allowed from current role' });
    }

    // Validate business license format if provided
    if (businessLicense) {
      const businessLicensePattern = /^[a-zA-Z]{2}\d{6}$/;
      if (!businessLicensePattern.test(businessLicense.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Business license must be in format: 2 letters followed by 6 digits (e.g., ss100001)'
        });
      }
    }

    // Apply role change and fields
    user.role = 'seller';
    if (typeof phone !== 'undefined') user.phone = phone;
    if (typeof storeName !== 'undefined') user.storeName = storeName;
    // Map businessLicense to licenseInfo for sellers
    if (typeof businessLicense !== 'undefined') {
      user.licenseInfo = user.licenseInfo || {};
      user.licenseInfo.licenseNumber = businessLicense;
    }
    if (typeof storeAddress !== 'undefined') user.storeAddress = storeAddress;
    if (typeof sellerCategory !== 'undefined') user.sellerCategory = sellerCategory;

    // Generate or regenerate seller unique number with retries for uniqueness
    if (!user.sellerUniqueNumber) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const seed = (String(user._id || '').slice(-6) || '000000').toUpperCase();
      user.sellerUniqueNumber = `SLR-${yy}${mm}-${seed}`;
    }

    // Save with up to 5 retries on duplicate key
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await user.save();
        break;
      } catch (e) {
        if (e && e.code === 11000) {
          const now = new Date();
          const yy = String(now.getFullYear()).slice(-2);
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const rand = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
          user.sellerUniqueNumber = `SLR-${yy}${mm}-${rand}`;
          continue;
        }
        throw e;
      }
    }

    const sanitized = user.toObject();
    delete sanitized.password;

    return res.json({ success: true, message: 'Upgraded to seller', user: sanitized });
  } catch (error) {
    console.error('Upgrade to seller error:', error);
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate key error', error: error.message });
    }
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Upgrade role to farmer
router.put('/:uid/role', async (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body || {};

    // Validate the role change
    if (role !== 'farmer') {
      return res.status(400).json({ success: false, message: 'Only role upgrade to farmer is supported' });
    }

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before upgrading role.',
        requiresEmailVerification: true
      });
    }

    // Allowed transitions: customer -> farmer
    const allowedFrom = ['customer'];
    if (!allowedFrom.includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Role upgrade to farmer not allowed from current role' });
    }

    // Apply role change
    user.role = 'farmer';

    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;

    return res.json({ success: true, message: 'Upgraded to farmer', user: sanitized });
  } catch (error) {
    console.error('Upgrade to farmer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Update delivery partner settings (service area and availability)
router.put('/:uid/delivery-settings', async (req, res) => {
  try {
    const { uid } = req.params;
    const { serviceArea, availability } = req.body || {};

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can update these settings' });

    // Basic validation
    if (serviceArea) {
      if (!['circle','polygon'].includes(serviceArea.type)) return res.status(400).json({ success: false, message: 'Invalid service area type' });

      // Pincode optional, but if provided must be 6 digits
      if (serviceArea.pincode && !/^\d{6}$/.test(String(serviceArea.pincode))) {
        return res.status(400).json({ success: false, message: 'Invalid pincode. Must be 6 digits' });
      }

      if (serviceArea.type === 'circle') {
        // Allow either pincode OR center+radius (when map integration is ready)
        const hasCenterRadius = serviceArea.center && typeof serviceArea.radiusMeters === 'number';
        const hasPincode = !!serviceArea.pincode;
        if (!hasPincode && !hasCenterRadius) {
          return res.status(400).json({ success: false, message: 'Provide pincode or center and radius for circle area' });
        }
      } else if (serviceArea.type === 'polygon') {
        if (!Array.isArray(serviceArea.polygon) || serviceArea.polygon.length < 3) return res.status(400).json({ success: false, message: 'Polygon requires at least 3 points' });
      }
    }

    // Update the user's serviceArea and availability
    if (serviceArea) {
      user.serviceArea = serviceArea;
    }
    if (Array.isArray(availability)) {
      user.availability = availability;
    }

    await user.save();

    return res.json({ 
      success: true, 
      message: 'Delivery settings updated', 
      serviceArea: user.serviceArea, 
      availability: user.availability 
    });
  } catch (error) {
    console.error('Delivery settings update error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Schedules (date-based) - for delivery users only
router.get('/:uid/schedules', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('schedules role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can access schedules' });

    const normalizedSchedules = normalizeScheduleList(user.schedules || []);
    
    return res.json({ success: true, schedules: normalizedSchedules });
  } catch (e) {
    console.error('Schedules fetch error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Go Online - Create a new active schedule for delivery users
router.post('/:uid/schedules/go-online', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can go online' });

    const nowDate = getCurrentDateISO();
    const nowTime = getCurrentTimeHHMM();

    // Create a new active schedule
    const newSchedule = {
      date: nowDate,
      start: nowTime,
      startTime: nowTime,
      status: 'active',
      autoCreated: true,
      note: 'Manual online status'
    };

    user.schedules.push(newSchedule);
    
    const updatedUser = await user.save();
    const savedSchedule = updatedUser.schedules[updatedUser.schedules.length - 1];
    
    const normalizedSchedules = normalizeScheduleList(user.schedules);
    const normalizedSavedSchedule = normalizeScheduleEntry(savedSchedule);

    return res.json({
      success: true,
      message: 'You are now online',
      schedule: normalizedSavedSchedule,
      schedules: normalizedSchedules
    });
  } catch (e) {
    console.error('Go online error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/:uid/schedules', async (req, res) => {
  try {
    const { uid } = req.params;
    const {
      date,
      start,
      end,
      startTime,
      endTime,
      durationMinutes,
      note,
      status,
      autoCreated,
      resume
    } = req.body || {};
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can add schedules' });

    const nowDate = getCurrentDateISO();
    const nowTime = getCurrentTimeHHMM();

    const scheduleStart = start || startTime || nowTime;
    const scheduleEnd = end || endTime;

    if (!date && !resume) {
      if (!scheduleStart) return res.status(400).json({ success: false, message: 'start time is required' });
      user.schedules.push({
        date: nowDate,
        start: scheduleStart,
        startTime: scheduleStart,
        end: scheduleEnd,
        endTime: scheduleEnd,
        durationMinutes: durationMinutes || calculateDurationMinutes(scheduleStart, scheduleEnd),
        note,
        status: status && SCHEDULE_STATUSES.includes(status) ? status : 'active',
        autoCreated: Boolean(autoCreated ?? true)
      });
    } else if (resume) {
      const latestIdx = findLatestActiveScheduleIndex(user.schedules);
      if (latestIdx !== -1) {
        const schedule = user.schedules[latestIdx];
        schedule.status = 'active';
        schedule.completedAt = null;
        schedule.end = schedule.end || schedule.endTime || scheduleEnd || '';
        schedule.endTime = schedule.end || schedule.endTime;
        schedule.durationMinutes = schedule.durationMinutes || calculateDurationMinutes(schedule.start, schedule.end);
        schedule.updatedAt = new Date();
      } else {
        user.schedules.push({
          date: date || nowDate,
          start: scheduleStart,
          startTime: scheduleStart,
          end: scheduleEnd,
          endTime: scheduleEnd,
          durationMinutes: durationMinutes || calculateDurationMinutes(scheduleStart, scheduleEnd),
          note,
          status: 'active',
          autoCreated: Boolean(autoCreated ?? true)
        });
      }
    } else {
      if (!date || !scheduleStart) return res.status(400).json({ success: false, message: 'date and start time are required' });

      user.schedules.push({
        date,
        start: scheduleStart,
        startTime: scheduleStart,
        end: scheduleEnd,
        endTime: scheduleEnd,
        durationMinutes: durationMinutes || calculateDurationMinutes(scheduleStart, scheduleEnd),
        note,
        status: status && SCHEDULE_STATUSES.includes(status) ? status : 'scheduled',
        autoCreated: Boolean(autoCreated)
      });
    }

    let savedSchedule;
    try {
      const updatedUser = await user.save();
      savedSchedule = updatedUser.schedules[updatedUser.schedules.length - 1];
    } catch (saveError) {
      console.error('Schedules add error:', saveError);
      return res.status(500).json({ success: false, message: saveError.message || 'Failed to save schedule' });
    }

    const normalizedSchedules = normalizeScheduleList(user.schedules);

    const normalizedSavedSchedule = savedSchedule ? normalizeScheduleEntry(savedSchedule) : null;

    return res.json({
      success: true,
      message: resume ? 'Schedule resumed' : 'Schedule added',
      schedule: normalizedSavedSchedule,
      schedules: normalizedSchedules
    });
  } catch (e) {
    console.error('Schedules add error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' });
  }
});

router.patch('/:uid/schedules/:scheduleId/complete', async (req, res) => {
  try {
    const { uid, scheduleId } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can end schedules' });

    const schedule = user.schedules.id(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (schedule.status === 'completed') {
      return res.json({ success: true, message: 'Schedule already completed', schedule: normalizeScheduleEntry(schedule), schedules: normalizeScheduleList(user.schedules) });
    }

    const nowDate = getCurrentDateISO();
    const nowTime = getCurrentTimeHHMM();

    schedule.status = 'completed';
    schedule.completedAt = new Date();

    if (!schedule.end && !schedule.endTime) {
      schedule.date = schedule.date || nowDate;
      schedule.end = nowTime;
      schedule.endTime = nowTime;
    }

    if (!schedule.durationMinutes) {
      const computedDuration = calculateDurationMinutes(schedule.start || schedule.startTime, schedule.end || schedule.endTime);
      schedule.durationMinutes = computedDuration;
    }

    schedule.updatedAt = new Date();

    await user.save();

    return res.json({
      success: true,
      message: 'Schedule completed',
      schedule: normalizeScheduleEntry(schedule),
      schedules: normalizeScheduleList(user.schedules)
    });
  } catch (e) {
    console.error('Schedule complete error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Go Offline - Complete the latest active schedule for delivery users
router.post('/:uid/schedules/go-offline', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can go offline' });

    // Find the latest active schedule
    const latestIdx = findLatestActiveScheduleIndex(user.schedules);
    if (latestIdx === -1) {
      return res.status(404).json({ success: false, message: 'No active schedule found' });
    }

    const schedule = user.schedules[latestIdx];
    
    // Complete the schedule
    const nowDate = getCurrentDateISO();
    const nowTime = getCurrentTimeHHMM();

    schedule.status = 'completed';
    schedule.completedAt = new Date();

    if (!schedule.end && !schedule.endTime) {
      schedule.date = schedule.date || nowDate;
      schedule.end = nowTime;
      schedule.endTime = nowTime;
    }

    if (!schedule.durationMinutes) {
      const computedDuration = calculateDurationMinutes(schedule.start || schedule.startTime, schedule.end || schedule.endTime);
      schedule.durationMinutes = computedDuration;
    }

    schedule.updatedAt = new Date();

    await user.save();

    const normalizedSchedules = normalizeScheduleList(user.schedules);
    const normalizedSchedule = normalizeScheduleEntry(schedule);

    return res.json({
      success: true,
      message: 'You are now offline',
      schedule: normalizedSchedule,
      schedules: normalizedSchedules
    });
  } catch (e) {
    console.error('Go offline error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:uid/schedules/:scheduleId', async (req, res) => {
  try {
    const { uid, scheduleId } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'delivery') return res.status(403).json({ success: false, message: 'Only delivery users can delete schedules' });

    // Find and remove schedule by ID
    const scheduleIndex = user.schedules.findIndex(s => s._id.toString() === scheduleId);
    if (scheduleIndex === -1) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    
    user.schedules.splice(scheduleIndex, 1);
    await user.save();

    const normalizedSchedules = normalizeScheduleList(user.schedules);

    return res.json({ success: true, message: 'Schedule removed', schedules: normalizedSchedules });
  } catch (e) {
    console.error('Schedules delete error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Store Hours (day-based) - for seller users only
router.get('/:uid/store-hours', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('storeHours role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller', 'store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only sellers can access store hours' });
    
    return res.json({ success: true, storeHours: user.storeHours || [] });
  } catch (e) {
    console.error('Store hours fetch error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/:uid/store-hours', async (req, res) => {
  try {
    const { uid } = req.params;
    const { day, openTime, closeTime, isClosed, note } = req.body || {};
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller', 'store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only sellers can manage store hours' });

    if (!day) return res.status(400).json({ success: false, message: 'Day is required' });
    if (!isClosed && (!openTime || !closeTime)) return res.status(400).json({ success: false, message: 'Opening and closing times are required for open days' });

    // Initialize storeHours array if it doesn't exist
    if (!user.storeHours) {
      user.storeHours = [];
    }

    // Normalize day name for comparison (trim and case-insensitive)
    const normalizedDay = day.trim();
    
    // Check if hours already exist for this day (case-insensitive comparison)
    const existingIndex = user.storeHours.findIndex(h => 
      h.day && h.day.trim().toLowerCase() === normalizedDay.toLowerCase()
    );
    
    const newHours = {
      day: normalizedDay,
      openTime: isClosed ? null : openTime,
      closeTime: isClosed ? null : closeTime,
      isClosed: Boolean(isClosed),
      note: note || ''
    };

    if (existingIndex >= 0) {
      // Update existing hours using set to ensure proper update
      user.storeHours.set(existingIndex, newHours);
    } else {
      // Add new hours
      user.storeHours.push(newHours);
    }

    // Mark the field as modified to ensure Mongoose saves it
    user.markModified('storeHours');
    await user.save();
    
    return res.json({ success: true, message: 'Store hours updated', storeHours: user.storeHours });
  } catch (e) {
    console.error('Store hours add/update error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:uid/store-hours/:day', async (req, res) => {
  try {
    const { uid, day } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller', 'store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only sellers can manage store hours' });

    if (!user.storeHours || user.storeHours.length === 0) {
      return res.status(404).json({ success: false, message: 'No store hours found' });
    }

    // Normalize day for comparison
    const normalizedDay = day.trim();
    
    // Remove hours for the specified day (case-insensitive)
    const initialLength = user.storeHours.length;
    user.storeHours = user.storeHours.filter(h => 
      !h.day || h.day.trim().toLowerCase() !== normalizedDay.toLowerCase()
    );
    
    if (user.storeHours.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Store hours for this day not found' });
    }
    
    user.markModified('storeHours');
    await user.save();
    return res.json({ success: true, message: 'Store hours removed', storeHours: user.storeHours });
  } catch (e) {
    console.error('Store hours delete error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user addresses
router.get('/:uid/addresses', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('addresses role');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sellers: no addresses section; use profile.storeAddress
    if (user.role === 'seller') {
      return res.json([]);
    }

    res.json(user.addresses || []);

  } catch (error) {
    console.error('Addresses fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add new address
router.post('/:uid/addresses', async (req, res) => {
  try {
    const { uid } = req.params;

    const userDoc = await User.findOne({ uid }).select('role');
    if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

    // Block sellers from adding addresses
    if (userDoc.role === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot add addresses. Use profile storeAddress.' });
    }

    // Proceed for non-sellers as before
    const newAddress = req.body;
    if (newAddress.type) newAddress.type = String(newAddress.type).toLowerCase();

    if (userDoc.role === 'delivery') {
      const hasPermanent = ((await User.findOne({ uid }).select('addresses'))?.addresses || []).some(a => a.type === 'permanent');
      if (!hasPermanent && newAddress.type !== 'permanent') {
        return res.status(400).json({ success: false, message: 'Permanent address is required first for delivery agents' });
      }
    }

    if (newAddress.isDefault) {
      await User.updateOne(
        { uid },
        { $set: { 'addresses.$[].isDefault': false } }
      );
    }

    const user = await User.findOneAndUpdate(
      { uid },
      { $push: { addresses: newAddress } },
      { new: true, runValidators: true }
    ).select('addresses');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Address added successfully', addresses: user.addresses });

  } catch (error) {
    console.error('Address add error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Update address
router.put('/:uid/addresses/:addressId', async (req, res) => {
  try {
    const { uid, addressId } = req.params;

    const userDoc = await User.findOne({ uid }).select('role');
    if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

    // Block sellers from editing addresses
    if (userDoc.role === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot edit addresses. Use profile storeAddress.' });
    }

    const updates = req.body;

    if (updates.isDefault) {
      await User.updateOne(
        { uid },
        { $set: { 'addresses.$[].isDefault': false } }
      );
    }

    const user = await User.findOneAndUpdate(
      { 
        uid,
        'addresses._id': addressId 
      },
      { 
        $set: { 
          'addresses.$': { ...updates, _id: addressId } 
        } 
      },
      { new: true, runValidators: true }
    ).select('addresses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User or address not found'
      });
    }

    res.json({
      success: true,
      message: 'Address updated successfully',
      addresses: user.addresses
    });

  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete address
router.delete('/:uid/addresses/:addressId', async (req, res) => {
  try {
    const { uid, addressId } = req.params;

    const userDoc = await User.findOne({ uid }).select('role');
    if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

    // Block sellers from deleting addresses
    if (userDoc.role === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot delete addresses. Use profile storeAddress.' });
    }

    const user = await User.findOneAndUpdate(
      { uid },
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    ).select('addresses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses: user.addresses
    });

  } catch (error) {
    console.error('Address delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Set default address
router.put('/:uid/addresses/:addressId/default', async (req, res) => {
  try {
    const { uid, addressId } = req.params;

    const userDoc = await User.findOne({ uid }).select('role');
    if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

    // Block sellers from setting default addresses
    if (userDoc.role === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot set default addresses. Use profile storeAddress.' });
    }

    // Remove default flag from all addresses
    await User.updateOne(
      { uid },
      { $set: { 'addresses.$[].isDefault': false } }
    );

    // Set the specified address as default
    const user = await User.findOneAndUpdate(
      {
        uid,
        'addresses._id': addressId
      },
      {
        $set: { 'addresses.$.isDefault': true }
      },
      { new: true }
    ).select('addresses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User or address not found'
      });
    }

    res.json({
      success: true,
      message: 'Default address updated successfully',
      addresses: user.addresses
    });

  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete account (non-admin)
router.delete('/:uid/delete', async (req, res) => {
  try {
    const { uid } = req.params;

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Admins cannot be deleted' });

    // Best-effort: remove uploaded profile image file
    try {
      if (user.profileImagePath) {
        const abs = path.resolve(user.profileImagePath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
    } catch {}

    // Build analytics
    const addressesCount = Array.isArray(user.addresses) ? user.addresses.length : 0;
    const hadProfilePicture = !!(user.profilePicture || user.profileImagePath);
    const hadStoreFields = !!(user.storeName || user.businessLicense || user.storeAddress || user.sellerCategory);
    const hadDeliveryFields = !!(user.vehicleType || user.licenseNumber || (user.serviceArea && (user.serviceArea.pincode || user.serviceArea.radiusMeters)));
    const daysSinceSignup = Math.max(0, Math.round((Date.now() - new Date(user.createdAt).getTime()) / (1000*60*60*24)));
    const lastLoginAgeDays = user.lastLogin ? Math.max(0, Math.round((Date.now() - new Date(user.lastLogin).getTime()) / (1000*60*60*24))) : null;

    // Save deleted user snapshot + analytics
    try {
      const snapshot = user.toObject();
      delete snapshot.password; // do not store password hash
      await DeletedUser.create({
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: user.provider,
        reason: 'self-initiated',
        snapshot,
        analytics: { addressesCount, hadProfilePicture, hadStoreFields, hadDeliveryFields, daysSinceSignup, lastLoginAgeDays }
      });
    } catch (e) {
      console.warn('Failed to persist deleted user snapshot:', e.message);
    }

    await User.deleteOne({ _id: user._id });

    try {
      await Activity.create({
        actorUid: uid,
        actorEmail: user.email,
        actorRole: user.role,
        targetUserId: user._id,
        action: 'delete-account',
        details: { reason: 'self-initiated' }
      });
    } catch {}

    return res.json({ success: true, message: 'Account deleted' });
  } catch (e) {
    console.error('Account delete error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error', error: e.message });
  }
});

// Test profile update endpoint
router.post('/test-update/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    console.log('=== PROFILE UPDATE TEST ===');
    console.log('UID:', uid);
    console.log('Updates:', JSON.stringify(updates, null, 2));

    // Find the user first
    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Current user data:', {
      uid: user.uid,
      role: user.role,
      name: user.name,
      email: user.email,
      vehicleType: user.vehicleType,
      licenseNumber: user.licenseNumber,
      adminLevel: user.adminLevel,
      storeAddress: user.storeAddress
    });

    // Test the update without actually saving
    const testUser = new User(user.toObject());
    Object.assign(testUser, updates);

    try {
      await testUser.validate();
      console.log('✅ Validation passed');
    } catch (validationError) {
      console.log('❌ Validation failed:', validationError.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation test failed',
        errors: Object.keys(validationError.errors).map(key => ({
          field: key,
          message: validationError.errors[key].message
        }))
      });
    }

    res.json({
      success: true,
      message: 'Profile update test passed',
      currentUser: {
        uid: user.uid,
        role: user.role,
        name: user.name
      },
      proposedUpdates: updates,
      validationStatus: 'PASSED'
    });

  } catch (error) {
    console.error('Test update error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// -------------------------------
// Seller Branch Stores (name + address)
// -------------------------------

// List branch stores (seller only) + linked-by info, with expanded profiles
router.get('/:uid/branch-stores', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('role storeName branchStores linkedBranchOf sellerUniqueNumber uid email name profilePicture provider emailVerified');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage branch stores' });
    
    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before accessing branch stores.',
        requiresEmailVerification: true
      });
    }

    const branchStores = user.branchStores || [];
    const linkedBranchOf = user.linkedBranchOf || [];

    // Expand profiles for linked sellers
    const numbersToFetch = [
      ...branchStores.map(b => b.linkedSellerUniqueNumber).filter(Boolean),
      ...linkedBranchOf.map(x => x.sellerUniqueNumber).filter(Boolean)
    ];

    const uniq = Array.from(new Set(numbersToFetch));
    const others = uniq.length ? await User.find({ sellerUniqueNumber: { $in: uniq } }).select('uid email name sellerUniqueNumber profilePicture storeName storeAddress') : [];

    // Pending requests for this seller (as target) - handle case where sellerUniqueNumber is null/undefined
    const pendingAsTarget = user.sellerUniqueNumber 
      ? await BranchLinkRequest.find({ targetSellerUniqueNumber: user.sellerUniqueNumber, status: 'pending' }).sort({ createdAt: -1 }).lean()
      : [];

    res.json({
      seller: { uid: user.uid, email: user.email, name: user.name, sellerUniqueNumber: user.sellerUniqueNumber, profilePicture: user.profilePicture, storeName: user.storeName, storeAddress: user.storeAddress },
      branchStores,
      linkedBranchOf,
      linkedProfiles: others,
      pendingRequests: pendingAsTarget
    });
  } catch (e) {
    console.error('List branch stores error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add a branch store (seller only)
router.post('/:uid/branch-stores', async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, address, linkedSellerUniqueNumber } = req.body || {};

    if (!name || String(name).trim().length < 2) return res.status(400).json({ success: false, message: 'Branch name is required' });
    if (!address || String(address).trim().length < 10) return res.status(400).json({ success: false, message: 'Branch address must be at least 10 characters' });

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage branch stores' });
    
    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before managing branch stores.',
        requiresEmailVerification: true
      });
    }

    // Validation: if and only if a linked seller number is provided, verify it
    let normalizedLinked = '';
    let linkedDoc = null;
    if (linkedSellerUniqueNumber && String(linkedSellerUniqueNumber).trim()) {
      normalizedLinked = String(linkedSellerUniqueNumber).trim();
      linkedDoc = await User.findOne({ sellerUniqueNumber: normalizedLinked }).select('uid sellerUniqueNumber role linkedBranchOf');
      if (!linkedDoc || linkedDoc.role !== 'seller') {
        return res.status(400).json({ success: false, message: 'Linked seller unique number is invalid or does not belong to a seller' });
      }
    }

    // Do NOT enforce that branch name matches storeName; allow any name

    user.branchStores = user.branchStores || [];
    user.branchStores.push({ 
      name: String(name).trim(), 
      address: String(address).trim(), 
      // Do not set link yet if a request will be created; only set after acceptance
      linkedSellerUniqueNumber: linkedDoc ? '' : normalizedLinked
    });
    await user.save();

    // If linking another seller, create a pending request instead of immediate linking
    if (linkedDoc) {
      try {
        const reqDoc = await BranchLinkRequest.create({
          requesterUid: user.uid,
          requesterSellerUniqueNumber: user.sellerUniqueNumber || '',
          requesterStoreName: user.storeName || '',
          targetUid: linkedDoc.uid || '',
          targetSellerUniqueNumber: linkedDoc.sellerUniqueNumber,
          branchName: String(name).trim(),
          branchAddress: String(address).trim(),
          status: 'pending'
        });
        // Notify target seller
        try {
          await Notification.create({
            uid: linkedDoc.uid,
            type: 'branch-link-request',
            title: 'New Branch Link Request',
            message: `${user.sellerUniqueNumber || 'A seller'} requested to link a branch to your profile`,
            data: { requestId: reqDoc._id.toString(), status: 'pending', from: user.sellerUniqueNumber, branchName: String(name).trim(), branchAddress: String(address).trim() }
          });
        } catch (ne) { console.warn('Failed to create notification:', ne?.message || ne); }
      } catch (e) {
        console.warn('Failed to create branch link request:', e?.message || e);
      }
    }

    res.json({ success: true, message: 'Branch store added', branchStores: user.branchStores });
  } catch (e) {
    console.error('Add branch store error:', e);
    const msg = e && e.message ? e.message : 'Internal server error';
    // Common Mongo error code for duplicate key
    if (e && e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate key error: a similar entry already exists' });
    }
    res.status(500).json({ success: false, message: msg });
  }
});

// Delete a branch store by index (seller only)
router.delete('/:uid/branch-stores/:index', async (req, res) => {
  try {
    const { uid, index } = req.params;
    const idx = Number(index);
    if (Number.isNaN(idx) || idx < 0) return res.status(400).json({ success: false, message: 'Invalid index' });

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage branch stores' });

    user.branchStores = user.branchStores || [];
    if (idx >= user.branchStores.length) return res.status(404).json({ success: false, message: 'Branch not found' });

    const removed = user.branchStores.splice(idx, 1)[0] || null;
    await user.save();

    // If that branch had a link to another seller, cancel any pending request and remove reverse link
    if (removed && removed.linkedSellerUniqueNumber) {
      try {
        await BranchLinkRequest.updateMany({
          requesterUid: user.uid,
          targetSellerUniqueNumber: removed.linkedSellerUniqueNumber,
          branchName: removed.name,
          status: 'pending'
        }, { $set: { status: 'denied', decidedAt: new Date() } });
      } catch (e) {
        console.warn('Failed to update related branch requests on delete:', e?.message || e);
      }
    }

    res.json({ success: true, message: 'Branch store removed', branchStores: user.branchStores });
  } catch (e) {
    console.error('Delete branch store error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// -------------------------------
// Notifications (simple): list and mark read
// -------------------------------
router.get('/:uid/notifications', async (req, res) => {
  try {
    const { uid } = req.params;
    const { unread } = req.query;
    const filter = { uid };
    if (String(unread).toLowerCase() === 'true') {
      filter.read = false;
    }
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, notifications: list });
  } catch (e) {
    console.error('List notifications error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
router.post('/:uid/notifications/:id/read', async (req, res) => {
  try {
    const { uid, id } = req.params;
    const doc = await Notification.findOneAndUpdate({ _id: id, uid }, { $set: { read: true } }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true });
  } catch (e) {
    console.error('Mark notification read error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// Mark all notifications as read
router.post('/:uid/notifications/mark-all-read', async (req, res) => {
  try {
    const { uid } = req.params;
    await Notification.updateMany({ uid, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (e) {
    console.error('Mark all notifications read error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete a single notification
router.delete('/:uid/notifications/:id', async (req, res) => {
  try {
    const { uid, id } = req.params;
    const result = await Notification.deleteOne({ _id: id, uid });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true });
  } catch (e) {
    console.error('Delete notification error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Clear all notifications (optionally only read ones)
router.post('/:uid/notifications/clear', async (req, res) => {
  try {
    const { uid } = req.params;
    const { onlyRead } = req.body || {};
    const filter = { uid };
    if (onlyRead) filter.read = true;
    await Notification.deleteMany(filter);
    res.json({ success: true });
  } catch (e) {
    console.error('Clear notifications error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// -------------------------------
// Branch Link Requests: list, accept, deny (target seller actions)
// -------------------------------

// List incoming branch link requests (for target seller)
router.get('/:uid/branch-link-requests', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('uid role sellerUniqueNumber');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can view branch link requests' });

    // If seller doesn't have a unique number yet, return empty array instead of querying with null
    if (!user.sellerUniqueNumber) {
      return res.json({ success: true, requests: [] });
    }

    const pending = await BranchLinkRequest.find({ targetSellerUniqueNumber: user.sellerUniqueNumber, status: 'pending' }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, requests: pending });
  } catch (e) {
    console.error('List branch link requests error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Accept or deny a branch link request by id
router.post('/:uid/branch-link-requests/:requestId/:action', async (req, res) => {
  try {
    const { uid, requestId, action } = req.params;
    if (!['accept','deny'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action' });

    const user = await User.findOne({ uid }).select('uid role sellerUniqueNumber');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage branch link requests' });

    const reqDoc = await BranchLinkRequest.findById(requestId);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found' });
    if (reqDoc.targetSellerUniqueNumber !== user.sellerUniqueNumber) return res.status(403).json({ success: false, message: 'Not authorized for this request' });
    if (reqDoc.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });

    if (action === 'deny') {
      reqDoc.status = 'denied';
      reqDoc.decidedAt = new Date();
      await reqDoc.save();
      // Remove the branch from requester so it doesn't display
      try {
        const requester = await User.findOne({ uid: reqDoc.requesterUid });
        if (requester) {
          requester.branchStores = (requester.branchStores || []).filter(b => !(b.name === reqDoc.branchName && b.address === reqDoc.branchAddress));
          await requester.save();
        }
      } catch(e) { console.warn('Failed to remove requester branch on deny:', e?.message || e); }
      // Notify requester
      try {
        await Notification.create({
          uid: reqDoc.requesterUid,
          type: 'branch-link-request-update',
          title: 'Branch Link Request Denied',
          message: `Your branch link request to ${user.sellerUniqueNumber} was denied`,
          data: { requestId: reqDoc._id.toString(), status: 'denied', target: user.sellerUniqueNumber }
        });
      } catch (ne) { console.warn('Failed to notify requester (deny):', ne?.message || ne); }
      // Remove the original target notifications so they no longer appear
      try {
        await Notification.deleteMany({
          uid: user.uid,
          type: 'branch-link-request',
          'data.requestId': reqDoc._id.toString()
        });
      } catch (ne) { console.warn('Failed to delete original notifications (deny):', ne?.message || ne); }
      return res.json({ success: true, message: 'Request denied' });
    }

    // Accept flow: create reverse link on this (target) seller to show they are linked by requester
    // and ensure requester's branch exists and is linked
    const requester = await User.findOne({ uid: reqDoc.requesterUid });
    const target = user; // current user
    if (!requester) return res.status(404).json({ success: false, message: 'Requester not found' });

    try {
      // On target seller: add linkedBranchOf entry for the requester (main = requester)
      const tgtDoc = await User.findOne({ uid: target.uid });
      tgtDoc.linkedBranchOf = tgtDoc.linkedBranchOf || [];
      const existsRev = (tgtDoc.linkedBranchOf || []).some(x => String(x.sellerUniqueNumber) === String(requester.sellerUniqueNumber));
      if (!existsRev) {
        tgtDoc.linkedBranchOf.push({
          sellerUniqueNumber: requester.sellerUniqueNumber || '',
          branchName: reqDoc.branchName,
          branchAddress: reqDoc.branchAddress
        });
      }
      await tgtDoc.save();
    } catch(e) {
      console.warn('Failed to update target reverse link:', e?.message || e);
    }

    try {
      // On requester: ensure branch exists and set linkedSellerUniqueNumber to target
      const rqDoc = await User.findOne({ uid: requester.uid });
      rqDoc.branchStores = rqDoc.branchStores || [];
      // Find matching branch by name+address
      let idx = rqDoc.branchStores.findIndex(b => (b.name === reqDoc.branchName && b.address === reqDoc.branchAddress));
      if (idx === -1) {
        rqDoc.branchStores.push({ name: reqDoc.branchName, address: reqDoc.branchAddress, linkedSellerUniqueNumber: user.sellerUniqueNumber });
      } else {
        rqDoc.branchStores[idx].linkedSellerUniqueNumber = user.sellerUniqueNumber;
      }
      await rqDoc.save();
    } catch(e) {
      console.warn('Failed to update requester branch link:', e?.message || e);
    }

    reqDoc.status = 'accepted';
    reqDoc.decidedAt = new Date();
    await reqDoc.save();

    // Notify requester
    try {
      await Notification.create({
        uid: reqDoc.requesterUid,
        type: 'branch-link-request-update',
        title: 'Branch Link Request Accepted',
        message: `Your branch link request to ${user.sellerUniqueNumber} was accepted`,
        data: { requestId: reqDoc._id.toString(), status: 'accepted', target: user.sellerUniqueNumber }
      });
    } catch (ne) { console.warn('Failed to notify requester (accept):', ne?.message || ne); }
    // Remove the original target notifications so they no longer appear
    try {
      await Notification.deleteMany({
        uid: user.uid,
        type: 'branch-link-request',
        'data.requestId': reqDoc._id.toString()
      });
    } catch (ne) { console.warn('Failed to delete original notifications (accept):', ne?.message || ne); }

    return res.json({ success: true, message: 'Request accepted' });
  } catch (e) {
    console.error('Manage branch link request error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// -------------------------------
// Seller Bank Details + 6-digit PIN
// -------------------------------

const ENC_ALGO = 'aes-256-gcm';
const ENC_KEY = (process.env.BANK_ENC_KEY || '').padEnd(32, '0').slice(0,32); // 32 bytes

function enc(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, Buffer.from(ENC_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { enc: encrypted.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function dec(encBase64, ivBase64, tagBase64) {
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const decipher = crypto.createDecipheriv(ENC_ALGO, Buffer.from(ENC_KEY), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encBase64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

// Create/Update 6-digit PIN
router.post('/:uid/bank/pin', async (req, res) => {
  try {
    const { uid } = req.params;
    const { pin } = req.body || {};
    if (!/^[0-9]{6}$/.test(String(pin || ''))) return res.status(400).json({ success: false, message: 'PIN must be 6 digits' });

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller','store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only seller/store can set bank PIN' });

    const saltRounds = 10;
    user.bankPinHash = await bcrypt.hash(String(pin), saltRounds);
    await user.save();
    return res.json({ success: true, message: 'PIN set successfully' });
  } catch (e) {
    console.error('Set PIN error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save bank details (requires PIN)
router.post('/:uid/bank', async (req, res) => {
  try {
    const { uid } = req.params;
    const { pin, bankName, branch, ifsc, accountHolderName, accountNumber, pan, upi } = req.body || {};

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller','store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only seller/store can save bank details' });
    if (!user.bankPinHash) return res.status(403).json({ success: false, message: 'Set PIN first' });

    const ok = await bcrypt.compare(String(pin || ''), user.bankPinHash || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid PIN' });

    // Validations
    if (!bankName || !accountHolderName) return res.status(400).json({ success: false, message: 'Bank name and account holder are required' });
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) return res.status(400).json({ success: false, message: 'Invalid IFSC' });
    if (accountNumber && !/^[0-9]{9,18}$/.test(String(accountNumber))) return res.status(400).json({ success: false, message: 'Invalid account number' });
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(pan)) return res.status(400).json({ success: false, message: 'Invalid PAN' });
    if (upi && !/^[a-z0-9.\/_\-]{2,256}@[a-z]{2,64}$/i.test(upi)) return res.status(400).json({ success: false, message: 'Invalid UPI ID' });

    const acc = accountNumber ? enc(String(accountNumber)) : null;
    const panEnc = pan ? enc(String(pan).toUpperCase()) : null;
    const upiEnc = upi ? enc(String(upi).toLowerCase()) : null;

    user.bankDetails = {
      bankName: String(bankName),
      branch: branch ? String(branch) : '',
      ifsc: ifsc ? String(ifsc).toUpperCase() : '',
      accountHolderName: String(accountHolderName),
      accountNumberEnc: acc?.enc || '',
      accountNumberIV: acc?.iv || '',
      accountNumberTag: acc?.tag || '',
      panEnc: panEnc?.enc || '',
      panIV: panEnc?.iv || '',
      panTag: panEnc?.tag || '',
      upiEnc: upiEnc?.enc || '',
      upiIV: upiEnc?.iv || '',
      upiTag: upiEnc?.tag || '',
      updatedAt: new Date()
    };

    await user.save();
    return res.json({ success: true, message: 'Bank details saved' });
  } catch (e) {
    console.error('Save bank error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get bank details masked (requires PIN)
router.post('/:uid/bank/view', async (req, res) => {
  try {
    const { uid } = req.params;
    const { pin } = req.body || {};
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller','store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only seller/store can view bank details' });

    const ok = await bcrypt.compare(String(pin || ''), user.bankPinHash || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid PIN' });

    const bd = user.bankDetails || {};

    const accountNumber = (bd.accountNumberEnc && bd.accountNumberIV && bd.accountNumberTag)
      ? dec(bd.accountNumberEnc, bd.accountNumberIV, bd.accountNumberTag) : '';
    const pan = (bd.panEnc && bd.panIV && bd.panTag)
      ? dec(bd.panEnc, bd.panIV, bd.panTag) : '';
    const upi = (bd.upiEnc && bd.upiIV && bd.upiTag)
      ? dec(bd.upiEnc, bd.upiIV, bd.upiTag) : '';

    const mask = (s) => s ? s.replace(/.(?=.{4})/g, '•') : '';

    return res.json({
      success: true,
      bankDetails: {
        bankName: bd.bankName || '',
        branch: bd.branch || '',
        ifsc: bd.ifsc || '',
        accountHolderName: bd.accountHolderName || '',
        accountNumberMasked: mask(accountNumber),
        panMasked: mask(pan),
        upiMasked: upi ? mask(upi.split('@')[0]) + '@' + (upi.split('@')[1] || '') : '',
        updatedAt: bd.updatedAt || null
      }
    });
  } catch (e) {
    console.error('View bank error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// -------------------------------
// Store/Seller Working Hours & Status
// -------------------------------

function isValidHHMM(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function toMinutes(s) {
  const [h,m] = String(s).split(':').map(Number);
  return h*60 + m;
}

const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];

function normalizeWeekly(weekly) {
  // Ensure each day exists once; normalize and order mon..sun
  const map = new Map();
  (Array.isArray(weekly) ? weekly : []).forEach(d => {
    if (!d || !dayKeys.includes(d.day)) return;
    const intervals = Array.isArray(d.intervals)
      ? d.intervals.filter(x => x && isValidHHMM(x.start) && isValidHHMM(x.end) && toMinutes(x.end) > toMinutes(x.start))
      : [];
    map.set(d.day, { day: d.day, enabled: !!d.enabled && intervals.length > 0, intervals });
  });
  return ['mon','tue','wed','thu','fri','sat','sun'].map(k => map.get(k) || { day: k, enabled: false, intervals: [] });
}

function computeStatus(now = new Date(), user) {
  const wh = user?.workingHours || {};
  const mode = wh.mode || 'auto';
  if (mode === 'force_open') return { isOpen: true, mode, reason: 'manual', now: now.toISOString(), activeSource: 'manual' };
  if (mode === 'force_closed') return { isOpen: false, mode, reason: 'manual', now: now.toISOString(), activeSource: 'manual' };

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const minutesNow = now.getHours()*60 + now.getMinutes();
  const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];

  // Overrides first
  const overrides = Array.isArray(wh.overrides) ? wh.overrides : [];
  const todayOverrides = overrides.filter(o => o && o.date === todayStr);
  if (todayOverrides.length > 0) {
    const o = todayOverrides[0];
    if (o.type === 'closed') return { isOpen: false, mode, reason: 'override-closed', now: now.toISOString(), activeSource: 'override' };
    const intervals = (o.intervals || []).filter(x => isValidHHMM(x?.start) && isValidHHMM(x?.end) && toMinutes(x.end) > toMinutes(x.start));
    const open = intervals.some(iv => minutesNow >= toMinutes(iv.start) && minutesNow < toMinutes(iv.end));
    return { isOpen: open, mode, reason: 'override-open', now: now.toISOString(), activeSource: 'override' };
  }

  // Weekly
  const weekly = normalizeWeekly(wh.weekly);
  const today = weekly.find(d => d.day === dayKey);
  if (!today || !today.enabled || !Array.isArray(today.intervals)) return { isOpen: false, mode, reason: 'weekly-disabled', now: now.toISOString(), activeSource: 'weekly' };
  const open = today.intervals.some(iv => isValidHHMM(iv?.start) && isValidHHMM(iv?.end) && minutesNow >= toMinutes(iv.start) && minutesNow < toMinutes(iv.end));
  return { isOpen: open, mode, reason: 'weekly', now: now.toISOString(), activeSource: 'weekly' };
}

// Get store hours
router.get('/:uid/store-hours', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('role workingHours provider emailVerified');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage store hours' });
    
    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before accessing store hours.',
        requiresEmailVerification: true
      });
    }
    const wh = user.workingHours || { mode: 'auto', weekly: [], overrides: [] };
    return res.json({ success: true, workingHours: { ...wh, weekly: normalizeWeekly(wh.weekly) } });
  } catch (e) {
    console.error('Fetch store-hours error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update store hours
router.put('/:uid/store-hours', async (req, res) => {
  try {
    const { uid } = req.params;
    const { mode, weekly, overrides } = req.body || {};
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ success: false, message: 'Only sellers can manage store hours' });
    
    // Check email verification for email providers (not Google users)
    if (user.provider === 'email' && !user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email verification required. Please verify your email before updating store hours.',
        requiresEmailVerification: true
      });
    }

    // Validate mode
    const modeVal = ['auto','force_open','force_closed'].includes(mode) ? mode : 'auto';

    // Validate weekly
    const safeWeekly = [];
    const seen = new Set();
    for (const d of (Array.isArray(weekly) ? weekly : [])) {
      if (!d || !dayKeys.includes(d.day)) continue;
      if (seen.has(d.day)) continue;
      seen.add(d.day);
      const dayIntervals = [];
      for (const iv of Array.isArray(d.intervals) ? d.intervals : []) {
        if (!iv || !isValidHHMM(iv.start) || !isValidHHMM(iv.end)) continue;
        const s = toMinutes(iv.start), e = toMinutes(iv.end);
        if (!(e > s)) continue; // no overnight allowed & end must be after start
        dayIntervals.push({ start: iv.start, end: iv.end });
      }
      // Ensure no overlaps for this day
      dayIntervals.sort((a,b) => toMinutes(a.start) - toMinutes(b.start));
      let ok = true;
      for (let i=1;i<dayIntervals.length;i++) {
        if (toMinutes(dayIntervals[i].start) < toMinutes(dayIntervals[i-1].end)) { ok = false; break; }
      }
      const enabled = !!d.enabled && ok && dayIntervals.length > 0;
      safeWeekly.push({ day: d.day, enabled, intervals: ok ? dayIntervals : [] });
    }

    // Fill missing days as disabled
    const weeklyNormalized = normalizeWeekly(safeWeekly);

    // Validate overrides
    const safeOverrides = [];
    for (const o of Array.isArray(overrides) ? overrides : []) {
      if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(String(o.date || ''))) continue;
      if (!['closed','open'].includes(o.type)) continue;
      let ivs = [];
      if (o.type === 'open') {
        ivs = (o.intervals || []).filter(x => x && isValidHHMM(x.start) && isValidHHMM(x.end) && toMinutes(x.end) > toMinutes(x.start));
        // Ensure no overlaps
        ivs.sort((a,b) => toMinutes(a.start) - toMinutes(b.start));
        let ok = true;
        for (let i=1;i<ivs.length;i++) if (toMinutes(ivs[i].start) < toMinutes(ivs[i-1].end)) { ok = false; break; }
        if (!ok) ivs = [];
      }
      safeOverrides.push({ date: o.date, type: o.type, intervals: ivs, note: (o.note || '').trim().slice(0,200) });
    }

    user.workingHours = { mode: modeVal, weekly: weeklyNormalized, overrides: safeOverrides };
    await user.save();
    return res.json({ success: true, message: 'Store hours updated', workingHours: user.workingHours });
  } catch (e) {
    console.error('Update store-hours error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get current store status (open/closed)
router.get('/:uid/store-status', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid }).select('role workingHours');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['seller','store'].includes(user.role)) return res.status(403).json({ success: false, message: 'Only seller/store' });
    const status = computeStatus(new Date(), user);
    return res.json({ success: true, ...status });
  } catch (e) {
    console.error('Store status error:', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;

