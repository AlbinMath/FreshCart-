import express from 'express';
import Address from '../models/Address.js';

const router = express.Router();

// Get user addresses
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-uid'];
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    res.json({ success: true, addresses });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
});

// Add new address
router.post('/add', async (req, res) => {
  try {
    const userId = req.headers['x-uid'];
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    // Remove any immutable fields that might be accidentally sent
    const { _id, createdAt, updatedAt, ...addressData } = req.body;
    const finalAddressData = { ...addressData, userId };

    // If this is the first address or marked as default, set it as default
    if (finalAddressData.isDefault || (await Address.countDocuments({ userId })) === 0) {
      finalAddressData.isDefault = true;
      // Remove default flag from other addresses
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const address = new Address(finalAddressData);
    await address.save();

    res.json({ success: true, address });
  } catch (error) {
    console.error('Error adding address:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    res.status(500).json({ success: false, message: 'Failed to add address' });
  }
});

// Update address
router.put('/update/:id', async (req, res) => {
  try {
    const userId = req.headers['x-uid'];
    const { id } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const addressData = req.body;

    // Remove immutable fields that shouldn't be updated
    const { _id, createdAt, updatedAt, ...updateData } = addressData;

    // If setting as default, remove default from others
    if (updateData.isDefault) {
      await Address.updateMany({ userId, _id: { $ne: id } }, { isDefault: false });
    }

    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    res.json({ success: true, address });
  } catch (error) {
    console.error('Error updating address:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
});

// Delete address
router.delete('/delete/:id', async (req, res) => {
  try {
    const userId = req.headers['x-uid'];
    const { id } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const address = await Address.findOneAndDelete({ _id: id, userId });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
});

// Set default address
router.put('/set-default/:id', async (req, res) => {
  try {
    const userId = req.headers['x-uid'];
    const { id } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    // Remove default from all addresses
    await Address.updateMany({ userId }, { isDefault: false });

    // Set the specified address as default
    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      { isDefault: true },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    res.json({ success: true, address });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ success: false, message: 'Failed to set default address' });
  }
});

export default router;