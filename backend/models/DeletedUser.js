import mongoose from 'mongoose';

const deletedUserSchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  email: { type: String, required: true, lowercase: true, index: true },
  name: { type: String, default: '' },
  role: { type: String, enum: ['customer','store','seller','admin','delivery'], required: true },
  provider: { type: String, enum: ['email', 'google'], default: 'email' },
  deletedAt: { type: Date, default: Date.now },
  reason: { type: String, default: 'self-initiated' },
  // Snapshot of user document (without password hash for safety)
  snapshot: { type: Object, default: {} },
  // Simple analytics fields for reporting
  analytics: {
    addressesCount: { type: Number, default: 0 },
    hadProfilePicture: { type: Boolean, default: false },
    hadStoreFields: { type: Boolean, default: false },
    hadDeliveryFields: { type: Boolean, default: false },
    daysSinceSignup: { type: Number, default: 0 },
    lastLoginAgeDays: { type: Number, default: 0 }
  }
}, { timestamps: true });

const DeletedUser = mongoose.model('DeletedUser', deletedUserSchema);
export default DeletedUser;