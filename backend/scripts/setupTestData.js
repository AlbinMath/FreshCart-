import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { getSellerProductModel } from '../models/Product.js';

dotenv.config();

const testUsers = [
  {
    uid: 'test-user-uid-12345',
    name: 'Test User',
    email: 'test.user@example.com',
    password: 'TestPassword123!',
    role: 'customer',
    phone: '+1234567890',
    provider: 'email',
    emailVerified: true,
    isActive: true
  },
  {
    uid: 'seller-test-uid-12345',
    name: 'Seller User',
    email: 'seller.test@example.com',
    password: 'SellerPassword123!',
    role: 'seller',
    phone: '+1234567891',
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
    name: 'Delivery User',
    email: 'delivery.test@example.com',
    password: 'DeliveryPassword123!',
    role: 'delivery',
    phone: '+1234567892',
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

async function setupTestData() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create test users
    console.log('👥 Creating test users...');
    for (const userData of testUsers) {
      let user = await User.findOne({ $or: [{ email: userData.email }, { uid: userData.uid }] });
      
      if (user) {
        console.log(`ℹ️ Updating existing user: ${userData.email}`);
        Object.assign(user, userData);
        await user.save();
      } else {
        console.log(`🆕 Creating user: ${userData.email}`);
        user = new User(userData);
        await user.save();
      }
    }

    // Get seller user for products
    const sellerUser = await User.findOne({ email: 'seller.test@example.com' });
    if (sellerUser) {
      // Get seller-specific Product model
      const ProductModel = getSellerProductModel(sellerUser.uid);
      
      // Create test products
      console.log('🛒 Creating test products...');
      for (const productData of testProducts) {
        productData.sellerRef = {
          uid: sellerUser.uid,
          sellerUniqueNumber: sellerUser.sellerUniqueNumber || ''
        };
        
        let product = await ProductModel.findOne({ name: productData.name });
        
        if (product) {
          console.log(`ℹ️ Updating existing product: ${productData.name}`);
          Object.assign(product, productData);
          await product.save();
        } else {
          console.log(`🆕 Creating product: ${productData.name}`);
          product = new ProductModel(productData);
          await product.save();
        }
      }
    }

    console.log('✅ Test data setup completed successfully');
  } catch (err) {
    console.error('❌ Failed to setup test data:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupTestData();