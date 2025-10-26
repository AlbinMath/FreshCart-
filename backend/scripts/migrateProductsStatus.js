import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { getSellerProductModel } from '../models/Product.js';

// Set to true to remove legacy approvalStatus field after migration
const REMOVE_LEGACY = process.env.REMOVE_LEGACY_APPROVAL_STATUS === 'true';

dotenv.config();

async function migrateOneCollection(identifier) {
  const Model = getSellerProductModel(identifier);

  // 1) Normalize status from approvalStatus when missing
  // 2) Coerce stock to non-negative integer
  // 3) Ensure lowStockThreshold default
  const updateResult = await Model.updateMany(
    {},
    [
      {
        $set: {
          status: { $ifNull: ['$status', { $ifNull: ['$approvalStatus', 'pending'] }] },
          stock: { $max: [0, { $toInt: { $ifNull: ['$stock', 0] } }] },
          lowStockThreshold: { $ifNull: ['$lowStockThreshold', 10] }
        }
      }
    ]
  );

  let unsetResult = { acknowledged: true, modifiedCount: 0 };
  if (REMOVE_LEGACY) {
    unsetResult = await Model.updateMany(
      { approvalStatus: { $exists: true } },
      { $unset: { approvalStatus: '' } }
    );
  }

  return { updateResult, unsetResult };
}

async function run() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all sellers (and stores if they also have product collections)
    const sellers = await User.find({ role: { $in: ['seller', 'store'] } })
      .select('uid sellerUniqueNumber email');

    console.log(`👤 Found ${sellers.length} seller/store users`);

    const seen = new Set();
    let collectionsProcessed = 0;
    let totalModified = 0;
    let totalUnset = 0;

    for (const s of sellers) {
      const identifiers = [s.sellerUniqueNumber, s.uid]
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);

      for (const id of identifiers) {
        if (seen.has(id)) continue; // avoid processing same collection twice
        seen.add(id);

        try {
          console.log(`\n📦 Migrating collection for identifier: ${id}`);
          const { updateResult, unsetResult } = await migrateOneCollection(id);
          console.log(
            `   - Modified (set): ${updateResult.modifiedCount ?? updateResult.nModified || 0}`
          );
          if (REMOVE_LEGACY) {
            console.log(
              `   - Removed approvalStatus: ${unsetResult.modifiedCount ?? unsetResult.nModified || 0}`
            );
            totalUnset += unsetResult.modifiedCount ?? unsetResult.nModified || 0;
          }
          totalModified += updateResult.modifiedCount ?? updateResult.nModified || 0;
          collectionsProcessed += 1;
        } catch (e) {
          console.warn(`   ⚠️  Skipped identifier ${id}:`, e.message);
        }
      }
    }

    console.log('\n✅ Migration complete');
    console.log(`   Collections processed: ${collectionsProcessed}`);
    console.log(`   Documents modified (set): ${totalModified}`);
    if (REMOVE_LEGACY) console.log(`   Documents updated (unset approvalStatus): ${totalUnset}`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();