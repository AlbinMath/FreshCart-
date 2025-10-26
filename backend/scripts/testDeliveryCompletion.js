/**
 * Test Script for Simplified Delivery Completion OTP Verification
 * 
 * This script tests the new simplified OTP verification flow for delivery completion.
 * Run this after starting the backend server.
 */

const BASE_URL = 'http://localhost:5000';

// Test data
const testCases = [
  {
    name: 'Valid 6-digit OTP',
    orderId: 'TEST_ORDER_ID', // Replace with actual order ID
    otp: '123456',
    expectedStatus: 200,
    expectedSuccess: true
  },
  {
    name: 'Invalid OTP - Wrong digits',
    orderId: 'TEST_ORDER_ID',
    otp: '999999',
    expectedStatus: 400,
    expectedSuccess: false,
    expectedMessage: 'Invalid OTP'
  },
  {
    name: 'Invalid OTP - Less than 6 digits',
    orderId: 'TEST_ORDER_ID',
    otp: '12345',
    expectedStatus: 400,
    expectedSuccess: false,
    expectedMessage: 'Invalid OTP'
  },
  {
    name: 'Invalid OTP - More than 6 digits',
    orderId: 'TEST_ORDER_ID',
    otp: '1234567',
    expectedStatus: 400,
    expectedSuccess: false,
    expectedMessage: 'Invalid OTP'
  },
  {
    name: 'Invalid OTP - Non-numeric characters',
    orderId: 'TEST_ORDER_ID',
    otp: '12A456',
    expectedStatus: 400,
    expectedSuccess: false,
    expectedMessage: 'Invalid OTP'
  },
  {
    name: 'Missing OTP',
    orderId: 'TEST_ORDER_ID',
    otp: '',
    expectedStatus: 400,
    expectedSuccess: false,
    expectedMessage: 'OTP is required'
  }
];

async function testCompleteDelivery(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   OTP: "${testCase.otp}"`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/orders/delivery/complete/${testCase.orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerOTPInput: testCase.otp
      })
    });
    
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    
    // Validate response
    let passed = true;
    
    if (response.status !== testCase.expectedStatus) {
      console.log(`   ❌ FAILED: Expected status ${testCase.expectedStatus}, got ${response.status}`);
      passed = false;
    }
    
    if (data.success !== testCase.expectedSuccess) {
      console.log(`   ❌ FAILED: Expected success=${testCase.expectedSuccess}, got success=${data.success}`);
      passed = false;
    }
    
    if (testCase.expectedMessage && data.message !== testCase.expectedMessage) {
      console.log(`   ❌ FAILED: Expected message "${testCase.expectedMessage}", got "${data.message}"`);
      passed = false;
    }
    
    if (passed) {
      console.log(`   ✅ PASSED`);
    }
    
    return passed;
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Delivery Completion OTP Verification - Test Suite');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n⚠️  IMPORTANT: Replace TEST_ORDER_ID with an actual order ID');
  console.log('              that has a customerOTP set and is out_for_delivery\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = await testCompleteDelivery(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   Test Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Manual test function
async function manualTest(orderId, otp) {
  console.log('\n🔍 Manual Test:');
  console.log(`   Order ID: ${orderId}`);
  console.log(`   OTP: ${otp}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/orders/delivery/complete/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerOTPInput: otp
      })
    });
    
    const data = await response.json();
    
    console.log(`\n   Response Status: ${response.status}`);
    console.log(`   Response Body:`, JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log(`\n   ✅ Delivery completed successfully!`);
      console.log(`   Order Status: ${data.order.status}`);
      console.log(`   Completed At: ${data.order.deliveryCompletedAt}`);
    } else {
      console.log(`\n   ❌ Failed: ${data.message}`);
    }
    
  } catch (error) {
    console.log(`\n   ❌ ERROR: ${error.message}`);
  }
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runTests,
    manualTest,
    testCompleteDelivery
  };
}

// Usage examples:
console.log('\n📚 Usage Examples:');
console.log('================\n');
console.log('1. Run automated tests:');
console.log('   node testDeliveryCompletion.js\n');
console.log('2. Manual test in Node.js REPL:');
console.log('   const test = require("./testDeliveryCompletion.js");');
console.log('   test.manualTest("your_order_id", "123456");\n');
console.log('3. Test in browser console:');
console.log('   Copy the manualTest function to browser console');
console.log('   manualTest("your_order_id", "123456");\n');

// Uncomment to run tests automatically
// runTests();
