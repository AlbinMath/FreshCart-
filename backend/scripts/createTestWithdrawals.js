import mongoose from 'mongoose';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestWithdrawals() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if there are any users
    const users = await User.find().limit(5);
    console.log('👥 Found users:', users.length);

    if (users.length === 0) {
      console.log('⚠️  No users found. Please create some users first.');
      return;
    }

    // Check existing withdrawals
    const existingWithdrawals = await Withdrawal.countDocuments();
    console.log('📊 Existing withdrawals:', existingWithdrawals);

    if (existingWithdrawals > 0) {
      console.log('✅ Withdrawals already exist. No need to create test data.');
      return;
    }

    // Create test withdrawals
    const testWithdrawals = [
      {
        userId: users[0].uid,
        amount: 500,
        status: 'pending',
        paymentMethod: 'upi',
        upiDetails: { upiId: 'test@upi' },
        note: 'Test withdrawal request 1'
      },
      {
        userId: users[0].uid,
        amount: 1000,
        status: 'processing',
        paymentMethod: 'bank_transfer',
        bankDetails: {
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Test User',
          bankName: 'State Bank of India'
        },
        note: 'Test withdrawal request 2'
      },
      {
        userId: users[1]?.uid || users[0].uid,
        amount: 750,
        status: 'completed',
        paymentMethod: 'upi',
        upiDetails: { upiId: 'test2@upi' },
        note: 'Test withdrawal request 3',
        completedAt: new Date()
      }
    ];

    console.log('🔄 Creating test withdrawals...');
    const createdWithdrawals = await Withdrawal.insertMany(testWithdrawals);
    console.log('✅ Created', createdWithdrawals.length, 'test withdrawals');

    // Verify creation
    const totalWithdrawals = await Withdrawal.countDocuments();
    console.log('📊 Total withdrawals now:', totalWithdrawals);

    const statusCounts = await Withdrawal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('📈 Status distribution:');
    statusCounts.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createTestWithdrawals();