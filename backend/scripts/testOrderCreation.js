import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';

dotenv.config();

async function testOrderCreation() {
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
      console.log('❌ No seller found. Please run setupTestData.js first.');
      return;
    }

    console.log(`✅ Found seller: ${seller.name} (${seller.email})`);
    console.log(`  Store Name: ${seller.storeName}`);
    console.log(`  Store Address: ${seller.storeAddress}`);
    console.log(`  Phone: ${seller.phone}`);

    // Create a test order with minimal storeDetails
    const testOrder = {
      orderId: `FC${Date.now()}TEST`,
      orderNumber: `FC${Date.now().toString().slice(-6)}TEST`,
      userId: 'test-user-uid-12345',
      products: [
        {
          id: 'test-product-1',
          name: 'Test Product',
          price: 10.99,
          quantity: 2,
          image: 'test.jpg',
          isVeg: true
        }
      ],
      subtotal: 21.98,
      deliveryFee: 2.50,
      totalAmount: 24.48,
      paymentMethod: 'COD',
      deliveryAddress: {
        name: 'Test Customer',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        phone: '+1234567890'
      },
      storeDetails: {
        sellerId: seller.uid,
        sellerCollection: 'test_seller_products'
      },
      statusTimeline: [{
        status: 'Order Placed',
        timestamp: new Date()
      }],
      status: 'Pending Seller Approval',
      paymentStatus: 'pending'
    };

    console.log('🛒 Creating test order...');
    const order = new Order(testOrder);
    await order.save();

    console.log('✅ Order created successfully');
    console.log('📋 Order storeDetails:');
    console.log(JSON.stringify(order.storeDetails, null, 2));

    // Verify that seller details were populated
    if (order.storeDetails.storeName && order.storeDetails.sellerName) {
      console.log('✅ Seller details were successfully populated in the order');
      console.log(`  Store Name: ${order.storeDetails.storeName}`);
      console.log(`  Store Address: ${order.storeDetails.storeAddress}`);
      console.log(`  Seller Phone: ${order.storeDetails.sellerPhone}`);
      console.log(`  Seller Name: ${order.storeDetails.sellerName}`);
    } else {
      console.log('❌ Seller details were not populated in the order');
    }

    // Clean up - delete the test order
    await Order.deleteOne({ _id: order._id });
    console.log('🧹 Cleaned up test order');

  } catch (err) {
    console.error('❌ Error during test:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testOrderCreation();