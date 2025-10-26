import mongoose from 'mongoose';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkWithdrawals() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check total withdrawals
    const totalWithdrawals = await Withdrawal.countDocuments();
    console.log('📊 Total withdrawals in database:', totalWithdrawals);

    if (totalWithdrawals > 0) {
      // Get sample withdrawals
      const sampleWithdrawals = await Withdrawal.find().limit(5);
      console.log('📋 Sample withdrawals:');
      sampleWithdrawals.forEach((w, index) => {
        console.log(`${index + 1}. ID: ${w._id}, User: ${w.userId}, Amount: ₹${w.amount}, Status: ${w.status}, Date: ${w.requestedAt}`);
      });

      // Check status distribution
      const statusCounts = await Withdrawal.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      console.log('📈 Status distribution:');
      statusCounts.forEach(stat => {
        console.log(`  ${stat._id}: ${stat.count}`);
      });
    } else {
      console.log('⚠️  No withdrawal records found in database');
      console.log('💡 You may need to create some test withdrawal requests');
    }

    // Check if there are any users
    const totalUsers = await User.countDocuments();
    console.log('👥 Total users in database:', totalUsers);

    if (totalUsers > 0) {
      const sampleUsers = await User.find().limit(3).select('name email role uid');
      console.log('👤 Sample users:');
      sampleUsers.forEach((u, index) => {
        console.log(`${index + 1}. Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, UID: ${u.uid}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkWithdrawals();



