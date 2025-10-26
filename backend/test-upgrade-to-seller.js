import fetch from 'node-fetch';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected for test'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// First create a customer user
const customerData = {
  uid: 'test-customer-' + Date.now(),
  name: 'Albin Mathew',
  email: 'albin.customer+' + Date.now() + '@example.com',
  password: 'Test123!',
  role: 'customer',
  phone: '09496176348'
};

console.log('Creating customer user...');

// Register as customer first
fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(customerData)
})
.then(response => response.json())
.then(data => {
  console.log('Customer registration response:', data);
  if (data.success) {
    console.log('✅ Customer registration successful!');
    
    // Now test upgrading to seller
    const upgradeData = {
      phone: '09496176348',
      storeName: 'ALBINS',
      businessLicense: 'BV123652',
      storeAddress: 'Kanjirappally',
      sellerCategory: 'vegetables'
    };
    
    console.log('Testing upgrade to seller...');
    
    fetch(`http://localhost:5000/api/users/${customerData.uid}/upgrade-to-seller`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upgradeData)
    })
    .then(response => response.json())
    .then(upgradeResult => {
      console.log('Upgrade response:', upgradeResult);
      if (upgradeResult.success) {
        console.log('✅ Upgrade to seller successful!');
      } else {
        console.log('❌ Upgrade to seller failed:', upgradeResult.message);
      }
      // Close MongoDB connection
      mongoose.connection.close();
    })
    .catch(error => {
      console.error('Error during upgrade:', error);
      mongoose.connection.close();
    });
  } else {
    console.log('❌ Customer registration failed:', data.message);
    mongoose.connection.close();
  }
})
.catch(error => {
  console.error('Error during customer registration:', error);
  mongoose.connection.close();
});