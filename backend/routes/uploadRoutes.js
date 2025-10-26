import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: uid_timestamp.extension
    const uniqueName = `${req.params.uid}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter: allow images and PDF for license uploads
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetypeOk = allowedTypes.test(file.mimetype.toLowerCase());

  if (mimetypeOk && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) or PDF are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload profile image
router.post('/profile/:uid', upload.single('profileImage'), async (req, res) => {
  try {
    console.log('Upload request received for UID:', req.params.uid);
    console.log('File received:', req.file ? req.file.filename : 'No file');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old profile image if exists
    const { uid } = req.params;
    try {
      const files = fs.readdirSync(uploadDir);
      const oldFiles = files.filter(file => file.startsWith(`${uid}_`));
      
      oldFiles.forEach(file => {
        if (file !== req.file.filename) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
            console.log('Deleted old file:', file);
          } catch (error) {
            console.log('Error deleting old file:', error);
          }
        }
      });
    } catch (error) {
      console.log('Error reading upload directory:', error);
    }

    // Return the file URL
    const fileUrl = `/uploads/profiles/${req.file.filename}`;
    const fullPath = path.join(uploadDir, req.file.filename);
    
    console.log('File saved to:', fullPath);
    console.log('File URL:', fileUrl);

    // Update user profile in database with image info
    try {
      const updatedUser = await User.findOneAndUpdate(
        { uid },
        {
          $set: {
            profilePicture: `http://localhost:5000${fileUrl}`,
            profileImagePath: fullPath,
            profileImageFilename: req.file.filename
          }
        },
        { new: true }
      ).select('-password');

      console.log('User profile updated with image info');
    } catch (dbError) {
      console.error('Error updating user profile in database:', dbError);
      // Continue anyway, file is uploaded
    }
    
    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl: fileUrl,
      fullImageUrl: `http://localhost:5000${fileUrl}`,
      filename: req.file.filename,
      filePath: fullPath,
      fileSize: req.file.size,
      projectLocation: `backend/uploads/profiles/${req.file.filename}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Delete profile image
router.delete('/profile/:uid/:filename', async (req, res) => {
  try {
    const { uid, filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // Verify the file belongs to the user
    if (!filename.startsWith(`${uid}_`)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this file'
      });
    }

    // Delete the file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: 'Profile image deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

// Get all uploaded images info
router.get('/images/info', async (req, res) => {
  try {
    // Get all users with profile images
    const usersWithImages = await User.find({
      profileImageFilename: { $exists: true, $ne: '' }
    }).select('uid name email profilePicture profileImagePath profileImageFilename');

    // Get file system info
    const uploadDirInfo = {
      directory: uploadDir,
      exists: fs.existsSync(uploadDir)
    };

    let files = [];
    if (uploadDirInfo.exists) {
      files = fs.readdirSync(uploadDir).map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/uploads/profiles/${filename}`,
          fullUrl: `http://localhost:5000/uploads/profiles/${filename}`
        };
      });
    }

    res.json({
      success: true,
      uploadDirectory: uploadDirInfo,
      totalFiles: files.length,
      totalUsers: usersWithImages.length,
      files,
      users: usersWithImages,
      projectLocation: 'backend/uploads/profiles/'
    });

  } catch (error) {
    console.error('Error getting images info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get images info',
      error: error.message
    });
  }
});

export default router;