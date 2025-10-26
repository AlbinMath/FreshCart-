// Create test users by calling the frontend registration API directly
const testUsers = [
  {
    email: 'test.user@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    role: 'customer'
  },
  {
    email: 'admin.test@example.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'seller.test@example.com',
    password: 'SellerPassword123!',
    name: 'Seller User',
    role: 'seller',
    businessName: 'Test Seller Business',
    licenseNumber: 'AB123456'
  },
  {
    email: 'delivery.test@example.com',
    password: 'DeliveryPassword123!',
    name: 'Delivery User',
    role: 'delivery'
  }
];

async function createUsersViaAPI() {
  console.log('🚀 Creating test users via API...');
  
  for (const userData of testUsers) {
    try {
      console.log(`Creating ${userData.role} user: ${userData.email}`);
      
      // Call the backend registration API directly
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...userData,
          uid: `${userData.role}-${userData.email.split('@')[0]}-uid`, // Generate a UID
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Created user: ${userData.email}`);
        if (result.user && result.user.uid) {
          console.log(`   UID: ${result.user.uid}`);
        }
      } else {
        const error = await response.json();
        if (error.message && error.message.includes('already exists')) {
          console.log(`ℹ️ User already exists: ${userData.email}`);
        } else {
          console.log(`❌ Failed to create ${userData.email}: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error creating ${userData.email}: ${error.message}`);
    }
  }
  
  console.log('✅ User creation completed');
}

createUsersViaAPI();