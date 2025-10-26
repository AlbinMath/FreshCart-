import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other', 'permanent', 'staying'],
    default: 'home'
  },
  name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  house: {
    type: String,
    trim: true
  },
  street: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  landmark: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    default: 'India',
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: function() {
      return !this.provider || this.provider !== 'google';
    }, 
    minlength: 6 
  },
  provider: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  role: {
    type: String,
    required: true,
    enum: ['customer', 'store', 'seller', 'admin', 'delivery', 'farmer'],
    default: 'customer'
  },
  phone: {
    type: String,
    trim: true
  },
  addresses: [addressSchema],
  profilePicture: {
    type: String,
    default: ''
  },
  profileImagePath: {
    type: String,
    default: ''
  },
  profileImageFilename: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  // Notification tracking
  lastEmailVerificationNotification: {
    type: Date,
    default: null
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    licenseUpdates: {
      type: Boolean,
      default: true
    },
    emailVerificationReminders: {
      type: Boolean,
      default: true
    }
  },
  storeName: {
    type: String,
    trim: true
  },
  businessLicense: {
    type: String,
    trim: true
  },
  // Seller business license upload and verification
  licenseInfo: {
    licenseNumber: {
      type: String,
      trim: true,
      required: function() { return this.role === 'seller'; }
    },
    file: {
      url: { type: String, default: '' },
      path: { type: String, default: '' },
      filename: { type: String, default: '' },
      mimetype: { type: String, default: '' },
      size: { type: Number, default: 0 }
    },
    // Optional external link to license document (when user submits URL only)
    externalLink: { type: String, default: '' },
    // License expiry date
    expiryDate: {
      type: Date,
      required: false
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    verifiedAt: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  sellerCategory: {
    type: String,
    enum: ['vegetables', 'fruits', 'dairy', 'meat', 'seafood', 'ready-to-cook', 'organic', 'bakery', 'beverages', 'household', 'other'],
    validate: {
      validator: function(v) {
        return !v || ['vegetables', 'fruits', 'dairy', 'meat', 'seafood', 'ready-to-cook', 'organic', 'bakery', 'beverages', 'household', 'other'].includes(v);
      },
      message: 'Invalid seller category'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  // Delivery partner settings
  serviceArea: {
    type: {
      type: String,
      enum: ['circle', 'polygon'],
      default: 'circle'
    },
    pincode: { type: String, trim: true },
    center: {
      lat: { type: Number },
      lng: { type: Number }
    },
    radiusMeters: { type: Number, default: 3000 },
    polygon: [{ lat: Number, lng: Number }]
  },
  availability: [{
    day: { type: String, enum: ['mon','tue','wed','thu','fri','sat','sun'] },
    start: { type: String }, // HH:MM (24h)
    end: { type: String },   // HH:MM (24h)
    enabled: { type: Boolean, default: false }
  }],
  // Date-based delivery schedule entries
  schedules: [{
    date: { type: String, required: true },     // YYYY-MM-DD
    start: { type: String, required: true },    // HH:MM
    end: { type: String },                      // HH:MM (optional if using duration)
    durationMinutes: { type: Number },          // optional if end provided
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    autoCreated: { type: Boolean, default: false },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  // Admin specific fields
  adminLevel: {
    type: String,
    enum: ['super', 'manager', 'support'],
    trim: true,
    validate: {
      validator: function(v) {
        return !v || ['super', 'manager', 'support'].includes(v);
      },
      message: 'Invalid admin level'
    }
  },
  // Wallet and transactions
  balance: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100 // Ensure 2 decimal places
  },
  walletTransactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    description: {
      type: String,
      required: true
    },
    reference: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed'
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Store specific fields
  storeAddress: {
    type: String,
    trim: true
  },
  // Auto-generated seller unique number (read-only)
  sellerUniqueNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  // Seller branch stores (optional)
  branchStores: [{
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    linkedSellerUniqueNumber: { type: String, trim: true, default: '' }, // optional link to an existing seller by unique number
    createdAt: { type: Date, default: Date.now }
  }],
  // Bi-directional seller connections (created when linking branches)
  linkedSellers: [{
    sellerUniqueNumber: { type: String, trim: true, required: true },
    uid: { type: String, trim: true },
    connectedAt: { type: Date, default: Date.now }
  }],
  // Reverse links: other sellers that linked this seller as a branch of theirs
  linkedBranchOf: [{
    sellerUniqueNumber: { type: String, required: true, trim: true }, // main seller who linked this profile
    branchName: { type: String, trim: true },
    branchAddress: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
  // Reverse links: other sellers that linked this seller as a branch of theirs
  linkedBranchOf: [{
    sellerUniqueNumber: { type: String, required: true, trim: true }, // main seller unique number who linked this profile
    uid: { type: String, trim: true },
    branchName: { type: String, trim: true },
    connectedAt: { type: Date, default: Date.now }
  }],
  // Password reset fields
  passwordResetToken: String,
  passwordResetExpires: Date,
  // Account status
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },
  // Seller bank details (encrypted)
  bankDetails: {
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    accountNumberEnc: { type: String, default: '' },
    accountNumberIV: { type: String, default: '' },
    accountNumberTag: { type: String, default: '' },
    panEnc: { type: String, default: '' },
    panIV: { type: String, default: '' },
    panTag: { type: String, default: '' },
    upiEnc: { type: String, default: '' },
    upiIV: { type: String, default: '' },
    upiTag: { type: String, default: '' },
    updatedAt: { type: Date }
  },
  // Store/Seller working hours and overrides
  workingHours: {
    mode: { type: String, enum: ['auto','force_open','force_closed'], default: 'auto' },
    weekly: [{
      day: { type: String, enum: ['mon','tue','wed','thu','fri','sat','sun'], required: true },
      enabled: { type: Boolean, default: false },
      intervals: [{
        start: { type: String }, // HH:MM 24h
        end: { type: String }    // HH:MM 24h
      }]
    }],
    overrides: [{
      date: { type: String, required: true }, // YYYY-MM-DD
      type: { type: String, enum: ['closed','open'], required: true },
      intervals: [{ start: String, end: String }], // only when type=open
      note: { type: String, trim: true }
    }]
  },
  // Store hours management (day-based for next 7 days)
  storeHours: [{
    day: { 
      type: String, 
      required: true,
      trim: true
    },
    openTime: { 
      type: String, 
      trim: true 
    },
    closeTime: { 
      type: String, 
      trim: true 
    },
    isClosed: { 
      type: Boolean, 
      default: false 
    },
    note: { 
      type: String, 
      trim: true,
      default: '' 
    }
  }],
  bankPinHash: { type: String, default: '' }
}, { 
  timestamps: true 
});

// Normalize fields before validate to avoid enum errors on empty strings
userSchema.pre('validate', function(next) {
  const blankToUndef = (v) => (v !== undefined && v !== null && String(v).trim() === '' ? undefined : v);
  // Clear empty strings for enum fields or optional fields that shouldn't store ''
  this.adminLevel = blankToUndef(this.adminLevel);
  this.vehicleType = blankToUndef(this.vehicleType);
  this.gender = blankToUndef(this.gender);
  this.sellerCategory = blankToUndef(this.sellerCategory);
  this.licenseNumber = blankToUndef(this.licenseNumber);
  next();
});

// Normalize fields before save
userSchema.pre('save', function(next) {
  // Prevent storing empty string in a unique+sparse field which can cause conflicts
  if (this.sellerUniqueNumber !== undefined && this.sellerUniqueNumber !== null && String(this.sellerUniqueNumber).trim() === '') {
    this.sellerUniqueNumber = undefined;
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare passwords for login
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

const User = mongoose.model('User', userSchema);
export default User;