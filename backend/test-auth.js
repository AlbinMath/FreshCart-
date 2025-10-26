import fetch from 'node-fetch';

async function testAuth() {
  try {
    console.log('🧪 Testing authentication...');
    
    const response = await fetch('http://localhost:5000/api/farmer-products', {
      method: 'GET',
      headers: {
        'x-uid': 'SNdc93CUWVR2y3ozMHh6Ziuakqm1'
      }
    });

    console.log('📥 Response status:', response.status);
    const result = await response.json();
    console.log('📥 Response data:', result);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuth();
