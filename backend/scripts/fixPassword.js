import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

async function fixPassword() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find users without passwords (Google users)
    const usersWithoutPassword = await User.find({
      $or: [
        { password: { $exists: false } },
        { password: '' },
        { password: null }
      ]
    });

    console.log(`Found ${usersWithoutPassword.length} users without passwords`);

    for (const user of usersWithoutPassword) {
      console.log(`Fixing user: ${user.email} (provider: ${user.provider})`);
      
      if (user.provider === 'google') {
        // For Google users, set a placeholder password
        const placeholderPassword = await bcrypt.hash('google-auth-placeholder', 10);
        await User.findByIdAndUpdate(user._id, {
          password: placeholderPassword
        });
        console.log(`✅ Set placeholder password for Google user: ${user.email}`);
      } else {
        // For email users without password, set a temporary one
        const tempPassword = await bcrypt.hash('temp123456', 10);
        await User.findByIdAndUpdate(user._id, {
          password: tempPassword
        });
        console.log(`✅ Set temporary password for email user: ${user.email}`);
      }
    }

    // Verify all users now pass validation
    console.log('\n🔍 Final validation check...');
    const allUsers = await User.find({});
    
    for (const user of allUsers) {
      try {
        const userData = user.toObject();
        delete userData._id;
        delete userData.__v;
        delete userData.createdAt;
        delete userData.updatedAt;
        
        const testUser = new User(userData);
        await testUser.validate();
        console.log(`✅ User ${user.email} passes validation`);
      } catch (validationError) {
        console.log(`❌ User ${user.email} still fails validation:`);
        Object.keys(validationError.errors).forEach(field => {
          console.log(`  - ${field}: ${validationError.errors[field].message}`);
        });
      }
    }

    console.log('\n✅ Password fix completed!');

  } catch (error) {
    console.error('❌ Password fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the fix
fixPassword();