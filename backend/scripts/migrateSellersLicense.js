const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

db.once('open', async () => {
  try {
    console.log('Connected to MongoDB');
    
    // Find all seller accounts without licenseInfo
    const sellers = await User.find({
      role: 'seller',
      $or: [
        { licenseInfo: { $exists: false } },
        { licenseInfo: null }
      ]
    });

    console.log(`Found ${sellers.length} seller accounts to update`);

    // Update each seller with default licenseInfo
    const bulkOps = sellers.map(seller => ({
      updateOne: {
        filter: { _id: seller._id },
        update: {
          $set: {
            licenseInfo: {
              licenseNumber: '',
              file: {
                url: '',
                path: '',
                filename: '',
                mimetype: '',
                size: 0
              },
              status: 'pending',
              rejectionReason: '',
              verifiedAt: null,
              verifiedBy: null
            }
          }
        }
      }
    }));

    // Execute bulk update
    if (bulkOps.length > 0) {
      const result = await User.bulkWrite(bulkOps);
      console.log(`Successfully updated ${result.modifiedCount} seller accounts`);
    } else {
      console.log('No seller accounts needed updating');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
});
