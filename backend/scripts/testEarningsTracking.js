/**
 * Test script for delivery partner earnings tracking
 * This script tests the new earnings tracking fields in User model
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ordersDB';

async function testEarningsTracking() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find a delivery partner
    const deliveryPartner = await User.findOne({ role: 'delivery' });
    
    if (!deliveryPartner) {
      console.log('❌ No delivery partner found in database');
      console.log('💡 Please create a delivery partner user first');
      return;
    }

    console.log('👤 Found delivery partner:');
    console.log(`   UID: ${deliveryPartner.uid}`);
    console.log(`   Name: ${deliveryPartner.name}`);
    console.log(`   Email: ${deliveryPartner.email}\n`);

    console.log('📊 Current Earnings Tracking:');
    console.log(`   Total Earnings: ₹${(deliveryPartner.totalEarnings || 0).toFixed(2)}`);
    console.log(`   Today's Earnings: ₹${(deliveryPartner.todayEarnings || 0).toFixed(2)}`);
    console.log(`   Total Deliveries: ${deliveryPartner.totalDeliveries || 0}`);
    console.log(`   Today's Deliveries: ${deliveryPartner.todayDeliveries || 0}`);
    console.log(`   Wallet Balance: ₹${(deliveryPartner.balance || 0).toFixed(2)}`);
    console.log(`   Last Update: ${deliveryPartner.lastEarningsUpdate || 'Never'}\n`);

    // Check delivered orders
    const deliveredOrders = await Order.find({
      deliveryPartnerId: deliveryPartner.uid,
      status: 'delivered'
    });

    console.log(`📦 Delivered Orders: ${deliveredOrders.length}`);
    
    if (deliveredOrders.length > 0) {
      console.log('\n🔍 Recent deliveries:');
      deliveredOrders.slice(0, 3).forEach((order, index) => {
        console.log(`   ${index + 1}. Order ${order.orderNumber}`);
        console.log(`      Delivery Fee: ₹${order.deliveryFee || 0}`);
        console.log(`      Completed: ${order.deliveryCompletedAt || 'N/A'}`);
      });

      const totalDeliveryFees = deliveredOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
      console.log(`\n💰 Total delivery fees from all orders: ₹${totalDeliveryFees.toFixed(2)}`);
    }

    console.log('\n✅ Earnings tracking test completed!');

  } catch (error) {
    console.error('❌ Error testing earnings tracking:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testEarningsTracking();
