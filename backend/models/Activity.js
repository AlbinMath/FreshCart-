import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  actorUid: { type: String, required: true, index: true }, // who performed the action
  actorEmail: { type: String, default: '', index: true },
  actorName: { type: String, default: '' },
  actorRole: { 
    type: String, 
    enum: ['customer', 'seller', 'store', 'admin', 'delivery'], 
    default: 'customer',
    index: true 
  },
  targetUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  targetUserEmail: { type: String, default: '' },
  targetUserName: { type: String, default: '' },
  action: { 
    type: String, 
    required: true,
    index: true
  }, 
  actionType: {
    type: String,
    enum: ['authentication', 'profile_update', 'order', 'verification', 'system', 'other'],
    default: 'other'
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  details: { 
    type: Object, 
    default: {},
  },
  metadata: {
    deviceType: { type: String },
    browser: { type: String },
    os: { type: String },
    location: { type: String }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ actorRole: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

// Virtual for formatted date
activitySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleString();
});

// Pre-save hook to set actor name if not provided
activitySchema.pre('save', async function(next) {
  if (!this.actorName && this.actorUid) {
    try {
      const user = await mongoose.model('User').findOne({ uid: this.actorUid });
      if (user) {
        this.actorName = user.name || user.email.split('@')[0];
      }
    } catch (error) {
      console.error('Error setting actor name:', error);
    }
  }
  next();
});

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;