import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function checkSellerDetails() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a test seller
    const seller = await User.findOne({ role: 'seller' });
    if (!seller) {
      console.log('❌ No seller found.');
      return;
    }

    console.log(`✅ Found seller: ${seller.name} (${seller.email})`);
    console.log('📋 Seller details:');
    console.log(`  UID: ${seller.uid}`);
    console.log(`  Store Name: ${seller.storeName || 'Not set'}`);
    console.log(`  Store Address: ${seller.storeAddress || 'Not set'}`);
    console.log(`  Phone: ${seller.phone || 'Not set'}`);
    console.log(`  Role: ${seller.role}`);

    // Check if we can update the seller with store details
    if (!seller.storeName) {
      seller.storeName = 'Test Store';
      seller.storeAddress = '123 Test Street, Test City, Test State 123456';
      await seller.save();
      console.log('✅ Updated seller with store details');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkSellerDetails();