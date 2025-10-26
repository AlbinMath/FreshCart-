import express from 'express';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import { getSellerProductModel } from '../models/Product.js';

const router = express.Router();

// Middleware: require authenticated customer
async function requireCustomer(req, res, next) {
  try {
    const uid = req.headers['x-uid'] || req.body.uid || req.query.uid;
    if (!uid) return res.status(401).json({ success: false, message: 'UID required' });

    const user = await User.findOne({ uid });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can access cart' });
    }

    req.customer = user;
    next();
  } catch (err) {
    console.error('Customer auth error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Get customer's cart
router.get('/cart', requireCustomer, async (req, res) => {
  try {
    let cart = await Cart.findOne({ customerUid: req.customer.uid });
    if (!cart) {
      return res.json({
        success: true,
        cart: {
          customerUid: req.customer.uid,
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          totalAmount: 0,
          itemCount: 0
        }
      });
    }

    // Force recalculation by triggering save if cart has items
    if (cart.items.length > 0) {
      await cart.save();
    }

    res.json({ success: true, cart });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add item to cart
router.post('/cart/add', requireCustomer, async (req, res) => {
  try {
    const { productId, sellerCollection, sellerUid, quantity = 1 } = req.body;

    if (!productId || !sellerCollection || !sellerUid) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, seller collection, and seller UID are required'
      });
    }

    // Get product details from seller's collection
    const SellerProduct = getSellerProductModel(sellerCollection);
    const product = await SellerProduct.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}`
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ customerUid: req.customer.uid });
    if (!cart) {
      cart = new Cart({
        customerUid: req.customer.uid,
        items: []
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item =>
      item.productId.toString() === productId &&
      item.sellerCollection === sellerCollection
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
      if (cart.items[existingItemIndex].quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more items. Available stock: ${product.stock}`
        });
      }
    } else {
      // Add new item
      cart.items.push({
        productId: product._id,
        sellerCollection,
        sellerUid,
        productName: product.name,
        productImage: product.images && product.images.length > 0 ? product.images[0] : '',
        price: product.price,
        quantity,
        category: product.category
      });
    }

    await cart.save();
    res.json({ success: true, cart, message: 'Item added to cart successfully' });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update cart item quantity
router.put('/cart/update/:itemId', requireCustomer, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const cart = await Cart.findOne({ customerUid: req.customer.uid });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    // Check stock availability
    const SellerProduct = getSellerProductModel(item.sellerCollection);
    const product = await SellerProduct.findById(item.productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product no longer available' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}`
      });
    }

    item.quantity = quantity;
    await cart.save();

    res.json({ success: true, cart, message: 'Cart updated successfully' });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Remove item from cart
router.delete('/cart/remove/:itemId', requireCustomer, async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ customerUid: req.customer.uid });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.json({ success: true, cart, message: 'Item removed from cart successfully' });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Clear cart
router.delete('/cart/clear', requireCustomer, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ customerUid: req.customer.uid });
    res.json({ success: true, message: 'Cart cleared successfully' });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;