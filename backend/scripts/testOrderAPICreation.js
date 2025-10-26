import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';
import express from 'express';
import orderRoutes from '../routes/orderRoutes.js';

dotenv.config();

// Create a minimal Express app for testing
const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

async function testOrderAPICreation() {
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

    // Prepare test order data (similar to what frontend sends)
    const testOrderData = {
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
      }
    };

    console.log('🛒 Creating test order via API...');

    // Simulate an API call to create the order
    const response = await new Promise((resolve) => {
      // Create a mock request and response
      const req = {
        body: testOrderData,
        headers: {},
        query: {},
        params: {}
      };

      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          resolve({ statusCode: this.statusCode, data });
        }
      };

      // Call the order creation route handler directly
      const orderRouteHandler = app._router.stack.find(layer => 
        layer.route && layer.route.path === '/api/orders/create'
      );

      if (orderRouteHandler) {
        orderRouteHandler.route.stack[0].handle(req, res);
      } else {
        resolve({ statusCode: 404, data: { success: false, message: 'Route not found' } });
      }
    });

    console.log(`API Response Status: ${response.statusCode}`);
    console.log(`API Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.statusCode === 200 && response.data.success) {
      // Retrieve the created order to check if seller details were populated
      const order = await Order.findOne({ orderId: response.data.orderId });
      if (order) {
        console.log('✅ Order created successfully via API');
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
      }
    } else {
      console.log('❌ Failed to create order via API');
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

testOrderAPICreation();