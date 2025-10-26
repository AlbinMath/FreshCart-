// Setup Firebase test users
import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testUsers = [
  {
    email: 'test.user@example.com',
    password: 'TestPassword123!',
    uid: 'test-user-uid-12345'
  },
  {
    email: 'admin.test@example.com',
    password: 'AdminPassword123!',
    uid: 'admin-test-uid-12345'
  },
  {
    email: 'seller.test@example.com',
    password: 'SellerPassword123!',
    uid: 'seller-test-uid-12345'
  },
  {
    email: 'delivery.test@example.com',
    password: 'DeliveryPassword123!',
    uid: 'delivery-test-uid-12345'
  }
];

async function setupFirebaseUsers() {
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
        console.log('❌ Firebase credentials not found in environment');
        return;
      }
    }

    console.log('🔥 Setting up Firebase test users...');

    for (const userData of testUsers) {
      try {
        // Delete user if exists first to recreate with proper password
        try {
          await admin.auth().deleteUser(userData.uid);
          console.log(`🗑️ Deleted existing Firebase user: ${userData.email}`);
        } catch (deleteError) {
          if (deleteError.code !== 'auth/user-not-found') {
            console.log(`ℹ️ User ${userData.email} doesn't exist yet`);
          }
        }

        // Create new user with password
        const userRecord = await admin.auth().createUser({
          uid: userData.uid,
          email: userData.email,
          password: userData.password,
          emailVerified: true,
          disabled: false
        });
        console.log(`✅ Created Firebase user: ${userData.email} with UID: ${userRecord.uid}`);

      } catch (error) {
        console.error(`❌ Failed to setup user ${userData.email}:`, error.message);
      }
    }

    console.log('✅ Firebase test users setup completed');
  } catch (error) {
    console.error('❌ Failed to setup Firebase users:', error.message);
  }
}

setupFirebaseUsers();