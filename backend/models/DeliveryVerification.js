import mongoose from 'mongoose';

const deliveryVerificationSchema = new mongoose.Schema({
  // Link to user
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Personal Information
  fullName: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    trim: true
  },
  phoneNumber: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    trim: true
  },
  address: {
    type: String,
    required: function() {
      return !this.isDraft;
    },
    trim: true
  },
  
  // Driving License Information
  drivingLicense: {
    licenseNumber: {
      type: String,
      required: function() {
        return !this.ownerDocument().isDraft;
      },
      trim: true,
      uppercase: true
    },
    expiryDate: {
      type: Date,
      required: function() {
        return !this.ownerDocument().isDraft;
      }
    },
    // Driving license image files
    frontImage: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    },
    backImage: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    }
  },
  
  // Vehicle Information
  vehicle: {
    type: {
      type: String,
      required: true,
      enum: ['bike', 'scooter', 'car', 'van', 'truck', 'bicycle'],
      default: 'bike'
    },
    registrationNumber: {
      type: String,
      required: function() {
        return !this.ownerDocument().isDraft;
      },
      trim: true,
      uppercase: true
    },
    make: {
      type: String,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    color: {
      type: String,
      trim: true
    },
    // Vehicle images
    frontImage: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    },
    backImage: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    },
    sideImage: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    },
    rcImage: { // Registration Certificate
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    }
  },
  
  // Verification Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'],
    default: 'pending'
  },
  
  // Admin Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewComments: {
    type: String,
    trim: true,
    default: ''
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Approval Details
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Verification History (for tracking resubmissions)
  verificationHistory: [{
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'],
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    comments: {
      type: String,
      trim: true,
      default: ''
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  
  // Submission tracking
  submittedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional metadata
  metadata: {
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    deviceInfo: { type: String, default: '' }
  },

  isDraft: {
    type: Boolean,
    default: true
  },
  
  // Emergency contact information
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true
    }
  },
  
  // Document expiry notifications
  notificationSettings: {
    licenseExpiryReminder: {
      type: Boolean,
      default: true
    },
    daysBeforeExpiry: {
      type: Number,
      default: 30 // days
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
deliveryVerificationSchema.index({ uid: 1 });
deliveryVerificationSchema.index({ status: 1 });
deliveryVerificationSchema.index({ submittedAt: -1 });
deliveryVerificationSchema.index({ 'drivingLicense.licenseNumber': 1 });
deliveryVerificationSchema.index({ 'vehicle.registrationNumber': 1 });

// Pre-save middleware to update lastUpdatedAt
deliveryVerificationSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

// Instance method to add history entry
deliveryVerificationSchema.methods.addHistory = function(status, changedBy, comments = '', reason = '') {
  this.verificationHistory.push({
    status,
    changedBy,
    comments,
    reason,
    changedAt: new Date()
  });
};

// Instance method to check if verification is complete
deliveryVerificationSchema.methods.isComplete = function() {
  return this.drivingLicense.frontImage.filename && 
         this.drivingLicense.backImage.filename && 
         this.vehicle.frontImage.filename && 
         this.vehicle.backImage.filename &&
         this.vehicle.rcImage.filename;
};

// Instance method to check if license is expired or expiring soon
deliveryVerificationSchema.methods.isLicenseExpiring = function(daysAhead = 30) {
  if (!this.drivingLicense.expiryDate) return false;
  const expiryDate = new Date(this.drivingLicense.expiryDate);
  const checkDate = new Date();
  checkDate.setDate(checkDate.getDate() + daysAhead);
  return expiryDate <= checkDate;
};

// Static method to find pending verifications
deliveryVerificationSchema.statics.findPendingVerifications = function() {
  return this.find({ 
    status: { $in: ['pending', 'under_review', 'resubmission_required'] } 
  }).populate('userId', 'name email phone').sort({ submittedAt: -1 });
};

// Static method to find approved verifications
deliveryVerificationSchema.statics.findApprovedVerifications = function() {
  return this.find({ status: 'approved' })
    .populate('userId', 'name email phone')
    .sort({ approvedAt: -1 });
};

// Virtual for getting readable status
deliveryVerificationSchema.virtual('readableStatus').get(function() {
  const statusMap = {
    'pending': 'Pending Review',
    'under_review': 'Under Review',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'resubmission_required': 'Resubmission Required'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for checking verification progress
deliveryVerificationSchema.virtual('completionPercentage').get(function() {
  let completed = 0;
  const total = 5; // 2 license images + 3 vehicle images (removed side)
  
  if (this.drivingLicense.frontImage.filename) completed++;
  if (this.drivingLicense.backImage.filename) completed++;
  if (this.vehicle.frontImage.filename) completed++;
  if (this.vehicle.backImage.filename) completed++;
  if (this.vehicle.rcImage.filename) completed++;
  
  return Math.round((completed / total) * 100);
});

const DeliveryVerification = mongoose.model('DeliveryVerification', deliveryVerificationSchema);
export default DeliveryVerification;
