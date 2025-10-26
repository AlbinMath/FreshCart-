import Activity from '../models/Activity.js';
import User from '../models/User.js';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

// Helper to get device and browser info
const getDeviceInfo = (userAgent) => {
  const parser = new UAParser(userAgent);
  const { browser, os, device } = parser.getResult();
  
  return {
    deviceType: device.type || 'desktop',
    browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
    os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
  };
};

// Helper to get location from IP
const getLocationFromIp = (ip) => {
  try {
    const geo = geoip.lookup(ip);
    if (!geo) return null;
    
    return {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      ll: geo.ll,
    };
  } catch (error) {
    console.error('Error getting location from IP:', error);
    return null;
  }
};

// Middleware to log user activities
export const logActivity = (action, actionType = 'other', options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Override default options with provided ones
    const {
      captureResponse = false,
      captureRequest = false,
      customDetails = {},
      targetUserIdField = 'userId',
      statusField = 'success'
    } = options;

    // Get client IP address
    const ip = req.headers['x-forwarded-for'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress;
    
    // Get user agent
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = getDeviceInfo(userAgent);
    const location = getLocationFromIp(ip);
    
    // Extract user info from various sources (prefer req.user.uid, fallback to req.user.id)
    let actorUid = req.user?.uid || 
                    req.headers['x-actor-uid'] || 
                    req.body?.uid;
    if (!actorUid && req.user?.id) {
      actorUid = String(req.user.id);
    }
                    
    const actorEmail = req.user?.email || 
                      req.headers['x-actor-email'] || 
                      req.body?.email;

    // Get user role if not provided
    let actorRole = req.user?.role || 
                   req.headers['x-actor-role'] || 
                   req.body?.role;

    // If we don't have role but have UID, fetch it
    if (!actorRole && actorUid) {
      try {
        const user = await User.findOne({ uid: actorUid }).select('role name');
        if (user) {
          actorRole = user.role;
          // If we have user data, use it to populate actor name
          if (user.name) {
            req.actorName = user.name;
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    }

    // Store the original JSON function
    const originalJson = res.json;
    let responseBody = {};

    // Override res.json to capture the response
    if (captureResponse) {
      res.json = function(body) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }

    // Log the activity after the request is processed
    res.on('finish', async () => {
      try {
        // Skip logging for non-API routes or health checks
        if (req.path.includes('health') || req.path.includes('favicon.ico')) {
          return;
        }

        const duration = Date.now() - startTime;
        const status = res.statusCode >= 400 ? 'failed' : statusField;
        
        // Prepare activity data
        const activityData = {
          actorUid,
          actorEmail: actorEmail || '',
          actorName: req.actorName || '',
          actorRole: actorRole || 'customer',
          action,
          actionType,
          targetUserId: req.params[targetUserIdField] || req.body[targetUserIdField],
          ipAddress: ip,
          userAgent,
          status,
          responseTime: duration,
          details: {
            ...customDetails,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ...(captureRequest && { requestBody: req.body }),
            ...(captureResponse && { responseBody }),
            ...(res.locals.error && { error: res.locals.error })
          },
          metadata: {
            ...deviceInfo,
            location: location ? `${location.city}, ${location.country}` : null,
            ipDetails: location
          }
        };

        // Add target user info if available
        if (activityData.targetUserId) {
          try {
            const targetUser = await User.findById(activityData.targetUserId)
              .select('name email role');
              
            if (targetUser) {
              activityData.targetUserEmail = targetUser.email;
              activityData.targetUserName = targetUser.name;
            }
          } catch (error) {
            console.error('Error fetching target user:', error);
          }
        }

        // If we still don't have an actor, skip logging to avoid schema validation errors
        if (!activityData.actorUid) {
          return;
        }

        // Save the activity (fire and forget)
        Activity.create(activityData).catch(console.error);
        
      } catch (error) {
        console.error('Error in activity logger:', error);
      }
    });

    next();
  };
};

// Helper function to manually log activities
export const logUserActivity = async (actorUid, actorEmail, actorRole, action, details = {}, targetUserId = null) => {
  try {
    const activityData = {
      actorUid,
      actorEmail: actorEmail || '',
      actorRole: actorRole || 'customer',
      action,
      details,
      targetUserId
    };

    await Activity.create(activityData);
  } catch (error) {
    console.error('Error manually logging activity:', error);
  }
};
