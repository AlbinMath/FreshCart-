import fetch from 'node-fetch';

// Test data similar to what the frontend sends
const testSellerData = {
  uid: 'test-seller-' + Date.now(),
  name: 'Albin Mathew',
  email: 'albin.mathew+' + Date.now() + '@example.com',
  password: 'Test123!',
  role: 'seller',
  phone: '09496176348',
  storeName: 'ALBINS',
  businessLicense: 'BV123652',
  storeAddress: 'Kanjirappally',
  sellerCategory: 'vegetables'
};

console.log('Testing seller registration with data:', testSellerData);

// Send registration request
fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testSellerData)
})
.then(response => response.json())
.then(data => {
  console.log('Registration response:', data);
  if (data.success) {
    console.log('✅ Seller registration successful!');
  } else {
    console.log('❌ Seller registration failed:', data.message);
  }
})
.catch(error => {
  console.error('Error during registration:', error);
});