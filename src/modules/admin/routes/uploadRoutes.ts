import * as express from 'express';
import {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getImage,
  listImages,
} from '../controllers/uploadController';
import {
  uploadSingleImage,
  uploadMultipleImages as uploadMultipleMiddleware,
} from '../../common/middleware/uploadMiddleware';
import { authMiddleware } from '../../common/middleware/authMiddleware';
import { validateTenant } from '../../common/middleware/tenantMiddleware';

const router = express.Router();

/**
 * ============================================
 * UPLOAD ROUTES (TENANT-SCOPED)
 * ============================================
 *
 * All upload routes are tenant-scoped and use the restaurant context
 * extracted from subdomain by the tenant middleware.
 *
 * File Storage Structure:
 * uploads/
 *   {restaurantId}/
 *     {timestamp}-{random}.{ext}
 *
 * Authentication:
 * - Upload/Delete: Requires authentication (admin or staff)
 * - Get: Public access (for displaying images on menu)
 * - List: Requires authentication
 */

// ====================
// PUBLIC ROUTES
// ====================

/**
 * @route   GET /api/upload/:restaurantId/:filename
 * @desc    Serve uploaded image (public)
 * @access  Public
 * @example GET /api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg
 */
router.get('/:restaurantId/:filename', getImage);

// ====================
// PROTECTED ROUTES (Require Authentication)
// ====================

// Apply authentication middleware to all routes below
router.use(authMiddleware);
router.use(validateTenant);

/**
 * @route   POST /api/upload/image
 * @desc    Upload single image (tenant-scoped)
 * @access  Private (Admin/Staff)
 * @body    multipart/form-data with 'image' field
 * @returns { success, message, data: { filename, path, url, size } }
 *
 * @example
 * POST /api/upload/image
 * Content-Type: multipart/form-data
 * Authorization: Bearer {token}
 *
 * FormData:
 *   image: [File]
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Image uploaded successfully",
 *   "data": {
 *     "filename": "1704123456789-abc123def456.jpg",
 *     "path": "507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *     "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *     "size": 245678,
 *     "mimetype": "image/jpeg",
 *     "originalName": "menu-item.jpg"
 *   }
 * }
 */
router.post('/image', uploadSingleImage, uploadImage);

/**
 * @route   POST /api/upload/images
 * @desc    Upload multiple images (tenant-scoped)
 * @access  Private (Admin/Staff)
 * @body    multipart/form-data with 'images' field (array)
 * @returns { success, message, count, data: [{ filename, path, url, size }, ...] }
 *
 * @example
 * POST /api/upload/images
 * Content-Type: multipart/form-data
 * Authorization: Bearer {token}
 *
 * FormData:
 *   images: [File, File, File]
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Successfully uploaded 3 image(s)",
 *   "count": 3,
 *   "data": [
 *     {
 *       "filename": "1704123456789-abc123def456.jpg",
 *       "path": "507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *       "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *       "size": 245678,
 *       "mimetype": "image/jpeg",
 *       "originalName": "image1.jpg"
 *     },
 *     ...
 *   ]
 * }
 */
router.post('/images', uploadMultipleMiddleware, uploadMultipleImages);

/**
 * @route   GET /api/upload/images
 * @desc    List all images for current restaurant (tenant-scoped)
 * @access  Private (Admin/Staff)
 * @returns { success, count, data: [{ filename, path, url, size, createdAt }, ...] }
 *
 * @example
 * GET /api/upload/images
 * Authorization: Bearer {token}
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Images retrieved successfully",
 *   "count": 5,
 *   "data": [
 *     {
 *       "filename": "1704123456789-abc123def456.jpg",
 *       "path": "507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *       "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
 *       "size": 245678,
 *       "createdAt": "2024-01-01T12:30:56.789Z",
 *       "modifiedAt": "2024-01-01T12:30:56.789Z"
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/images', listImages);

/**
 * @route   DELETE /api/upload/image/:filename
 * @desc    Delete uploaded image (tenant-scoped)
 * @access  Private (Admin/Staff)
 * @params  filename - Name of the file to delete (not full path)
 * @returns { success, message }
 *
 * Security:
 * - Only allows deletion of images in the current restaurant's folder
 * - Filename validation prevents directory traversal
 *
 * @example
 * DELETE /api/upload/image/1704123456789-abc123def456.jpg
 * Authorization: Bearer {token}
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Image deleted successfully"
 * }
 */
router.delete('/image/:filename', deleteImage);

/**
 * Error Handling for Multer
 *
 * Multer errors are handled by the error handler middleware,
 * but here are the common errors:
 *
 * - LIMIT_FILE_SIZE: File size exceeds 5MB limit
 * - LIMIT_FILE_COUNT: Too many files (max 10 for multiple upload)
 * - LIMIT_UNEXPECTED_FILE: Wrong field name (use 'image' or 'images')
 * - Invalid file type: Only jpg, jpeg, png, gif, webp allowed
 */

export default router;
