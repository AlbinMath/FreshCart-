import mongoose from 'mongoose';

const branchLinkRequestSchema = new mongoose.Schema({
  requesterUid: { type: String, required: true, index: true },
  requesterSellerUniqueNumber: { type: String, required: true, index: true },
  requesterStoreName: { type: String, default: '' },

  targetUid: { type: String, default: '', index: true }, // resolved from targetSellerUniqueNumber
  targetSellerUniqueNumber: { type: String, required: true, index: true },

  branchName: { type: String, required: true, trim: true },
  branchAddress: { type: String, required: true, trim: true },

  status: { type: String, enum: ['pending','accepted','denied'], default: 'pending', index: true },
  decidedAt: { type: Date },
}, { timestamps: true });

branchLinkRequestSchema.index({ requesterUid: 1, targetSellerUniqueNumber: 1, branchName: 1, status: 1 });

const BranchLinkRequest = mongoose.model('BranchLinkRequest', branchLinkRequestSchema);
export default BranchLinkRequest;