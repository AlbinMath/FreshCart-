import express from 'express';
import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import { logActivity } from '../middleware/activityLogger.js';

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const { uid } = req.user || {};
    const user = await User.findOne({ uid });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all activities with filters and pagination
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      actorRole,
      actionType,
      status,
      search,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by actor role
    if (actorRole) {
      query.actorRole = { $in: actorRole.split(',') };
    }

    // Filter by action type
    if (actionType) {
      query.actionType = { $in: actionType.split(',') };
    }

    // Filter by status
    if (status) {
      query.status = { $in: status.split(',') };
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search across multiple fields
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { 'details.path': searchRegex },
        { action: searchRegex },
        { actorEmail: searchRegex },
        { actorName: searchRegex },
        { 'details.method': searchRegex },
        { 'details.statusCode': searchRegex }
      ];
    }

    // Execute query with pagination
    const activities = await Activity.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await Activity.countDocuments(query);

    res.json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
});

// Get activity statistics
router.get('/stats', requireAdmin, async (req, res) => {
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
router.get('/:id', requireAdmin, async (req, res) => {
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
router.delete('/:id', requireAdmin, async (req, res) => {
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
router.delete('/', requireAdmin, async (req, res) => {
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

export default router;
