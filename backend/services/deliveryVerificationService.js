import DeliveryVerification from '../models/DeliveryVerification.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

class DeliveryVerificationService {
  
  // Get verification status for a user
  async getVerificationStatus(uid) {
    try {
      console.log('🔍 Looking for verification with uid:', uid);
      
      // Try multiple field names to find the verification
      let verification = await DeliveryVerification.findOne({ uid })
        .populate('userId', 'name email phone')
        .populate('reviewedBy', 'name email')
        .populate('approvedBy', 'name email');
      
      // If not found by uid, try by userId field
      if (!verification) {
        console.log('🔍 Not found by uid, trying userId field...');
        verification = await DeliveryVerification.findOne({ userId: uid })
          .populate('userId', 'name email phone')
          .populate('reviewedBy', 'name email')
          .populate('approvedBy', 'name email');
      }
      
      console.log('🔍 Found verification:', verification ? 'YES' : 'NO');
      if (verification) {
        console.log('🔍 Verification status:', verification.status);
      }
      
      if (!verification) {
        return {
          exists: false,
          status: 'not_started',
          message: 'Verification not started'
        };
      }
      
      return {
        exists: true,
        verification,
        completionPercentage: verification.completionPercentage,
        isComplete: verification.isComplete(),
        isLicenseExpiring: verification.isLicenseExpiring(),
        readableStatus: verification.readableStatus
      };
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw new Error('Failed to get verification status');
    }
  }

