// Daily stock reset job
// - Resets all products' stock to 0 for every seller collection
// - Runs at a configured time (default: 00:00 server time)
// - Skips if DB not connected

import cron from 'node-cron';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { getSellerProductModel } from '../models/Product.js';

// time format: "0 0 * * *" -> at 00:00 every day
// allow override via env CRON_RESET_STOCK (e.g., "0 3 * * *" for 03:00)
const CRON_SCHEDULE = process.env.CRON_RESET_STOCK || '0 0 * * *';

// Auto-reject orders not accepted by seller within 3 minutes
function scheduleAutoRejectOrders() {
  console.log('[CRON] Scheduling auto-reject orders every minute');
  cron.schedule('* * * * *', async () => { // Every minute
    if (mongoose.connection.readyState !== 1) {
      console.warn('[CRON] MongoDB not connected. Skipping auto-reject orders.');
      return;
    }
    try {
      const now = new Date();
      const expiredOrders = await Order.find({
        status: 'Pending Seller Approval',
        sellerApprovalDeadline: { $lt: now }
      });

      for (const order of expiredOrders) {
        await Order.findOneAndUpdate(
          { orderId: order.orderId },
          {
            status: 'Cancelled',
            $push: {
              statusTimeline: {
                status: 'Auto-rejected: Seller did not respond within 3 minutes',
                timestamp: new Date()
              }
            }
          }
        );
        console.log(`[CRON] Auto-rejected order ${order.orderId}`);
      }

      if (expiredOrders.length > 0) {
        console.log(`[CRON] Auto-rejected ${expiredOrders.length} orders`);
      }
    } catch (e) {
      console.error('[CRON] Auto-reject orders failed:', e);
    }
  });
}

export function initCronJobs() {
  try {
    console.log(`[CRON] Scheduling daily stock reset with expression: ${CRON_SCHEDULE}`);
    cron.schedule(CRON_SCHEDULE, async () => {
      if (mongoose.connection.readyState !== 1) {
        console.warn('[CRON] MongoDB not connected. Skipping stock reset.');
        return;
      }
      const start = Date.now();
      try {
        const sellers = await User.find({ role: 'seller', isActive: true }).select('uid sellerUniqueNumber');
        let updatedCollections = 0;
        for (const seller of sellers) {
          try {
            const ProductModel = getSellerProductModel(seller.sellerUniqueNumber || seller.uid);
            const res = await ProductModel.updateMany({}, { $set: { stock: 0 } });
            updatedCollections += 1;
            console.log(`[CRON] Reset stock for seller=${seller.uid} matched=${res.matchedCount} modified=${res.modifiedCount}`);
          } catch (e) {
            console.error(`[CRON] Error resetting stock for seller=${seller.uid}:`, e.message);
          }
        }
        console.log(`[CRON] Daily stock reset completed in ${Date.now() - start}ms across ${updatedCollections} seller collections`);
      } catch (e) {
        console.error('[CRON] Daily stock reset failed:', e);
      }
    });

    // Schedule auto-reject orders
    scheduleAutoRejectOrders();
  } catch (e) {
    console.error('[CRON] Failed to schedule jobs:', e);
  }
}