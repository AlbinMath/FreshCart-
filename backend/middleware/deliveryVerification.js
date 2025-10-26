import deliveryVerificationService from '../services/deliveryVerificationService.js';

// Middleware to check if delivery partner is verified
export const checkDeliveryVerification = async (req, res, next) => {
  try {
    // Only check for delivery partners
    if (!req.user || req.user.role !== 'delivery') {
      return next();
    }

    // Check verification status
    const verificationResult = await deliveryVerificationService.isUserVerified(req.user.uid);
    
    if (!verificationResult.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Delivery verification required',
        code: 'VERIFICATION_REQUIRED',
        verificationStatus: verificationResult.status,
        redirectTo: '/delivery/verification'
      });
    }

    // Add verification info to request for use in other middleware/routes
    req.verificationStatus = verificationResult;
    next();
  } catch (error) {
    console.error('Error checking delivery verification:', error);
    // Allow access if verification check fails (don't block on errors)
    next();
  }
};

// Middleware to check if delivery partner can access orders
export const checkOrderAccess = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'delivery') {
      return next();
    }

    const verificationResult = await deliveryVerificationService.isUserVerified(req.user.uid);
    
    if (!verificationResult.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'You must complete delivery verification before accepting orders',
        code: 'VERIFICATION_REQUIRED_FOR_ORDERS',
        verificationStatus: verificationResult.status,
        redirectTo: '/delivery/verification'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking order access:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking order access'
    });
  }
};

export default { checkDeliveryVerification, checkOrderAccess };