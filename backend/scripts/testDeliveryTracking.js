import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';

dotenv.config();

async function testDeliveryTracking() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'ordersDB' });
    console.log('✅ Connected to MongoDB (ordersDB)');

    // Find an existing order with storeDetails
    const order = await Order.findOne({ 'storeDetails.sellerId': { $exists: true } });
    
    if (!order) {
      console.log('❌ No order with storeDetails found.');
      return;
    }

    console.log(`✅ Found order: ${order.orderNumber}`);
    console.log('📋 Order storeDetails:');
    console.log(JSON.stringify(order.storeDetails, null, 2));

    // Check if seller details are populated
    if (order.storeDetails.storeName && order.storeDetails.sellerName) {
      console.log('✅ Seller details are populated in the order');
      console.log(`  Store Name: ${order.storeDetails.storeName}`);
      console.log(`  Store Address: ${order.storeDetails.storeAddress}`);
      console.log(`  Seller Phone: ${order.storeDetails.sellerPhone}`);
      console.log(`  Seller Name: ${order.storeDetails.sellerName}`);
    } else {
      console.log('❌ Seller details are not populated in the order');
      console.log('This might be because the order was created before the enhancement or there was an error during creation.');
    }

  } catch (err) {
    console.error('❌ Error during test:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testDeliveryTracking();