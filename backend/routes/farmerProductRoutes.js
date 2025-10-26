import express from 'express';
import FarmerProduct from '../models/FarmerProduct.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to require farmer authentication
async function requireFarmer(req, res, next) {
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

    // Only allow farmers to submit products
    if (user.role !== 'farmer') {
      return res.status(403).json({ success: false, message: 'Only farmers can submit products' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

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

    // Only allow sellers to accept farmer products
    if (!['seller', 'store'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only sellers can accept farmer products' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

// Middleware to require farmer or customer authentication
async function requireFarmerOrCustomer(req, res, next) {
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

    // Allow both farmers and customers to submit/view products
    if (user.role !== 'farmer' && user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only farmers and customers can access this feature' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

// Submit farmer product
router.post('/farmer-products', requireFarmerOrCustomer, async (req, res) => {
  try {
    console.log('📥 Farmer product submission request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user);
    console.log('Headers:', req.headers);
    console.log('🔍 Raw req.body type:', typeof req.body);
    console.log('🔍 req.body keys:', Object.keys(req.body || {}));
    
    const {
      productName,
      category,
      description,
      price,
      quantity,
      imagePath,
      farmerName,
      farmerEmail
    } = req.body;

    // Basic information validation
    const hasBasicInfo = productName?.trim() || category || 
                        (typeof price === 'number' && price > 0) || 
                        (typeof quantity === 'number' && quantity > 0);
    
    console.log('🔍 Validation check:', {
      productName: productName,
      productNameTrimmed: productName?.trim(),
      category: category,
      price: price,
      priceType: typeof price,
      quantity: quantity,
      quantityType: typeof quantity,
      hasBasicInfo: hasBasicInfo
    });
    
    if (!hasBasicInfo) {
      console.log('❌ Basic information validation failed');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide at least some basic information about your product' 
      });
    }

    // Detailed validation
    if (!productName || !productName.trim()) {
      console.log('❌ Product name validation failed');
      return res.status(400).json({ 
        success: false, 
        message: 'Product name is required. Please enter a name for your product.' 
      });
    }

    if (!category) {
      console.log('❌ Category validation failed');
      return res.status(400).json({ 
        success: false, 
        message: 'Please select a category for your product to help customers find it easily.' 
      });
    }

    if (typeof price !== 'number') {
      console.log('❌ Price type validation failed:', typeof price);
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid price for your product.' 
      });
    }

    if (price < 0) {
      console.log('❌ Price value validation failed:', price);
      return res.status(400).json({ 
        success: false, 
        message: 'Price must be a positive number. Please enter a valid price for your product.' 
      });
    }

    if (typeof quantity !== 'number') {
      console.log('❌ Quantity type validation failed:', typeof quantity);
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid quantity for your product.' 
      });
    }

    if (quantity < 0) {
      console.log('❌ Quantity value validation failed:', quantity);
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be a positive number. Please enter a valid quantity for your product.' 
      });
    }

    // Create farmer product
    const farmerProduct = new FarmerProduct({
      productName: productName.trim(),
      category,
      description: description?.trim() || '',
      price,
      quantity,
      imagePath: imagePath || '',
      farmerId: req.user.uid,
      farmerName: farmerName || req.user.name,
      farmerEmail: farmerEmail || req.user.email,
      status: 'pending'
    });

    console.log('💾 Attempting to save farmer product to MongoDB...');
    await farmerProduct.save();
    console.log('✅ Farmer product saved successfully to MongoDB with ID:', farmerProduct._id);
    console.log('📊 Product details:', {
      productName: farmerProduct.productName,
      category: farmerProduct.category,
      price: farmerProduct.price,
      quantity: farmerProduct.quantity,
      farmerId: farmerProduct.farmerId,
      status: farmerProduct.status
    });

    res.status(201).json({
      success: true,
      message: 'Product submitted successfully',
      product: farmerProduct
    });

  } catch (error) {
    console.error('Farmer product submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit product',
      error: error.message
    });
  }
});

