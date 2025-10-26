import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  orderId: {
    type: String
  },
  withdrawalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const deliveryWalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  transactions: [transactionSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to add earnings
deliveryWalletSchema.methods.addEarnings = function(amount, orderId, description = 'Delivery fee') {
  this.totalEarnings += amount;
  this.balance += amount;
  this.transactions.push({
    type: 'credit',
    amount,
    description,
    reference: `DELIVERY_${orderId}`,
    orderId,
    status: 'completed'
  });
  this.lastUpdated = new Date();
};

// Method to process withdrawal
deliveryWalletSchema.methods.processWithdrawal = function(amount, withdrawalId) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  // Don't update totalWithdrawn as it's calculated from Withdrawal database
  this.balance -= amount;
  this.transactions.push({
    type: 'debit',
    amount,
    description: 'Withdrawal request',
    reference: `WITHDRAWAL_${withdrawalId}`,
    withdrawalId,
    status: 'completed'
  });
  this.lastUpdated = new Date();
};

// Method to refund withdrawal (when rejected)
deliveryWalletSchema.methods.refundWithdrawal = function(amount, withdrawalId) {
  // Don't update totalWithdrawn as it's calculated from Withdrawal database
  this.balance += amount;
  this.transactions.push({
    type: 'credit',
    amount,
    description: 'Withdrawal rejected - Refund',
    reference: `REFUND_${withdrawalId}`,
    withdrawalId,
    status: 'completed'
  });
  this.lastUpdated = new Date();
};

// Virtual to calculate available balance based on Withdrawal database
deliveryWalletSchema.virtual('availableBalance').get(function() {
  // This virtual property is deprecated as available balance is now calculated from Withdrawal database
  // Kept for backward compatibility
  return this.balance;
});

// Ensure virtual fields are serialized
deliveryWalletSchema.set('toJSON', { virtuals: true });
deliveryWalletSchema.set('toObject', { virtuals: true });

const DeliveryWallet = mongoose.model('DeliveryWallet', deliveryWalletSchema);

export default DeliveryWallet;
