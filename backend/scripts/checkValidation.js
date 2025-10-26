import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function checkValidation() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users in database`);

    for (const user of users) {
      console.log(`\n🔍 Checking user: ${user.email} (${user.role})`);
      
      // Test validation by creating a new instance
      try {
        const testUser = new User(user.toObject());
        await testUser.validate();
        console.log(`✅ User ${user.email} passes validation`);
      } catch (validationError) {
        console.log(`❌ User ${user.email} fails validation:`);
        Object.keys(validationError.errors).forEach(field => {
          console.log(`  - ${field}: ${validationError.errors[field].message}`);
        });
      }

      // Test a simple update
      try {
        const updateData = { name: user.name + ' (Updated)' };
        await User.findByIdAndUpdate(user._id, updateData, { 
          runValidators: false,
          new: true 
        });
        console.log(`✅ User ${user.email} can be updated`);
        
        // Revert the change
        await User.findByIdAndUpdate(user._id, { name: user.name }, { 
          runValidators: false 
        });
      } catch (updateError) {
        console.log(`❌ User ${user.email} update failed: ${updateError.message}`);
      }
    }

    // Test creating a new customer user
    console.log('\n🧪 Testing new customer creation...');
    const testCustomer = new User({
      uid: 'test-uid-' + Date.now(),
      email: 'test@example.com',
      name: 'Test Customer',
      role: 'customer',
      provider: 'email'
    });

    try {
      await testCustomer.validate();
      console.log('✅ New customer validation passes');
      
      // Don't save, just test
      console.log('✅ Customer creation test successful');
    } catch (error) {
      console.log('❌ New customer validation failed:', error.message);
    }

    console.log('\n✅ Validation check completed!');

  } catch (error) {
    console.error('❌ Validation check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the check
checkValidation();