  // Create or update verification
  async createOrUpdateVerification(uid, data) {
    try {
      const user = await User.findOne({ uid });
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'delivery') {
        throw new Error('Only delivery partners can submit verification');
      }

      let verification = await DeliveryVerification.findOne({ uid });
      
      if (verification) {
        // Update existing verification - merge data carefully
        if (data.fullName !== undefined) verification.fullName = data.fullName;
        if (data.phoneNumber !== undefined) verification.phoneNumber = data.phoneNumber;
        if (data.address !== undefined) verification.address = data.address;
        
        // Handle driving license data
        if (data.drivingLicense) {
          if (data.drivingLicense.licenseNumber !== undefined) {
            verification.drivingLicense.licenseNumber = data.drivingLicense.licenseNumber;
          }
          if (data.drivingLicense.expiryDate !== undefined) {
            verification.drivingLicense.expiryDate = data.drivingLicense.expiryDate;
          }
        }
        
        // Handle vehicle data
        if (data.vehicle) {
          Object.keys(data.vehicle).forEach(key => {
            if (data.vehicle[key] !== undefined) {
              verification.vehicle[key] = data.vehicle[key];
            }
          });
        }
        
        // Handle emergency contact
        if (data.emergencyContact) {
          Object.keys(data.emergencyContact).forEach(key => {
            if (data.emergencyContact[key] !== undefined) {
              verification.emergencyContact[key] = data.emergencyContact[key];
            }
          });
        }
        
        verification.lastUpdatedAt = new Date();
        
        // Add history entry if status changed
        if (data.status && data.status !== verification.status) {
          verification.addHistory(data.status, user._id, 'User updated verification');
        }
      } else {
        // Create new verification with default empty values for required fields
        verification = new DeliveryVerification({
          uid,
          userId: user._id,
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber || '',
          address: data.address || '',
          drivingLicense: {
            licenseNumber: data.drivingLicense?.licenseNumber || '',
            expiryDate: data.drivingLicense?.expiryDate || null
          },
          vehicle: {
            type: data.vehicle?.type || 'bike',
            registrationNumber: data.vehicle?.registrationNumber || '',
            make: data.vehicle?.make || '',
            model: data.vehicle?.model || '',
            year: data.vehicle?.year || '',
            color: data.vehicle?.color || ''
          },
          emergencyContact: {
            name: data.emergencyContact?.name || '',
            relationship: data.emergencyContact?.relationship || '',
            phoneNumber: data.emergencyContact?.phoneNumber || ''
          },
          status: 'pending',
          submittedAt: new Date(),
          isDraft: true // Always start as draft
        });
        
        verification.addHistory('pending', user._id, 'Initial submission');
      }

      // Update draft status based on completeness
      const shouldValidate = this.updateDraftStatus(verification);
      console.log('🔍 Draft status:', verification.isDraft, 'Should validate:', shouldValidate);
      
      await verification.save({ validateBeforeSave: shouldValidate });
      return verification;
    } catch (error) {
      console.error('Error creating/updating verification:', error);
      throw new Error(error.message || 'Failed to save verification');
    }
  }

  hasMinimumRequiredFields(verification) {
    // Check if all required text fields have meaningful values (not empty strings)
    const hasBaseFields = Boolean(
      verification.fullName && verification.fullName.trim() &&
      verification.phoneNumber && verification.phoneNumber.trim() &&
      verification.address && verification.address.trim() &&
      verification.drivingLicense?.licenseNumber && verification.drivingLicense.licenseNumber.trim() &&
      verification.drivingLicense?.expiryDate &&
      verification.vehicle?.registrationNumber && verification.vehicle.registrationNumber.trim()
    );

    const licenseImages = verification.drivingLicense;
    const vehicleImages = verification.vehicle;

    const hasDocumentImages = Boolean(
      licenseImages?.frontImage?.filename &&
      licenseImages?.backImage?.filename &&
      vehicleImages?.frontImage?.filename &&
      vehicleImages?.backImage?.filename &&
      vehicleImages?.rcImage?.filename
    );

    return hasBaseFields && hasDocumentImages;
  }

  updateDraftStatus(verification) {
    const isComplete = this.hasMinimumRequiredFields(verification);
    verification.isDraft = !isComplete;
    return isComplete;
  }

  // Upload verification documents
  async uploadDocument(uid, documentType, imageType, file) {
    try {
      // Check file validity
      if (!file) {
        throw new Error('No file provided');
      }
      
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size should not exceed 5MB');
      }

      let verification = await DeliveryVerification.findOne({ uid });
      
      // If verification doesn't exist, create it automatically with minimal data
      if (!verification) {
        console.log('📝 Creating new verification record for UID:', uid);
        const user = await User.findOne({ uid });
        if (!user) {
          throw new Error('User not found');
        }

        if (user.role !== 'delivery') {
          throw new Error('Only delivery partners can submit verification');
        }

        verification = new DeliveryVerification({
          uid,
          userId: user._id,
          fullName: user.name || '',
          phoneNumber: user.phone || '',
          address: '',
          drivingLicense: {
            licenseNumber: '',
            expiryDate: null
          },
          vehicle: {
            type: 'bike',
            registrationNumber: '',
            make: '',
            model: '',
            year: '',
            color: ''
          },
          emergencyContact: {
            name: '',
            relationship: '',
            phoneNumber: ''
          },
          status: 'pending',
          submittedAt: new Date(),
          isDraft: true
        });

        verification.addHistory('pending', user._id, 'Initial verification created automatically during document upload');
        await verification.save({ validateBeforeSave: false });
        console.log('✅ New verification record created');
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const fileInfo = {
        url: `${baseUrl}/uploads/delivery-verification/${file.filename}`,
        path: file.path,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      };

      // Update the appropriate field based on document and image type
      if (documentType === 'license') {
        if (imageType === 'front') {
          verification.drivingLicense.frontImage = fileInfo;
        } else if (imageType === 'back') {
          verification.drivingLicense.backImage = fileInfo;
        }
      } else if (documentType === 'vehicle') {
        if (imageType === 'front') {
          verification.vehicle.frontImage = fileInfo;
        } else if (imageType === 'back') {
          verification.vehicle.backImage = fileInfo;
        } else if (imageType === 'rc') {
          verification.vehicle.rcImage = fileInfo;
        }
      }

      verification.lastUpdatedAt = new Date();
      const shouldValidate = this.updateDraftStatus(verification);
      await verification.save({ validateBeforeSave: shouldValidate });
      console.log('📤 Document uploaded successfully for:', documentType, imageType);

      return verification;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error(error.message || 'Failed to upload document');
    }
  }

  // Delete uploaded document
  async deleteDocument(uid, documentType, imageType) {
    try {
      const verification = await DeliveryVerification.findOne({ uid });
      if (!verification) {
        throw new Error('Verification record not found');
      }

      let fileInfo = null;

      // Get file info and clear the field
      if (documentType === 'license') {
        if (imageType === 'front') {
          fileInfo = verification.drivingLicense.frontImage;
          verification.drivingLicense.frontImage = {
            url: '', path: '', filename: '', mimetype: '', size: 0
          };
        } else if (imageType === 'back') {
          fileInfo = verification.drivingLicense.backImage;
          verification.drivingLicense.backImage = {
            url: '', path: '', filename: '', mimetype: '', size: 0
          };
        }
      } else if (documentType === 'vehicle') {
        if (imageType === 'front') {
          fileInfo = verification.vehicle.frontImage;
          verification.vehicle.frontImage = {
            url: '', path: '', filename: '', mimetype: '', size: 0
          };
        } else if (imageType === 'back') {
          fileInfo = verification.vehicle.backImage;
          verification.vehicle.backImage = {
            url: '', path: '', filename: '', mimetype: '', size: 0
          };
        } else if (imageType === 'rc') {
          fileInfo = verification.vehicle.rcImage;
          verification.vehicle.rcImage = {
            url: '', path: '', filename: '', mimetype: '', size: 0
          };
        }
      }

      // Delete physical file
      if (fileInfo && fileInfo.path && fs.existsSync(fileInfo.path)) {
        try {
          fs.unlinkSync(fileInfo.path);
        } catch (deleteError) {
          console.warn('Warning: Could not delete file:', deleteError.message);
        }
      }

      verification.lastUpdatedAt = new Date();
      const shouldValidate = this.updateDraftStatus(verification);
      await verification.save({ validateBeforeSave: shouldValidate });

      return verification;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(error.message || 'Failed to delete document');
    }
  }

  // Submit verification for review
  async submitForReview(uid) {
    try {
      const verification = await DeliveryVerification.findOne({ uid });
      if (!verification) {
        throw new Error('Verification record not found');
      }

      if (!verification.isComplete()) {
        throw new Error('Please upload all required documents before submitting');
      }

      verification.status = 'under_review';
      verification.lastUpdatedAt = new Date();
      verification.addHistory('under_review', verification.userId, 'Submitted for admin review');

      await verification.save();
      return verification;
    } catch (error) {
      console.error('Error submitting for review:', error);
      throw new Error(error.message || 'Failed to submit for review');
    }
  }

  // Admin: Get all verifications for review
  async getAllVerifications(filter = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, status, sortBy = 'submittedAt', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      const query = {};
      if (status) {
        query.status = status;
      }
      if (filter.search) {
        query.$or = [
          { fullName: { $regex: filter.search, $options: 'i' } },
          { phoneNumber: { $regex: filter.search, $options: 'i' } },
          { 'drivingLicense.licenseNumber': { $regex: filter.search, $options: 'i' } },
          { 'vehicle.registrationNumber': { $regex: filter.search, $options: 'i' } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const verifications = await DeliveryVerification.find(query)
        .populate('userId', 'name email phone')
        .populate('reviewedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await DeliveryVerification.countDocuments(query);

      return {
        verifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      console.error('Error getting verifications:', error);
      throw new Error('Failed to get verifications');
    }
  }

  // Admin: Review verification (approve/reject)
  async reviewVerification(verificationId, adminUid, action, comments = '', rejectionReason = '') {
    try {
      const admin = await User.findOne({ uid: adminUid });
      if (!admin || admin.role !== 'admin') {
        throw new Error('Only admins can review verifications');
      }

      const verification = await DeliveryVerification.findById(verificationId);
      if (!verification) {
        throw new Error('Verification not found');
      }

      const now = new Date();
      
      if (action === 'approve') {
        verification.status = 'approved';
        verification.approvedAt = now;
        verification.approvedBy = admin._id;
        verification.reviewComments = comments;
        verification.addHistory('approved', admin._id, comments, 'Admin approval');
      } else if (action === 'reject') {
        verification.status = 'rejected';
        verification.rejectionReason = rejectionReason || comments;
        verification.reviewComments = comments;
        verification.addHistory('rejected', admin._id, comments, rejectionReason);
      } else if (action === 'request_resubmission') {
        verification.status = 'resubmission_required';
        verification.rejectionReason = rejectionReason || comments;
        verification.reviewComments = comments;
        verification.addHistory('resubmission_required', admin._id, comments, rejectionReason);
      }

      verification.reviewedBy = admin._id;
      verification.reviewedAt = now;
      verification.lastUpdatedAt = now;

      await verification.save();

      // Update user verification status in User model if needed
      const user = await User.findById(verification.userId);
      if (user && verification.status === 'approved') {
        user.isVerified = true;
        await user.save();
      } else if (user && ['rejected', 'resubmission_required'].includes(verification.status)) {
        user.isVerified = false;
        await user.save();
      }

      return verification;
    } catch (error) {
      console.error('Error reviewing verification:', error);
      throw new Error(error.message || 'Failed to review verification');
    }
  }

  // Check if user is verified
  async isUserVerified(uid) {
    try {
      const verification = await DeliveryVerification.findOne({ uid });
      return {
        isVerified: verification && verification.status === 'approved',
        status: verification ? verification.status : 'not_started',
        verification
      };
    } catch (error) {
      console.error('Error checking verification status:', error);
      return { isVerified: false, status: 'error', verification: null };
    }
  }

  // Get verification statistics for admin dashboard
  async getVerificationStats() {
    try {
      const stats = await DeliveryVerification.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusCounts = {
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        resubmission_required: 0
      };

      stats.forEach(stat => {
        if (statusCounts.hasOwnProperty(stat._id)) {
          statusCounts[stat._id] = stat.count;
        }
      });

      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      
      // Get recent submissions
      const recentSubmissions = await DeliveryVerification.find()
        .populate('userId', 'name email')
        .sort({ submittedAt: -1 })
        .limit(5);

      // Get expiring licenses
      const expiringLicenses = await DeliveryVerification.find({
        status: 'approved',
        'drivingLicense.expiryDate': {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      }).populate('userId', 'name email phone');

      return {
        statusCounts,
        total,
        recentSubmissions,
        expiringLicenses
      };
    } catch (error) {
      console.error('Error getting verification stats:', error);
      throw new Error('Failed to get verification statistics');
    }
  }

  // Clean up orphaned files
  async cleanupOrphanedFiles() {
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'delivery-verification');
      
      if (!fs.existsSync(uploadDir)) {
        return { cleaned: 0, message: 'Upload directory does not exist' };
      }

      const files = fs.readdirSync(uploadDir);
      const verifications = await DeliveryVerification.find();
      
      const usedFiles = new Set();
      verifications.forEach(verification => {
        // Collect all used filenames
        if (verification.drivingLicense.frontImage.filename) usedFiles.add(verification.drivingLicense.frontImage.filename);
        if (verification.drivingLicense.backImage.filename) usedFiles.add(verification.drivingLicense.backImage.filename);
        if (verification.vehicle.frontImage.filename) usedFiles.add(verification.vehicle.frontImage.filename);
        if (verification.vehicle.backImage.filename) usedFiles.add(verification.vehicle.backImage.filename);
        if (verification.vehicle.rcImage.filename) usedFiles.add(verification.vehicle.rcImage.filename);
      });

      let cleanedCount = 0;
      files.forEach(file => {
        if (!usedFiles.has(file)) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
            cleanedCount++;
          } catch (error) {
            console.warn(`Failed to delete orphaned file ${file}:`, error.message);
          }
        }
      });

      return { 
        cleaned: cleanedCount, 
        message: `Cleaned up ${cleanedCount} orphaned files` 
      };
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      throw new Error('Failed to cleanup orphaned files');
    }
  }
}

export default new DeliveryVerificationService();
