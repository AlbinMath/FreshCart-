import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function cleanDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clean up invalid enum values
    console.log('🧹 Cleaning up invalid enum values...');
    
    // Fix empty string enum values
    const cleanupResult = await User.updateMany(
      {},
      [
        {
          $set: {
            sellerCategory: {
              $cond: {
                if: { $or: [{ $eq: ['$sellerCategory', ''] }, { $eq: ['$sellerCategory', null] }] },
                then: '$$REMOVE',
                else: '$sellerCategory'
              }
            },
            vehicleType: {
              $cond: {
                if: { $or: [{ $eq: ['$vehicleType', ''] }, { $eq: ['$vehicleType', null] }] },
                then: '$$REMOVE',
                else: '$vehicleType'
              }
            },
            adminLevel: {
              $cond: {
                if: { $or: [{ $eq: ['$adminLevel', ''] }, { $eq: ['$adminLevel', null] }] },
                then: '$$REMOVE',
                else: '$adminLevel'
              }
            }
          }
        }
      ]
    );

    console.log(`✅ Cleaned up ${cleanupResult.modifiedCount} user records`);

    // Verify all users now pass validation
    console.log('🔍 Verifying user validation...');
    const users = await User.find({});
    
    for (const user of users) {
      try {
        // Create a copy for validation test
        const userData = user.toObject();
        delete userData._id;
        delete userData.__v;
        delete userData.createdAt;
        delete userData.updatedAt;
        
        const testUser = new User(userData);
        await testUser.validate();
        console.log(`✅ User ${user.email} passes validation`);
      } catch (validationError) {
        console.log(`❌ User ${user.email} still has validation issues:`);
        Object.keys(validationError.errors).forEach(field => {
          console.log(`  - ${field}: ${validationError.errors[field].message}`);
        });
        
        // Try to fix the specific user
        const fixes = {};
        if (validationError.errors.sellerCategory) {
          fixes.sellerCategory = undefined;
        }
        if (validationError.errors.vehicleType) {
          fixes.vehicleType = undefined;
        }
        if (validationError.errors.adminLevel) {
          fixes.adminLevel = undefined;
        }
        
        if (Object.keys(fixes).length > 0) {
          await User.findByIdAndUpdate(user._id, { $unset: fixes });
          console.log(`🔧 Applied fixes to ${user.email}:`, fixes);
        }
      }
    }

    console.log('✅ Database cleanup completed!');

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the cleanup
cleanDatabase();