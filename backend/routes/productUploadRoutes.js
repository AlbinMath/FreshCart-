import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uid = req.headers['x-uid'] || 'anon';
    const unique = `${uid}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
  if (ok) return cb(null, true);
  cb(new Error('Only image files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Auth middleware to allow sellers, farmers, and customers to upload product images
async function requireSellerOrFarmerOrCustomer(req, res, next) {
  try {
    const uid = req.headers['x-uid'];
    if (!uid) return res.status(401).json({ success: false, message: 'UID required' });
    const user = await User.findOne({ uid });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.role !== 'seller' && user.role !== 'customer' && user.role !== 'farmer') return res.status(403).json({ success: false, message: 'Only sellers, farmers, and customers can upload product images' });
    req.seller = user;
    next();
  } catch (e) {
    console.error('seller check error', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

router.post('/product-image', requireSellerOrFarmerOrCustomer, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/products/${req.file.filename}`;
    res.json({ success: true, url, fullUrl: `http://localhost:5000${url}`, filename: req.file.filename });
  } catch (e) {
    console.error('product image upload error', e);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

export default router;