import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function testGoogleSignin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a new Google user
    console.log('\n📝 Test 1: Creating new Google user');
    
    const googleUserData = {
      uid: 'google-test-' + Date.now(),
      email: 'testgoogle@example.com',
      name: 'Google Test User',
      role: 'customer',
      provider: 'google',
      profilePicture: 'https://example.com/photo.jpg'
    };

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email: googleUserData.email }, { uid: googleUserData.uid }] 
      });
      
      if (existingUser) {
        console.log('🗑️ Removing existing test user...');
        await User.findByIdAndDelete(existingUser._id);
      }

      // Create new Google user
      const newUser = new User(googleUserData);
      await newUser.save();
      
      console.log('✅ Google user created successfully:');
      console.log(`  - UID: ${newUser.uid}`);
      console.log(`  - Email: ${newUser.email}`);
      console.log(`  - Name: ${newUser.name}`);
      console.log(`  - Provider: ${newUser.provider}`);
      console.log(`  - Role: ${newUser.role}`);
      console.log(`  - Has Password: ${!!newUser.password}`);

    } catch (error) {
      console.log('❌ Failed to create Google user:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(field => {
          console.log(`  - ${field}: ${error.errors[field].message}`);
        });
      }
    }

    // Test 2: Test registration endpoint
    console.log('\n📝 Test 2: Testing registration endpoint');
    
    const registrationData = {
      uid: 'google-reg-' + Date.now(),
      email: 'regtest@example.com',
      name: 'Registration Test User',
      role: 'customer',
      provider: 'google'
    };

    try {
      // Simulate the registration endpoint logic
      const existingUser = await User.findOne({ 
        $or: [{ email: registrationData.email }, { uid: registrationData.uid }] 
      });
      
      if (existingUser) {
        console.log('User already exists, would return existing user');
      } else {
        const userData = {
          uid: registrationData.uid,
          name: registrationData.name,
          email: registrationData.email,
          role: registrationData.role,
          provider: registrationData.provider || 'email'
        };

        // Don't add password for Google users
        if (!registrationData.provider || registrationData.provider !== 'google') {
          userData.password = 'required-for-email-users';
        }

        const user = new User(userData);
        await user.save();

        console.log('✅ Registration endpoint simulation successful:');
        console.log(`  - UID: ${user.uid}`);
        console.log(`  - Email: ${user.email}`);
        console.log(`  - Provider: ${user.provider}`);
      }
    } catch (error) {
      console.log('❌ Registration endpoint simulation failed:', error.message);
    }

    // Test 3: List all users
    console.log('\n📝 Test 3: Current users in database');
    const allUsers = await User.find({});
    console.log(`Total users: ${allUsers.length}`);
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.provider}) - ${user.role}`);
    });

    console.log('\n✅ Google sign-in tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testGoogleSignin();