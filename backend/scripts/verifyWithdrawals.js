import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freshcart')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

async function verifyWithdrawals() {
  try {
    console.log('🔍 Verifying withdrawal data in database...\n');

    // Count total withdrawals
    const totalWithdrawals = await Withdrawal.countDocuments();
    console.log(`📊 Total withdrawals in database: ${totalWithdrawals}`);

    // Get all withdrawals with user details
    const withdrawals = await Withdrawal.find()
      .sort({ requestedAt: -1 })
      .limit(10);

    console.log(`\n📋 Recent withdrawals (${withdrawals.length}):`);
    
    for (const withdrawal of withdrawals) {
      const user = await User.findOne({ uid: withdrawal.userId });
      console.log(`\n💰 ${withdrawal.reference}`);
      console.log(`   Amount: ₹${withdrawal.amount}`);
      console.log(`   Status: ${withdrawal.status}`);
      console.log(`   User: ${user?.name || 'Unknown'} (${user?.email || withdrawal.userId})`);
      console.log(`   Method: ${withdrawal.paymentMethod}`);
      console.log(`   Requested: ${withdrawal.requestedAt.toLocaleString()}`);
    }

    // Get statistics
    const stats = {
      total: await Withdrawal.countDocuments(),
      pending: await Withdrawal.countDocuments({ status: 'pending' }),
      processing: await Withdrawal.countDocuments({ status: 'processing' }),
      completed: await Withdrawal.countDocuments({ status: 'completed' }),
      rejected: await Withdrawal.countDocuments({ status: 'rejected' })
    };

    console.log('\n📈 Statistics:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Rejected: ${stats.rejected}`);

    // Calculate amounts
    const totalAmount = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingAmount = await Withdrawal.aggregate([
      { $match: { status: { $in: ['pending', 'processing'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    console.log(`\n💰 Amounts:`);
    console.log(`   Total Amount: ₹${totalAmount[0]?.total || 0}`);
    console.log(`   Pending Amount: ₹${pendingAmount[0]?.total || 0}`);

    console.log('\n✅ Database verification complete!');
    console.log('\n🎯 The Payment Requests section should now display data in the admin dashboard.');

  } catch (error) {
    console.error('❌ Error verifying withdrawals:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the verification
verifyWithdrawals();





