import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { deleteFile, fileExists, getFileSize } from '../../common/middleware/uploadMiddleware';

// Base upload directory
const BASE_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * @desc    Upload single image (tenant-scoped)
 * @route   POST /api/upload/image
 * @access  Private (requires authentication)
 *
 * Usage:
 * - Menu item images
 * - Restaurant logos
 * - Profile pictures
 *
 * Request: multipart/form-data with 'image' field
 * Response: { success, message, data: { filename, path, url, size } }
 */
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file provided. Please upload an image.',
        code: 'NO_FILE_UPLOADED',
      });
      return;
    }

    // Validate tenant context
    if (!req.restaurantId) {
      // Clean up uploaded file if tenant validation fails
      await deleteFile(req.file.path);

      res.status(400).json({
        success: false,
        message: 'Restaurant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }

    const restaurantId = req.restaurantId.toString();
    const filename = req.file.filename;
    const relativePath = `${restaurantId}/${filename}`;
    const fileSize = getFileSize(req.file.path);

    // Generate URL for accessing the image
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${baseUrl}/api/upload/${relativePath}`;

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        filename,
        path: relativePath,
        url: imageUrl,
        size: fileSize,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
      },
    });
  } catch (error: any) {
    // Clean up file on error
    if (req.file) {
      await deleteFile(req.file.path).catch(() => {});
    }

    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
};

/**
 * @desc    Upload multiple images (tenant-scoped)
 * @route   POST /api/upload/images
 * @access  Private (requires authentication)
 *
 * Usage:
 * - Multiple menu item images
 * - Gallery uploads
 *
 * Request: multipart/form-data with 'images' field (array)
 * Response: { success, message, data: [{ filename, path, url, size }, ...] }
 */
export const uploadMultipleImages = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if files were uploaded
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No image files provided. Please upload at least one image.',
        code: 'NO_FILES_UPLOADED',
      });
      return;
    }

    // Validate tenant context
    if (!req.restaurantId) {
      // Clean up uploaded files if tenant validation fails
      for (const file of files) {
        await deleteFile(file.path).catch(() => {});
      }

      res.status(400).json({
        success: false,
        message: 'Restaurant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }

    const restaurantId = req.restaurantId.toString();
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

    // Process all uploaded files
    const uploadedFiles = files.map((file) => {
      const filename = file.filename;
      const relativePath = `${restaurantId}/${filename}`;
      const fileSize = getFileSize(file.path);
      const imageUrl = `${baseUrl}/api/upload/${relativePath}`;

      return {
        filename,
        path: relativePath,
        url: imageUrl,
        size: fileSize,
        mimetype: file.mimetype,
        originalName: file.originalname,
      };
    });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${files.length} image(s)`,
      count: files.length,
      data: uploadedFiles,
    });
  } catch (error: any) {
    // Clean up files on error
    const files = req.files as Express.Multer.File[];
    if (files) {
      for (const file of files) {
        await deleteFile(file.path).catch(() => {});
      }
    }

    console.error('Upload multiple images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete uploaded image (tenant-scoped)
 * @route   DELETE /api/upload/image/:filename
 * @access  Private (requires authentication)
 *
 * Security:
 * - Only allows deletion of images in the current restaurant's folder
 * - Validates filename to prevent directory traversal attacks
 *
 * Response: { success, message }
 */
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate tenant context
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }

    // Validate filename (prevent directory traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        message: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
      return;
    }

    const restaurantId = req.restaurantId.toString();
    const filePath = path.join(BASE_UPLOAD_DIR, restaurantId, filename);

    // Check if file exists
    if (!fileExists(filePath)) {
      res.status(404).json({
        success: false,
        message: 'Image not found',
        code: 'FILE_NOT_FOUND',
      });
      return;
    }

    // Delete the file
    await deleteFile(filePath);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message,
    });
  }
};

/**
 * @desc    Serve uploaded image
 * @route   GET /api/upload/:restaurantId/:filename
 * @access  Public
 *
 * Purpose:
 * - Serve images to clients
 * - Public access for menu display
 * - Validates restaurant and filename
 *
 * Response: Image file with proper content-type headers
 */
export const getImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, filename } = req.params;

    // Validate parameters
    if (!restaurantId || !filename) {
      res.status(400).json({
        success: false,
        message: 'Missing restaurantId or filename',
        code: 'INVALID_PARAMETERS',
      });
      return;
    }

    // Validate filename (prevent directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        message: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
      return;
    }

    const filePath = path.join(BASE_UPLOAD_DIR, restaurantId, filename);

    // Check if file exists
    if (!fileExists(filePath)) {
      res.status(404).json({
        success: false,
        message: 'Image not found',
        code: 'FILE_NOT_FOUND',
      });
      return;
    }

    // Set caching headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.setHeader('ETag', `"${filename}"`);

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file',
          error: error.message,
        });
      }
    });
  } catch (error: any) {
    console.error('Get image error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve image',
        error: error.message,
      });
    }
  }
};

/**
 * @desc    List all images for a restaurant (tenant-scoped)
 * @route   GET /api/upload/images
 * @access  Private (requires authentication)
 *
 * Purpose:
 * - View all uploaded images for the current restaurant
 * - Useful for image management interfaces
 *
 * Response: { success, count, data: [{ filename, path, url, size, createdAt }, ...] }
 */
export const listImages = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate tenant context
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }

    const restaurantId = req.restaurantId.toString();
    const uploadDir = path.join(BASE_UPLOAD_DIR, restaurantId);

    // Check if directory exists
    if (!fs.existsSync(uploadDir)) {
      res.status(200).json({
        success: true,
        message: 'No images found',
        count: 0,
        data: [],
      });
      return;
    }

    // Read directory
    const files = fs.readdirSync(uploadDir);
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

    // Get file details
    const imageFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map((file) => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        const relativePath = `${restaurantId}/${file}`;
        const imageUrl = `${baseUrl}/api/upload/${relativePath}`;

        return {
          filename: file,
          path: relativePath,
          url: imageUrl,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by newest first

    res.status(200).json({
      success: true,
      message: 'Images retrieved successfully',
      count: imageFiles.length,
      data: imageFiles,
    });
  } catch (error: any) {
    console.error('List images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list images',
      error: error.message,
    });
  }
};
