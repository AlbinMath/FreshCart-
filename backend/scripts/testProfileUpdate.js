import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function testProfileUpdate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first user
    const user = await User.findOne({});
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`\n🧪 Testing profile update for: ${user.email}`);
    console.log(`Current name: ${user.name}`);
    console.log(`Current phone: ${user.phone || 'Not set'}`);

    // Test 1: Simple update
    console.log('\n📝 Test 1: Simple name and phone update');
    try {
      const updateData = {
        name: 'Updated Test Name',
        phone: '+1234567890'
      };

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: updateData },
        { 
          new: true, 
          runValidators: false,
          context: 'query' 
        }
      );

      if (updatedUser) {
        console.log('✅ Simple update successful');
        console.log(`New name: ${updatedUser.name}`);
        console.log(`New phone: ${updatedUser.phone}`);
      } else {
        console.log('❌ Update returned null');
      }
    } catch (error) {
      console.log('❌ Simple update failed:', error.message);
    }

    // Test 2: Update with validation enabled
    console.log('\n📝 Test 2: Update with validation enabled');
    try {
      const updateData = {
        name: 'Validated Update Name',
        phone: '+9876543210',
        gender: 'male'
      };

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          context: 'query' 
        }
      );

      if (updatedUser) {
        console.log('✅ Validated update successful');
        console.log(`Name: ${updatedUser.name}`);
        console.log(`Phone: ${updatedUser.phone}`);
        console.log(`Gender: ${updatedUser.gender}`);
      } else {
        console.log('❌ Validated update returned null');
      }
    } catch (error) {
      console.log('❌ Validated update failed:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(field => {
          console.log(`  - ${field}: ${error.errors[field].message}`);
        });
      }
    }

    // Test 3: Invalid data update
    console.log('\n📝 Test 3: Invalid data update (should fail with validation)');
    try {
      const invalidData = {
        phone: 'invalid-phone',
        gender: 'invalid-gender'
      };

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: invalidData },
        { 
          new: true, 
          runValidators: true,
          context: 'query' 
        }
      );

      console.log('⚠️ Invalid update unexpectedly succeeded');
    } catch (error) {
      console.log('✅ Invalid update correctly failed:', error.message);
    }

    console.log('\n✅ Profile update tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testProfileUpdate();