import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function addBalanceField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Update all users to have balance field
    const result = await User.updateMany(
      { balance: { $exists: false } }, // Only update if balance doesn't exist
      { $set: { balance: 0 } }
    );

    console.log(`✅ Successfully added balance field to ${result.nModified} users`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding balance field:', error);
    process.exit(1);
  }
}

addBalanceField();
