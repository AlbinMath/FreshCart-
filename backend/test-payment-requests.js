// Test script for Payment Request API endpoints
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000/api';

// Test data
const testAdminToken = 'your-admin-token-here'; // Replace with actual admin token
const testUserId = 'test-user-id'; // Replace with actual user ID

async function testPaymentRequestEndpoints() {
  console.log('🧪 Testing Payment Request API Endpoints...\n');

  try {
    // Test 1: Get payment request statistics
    console.log('1. Testing GET /api/users/admin/payment-requests/stats');
    const statsResponse = await fetch(`${API_BASE_URL}/users/admin/payment-requests/stats`, {
      headers: {
        'Authorization': `Bearer ${testAdminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ Payment request stats endpoint working');
      console.log('📊 Stats:', JSON.stringify(statsData, null, 2));
    } else {
      console.log('❌ Stats endpoint failed:', statsResponse.status, await statsResponse.text());
    }

    // Test 2: Get all withdrawal requests
    console.log('\n2. Testing GET /api/users/admin/withdrawals');
    const withdrawalsResponse = await fetch(`${API_BASE_URL}/users/admin/withdrawals?limit=10`, {
      headers: {
        'Authorization': `Bearer ${testAdminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (withdrawalsResponse.ok) {
      const withdrawalsData = await withdrawalsResponse.json();
      console.log('✅ Withdrawals list endpoint working');
      console.log('📋 Withdrawals count:', withdrawalsData.withdrawals?.length || 0);
    } else {
      console.log('❌ Withdrawals endpoint failed:', withdrawalsResponse.status, await withdrawalsResponse.text());
    }

    // Test 3: Test bulk update endpoint
    console.log('\n3. Testing PUT /api/users/admin/withdrawals/bulk-update');
    const bulkUpdateResponse = await fetch(`${API_BASE_URL}/users/admin/withdrawals/bulk-update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${testAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        withdrawalIds: [], // Empty array for testing
        status: 'processing',
        adminNotes: 'Test bulk update'
      })
    });
    
    if (bulkUpdateResponse.ok) {
      const bulkData = await bulkUpdateResponse.json();
      console.log('✅ Bulk update endpoint working');
      console.log('📝 Response:', JSON.stringify(bulkData, null, 2));
    } else {
      console.log('❌ Bulk update endpoint failed:', bulkUpdateResponse.status, await bulkUpdateResponse.text());
    }

    // Test 4: Test user withdrawal request
    console.log('\n4. Testing POST /api/users/{userId}/wallet/withdraw');
    const withdrawResponse = await fetch(`${API_BASE_URL}/users/${testUserId}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAdminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 100,
        paymentMethod: 'upi',
        upiDetails: {
          upiId: 'test@upi'
        }
      })
    });
    
    if (withdrawResponse.ok) {
      const withdrawData = await withdrawResponse.json();
      console.log('✅ User withdrawal request endpoint working');
      console.log('💰 Withdrawal created:', JSON.stringify(withdrawData, null, 2));
    } else {
      console.log('❌ User withdrawal endpoint failed:', withdrawResponse.status, await withdrawResponse.text());
    }

    console.log('\n🎉 Payment Request API Testing Complete!');
    console.log('\n📋 Available Endpoints:');
    console.log('• GET  /api/users/admin/payment-requests/stats - Get statistics');
    console.log('• GET  /api/users/admin/withdrawals - List all requests');
    console.log('• GET  /api/users/admin/withdrawals/:id - Get request details');
    console.log('• PUT  /api/users/admin/withdrawals/:id - Update request status');
    console.log('• PUT  /api/users/admin/withdrawals/bulk-update - Bulk update');
    console.log('• POST /api/users/:userId/wallet/withdraw - Submit withdrawal request');
    console.log('• GET  /api/users/:userId/wallet/withdrawals - User withdrawal history');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testPaymentRequestEndpoints();





