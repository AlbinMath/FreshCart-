import express from 'express';
import mongoose from 'mongoose';
import DeliveryWallet from '../models/DeliveryWallet.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../middleware/activityLogger.js';

const router = express.Router();

// Get delivery wallet details
router.get('/:userId/wallet', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the requesting user has access to this wallet
    if (req.user.uid !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Verify user is a delivery partner
    const user = await User.findOne({ uid: userId });
    if (!user || user.role !== 'delivery') {
      return res.status(403).json({ success: false, message: 'Only delivery partners can access wallet' });
    }

    // Get or create wallet
    let wallet = await DeliveryWallet.findOne({ userId });
    
    if (!wallet) {
      wallet = new DeliveryWallet({
        userId,
        totalEarnings: 0,
        totalWithdrawn: 0,
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }

    // Calculate total withdrawn from Withdrawal database (excluding rejected withdrawals)
    const withdrawals = await Withdrawal.find({ userId });
    const totalWithdrawn = withdrawals
      .filter(w => w.status !== 'rejected')
      .reduce((sum, w) => sum + w.amount, 0);
    
    // Calculate available balance based only on Withdrawal database
    const availableBalance = Math.max(0, wallet.totalEarnings - totalWithdrawn);

    res.json({
      success: true,
      wallet: {
        totalEarnings: wallet.totalEarnings,
        totalWithdrawn: totalWithdrawn, // Use calculated value from Withdrawal database
        balance: wallet.balance,
        lastUpdated: wallet.lastUpdated,
        transactions: wallet.transactions.slice(-20).reverse() // Last 20 transactions
      }
    });
  } catch (error) {
    console.error('Error fetching delivery wallet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch wallet details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add earnings to wallet (called when delivery is completed)
router.post('/:userId/wallet/credit', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const { amount, orderId, description = 'Delivery fee' } = req.body;

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid amount' 
      });
    }

    // Get or create wallet
    let wallet = await DeliveryWallet.findOne({ userId }).session(session);
    
    if (!wallet) {
      wallet = new DeliveryWallet({
        userId,
        totalEarnings: 0,
        totalWithdrawn: 0,
        balance: 0,
        transactions: []
      });
    }

    // Add earnings
    wallet.addEarnings(amountValue, orderId, description);
    await wallet.save({ session });

    // Log activity
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'delivery_earnings_credit',
      targetUserId: userId,
      details: {
        amount: amountValue,
        orderId,
        description,
        newBalance: wallet.balance,
        totalEarnings: wallet.totalEarnings
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Earnings credited successfully',
      wallet: {
        totalEarnings: wallet.totalEarnings,
        balance: wallet.balance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error crediting earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to credit earnings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Request withdrawal (simplified - no bank/UPI details required)
router.post('/:userId/wallet/withdraw', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const { amount } = req.body;

    // Verify the requesting user
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid amount' 
      });
    }

    // Minimum withdrawal check
    if (amountValue < 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum withdrawal amount is ₹100' 
      });
    }

    // Get wallet
    const wallet = await DeliveryWallet.findOne({ userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Check balance
    if (wallet.balance < amountValue) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Available: ₹${wallet.balance.toFixed(2)}` 
      });
    }

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      amount: amountValue,
      paymentMethod: 'pending_details',
      note: 'Awaiting admin processing',
      status: 'pending'
    });
    await withdrawal.save({ session });

    // Deduct from wallet (only update balance, not totalWithdrawn)
    if (wallet.balance < amountValue) {
      throw new Error('Insufficient balance');
    }
    wallet.balance -= amountValue;
    wallet.transactions.push({
      type: 'debit',
      amount: amountValue,
      description: 'Withdrawal request',
      reference: `WITHDRAWAL_${withdrawal._id}`,
      withdrawalId: withdrawal._id,
      status: 'completed'
    });
    wallet.lastUpdated = new Date();
    await wallet.save({ session });

    // Log activity
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'withdrawal_request',
      targetUserId: userId,
      details: {
        amount: amountValue,
        withdrawalId: withdrawal._id,
        newBalance: wallet.balance
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. Admin will process your request.',
      withdrawal: {
        _id: withdrawal._id,
        reference: withdrawal.reference,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt
      },
      wallet: {
        balance: wallet.balance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process withdrawal request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get withdrawal history
router.get('/:userId/wallet/withdrawals', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify access
    if (req.user.uid !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const withdrawals = await Withdrawal.find({ userId })
      .sort({ requestedAt: -1 })
      .limit(50);

    // Calculate total withdrawn based only on non-rejected withdrawals
    const totalWithdrawn = withdrawals
      .filter(w => w.status !== 'rejected')
      .reduce((sum, w) => sum + w.amount, 0);

    // Calculate statistics
    const stats = {
      total: withdrawals.length,
      pending: withdrawals.filter(w => w.status === 'pending').length,
      processing: withdrawals.filter(w => w.status === 'processing').length,
      completed: withdrawals.filter(w => w.status === 'completed').length,
      rejected: withdrawals.filter(w => w.status === 'rejected').length,
      totalWithdrawn: totalWithdrawn,
      totalPending: withdrawals
        .filter(w => w.status === 'pending' || w.status === 'processing')
        .reduce((sum, w) => sum + w.amount, 0)
    };

    res.json({
      success: true,
      withdrawals,
      stats,
      totalWithdrawn // Include totalWithdrawn in response
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Get all delivery wallets
router.get('/admin/wallets', authenticateToken, async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const { limit = 50, skip = 0 } = req.query;

    const wallets = await DeliveryWallet.find()
      .sort({ totalEarnings: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Get user details for each wallet
    const walletsWithUsers = await Promise.all(
      wallets.map(async (wallet) => {
        const user = await User.findOne(
          { uid: wallet.userId },
          { name: 1, email: 1, phone: 1 }
        );
        return {
          ...wallet.toObject(),
          user: user ? {
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null
        };
      })
    );

    const totalCount = await DeliveryWallet.countDocuments();

    // Calculate overall statistics
    const stats = await DeliveryWallet.aggregate([
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$totalEarnings' },
          totalWithdrawn: { $sum: '$totalWithdrawn' },
          totalBalance: { $sum: '$balance' }
        }
      }
    ]);

    res.json({
      success: true,
      wallets: walletsWithUsers,
      stats: stats[0] || { totalEarnings: 0, totalWithdrawn: 0, totalBalance: 0 },
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + wallets.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching delivery wallets:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery wallets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Process withdrawal (approve/reject)
router.put('/admin/withdrawals/:withdrawalId', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const { withdrawalId } = req.params;
    const { status, adminNotes, transactionId, rejectedReason, paymentMethod, bankDetails, upiDetails } = req.body;

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // Update withdrawal
    const updateData = { status, adminNotes };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.transactionId = transactionId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (bankDetails) updateData.bankDetails = bankDetails;
      if (upiDetails) updateData.upiDetails = upiDetails;
    } else if (status === 'processing') {
      updateData.processedAt = new Date();
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (bankDetails) updateData.bankDetails = bankDetails;
      if (upiDetails) updateData.upiDetails = upiDetails;
    } else if (status === 'rejected') {
      updateData.rejectedReason = rejectedReason;
      
      // Refund to wallet (only update balance, not totalWithdrawn)
      const wallet = await DeliveryWallet.findOne({ userId: withdrawal.userId }).session(session);
      if (wallet) {
        wallet.balance += withdrawal.amount;
        wallet.transactions.push({
          type: 'credit',
          amount: withdrawal.amount,
          description: 'Withdrawal rejected - Refund',
          reference: `REFUND_${withdrawal._id}`,
          withdrawalId: withdrawal._id,
          status: 'completed'
        });
        wallet.lastUpdated = new Date();
        await wallet.save({ session });
      }
    }

    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      updateData,
      { new: true, session }
    );

    // Log activity
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'withdrawal_status_update',
      targetUserId: withdrawal.userId,
      details: {
        withdrawalId,
        previousStatus: withdrawal.status,
        newStatus: status,
        amount: withdrawal.amount,
        transactionId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Withdrawal status updated successfully',
      withdrawal: updatedWithdrawal
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating withdrawal:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update withdrawal status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
