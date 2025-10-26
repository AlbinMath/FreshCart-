import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function cleanIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the User collection
    const collection = mongoose.connection.db.collection('users');

    // List all indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop problematic indexes
    console.log('\n🗑️ Dropping problematic indexes...');
    
    try {
      // Try to drop the Rid index if it exists
      await collection.dropIndex('Rid_1');
      console.log('✅ Dropped Rid_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Rid_1 index does not exist');
      } else {
        console.log('❌ Error dropping Rid_1 index:', error.message);
      }
    }

    // Recreate proper indexes
    console.log('\n🔧 Ensuring proper indexes...');
    
    try {
      await collection.createIndex({ uid: 1 }, { unique: true });
      console.log('✅ Created uid unique index');
    } catch (error) {
      console.log('ℹ️ uid index already exists');
    }

    try {
      await collection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Created email unique index');
    } catch (error) {
      console.log('ℹ️ email index already exists');
    }

    try {
      await collection.createIndex({ sellerUniqueNumber: 1 }, { unique: true, sparse: true });
      console.log('✅ Created sellerUniqueNumber unique sparse index');
    } catch (error) {
      console.log('ℹ️ sellerUniqueNumber index already exists');
    }

    // List indexes again
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Index cleanup completed!');

  } catch (error) {
    console.error('❌ Index cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the cleanup
cleanIndexes();