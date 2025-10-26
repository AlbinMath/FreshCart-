import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config();

// Test customerOTP generation and storage
async function testCustomerOTP() {
  try {
    console.log('🔍 Testing customerOTP Generation...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'ordersDB'
    });
    console.log('✅ Connected to MongoDB\n');

    // Find an order with status 'ready_for_delivery'
    const readyOrder = await Order.findOne({ status: 'ready_for_delivery' });
    
    if (!readyOrder) {
      console.log('❌ No orders found with status "ready_for_delivery"');
      console.log('Please create a test order and mark it ready for delivery first.\n');
      
      // Show available orders
      const allOrders = await Order.find({}).limit(5);
      console.log(`📊 Found ${allOrders.length} orders in database:`);
      allOrders.forEach(order => {
        console.log(`  - Order ${order.orderNumber}: ${order.status}`);
      });
    } else {
      console.log(`✅ Found order: ${readyOrder.orderNumber}`);
      console.log(`   Status: ${readyOrder.status}`);
      console.log(`   deliveryOTP: ${readyOrder.deliveryOTP || 'Not set'}`);
      console.log(`   customerOTP: ${readyOrder.customerOTP || 'Not set'}\n`);

      // Generate customerOTP
      const customerOTP = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`🔢 Generated customerOTP: ${customerOTP}\n`);

      // Update the order
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: readyOrder._id },
        {
          status: 'out_for_delivery',
          deliveryPartnerId: 'TEST_DELIVERY_PARTNER',
          customerOTP: customerOTP
        },
        { new: true }
      );

      console.log('✅ Order updated successfully!');
      console.log(`   Status: ${updatedOrder.status}`);
      console.log(`   deliveryOTP: ${updatedOrder.deliveryOTP}`);
      console.log(`   customerOTP: ${updatedOrder.customerOTP}`);
      console.log(`   deliveryPartnerId: ${updatedOrder.deliveryPartnerId}\n`);

      // Verify it was saved
      const verifyOrder = await Order.findById(updatedOrder._id);
      console.log('🔍 Verification check:');
      console.log(`   customerOTP from DB: ${verifyOrder.customerOTP}`);
      console.log(`   Match: ${verifyOrder.customerOTP === customerOTP ? '✅' : '❌'}\n`);
    }

    // Check for orders with customerOTP
    const ordersWithCustomerOTP = await Order.find({ customerOTP: { $exists: true, $ne: null } });
    console.log(`\n📊 Orders with customerOTP: ${ordersWithCustomerOTP.length}`);
    ordersWithCustomerOTP.forEach(order => {
      console.log(`  - ${order.orderNumber}: customerOTP = ${order.customerOTP}, status = ${order.status}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCustomerOTP();
