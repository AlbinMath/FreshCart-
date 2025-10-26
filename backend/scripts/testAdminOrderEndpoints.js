/**
 * Test Script for Admin Order Monitoring Endpoints
 * 
 * This script tests the enhanced admin order endpoints
 * Run with: node backend/scripts/testAdminOrderEndpoints.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Helper function to make API calls
async function testEndpoint(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`\n🔍 Testing: ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.token || ''}`,
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
      return data;
    } else {
      console.log(`❌ Failed: ${response.status}`);
      console.log('Error:', data.message);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function testAdminOrderEndpoints() {
  console.log('🚀 Starting Admin Order Monitoring Endpoint Tests\n');
  console.log('=' .repeat(60));
  
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get sample data for testing
    const sampleOrder = await Order.findOne().lean();
    if (!sampleOrder) {
      console.log('⚠️  No orders found in database. Please create some orders first.');
      return;
    }
    
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Please create an admin user first.');
      return;
    }
    
    console.log(`\n📦 Sample Order ID: ${sampleOrder.orderId}`);
    console.log(`👤 Admin User: ${adminUser.email}\n`);
    console.log('=' .repeat(60));
    
    // Note: In production, you'd need to authenticate and get a real token
    // For this test, we'll show the expected API calls
    const mockToken = 'YOUR_ADMIN_JWT_TOKEN_HERE';
    
    // Test 1: Get all orders
    console.log('\n📋 TEST 1: Get All Orders');
    console.log('-' .repeat(60));
    const allOrders = await testEndpoint('/admin/orders?limit=5', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (allOrders && allOrders.success) {
      console.log(`   Total Orders: ${allOrders.pagination.total}`);
      console.log(`   Returned: ${allOrders.orders.length}`);
      console.log(`   Statistics:`, allOrders.stats);
    }
    
    // Test 2: Get orders with status filter
    console.log('\n📋 TEST 2: Get Delivered Orders');
    console.log('-' .repeat(60));
    const deliveredOrders = await testEndpoint('/admin/orders?status=delivered&limit=3', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (deliveredOrders && deliveredOrders.success) {
      console.log(`   Delivered Orders: ${deliveredOrders.orders.length}`);
    }
    
    // Test 3: Search orders
    console.log('\n📋 TEST 3: Search Orders by Order Number');
    console.log('-' .repeat(60));
    const searchResults = await testEndpoint(`/admin/orders?search=${sampleOrder.orderNumber.substring(0, 5)}`, {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (searchResults && searchResults.success) {
      console.log(`   Search Results: ${searchResults.orders.length}`);
    }
    
    // Test 4: Get single order details
    console.log('\n📋 TEST 4: Get Order Details');
    console.log('-' .repeat(60));
    const orderDetails = await testEndpoint(`/admin/orders/${sampleOrder.orderId}`, {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (orderDetails && orderDetails.success) {
      console.log(`   Order ID: ${orderDetails.order.orderId}`);
      console.log(`   Customer: ${orderDetails.order.customerInfo?.name || 'N/A'}`);
      console.log(`   Status: ${orderDetails.order.status}`);
      console.log(`   Total Amount: ₹${orderDetails.order.totalAmount}`);
      console.log(`   Delivery OTP: ${orderDetails.order.deliveryOTP || 'Not set'}`);
      console.log(`   Customer OTP: ${orderDetails.order.customerOTP || 'Not set'}`);
    }
    
    // Test 5: Update order status (commented out to prevent accidental changes)
    console.log('\n📋 TEST 5: Update Order Status (Dry Run)');
    console.log('-' .repeat(60));
    console.log('   ⚠️  Skipping actual update to prevent data modification');
    console.log('   To test, uncomment the code below and run with caution');
    
    /*
    const statusUpdate = await testEndpoint(`/admin/orders/${sampleOrder.orderId}/status`, {
      method: 'PUT',
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      },
      body: {
        status: 'delivered',
        notes: 'Test status update from script'
      }
    });
    
    if (statusUpdate && statusUpdate.success) {
      console.log(`   ✅ Status updated to: ${statusUpdate.order.status}`);
    }
    */
    
    // Test 6: Pagination test
    console.log('\n📋 TEST 6: Test Pagination');
    console.log('-' .repeat(60));
    const page1 = await testEndpoint('/admin/orders?page=1&limit=2', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (page1 && page1.success) {
      console.log(`   Page 1 Orders: ${page1.orders.length}`);
      console.log(`   Total Pages: ${page1.pagination.totalPages}`);
    }
    
    const page2 = await testEndpoint('/admin/orders?page=2&limit=2', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (page2 && page2.success) {
      console.log(`   Page 2 Orders: ${page2.orders.length}`);
    }
    
    // Test 7: Sorting test
    console.log('\n📋 TEST 7: Test Sorting');
    console.log('-' .repeat(60));
    const sortedAsc = await testEndpoint('/admin/orders?sortBy=timestamp&sortOrder=asc&limit=2', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (sortedAsc && sortedAsc.success && sortedAsc.orders.length > 0) {
      console.log(`   Oldest Order: ${new Date(sortedAsc.orders[0].timestamp).toLocaleDateString()}`);
    }
    
    const sortedDesc = await testEndpoint('/admin/orders?sortBy=timestamp&sortOrder=desc&limit=2', {
      headers: {
        'x-actor-email': adminUser.email,
        'x-actor-uid': adminUser.uid
      }
    });
    
    if (sortedDesc && sortedDesc.success && sortedDesc.orders.length > 0) {
      console.log(`   Newest Order: ${new Date(sortedDesc.orders[0].timestamp).toLocaleDateString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAdminOrderEndpoints()
    .then(() => {
      console.log('\n✨ Test script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

export default testAdminOrderEndpoints;
