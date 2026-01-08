import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import * as crypto from 'crypto';

// Base upload directory
const BASE_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Ensure directory exists, create if not
 */
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Configure storage for tenant-scoped uploads
 * Files are stored in uploads/{restaurantId}/
 */
const tenantStorage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    // Extract restaurantId from tenant context
    const restaurantId = req.restaurantId?.toString() || 'default';
    const uploadPath = path.join(BASE_UPLOAD_DIR, restaurantId);

    // Ensure directory exists
    ensureDirectoryExists(uploadPath);

    cb(null, uploadPath);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: timestamp-randomstring.ext
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${timestamp}-${randomString}${ext}`;

    cb(null, filename);
  },
});

/**
 * File filter for image validation
 * Allowed formats: jpg, jpeg, png, gif, webp
 */
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  // Allowed image MIME types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  // Allowed file extensions
  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`));
  }

  // Check file extension
  if (!allowedExtensions.test(file.originalname)) {
    return cb(new Error('Invalid file extension. Only jpg, jpeg, png, gif, webp are allowed.'));
  }

  // File is valid
  cb(null, true);
};

/**
 * Multer upload configuration for single image
 * - File size limit: 5MB
 * - Tenant-scoped storage
 * - Image validation
 */
export const uploadSingleImage = multer({
  storage: tenantStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
    files: 1,
  },
}).single('image');

/**
 * Multer upload configuration for multiple images
 * - File size limit: 5MB per file
 * - Maximum 10 files at once
 * - Tenant-scoped storage
 * - Image validation
 */
export const uploadMultipleImages = multer({
  storage: tenantStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
    files: parseInt(process.env.MAX_FILES_PER_UPLOAD || '10'), // 10 files default
  },
}).array('images', parseInt(process.env.MAX_FILES_PER_UPLOAD || '10'));

/**
 * Legacy multer configuration for menu items (backwards compatibility)
 * Stores in uploads/menu-items/ without tenant scoping
 */
const menuItemStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const menuItemsDir = path.join(BASE_UPLOAD_DIR, 'menu-items');
    ensureDirectoryExists(menuItemsDir);
    cb(null, menuItemsDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `menu-item-${uniqueSuffix}${ext}`);
  },
});

export const uploadMenuImage = multer({
  storage: menuItemStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
  },
});

/**
 * Utility function to delete a file
 */
export const deleteFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        // File doesn't exist or already deleted
        if (err.code === 'ENOENT') {
          return resolve();
        }
        return reject(err);
      }
      resolve();
    });
  });
};

/**
 * Utility function to check if file exists
 */
export const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Get file size in bytes
 */
export const getFileSize = (filePath: string): number | null => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
};

/**
 * Validate image dimensions (optional)
 * Can be extended to use sharp or jimp for image processing
 */
export const validateImageDimensions = async (
  _filePath: string,
  _maxWidth?: number,
  _maxHeight?: number
): Promise<boolean> => {
  // Placeholder for image dimension validation
  // In production, use libraries like 'sharp' or 'jimp'
  return true;
};
