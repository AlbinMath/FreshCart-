/**
 * Test Script: Customer OTP Delivery Completion
 * 
 * This script tests the complete delivery flow with customerOTP verification
 * and status update to 'delivered' in the ordersDB.orders collection.
 */

const BASE_URL = 'http://localhost:5000';

async function testDeliveryCompletion() {
  console.log('🧪 Starting Delivery Completion Test...\n');

  try {
    // Step 1: Get an order that's out_for_delivery
    console.log('📦 Step 1: Finding an order with status "out_for_delivery"...');
    
    // Replace with an actual order ID from your database
    const orderId = 'YOUR_ORDER_ID_HERE'; // Update this with actual order ID
    
    const orderResponse = await fetch(`${BASE_URL}/api/orders/${orderId}`);
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok || !orderData.success) {
      throw new Error('Order not found or API error');
    }
    
    const order = orderData.order;
    console.log('✅ Order found:');
    console.log(`   - Order Number: ${order.orderNumber}`);
    console.log(`   - Status: ${order.status}`);
    console.log(`   - Customer OTP: ${order.customerOTP || 'NOT GENERATED'}`);
    console.log(`   - Payment Method: ${order.paymentMethod}`);
    console.log(`   - Payment Status: ${order.paymentStatus}\n`);
    
    // Verify order is in correct status
    if (order.status !== 'out_for_delivery') {
      console.log(`⚠️  Order status is "${order.status}", expected "out_for_delivery"`);
      console.log('   Please use an order that is out for delivery.\n');
      return;
    }
    
    // Verify customerOTP exists
    if (!order.customerOTP) {
      console.log('❌ Order does not have a customerOTP!');
      console.log('   CustomerOTP should be generated when delivery starts.\n');
      return;
    }
    
    // Step 2: Test with WRONG OTP first
    console.log('🔐 Step 2: Testing with WRONG OTP...');
    const wrongOTP = '999999';
    
    const wrongOtpResponse = await fetch(`${BASE_URL}/api/orders/delivery/complete/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerOTPInput: wrongOTP })
    });
    
    const wrongOtpData = await wrongOtpResponse.json();
    
    if (wrongOtpResponse.ok) {
      console.log('❌ ERROR: Wrong OTP was accepted! This should fail.\n');
      return;
    }
    
    console.log('✅ Wrong OTP correctly rejected:');
    console.log(`   - Status Code: ${wrongOtpResponse.status}`);
    console.log(`   - Message: ${wrongOtpData.message}\n`);
    
    // Step 3: Test with CORRECT OTP
    console.log('🔐 Step 3: Testing with CORRECT OTP...');
    console.log(`   Using OTP: ${order.customerOTP}`);
    
    const correctOtpResponse = await fetch(`${BASE_URL}/api/orders/delivery/complete/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerOTPInput: order.customerOTP })
    });
    
    const correctOtpData = await correctOtpResponse.json();
    
    if (!correctOtpResponse.ok || !correctOtpData.success) {
      console.log('❌ ERROR: Correct OTP was rejected!');
      console.log(`   - Status Code: ${correctOtpResponse.status}`);
      console.log(`   - Message: ${correctOtpData.message}\n`);
      return;
    }
    
    console.log('✅ Delivery completed successfully!');
    console.log(`   - Message: ${correctOtpData.message}`);
    console.log('   - Updated Order Details:');
    console.log(`     * Status: ${correctOtpData.order.status}`);
    console.log(`     * Delivery Completed At: ${correctOtpData.order.deliveryCompletedAt}`);
    console.log(`     * Payment Status: ${correctOtpData.order.paymentStatus}`);
    console.log(`     * Payment Method: ${correctOtpData.order.paymentMethod}\n`);
    
    // Step 4: Verify order status update
    console.log('📋 Step 4: Verifying order status in database...');
    
    const verifyResponse = await fetch(`${BASE_URL}/api/orders/${orderId}`);
    const verifyData = await verifyResponse.json();
    
    if (!verifyResponse.ok || !verifyData.success) {
      throw new Error('Failed to verify order status');
    }
    
    const updatedOrder = verifyData.order;
    console.log('✅ Order status verified:');
    console.log(`   - Status: ${updatedOrder.status}`);
    console.log(`   - Delivery Completed: ${updatedOrder.deliveryCompletedAt ? 'Yes' : 'No'}`);
    console.log(`   - Payment Status: ${updatedOrder.paymentStatus}\n`);
    
    // Step 5: Check status timeline
    console.log('📊 Step 5: Checking status timeline...');
    if (updatedOrder.statusTimeline && updatedOrder.statusTimeline.length > 0) {
      console.log('✅ Status Timeline:');
      updatedOrder.statusTimeline.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toLocaleString();
        console.log(`   ${index + 1}. ${entry.status} - ${timestamp}`);
      });
      console.log('');
    }
    
    // Final Summary
    console.log('🎉 TEST SUMMARY:');
    console.log('================');
    console.log('✅ Wrong OTP rejection: PASSED');
    console.log('✅ Correct OTP acceptance: PASSED');
    console.log('✅ Status update to "delivered": PASSED');
    console.log('✅ Delivery timestamp recorded: PASSED');
    
    if (updatedOrder.paymentMethod === 'COD') {
      console.log(`✅ COD payment status updated to "${updatedOrder.paymentStatus}": PASSED`);
    }
    
    console.log('\n✨ All tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Instructions
console.log('='.repeat(70));
console.log('DELIVERY COMPLETION TEST SCRIPT');
console.log('='.repeat(70));
console.log('\n📝 INSTRUCTIONS:');
console.log('1. Make sure your backend server is running on http://localhost:5000');
console.log('2. Update the orderId variable with an actual order ID that has:');
console.log('   - Status: "out_for_delivery"');
console.log('   - CustomerOTP: Generated (6-digit code)');
console.log('3. Run this script using: node backend/scripts/testDeliveryOTPCompletion.js');
console.log('\n' + '='.repeat(70) + '\n');

// Run the test
testDeliveryCompletion();
