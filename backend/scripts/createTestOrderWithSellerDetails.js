import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';

dotenv.config();

async function createTestOrderWithSellerDetails() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    // Connect to the main database first to get seller details
    const mainConnection = await mongoose.createConnection(process.env.MONGODB_URI);
    console.log('✅ Connected to main MongoDB');
    
    // Then connect to ordersDB
    const ordersConnection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: 'ordersDB' });
    console.log('✅ Connected to ordersDB');

    // Get the User model from main connection
    const User = mainConnection.model('User', require('../models/User.js').default.schema);
    
    // Get the Order model from orders connection
    const Order = ordersConnection.model('Order', require('../models/Order.js').default.schema);

    // Find a test seller
    const seller = await User.findOne({ role: 'seller' });
    if (!seller) {
      console.log('❌ No seller found.');
      return;
    }

    console.log(`✅ Found seller: ${seller.name} (${seller.email})`);
    console.log(`  Store Name: ${seller.storeName}`);
    console.log(`  Store Address: ${seller.storeAddress}`);
    console.log(`  Phone: ${seller.phone}`);

    // Create enriched storeDetails
    const enrichedStoreDetails = {
      sellerId: seller.uid,
      sellerCollection: 'test_seller_products',
      storeName: seller.storeName || '',
      storeAddress: seller.storeAddress || '',
      sellerPhone: seller.phone || '',
      sellerEmail: seller.email || '',
      sellerName: seller.name || ''
    };

    // Create a test order with enriched storeDetails
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
      storeDetails: enrichedStoreDetails,
      statusTimeline: [{
        status: 'Order Placed',
        timestamp: new Date()
      }],
      status: 'out_for_delivery',
      paymentStatus: 'pending',
      deliveryOTP: '123456'
    };

    console.log('🛒 Creating test order with enriched seller details...');
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

    // Test the order retrieval to simulate what the frontend would get
    const retrievedOrder = await Order.findOne({ orderId: order.orderId });
    console.log('\n📋 Retrieved order for frontend display:');
    console.log(`  Store Name: ${retrievedOrder.storeDetails.storeName}`);
    console.log(`  Store Address: ${retrievedOrder.storeDetails.storeAddress}`);
    console.log(`  Seller Phone: ${retrievedOrder.storeDetails.sellerPhone}`);
    console.log(`  Seller Name: ${retrievedOrder.storeDetails.sellerName}`);

  } catch (err) {
    console.error('❌ Error during test:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createTestOrderWithSellerDetails();