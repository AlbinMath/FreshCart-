import express from 'express';
import SellerFarmerTransaction from '../models/SellerFarmerTransaction.js';
import FarmerProduct from '../models/FarmerProduct.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to require seller authentication
async function requireSeller(req, res, next) {
  try {
    const uid = req.headers['x-uid'];
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Import User model dynamically to avoid circular dependency
    const { default: User } = await import('../models/User.js');
    const user = await User.findOne({ uid });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Only allow sellers to purchase farmer products
    if (!['seller', 'store'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only sellers can purchase farmer products' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

// Purchase farmer product (seller buys from farmer)
router.post('/seller-farmer-transactions', requireSeller, async (req, res) => {
  try {
    const {
      productId,
      quantityPurchased,
      deliveryAddress,
      notes
    } = req.body;

    // Validation
    if (!productId || !quantityPurchased || quantityPurchased <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID and valid quantity are required' 
      });
    }

    // Get the farmer product
    const farmerProduct = await FarmerProduct.findById(productId);
    if (!farmerProduct) {
      return res.status(404).json({ 
        success: false, 
        message: 'Farmer product not found' 
      });
    }

    // Check if product is approved
    if (farmerProduct.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Product is not available for purchase' 
      });
    }

    // Check if enough quantity is available
    if (farmerProduct.quantity < quantityPurchased) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient quantity available' 
      });
    }

    // Calculate total amount
    const totalAmount = farmerProduct.price * quantityPurchased;

    // Create transaction
    const transaction = new SellerFarmerTransaction({
      sellerId: req.user.uid,
      sellerName: req.user.name,
      sellerEmail: req.user.email,
      farmerId: farmerProduct.farmerId,
      farmerName: farmerProduct.farmerName,
      farmerEmail: farmerProduct.farmerEmail,
      productId: farmerProduct._id,
      productName: farmerProduct.productName,
      productCategory: farmerProduct.category,
      productDescription: farmerProduct.description,
      productImagePath: farmerProduct.imagePath,
      quantityPurchased,
      unitPrice: farmerProduct.price,
      totalAmount,
      deliveryAddress: deliveryAddress || '',
      notes: notes || '',
      status: 'pending',
      paymentStatus: 'pending'
    });

    await transaction.save();

    // Update farmer product quantity
    farmerProduct.quantity -= quantityPurchased;
    await farmerProduct.save();

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      transaction
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase order',
      error: error.message
    });
  }
});

// Get seller's purchase history
router.get('/seller-farmer-transactions/my-purchases', requireSeller, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { sellerId: req.user.uid };
    if (status) query.status = status;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await SellerFarmerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SellerFarmerTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get seller purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase history',
      error: error.message
    });
  }
});

// Get farmer's sales history
router.get('/seller-farmer-transactions/my-sales', authenticateToken, async (req, res) => {
  try {
    // Check if user is a farmer
    if (req.user.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can view sales history'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { farmerId: req.user.uid };
    if (status) query.status = status;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await SellerFarmerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SellerFarmerTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get farmer sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales history',
      error: error.message
    });
  }
});

// Update transaction status (seller or farmer)
router.put('/seller-farmer-transactions/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const transaction = await SellerFarmerTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user is authorized to update this transaction
    if (transaction.sellerId !== req.user.uid && transaction.farmerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this transaction'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Update transaction
    transaction.status = status;
    if (notes) transaction.notes = notes;
    transaction.updatedAt = new Date();

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction status updated successfully',
      transaction
    });

  } catch (error) {
    console.error('Update transaction status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction status',
      error: error.message
    });
  }
});

// Get transaction by ID
router.get('/seller-farmer-transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await SellerFarmerTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user is authorized to view this transaction
    if (transaction.sellerId !== req.user.uid && transaction.farmerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this transaction'
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

export default router;




