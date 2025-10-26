import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// Admin user data - matching test-data.js
const input = {
  uid: 'admin-test-uid-12345',
  name: 'Admin User',
  email: 'admin.test@example.com',
  password: 'AdminPassword123!',
  adminLevel: 'super',
  phone: '+1234567890',
  provider: 'email'
};

async function upsertAdmin() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Try to find by email or uid
    let user = await User.findOne({ $or: [{ email: input.email }, { uid: input.uid }] });

    if (user) {
      console.log(`ℹ️ Found existing user. Updating admin fields for ${user.email} (uid: ${user.uid})...`);
      user.uid = input.uid; // ensure UID matches desired one
      user.name = input.name;
      user.email = input.email.toLowerCase();
      user.role = 'admin';
      user.adminLevel = input.adminLevel;
      user.phone = input.phone;
      user.provider = input.provider || 'email';
      // Set password in plain text; schema pre-save hook will hash it
      user.password = input.password;
      user.isActive = true;
      await user.save();
      console.log('✅ Admin user updated successfully');
    } else {
      console.log(`🆕 Creating admin user: ${input.email}`);
      user = new User({
        uid: input.uid,
        name: input.name,
        email: input.email.toLowerCase(),
        password: input.password, // will be hashed by pre-save hook
        provider: input.provider || 'email',
        role: 'admin',
        adminLevel: input.adminLevel,
        phone: input.phone,
        isActive: true
      });
      await user.save();
      console.log('✅ Admin user created successfully');
    }

    // Inform about ignored field
    console.log('ℹ️ Note: adminAccessCode is not defined in the User schema and will not be stored.');

    // Output summary (without password)
    console.log({ uid: user.uid, email: user.email, role: user.role, adminLevel: user.adminLevel, phone: user.phone, provider: user.provider });
  } catch (err) {
    console.error('❌ Failed to register admin:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

upsertAdmin();