// Get all farmer products (for testing/debugging)
router.get('/farmer-products', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    const products = await FarmerProduct.find(query).sort({ createdAt: -1 });
    console.log('📋 Retrieved farmer products:', products.length, status ? `(status: ${status})` : '');
    res.json({
      success: true,
      count: products.length,
      products: products
    });
  } catch (error) {
    console.error('Error fetching farmer products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer products',
      error: error.message
    });
  }
});

// Admin approval endpoint
router.post('/farmer-products/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await FarmerProduct.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.status = 'approved';
    product.approvedBy = 'admin';
    product.approvalDate = new Date();
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Product approved successfully',
      product
    });
  } catch (error) {
    console.error('Approve farmer product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve product',
      error: error.message
    });
  }
});

// Get farmer's submitted products
router.get('/farmer-products/my-products', requireFarmerOrCustomer, async (req, res) => {
  try {
    const products = await FarmerProduct.find({ farmerId: req.user.uid })
      .sort({ submissionDate: -1 });

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Get farmer products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Update farmer product (only by farmer who submitted it)
router.put('/farmer-products/:id', requireFarmer, async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, description, price, quantity } = req.body;
    
    const product = await FarmerProduct.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user owns this product
    if (product.farmerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own products'
      });
    }

    // Check if product is approved (cannot edit approved products)
    if (product.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit approved products'
      });
    }

    // Update fields
    const updateData = {};
    if (productName) updateData.productName = productName.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) updateData.price = price;
    if (quantity !== undefined) updateData.quantity = quantity;
    updateData.updatedAt = new Date();

    const updatedProduct = await FarmerProduct.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Update farmer product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
});

// Update farmer product status (admin only)
router.put('/farmer-products/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected'
      });
    }

    const updateData = {
      status,
      approvedBy: req.user.uid,
      approvalDate: new Date(),
      updatedAt: new Date()
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const product = await FarmerProduct.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: `Product ${status} successfully`,
      product
    });

  } catch (error) {
    console.error('Update farmer product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: error.message
    });
  }
});

// Get farmer product by ID
router.get('/farmer-products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await FarmerProduct.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user can access this product
    if (req.user.role !== 'admin' && product.farmerId !== req.user.uid && req.user.role !== 'seller' && req.user.role !== 'store') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    console.error('Get farmer product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
});

// Delete farmer product (only by farmer who submitted it)
router.delete('/farmer-products/:id', requireFarmerOrCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await FarmerProduct.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user owns this product
    if (product.farmerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own products'
      });
    }

    await FarmerProduct.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete farmer product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
});

// Seller accepts farmer product
router.post('/farmer-products/:id/accept', requireSeller, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await FarmerProduct.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is approved
    if (product.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved products can be accepted'
      });
    }

    // Check if seller has already accepted this product
    const alreadyAccepted = product.acceptedBySellers.some(seller => seller.sellerId === req.user.uid);
    if (alreadyAccepted) {
      return res.status(400).json({
        success: false,
        message: 'You have already accepted this product'
      });
    }

    // Add seller to accepted sellers list
    product.acceptedBySellers.push({
      sellerId: req.user.uid,
      sellerName: req.user.name,
      storeDetails: {
        storeName: req.user.storeName || '',
        storeAddress: req.user.storeAddress || ''
      }
    });

    await product.save();

    res.json({
      success: true,
      message: 'Product accepted successfully',
      product
    });

  } catch (error) {
    console.error('Accept farmer product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept product',
      error: error.message
    });
  }
});

// Get farmer products accepted by a specific seller
router.get('/farmer-products/accepted-by-seller/:sellerId', authenticateToken, async (req, res) => {
  try {
    const { sellerId } = req.params;
    
    // If user is not admin, they can only view their own accepted products
    if (req.user.role !== 'admin' && req.user.uid !== sellerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const products = await FarmerProduct.find({
      'acceptedBySellers.sellerId': sellerId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Get accepted farmer products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accepted products',
      error: error.message
    });
  }
});

export default router;