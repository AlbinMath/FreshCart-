// Test Firebase password setting with a simple password
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

async function testFirebasePassword() {
  try {
    // Initialize Firebase Admin if not already done
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

    const testUser = {
      uid: 'test-simple-password',
      email: 'test.simple@example.com',
      password: 'password123' // Very simple password
    };

    // Delete user if exists
    try {
      await admin.auth().deleteUser(testUser.uid);
      console.log('🗑️ Deleted existing user');
    } catch (e) {
      console.log('ℹ️ User does not exist');
    }

    // Create user
    const userRecord = await admin.auth().createUser({
      uid: testUser.uid,
      email: testUser.email,
      password: testUser.password,
      emailVerified: true,
      disabled: false
    });

    console.log('✅ Created user:', userRecord.uid, userRecord.email);
    console.log('🔑 Password set:', testUser.password);
    
    // Try to get user info to verify
    const retrievedUser = await admin.auth().getUser(testUser.uid);
    console.log('📋 Retrieved user info:');
    console.log('- UID:', retrievedUser.uid);
    console.log('- Email:', retrievedUser.email);
    console.log('- Email verified:', retrievedUser.emailVerified);
    console.log('- Disabled:', retrievedUser.disabled);
    console.log('- Password hash:', retrievedUser.passwordHash ? 'SET' : 'NOT SET');
    console.log('- Password salt:', retrievedUser.passwordSalt ? 'SET' : 'NOT SET');

    console.log('\n🧪 Now try to login with:');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFirebasePassword();