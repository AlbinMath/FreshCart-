import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function updateDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔄 Updating user documents...');
    
    // Update all users to ensure they have the new fields
    const updateResult = await User.updateMany(
      {},
      [
        {
          $set: {
            profileImagePath: { $ifNull: ['$profileImagePath', ''] },
            profileImageFilename: { $ifNull: ['$profileImageFilename', ''] },
            accountStatus: { $ifNull: ['$accountStatus', 'active'] },
            isActive: { $ifNull: ['$isActive', true] }
          }
        }
      ]
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} user documents`);

    // Remove any invalid validation constraints
    console.log('🔄 Checking for users with missing required fields...');
    
    const usersWithIssues = await User.find({
      $or: [
        { role: 'delivery', vehicleType: { $exists: false } },
        { role: 'delivery', licenseNumber: { $exists: false } },
        { role: 'admin', adminLevel: { $exists: false } },
        { role: 'store', storeAddress: { $exists: false } }
      ]
    });

    console.log(`Found ${usersWithIssues.length} users with potential issues`);

    // Fix delivery users
    const deliveryUsers = await User.updateMany(
      { role: 'delivery', vehicleType: { $exists: false } },
      { $set: { vehicleType: 'bike' } }
    );

    const deliveryLicense = await User.updateMany(
      { role: 'delivery', licenseNumber: { $exists: false } },
      { $set: { licenseNumber: 'TEMP_LICENSE' } }
    );

    // Fix admin users
    const adminUsers = await User.updateMany(
      { role: 'admin', adminLevel: { $exists: false } },
      { $set: { adminLevel: 'support' } }
    );

    // Fix store users
    const storeUsers = await User.updateMany(
      { role: 'store', storeAddress: { $exists: false } },
      { $set: { storeAddress: 'Address not provided' } }
    );

    console.log('✅ Fixed user data:');
    console.log(`  - Delivery users: ${deliveryUsers.modifiedCount}`);
    console.log(`  - Delivery licenses: ${deliveryLicense.modifiedCount}`);
    console.log(`  - Admin users: ${adminUsers.modifiedCount}`);
    console.log(`  - Store users: ${storeUsers.modifiedCount}`);

    // Get final user count
    const totalUsers = await User.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);

    // Show sample of users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    console.log('📊 Users by role:');
    usersByRole.forEach(role => {
      console.log(`  - ${role._id}: ${role.count}`);
    });

    console.log('✅ Database update completed successfully!');

  } catch (error) {
    console.error('❌ Database update failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the update
updateDatabase();