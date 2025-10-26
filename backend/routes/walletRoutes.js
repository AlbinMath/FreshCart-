import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../middleware/activityLogger.js';

const router = express.Router();

// Get wallet details
router.get('/:userId/wallet', async (req, res) => {
  try {

    const user = await User.findOne(
      { uid: req.params.userId },
      { balance: 1, walletTransactions: 1 }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      balance: user.balance || 0,
      transactions: user.walletTransactions || []
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch wallet details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add money to wallet
router.post('/:userId/wallet/add', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const userId = req.params.userId;

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid amount' 
      });
    }

    // Verify the requesting user has access to this wallet
    if (req.user.uid !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Find user and update balance atomically
    const user = await User.findOneAndUpdate(
      { uid: userId },
      {
        $inc: { balance: amountValue },
        $push: {
          walletTransactions: {
            type: 'credit',
            amount: amountValue,
            description: 'Wallet top-up',
            reference: `WALLET_TOPUP_${Date.now()}`,
            status: 'completed'
          }
        }
      },
      { new: true, session }
    );

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Log the wallet top-up activity
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'wallet_topup',
      targetUserId: userId,
      details: {
        amount: amountValue,
        newBalance: user.balance + amountValue
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Money added to wallet successfully',
      newBalance: user.balance + amountValue,
      transaction: {
        _id: new mongoose.Types.ObjectId(),
        type: 'credit',
        amount: amountValue,
        description: 'Wallet top-up',
        reference: `WALLET_TOPUP_${Date.now()}`,
        status: 'completed',
        createdAt: new Date()
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error adding money to wallet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add money to wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Deduct money from wallet (for payments)
router.post('/:userId/wallet/deduct', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, reference, description = 'Payment' } = req.body;
    const userId = req.params.userId;
    
    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid amount' 
      });
    }

    // Verify the requesting user has access to this wallet
    if (req.user.uid !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Check if user has sufficient balance
    const user = await User.findOne({ uid: userId }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.balance < amountValue) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Update balance and add transaction
    const updatedUser = await User.findOneAndUpdate(
      { 
        uid: userId,
        balance: { $gte: amountValue } // Ensure balance hasn't changed
      },
      {
        $inc: { balance: -amountValue },
        $push: {
          walletTransactions: {
            type: 'debit',
            amount: amountValue,
            description,
            reference: reference || `PAYMENT_${Date.now()}`,
            status: 'completed'
          }
        }
      },
      { new: true, session }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance or user not found' 
      });
    }

    // Log the wallet deduction activity
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'wallet_deduction',
      targetUserId: userId,
      details: {
        amount: amountValue,
        reference,
        description,
        newBalance: updatedUser.balance - amountValue
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Payment successful',
      newBalance: updatedUser.balance - amountValue,
      transaction: {
        _id: new mongoose.Types.ObjectId(),
        type: 'debit',
        amount: amountValue,
        description,
        reference: reference || `PAYMENT_${Date.now()}`,
        status: 'completed',
        createdAt: new Date()
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error processing payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Request withdrawal
router.post('/:userId/wallet/withdraw', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, paymentMethod, bankDetails, upiDetails } = req.body;
    const userId = req.params.userId;

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid amount' 
      });
    }

    // Minimum withdrawal amount check (e.g., ₹100)
    if (amountValue < 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum withdrawal amount is ₹100' 
      });
    }

    // No authentication required - direct database access

    // Validate payment method details
    if (paymentMethod === 'bank_transfer') {
      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please provide complete bank details' 
        });
      }
    } else if (paymentMethod === 'upi') {
      if (!upiDetails || !upiDetails.upiId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please provide UPI ID' 
        });
      }
    }

    // Check if user has sufficient balance
    const user = await User.findOne({ uid: userId }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.balance < amountValue) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Available: ₹${user.balance.toFixed(2)}` 
      });
    }

    // Deduct amount from wallet
    const updatedUser = await User.findOneAndUpdate(
      { 
        uid: userId,
        balance: { $gte: amountValue }
      },
      {
        $inc: { balance: -amountValue },
        $push: {
          walletTransactions: {
            type: 'debit',
            amount: amountValue,
            description: 'Withdrawal request',
            reference: `WITHDRAWAL_${Date.now()}`,
            status: 'pending'
          }
        }
      },
      { new: true, session }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance or user not found' 
      });
    }

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      amount: amountValue,
      paymentMethod,
      bankDetails: paymentMethod === 'bank_transfer' ? bankDetails : undefined,
      upiDetails: paymentMethod === 'upi' ? upiDetails : undefined,
      status: 'pending'
    });

    await withdrawal.save({ session });

    // Log the withdrawal request activity
    await logActivity({
      actorUid: userId,
      actorEmail: 'system@freshcart.com',
      actorRole: 'seller',
      action: 'withdrawal_request',
      targetUserId: userId,
      details: {
        amount: amountValue,
        paymentMethod,
        withdrawalId: withdrawal._id,
        newBalance: updatedUser.balance
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        _id: withdrawal._id,
        reference: withdrawal.reference,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt
      },
      newBalance: updatedUser.balance
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process withdrawal request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get withdrawal history
router.get('/:userId/wallet/withdrawals', async (req, res) => {
  try {
    const userId = req.params.userId;

    const withdrawals = await Withdrawal.find({ userId })
      .sort({ requestedAt: -1 })
      .limit(50);

    // Calculate withdrawal statistics
    const stats = {
      total: withdrawals.length,
      pending: withdrawals.filter(w => w.status === 'pending').length,
      processing: withdrawals.filter(w => w.status === 'processing').length,
      completed: withdrawals.filter(w => w.status === 'completed').length,
      rejected: withdrawals.filter(w => w.status === 'rejected').length,
      // Updated to include all non-rejected withdrawals (matching wallet's totalWithdrawn calculation)
      totalWithdrawn: withdrawals
        .filter(w => w.status !== 'rejected')
        .reduce((sum, w) => sum + w.amount, 0),
      totalPending: withdrawals
        .filter(w => w.status === 'pending' || w.status === 'processing')
        .reduce((sum, w) => sum + w.amount, 0)
    };

    res.json({
      success: true,
      withdrawals,
      stats
    });
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint without authentication
router.get('/admin/withdrawals/test', async (req, res) => {
  try {
    console.log('🔍 Test endpoint called');
    
    // Test database connection
    const totalWithdrawals = await Withdrawal.countDocuments();
    console.log('🔍 Total withdrawals in database:', totalWithdrawals);
    
    // Get all withdrawals
    const allWithdrawals = await Withdrawal.find({}).limit(10);
    console.log('🔍 Sample withdrawals:', allWithdrawals.length);
    
    res.json({
      success: true,
      message: 'Test endpoint working',
      totalWithdrawals,
      withdrawals: allWithdrawals
    });
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Get all withdrawal requests (temporarily without auth for testing)
router.get('/admin/withdrawals', async (req, res) => {
  try {
    console.log('🔍 Admin withdrawals endpoint called');
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request query:', req.query);
    
    // Temporarily skip authentication for testing
    // TODO: Re-enable authentication after fixing the issue

    const { status, limit = 50, skip = 0 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Debug: Check if Withdrawal model is working
    console.log('🔍 Testing Withdrawal model...');
    const totalWithdrawals = await Withdrawal.countDocuments();
    console.log('🔍 Total withdrawals in database:', totalWithdrawals);
    
    // Debug: Check all withdrawals
    const allWithdrawals = await Withdrawal.find({}).limit(5);
    console.log('🔍 Sample withdrawals:', allWithdrawals.map(w => ({ id: w._id, userId: w.userId, amount: w.amount, status: w.status })));

    const withdrawals = await Withdrawal.find(query)
      .sort({ requestedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    console.log('🔍 Query:', query);
    console.log('🔍 Found withdrawals:', withdrawals.length);
    console.log('🔍 Withdrawals data:', withdrawals.map(w => ({ id: w._id, userId: w.userId, amount: w.amount, status: w.status })));

    // Get user details for each withdrawal
    const withdrawalsWithUsers = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        console.log('🔍 Looking up user for withdrawal:', withdrawal.userId);
        const user = await User.findOne(
          { uid: withdrawal.userId },
          { name: 1, email: 1, role: 1 }
        );
        console.log('🔍 User found:', user ? 'YES' : 'NO', user);
        return {
          ...withdrawal.toObject(),
          user: user ? {
            name: user.name,
            email: user.email,
            role: user.role
          } : {
            name: 'Unknown User',
            email: withdrawal.userId,
            role: 'unknown'
          }
        };
      })
    );

    // Get total count for pagination
    const totalCount = await Withdrawal.countDocuments(query);

    // Calculate statistics
    const stats = {
      total: totalCount,
      pending: await Withdrawal.countDocuments({ status: 'pending' }),
      processing: await Withdrawal.countDocuments({ status: 'processing' }),
      completed: await Withdrawal.countDocuments({ status: 'completed' }),
      rejected: await Withdrawal.countDocuments({ status: 'rejected' }),
      // Updated to include all non-rejected withdrawals (matching wallet's totalWithdrawn calculation)
      totalAmount: await Withdrawal.aggregate([
        { $match: { status: { $ne: 'rejected' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      pendingAmount: await Withdrawal.aggregate([
        { $match: { status: { $in: ['pending', 'processing'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0)
    };

    const response = {
      success: true,
      withdrawals: withdrawalsWithUsers,
      stats,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + withdrawals.length < totalCount
      }
    };
    
    console.log('🔍 Sending response with', withdrawalsWithUsers.length, 'withdrawals');
    console.log('🔍 Response data:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Update withdrawal status
router.put('/admin/withdrawals/:withdrawalId', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const { status, adminNotes, transactionId, rejectedReason } = req.body;
    const { withdrawalId } = req.params;

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // Update withdrawal status
    const updateData = {
      status,
      adminNotes
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.transactionId = transactionId;
    } else if (status === 'processing') {
      updateData.processedAt = new Date();
    } else if (status === 'rejected') {
      updateData.rejectedReason = rejectedReason;
      
      // Refund amount to user's wallet
      await User.findOneAndUpdate(
        { uid: withdrawal.userId },
        {
          $inc: { balance: withdrawal.amount },
          $push: {
            walletTransactions: {
              type: 'credit',
              amount: withdrawal.amount,
              description: 'Withdrawal request rejected - Refund',
              reference: `REFUND_${withdrawal.reference}`,
              status: 'completed'
            }
          }
        },
        { session }
      );
    }

    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      updateData,
      { new: true, session }
    );

    // Log the admin action
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
    
    console.error('Error updating withdrawal status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update withdrawal status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Get payment request statistics
router.get('/admin/payment-requests/stats', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Payment stats endpoint called');
    console.log('🔍 User role:', req.user.role);
    
    // Verify admin access
    if (req.user.role !== 'admin') {
      console.log('❌ Unauthorized access to stats - role:', req.user.role);
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const stats = {
      total: await Withdrawal.countDocuments(),
      pending: await Withdrawal.countDocuments({ status: 'pending' }),
      processing: await Withdrawal.countDocuments({ status: 'processing' }),
      completed: await Withdrawal.countDocuments({ status: 'completed' }),
      rejected: await Withdrawal.countDocuments({ status: 'rejected' }),
      totalAmount: await Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      pendingAmount: await Withdrawal.aggregate([
        { $match: { status: { $in: ['pending', 'processing'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      todayRequests: await Withdrawal.countDocuments({
        requestedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      todayAmount: await Withdrawal.aggregate([
        { $match: { requestedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0)
    };

    console.log('🔍 Stats calculated:', stats);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching payment request statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment request statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Bulk update withdrawal statuses
router.put('/admin/withdrawals/bulk-update', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const { withdrawalIds, status, adminNotes, transactionId, rejectedReason } = req.body;

    if (!withdrawalIds || !Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide withdrawal IDs to update' 
      });
    }

    const updateData = {
      status,
      adminNotes
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.transactionId = transactionId;
    } else if (status === 'processing') {
      updateData.processedAt = new Date();
    } else if (status === 'rejected') {
      updateData.rejectedReason = rejectedReason;
    }

    // Update all withdrawals
    const updatedWithdrawals = await Withdrawal.updateMany(
      { _id: { $in: withdrawalIds } },
      updateData,
      { session }
    );

    // If rejected, refund amounts to users' wallets
    if (status === 'rejected') {
      const withdrawals = await Withdrawal.find({ _id: { $in: withdrawalIds } }).session(session);
      
      for (const withdrawal of withdrawals) {
        await User.findOneAndUpdate(
          { uid: withdrawal.userId },
          {
            $inc: { balance: withdrawal.amount },
            $push: {
              walletTransactions: {
                type: 'credit',
                amount: withdrawal.amount,
                description: 'Withdrawal request rejected - Refund',
                reference: `REFUND_${withdrawal.reference}`,
                status: 'completed'
              }
            }
          },
          { session }
        );
      }
    }

    // Log the bulk admin action
    await logActivity({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'bulk_withdrawal_update',
      details: {
        withdrawalIds,
        status,
        count: withdrawalIds.length,
        transactionId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `Successfully updated ${updatedWithdrawals.modifiedCount} withdrawal requests`,
      updatedCount: updatedWithdrawals.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error bulk updating withdrawal statuses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk update withdrawal statuses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Get withdrawal details with user information
router.get('/admin/withdrawals/:withdrawalId', authenticateToken, async (req, res) => {
  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }

    const { withdrawalId } = req.params;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // Get user details
    const user = await User.findOne(
      { uid: withdrawal.userId },
      { name: 1, email: 1, role: 1, balance: 1, phone: 1 }
    );

    res.json({
      success: true,
      withdrawal: {
        ...withdrawal.toObject(),
        user: user ? {
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance,
          phone: user.phone
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching withdrawal details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
