// Complete test setup - creates users in both Firebase and MongoDB with matching UIDs
import mongoose from 'mongoose';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { getSellerProductModel } from '../models/Product.js';

dotenv.config();

const testUsers = [
  {
    uid: 'test-user-uid-12345',
    email: 'test.user@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    role: 'customer',
    phone: '+1234567890',
    provider: 'email',
    emailVerified: true,
    isActive: true
  },
  {
    uid: 'admin-test-uid-12345',
    email: 'admin.test@example.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
    role: 'admin',
    phone: '+1234567891',
    provider: 'email',
    adminLevel: 'super',
    emailVerified: true,
    isActive: true
  },
  {
    uid: 'seller-test-uid-12345',
    email: 'seller.test@example.com',
    password: 'SellerPassword123!',
    name: 'Seller User',
    role: 'seller',
    phone: '+1234567892',
    provider: 'email',
    businessName: 'Test Seller Business',
    licenseNumber: 'AB123456',
    licenseInfo: {
      licenseNumber: 'AB123456',
      status: 'approved'
    },
    sellerCategory: 'vegetables',
    emailVerified: true,
    isActive: true
  },
  {
    uid: 'delivery-test-uid-12345',
    email: 'delivery.test@example.com',
    password: 'DeliveryPassword123!',
    name: 'Delivery User',
    role: 'delivery',
    phone: '+1234567893',
    provider: 'email',
    emailVerified: true,
    isActive: true
  }
];

const testProducts = [
  {
    name: 'Fresh Organic Apples',
    description: 'Fresh organic apples from local farms',
    price: 4.99,
    category: 'fruits',
    images: ['test-apple.jpg'],
    stock: 100,
    status: 'approved'
  },
  {
    name: 'Fresh Carrots',
    description: 'Crisp and fresh carrots',
    price: 2.49,
    category: 'vegetables', 
    images: ['test-carrot.jpg'],
    stock: 150,
    status: 'approved'
  }
];

async function setupCompleteTestData() {
  try {
    console.log('🚀 Setting up complete test data...');
    
    // 1. Initialize Firebase Admin
    if (!admin.apps.length) {
      const hasEnvCreds = !!(
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      );

      if (hasEnvCreds) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
          })
        });
        console.log('✅ Firebase Admin initialized');
      } else {
        throw new Error('Firebase credentials not found');
      }
    }

    // 2. Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 3. Create users in both Firebase and MongoDB
    console.log('👥 Creating test users...');
    for (const userData of testUsers) {
      try {
        console.log(`Processing user: ${userData.email}`);
        
        // Delete existing Firebase user if exists
        try {
          await admin.auth().deleteUser(userData.uid);
          console.log(`🗑️ Deleted existing Firebase user: ${userData.email}`);
        } catch (e) {
          if (e.code !== 'auth/user-not-found') {
            console.log(`ℹ️ Firebase user ${userData.email} doesn't exist`);
          }
        }

        // Create Firebase user with specific UID
        await admin.auth().createUser({
          uid: userData.uid,
          email: userData.email,
          password: userData.password,
          emailVerified: true,
          disabled: false,
          displayName: userData.name
        });
        console.log(`✅ Created Firebase user: ${userData.email} with UID: ${userData.uid}`);

        // Delete existing MongoDB user if exists
        await User.deleteOne({ $or: [{ email: userData.email }, { uid: userData.uid }] });

        // Create MongoDB user
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created MongoDB user: ${userData.email}`);

      } catch (error) {
        console.error(`❌ Failed to setup user ${userData.email}:`, error.message);
      }
    }

    // 4. Create test products
    const sellerUser = await User.findOne({ email: 'seller.test@example.com' });
    if (sellerUser) {
      console.log('🛒 Creating test products...');
      const ProductModel = getSellerProductModel(sellerUser.uid);
      
      // Clear existing products
      await ProductModel.deleteMany({});
      
      for (const productData of testProducts) {
        productData.sellerRef = {
          uid: sellerUser.uid,
          sellerUniqueNumber: sellerUser.sellerUniqueNumber || ''
        };
        
        const product = new ProductModel(productData);
        await product.save();
        console.log(`✅ Created product: ${productData.name}`);
      }
    }

    console.log('✅ Complete test data setup completed successfully');
    console.log('\n📋 Test Users Created:');
    for (const user of testUsers) {
      console.log(`- ${user.email} (${user.role}) - UID: ${user.uid}`);
    }

  } catch (error) {
    console.error('❌ Failed to setup complete test data:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

setupCompleteTestData()
  .then(() => {
    console.log('🎉 Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });