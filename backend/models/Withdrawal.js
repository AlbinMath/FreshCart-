import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'cash'],
    default: 'pending_details'
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  upiDetails: {
    upiId: String
  },
  note: {
    type: String,
    default: 'Awaiting admin processing'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  rejectedReason: {
    type: String
  },
  adminNotes: {
    type: String
  },
  transactionId: {
    type: String
  },
  reference: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Create reference before saving
withdrawalSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = `WD${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;
