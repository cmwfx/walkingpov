import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'thumbnail-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload thumbnail endpoint (admin only)
router.post('/thumbnail', verifyToken, requireAdmin, upload.single('thumbnail'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const baseFilename = `thumbnail-${uniqueSuffix}`;

    // Define responsive image sizes
    const sizes = [
      { width: 400, suffix: 'small' },
      { width: 800, suffix: 'medium' },
      { width: 1200, suffix: 'large' }
    ];

    // Process and generate images in multiple formats and sizes
    for (const size of sizes) {
      const height = Math.round(size.width * 9 / 16); // 16:9 aspect ratio

      // Generate WebP version
      await sharp(req.file.path)
        .resize(size.width, height, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.webp`));

      // Generate AVIF version
      await sharp(req.file.path)
        .resize(size.width, height, { fit: 'cover', position: 'center' })
        .avif({ quality: 80 })
        .toFile(path.join(uploadDir, `${baseFilename}-${size.suffix}.avif`));
    }

    // Delete the original uploaded file
    fs.unlinkSync(req.file.path);

    // Return the medium WebP as the primary URL for backward compatibility
    const fileUrl = `/uploads/${baseFilename}-medium.webp`;
    
    res.json({
      success: true,
      url: fileUrl,
      filename: `${baseFilename}-medium.webp`,
      sizes: {
        small: {
          webp: `/uploads/${baseFilename}-small.webp`,
          avif: `/uploads/${baseFilename}-small.avif`
        },
        medium: {
          webp: `/uploads/${baseFilename}-medium.webp`,
          avif: `/uploads/${baseFilename}-medium.avif`
        },
        large: {
          webp: `/uploads/${baseFilename}-large.webp`,
          avif: `/uploads/${baseFilename}-large.avif`
        }
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

export default router;
