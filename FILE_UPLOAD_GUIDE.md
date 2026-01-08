# File Upload System Guide

## Table of Contents
1. [Overview](#overview)
2. [Local Storage Setup](#local-storage-setup)
3. [API Endpoints](#api-endpoints)
4. [Image Optimization](#image-optimization)
5. [Frontend Integration](#frontend-integration)
6. [CDN Integration (Production)](#cdn-integration-production)
7. [Security Considerations](#security-considerations)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The file upload system in Patlinks is designed for handling menu item images with a focus on performance, security, and multi-tenancy support. It provides a robust solution for both development (local storage) and production (CDN integration) environments.

### Architecture & Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │────────▶│   Multer     │────────▶│  File       │
│  (React)    │         │  Middleware  │         │  System     │
└─────────────┘         └──────────────┘         └─────────────┘
                               │                         │
                               │                         │
                               ▼                         ▼
                        ┌──────────────┐         ┌─────────────┐
                        │  Validation  │         │   MongoDB   │
                        │  - Type      │         │  (metadata) │
                        │  - Size      │         └─────────────┘
                        │  - Security  │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Sharp      │
                        │  Processing  │
                        │  (Optional)  │
                        └──────────────┘
```

### Key Features

- Multi-tenant file isolation (per restaurant)
- Automatic file type validation (JPEG, PNG, WebP, GIF)
- Configurable file size limits (default: 5MB)
- Unique filename generation to prevent collisions
- Automatic cleanup on deletion
- Static file serving with caching
- Support for CDN integration (S3, Cloudinary)

---

## Local Storage Setup

### Folder Structure

The upload system uses a hierarchical folder structure organized by restaurant:

```
uploads/
├── .gitkeep
└── menu-items/
    ├── menu-item-1704672000000-123456789.jpg
    ├── menu-item-1704672001000-987654321.png
    └── menu-item-1704672002000-456789123.webp
```

**Note:** The current implementation stores all menu items in a single directory. For multi-tenant isolation, you can extend it to:

```
uploads/
├── {restaurantId1}/
│   └── menu-items/
│       └── menu-item-*.jpg
└── {restaurantId2}/
    └── menu-items/
        └── menu-item-*.jpg
```

### Supported Formats and Size Limits

#### Supported File Types

- **JPEG** (.jpg, .jpeg) - Best for photos
- **PNG** (.png) - Best for graphics with transparency
- **WebP** (.webp) - Modern format, better compression
- **GIF** (.gif) - Animated images

#### Size Limits

Default configuration from `.env`:

```bash
# Maximum file size in bytes (5MB default in multer config)
MAX_FILE_SIZE=5242880  # 5MB

# For larger files (configured in server.ts body parser)
# This handles base64 encoded images in JSON requests
EXPRESS_BODY_LIMIT=10mb
```

### How Multer Middleware Works

The multer middleware is configured in `/src/middleware/uploadMiddleware.ts`:

```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 1. Directory Setup
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const menuItemsDir = path.join(uploadDir, 'menu-items');

// Auto-create directory if it doesn't exist
if (!fs.existsSync(menuItemsDir)) {
  fs.mkdirSync(menuItemsDir, { recursive: true });
}

// 2. Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, menuItemsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: menu-item-{timestamp}-{random}.{ext}
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `menu-item-${uniqueSuffix}${ext}`);
  },
});

// 3. File Filter (Validation)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);  // Accept file
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// 4. Create Multer Instance
export const uploadMenuImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'),
  },
});
```

### Example Uploads

**Successful Upload:**
```
Original filename: burger-deluxe.jpg
Generated filename: menu-item-1704672000000-123456789.jpg
Stored path: ./uploads/menu-items/menu-item-1704672000000-123456789.jpg
Database path: /uploads/menu-items/menu-item-1704672000000-123456789.jpg
```

**Access URL:**
```
http://localhost:5000/uploads/menu-items/menu-item-1704672000000-123456789.jpg
```

---

## API Endpoints

### POST /api/menu/:id/image

Upload an image for a specific menu item.

**Access:** Private (Admin only)

**Authentication:** Required - JWT token in Authorization header

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Form data with 'image' field

**cURL Example:**
```bash
# Upload image for menu item
curl -X POST http://localhost:5000/api/menu/64abc123def456789/image \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-restaurant-id: YOUR_RESTAURANT_ID" \
  -F "image=@/path/to/burger.jpg"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123def456789",
    "restaurantId": "64xyz789abc123",
    "name": "Deluxe Burger",
    "description": "Our signature burger",
    "categoryId": "64cat123abc456",
    "price": 12.99,
    "image": "/uploads/menu-items/menu-item-1704672000000-123456789.jpg",
    "isAvailable": true,
    "isVegetarian": false,
    "isVegan": false,
    "isGlutenFree": false,
    "customizationOptions": [],
    "preparationTime": 15,
    "averageRating": 4.5,
    "ratingsCount": 25,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-08T00:00:00.000Z"
  }
}
```

**Error Responses:**
```json
// 400 - No file uploaded
{
  "success": false,
  "message": "No image file uploaded"
}

// 400 - Invalid file type
{
  "success": false,
  "message": "Only image files are allowed (jpeg, jpg, png, gif, webp)"
}

// 404 - Menu item not found
{
  "success": false,
  "message": "Menu item not found"
}

// 413 - File too large
{
  "success": false,
  "message": "File too large"
}
```

### GET /api/menu/:id

Get menu item details (including image URL).

**Access:** Public

**cURL Example:**
```bash
curl -X GET http://localhost:5000/api/menu/64abc123def456789 \
  -H "x-restaurant-id: YOUR_RESTAURANT_ID"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64abc123def456789",
    "restaurantId": "64xyz789abc123",
    "name": "Deluxe Burger",
    "image": "/uploads/menu-items/menu-item-1704672000000-123456789.jpg",
    "price": 12.99,
    // ... other fields
  }
}
```

### DELETE /api/menu/:id

Delete menu item (automatically deletes associated image).

**Access:** Private (Admin only)

**cURL Example:**
```bash
curl -X DELETE http://localhost:5000/api/menu/64abc123def456789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-restaurant-id: YOUR_RESTAURANT_ID"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Menu item deleted successfully"
}
```

**Note:** The image file is automatically deleted from the filesystem:

```typescript
// From menuController.ts
if (menuItem.image) {
  const imagePath = path.join(process.cwd(), menuItem.image);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);  // Delete file
  }
}
```

### Static File Access

Images are served through Express static middleware configured in `server.ts`:

```typescript
// Serve static files with caching
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1d',        // Cache for 1 day
  etag: true,          // Enable ETag headers
  lastModified: true,  // Enable Last-Modified headers
}));
```

**Direct Access:**
```
GET http://localhost:5000/uploads/menu-items/menu-item-1704672000000-123456789.jpg
```

---

## Image Optimization

### Current Implementation

The current system stores original images without processing. For production use, you should implement image optimization using Sharp.

### Recommended Sharp Integration

Install Sharp:
```bash
npm install sharp
```

### Example: Image Processing Service

Create `/src/services/imageProcessingService.ts`:

```typescript
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

interface ImageSizes {
  original: string;
  large: string;
  medium: string;
  small: string;
}

export class ImageProcessingService {
  private uploadDir: string;

  constructor(uploadDir: string = './uploads/menu-items') {
    this.uploadDir = uploadDir;
  }

  /**
   * Process uploaded image and generate multiple sizes
   */
  async processMenuImage(filePath: string): Promise<ImageSizes> {
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);

    const sizes = {
      original: filePath,
      large: path.join(fileDir, `${fileName}-large.webp`),
      medium: path.join(fileDir, `${fileName}-medium.webp`),
      small: path.join(fileDir, `${fileName}-small.webp`),
    };

    try {
      // Read original image
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Generate large version (1200px width, high quality)
      await image
        .clone()
        .resize(1200, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 90 })
        .toFile(sizes.large);

      // Generate medium version (800px width, medium quality)
      await image
        .clone()
        .resize(800, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 85 })
        .toFile(sizes.medium);

      // Generate small/thumbnail version (400px width, optimized)
      await image
        .clone()
        .resize(400, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 80 })
        .toFile(sizes.small);

      // Optionally convert original to WebP for consistency
      if (ext !== '.webp') {
        const webpOriginal = path.join(fileDir, `${fileName}.webp`);
        await image
          .clone()
          .webp({ quality: 95 })
          .toFile(webpOriginal);

        // Delete original non-WebP file
        fs.unlinkSync(filePath);
        sizes.original = webpOriginal;
      }

      return sizes;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Delete all image variants
   */
  async deleteImageVariants(imagePath: string): Promise<void> {
    const fileDir = path.dirname(imagePath);
    const fileName = path.basename(imagePath, path.extname(imagePath));

    const variants = [
      imagePath,
      path.join(fileDir, `${fileName}-large.webp`),
      path.join(fileDir, `${fileName}-medium.webp`),
      path.join(fileDir, `${fileName}-small.webp`),
    ];

    for (const variant of variants) {
      if (fs.existsSync(variant)) {
        fs.unlinkSync(variant);
      }
    }
  }

  /**
   * Optimize existing image (compress without resizing)
   */
  async optimizeImage(filePath: string, quality: number = 85): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    await sharp(filePath)
      .webp({ quality })
      .toFile(tempPath);

    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath.replace(path.extname(filePath), '.webp'));
  }
}

export default new ImageProcessingService();
```

### Updated Upload Controller with Sharp

Modify `/src/controllers/menuController.ts`:

```typescript
import imageProcessingService from '../services/imageProcessingService';

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
      return;
    }

    // Delete old image variants if they exist
    if (menuItem.image) {
      const oldImagePath = path.join(process.cwd(), menuItem.image);
      await imageProcessingService.deleteImageVariants(oldImagePath);
    }

    // Process image and generate variants
    const filePath = path.join(process.cwd(), 'uploads/menu-items', req.file.filename);
    const imageSizes = await imageProcessingService.processMenuImage(filePath);

    // Update menu item with image paths
    menuItem.images = {
      original: imageSizes.original.replace(process.cwd(), ''),
      large: imageSizes.large.replace(process.cwd(), ''),
      medium: imageSizes.medium.replace(process.cwd(), ''),
      small: imageSizes.small.replace(process.cwd(), ''),
    };

    await menuItem.save();

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
```

### Thumbnail Sizes

Recommended sizes for different use cases:

| Size | Width | Quality | Use Case |
|------|-------|---------|----------|
| **Original** | Original | 95% | Full-screen view, downloads |
| **Large** | 1200px | 90% | Product detail pages |
| **Medium** | 800px | 85% | Grid/list views on desktop |
| **Small** | 400px | 80% | Thumbnails, mobile views |

### WebP Conversion

WebP provides 25-35% better compression than JPEG/PNG:

**Benefits:**
- Smaller file sizes (faster loading)
- Maintains visual quality
- Supports transparency (like PNG)
- Broad browser support (97%+ globally)

**Fallback Strategy:**
```typescript
// Serve WebP with fallback
<picture>
  <source srcset={item.images.medium} type="image/webp" />
  <img src={item.image} alt={item.name} />
</picture>
```

### Quality Settings

Recommended quality settings by image type:

```typescript
const qualitySettings = {
  photo: {
    webp: 85,
    jpeg: 90,
  },
  graphic: {
    webp: 90,
    png: 95,
  },
  thumbnail: {
    webp: 80,
    jpeg: 85,
  },
};
```

---

## Frontend Integration

### Uploading from React (user-app)

Currently, the user-app displays images but doesn't include upload functionality (admin feature). For admin panel integration:

#### Example: Image Upload Component

```typescript
import React, { useState } from 'react';
import axios from 'axios';

interface ImageUploadProps {
  menuItemId: string;
  currentImage?: string;
  onUploadSuccess: (imageUrl: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  menuItemId,
  currentImage,
  onUploadSuccess,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post(
        `/api/menu/${menuItemId}/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 100)
            );
            setProgress(percentCompleted);
          },
        }
      );

      onUploadSuccess(response.data.data.image);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload image');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      {preview && (
        <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Upload Button */}
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-8 h-8 mb-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, WebP, or GIF (max 5MB)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload Status */}
      {uploading && (
        <p className="text-sm text-gray-600 text-center">
          Uploading... {progress}%
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
```

### Displaying Images with Thumbnails

Current implementation in `/src/components/MenuItem.tsx`:

```typescript
const MenuItem: React.FC<MenuItemProps> = ({ item, onClick }) => {
  return (
    <Card hover onClick={onClick}>
      {/* Image with fallback */}
      <div className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"  // Lazy loading
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">🍽️</span>
          </div>
        )}
      </div>
      {/* ... rest of component */}
    </Card>
  );
};
```

### Responsive Images with Multiple Sizes

If using the Sharp implementation with multiple sizes:

```typescript
interface MenuItemProps {
  item: {
    name: string;
    images?: {
      small: string;
      medium: string;
      large: string;
      original: string;
    };
    image?: string;  // Fallback
  };
}

const MenuItem: React.FC<MenuItemProps> = ({ item }) => {
  const getImageSrc = () => {
    if (item.images) {
      return {
        small: item.images.small,
        medium: item.images.medium,
        large: item.images.large,
      };
    }
    return {
      small: item.image,
      medium: item.image,
      large: item.image,
    };
  };

  const imageSrc = getImageSrc();

  return (
    <Card>
      <div className="relative h-56">
        <picture>
          {/* Responsive images */}
          <source
            media="(max-width: 640px)"
            srcSet={imageSrc.small}
          />
          <source
            media="(max-width: 1024px)"
            srcSet={imageSrc.medium}
          />
          <img
            src={imageSrc.large}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </picture>
      </div>
    </Card>
  );
};
```

### Handling Upload Progress

See the ImageUpload component example above, which includes:

```typescript
onUploadProgress: (progressEvent) => {
  const percentCompleted = Math.round(
    (progressEvent.loaded * 100) / (progressEvent.total || 100)
  );
  setProgress(percentCompleted);
}
```

### Error Handling

Comprehensive error handling example:

```typescript
const handleUploadError = (error: any) => {
  if (error.response) {
    // Server responded with error
    switch (error.response.status) {
      case 400:
        return 'Invalid file format or no file selected';
      case 401:
        return 'Please log in to upload images';
      case 404:
        return 'Menu item not found';
      case 413:
        return 'File is too large (max 5MB)';
      case 500:
        return 'Server error. Please try again later';
      default:
        return error.response.data?.message || 'Upload failed';
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection';
  } else {
    // Error in request setup
    return 'An unexpected error occurred';
  }
};
```

---

## CDN Integration (Production)

### When to Use CDN vs Local Storage

| Feature | Local Storage | CDN (S3/Cloudinary) |
|---------|--------------|---------------------|
| **Development** | ✅ Recommended | ❌ Not needed |
| **Small Scale** | ✅ OK (<1000 images) | ⚠️ Optional |
| **Production** | ⚠️ Limited | ✅ Recommended |
| **Scale** | ❌ Not scalable | ✅ Highly scalable |
| **Performance** | ⚠️ Single server | ✅ Global CDN |
| **Cost** | ✅ Free (hosting) | 💲 Pay per use |
| **Backup** | ❌ Manual | ✅ Automatic |
| **Transformations** | ❌ Manual | ✅ On-the-fly |

**Use CDN when:**
- Serving 1000+ images
- Users are geographically distributed
- Need automatic backups and redundancy
- Want on-the-fly image transformations
- Scaling to multiple servers

**Use Local Storage when:**
- Development environment
- Small-scale deployments
- Single server setup
- Cost is a primary concern

### AWS S3 Setup Instructions

#### 1. Install AWS SDK

```bash
npm install aws-sdk
```

#### 2. Create S3 Service

Create `/src/services/s3Service.ts`:

```typescript
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

class S3Service {
  private s3: AWS.S3;
  private bucket: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucket = process.env.AWS_S3_BUCKET || '';
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    filePath: string,
    key: string,
    contentType: string
  ): Promise<string> {
    const fileContent = fs.readFileSync(filePath);

    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read', // or 'private' with signed URLs
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: this.bucket,
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }

  /**
   * Generate signed URL for private files
   */
  getSignedUrl(key: string, expiresIn: number = 3600): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn, // URL valid for 1 hour
    });
  }

  /**
   * Get public URL
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}

export default new S3Service();
```

#### 3. Update Upload Controller

```typescript
import s3Service from '../services/s3Service';

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem || !req.file) {
      // ... validation
      return;
    }

    // Upload to S3
    const key = `menu-items/${req.restaurantId}/${req.file.filename}`;
    const s3Url = await s3Service.uploadFile(
      req.file.path,
      key,
      req.file.mimetype
    );

    // Delete old image from S3
    if (menuItem.image) {
      const oldKey = menuItem.image.split('.com/')[1];
      await s3Service.deleteFile(oldKey);
    }

    // Update menu item
    menuItem.image = s3Url;
    await menuItem.save();

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
```

#### 4. Environment Variables

Add to `.env`:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=patlinks-uploads

# Storage mode: 'local' or 's3'
STORAGE_MODE=s3
```

### Cloudinary Setup Instructions

#### 1. Install Cloudinary SDK

```bash
npm install cloudinary
```

#### 2. Create Cloudinary Service

Create `/src/services/cloudinaryService.ts`:

```typescript
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(
    filePath: string,
    folder: string = 'menu-items'
  ): Promise<any> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }, // Auto WebP
        ],
        responsive_breakpoints: [
          {
            create_derived: true,
            bytes_step: 20000,
            min_width: 200,
            max_width: 1200,
            max_images: 4,
          },
        ],
      });

      return result;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  /**
   * Get optimized URL
   */
  getOptimizedUrl(
    publicId: string,
    width?: number,
    height?: number
  ): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
    });
  }
}

export default new CloudinaryService();
```

#### 3. Update Upload Controller

```typescript
import cloudinaryService from '../services/cloudinaryService';

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem || !req.file) {
      // ... validation
      return;
    }

    // Upload to Cloudinary
    const folder = `${req.restaurantId}/menu-items`;
    const result = await cloudinaryService.uploadImage(req.file.path, folder);

    // Delete old image from Cloudinary
    if (menuItem.image) {
      const publicId = menuItem.image.split('/').slice(-2).join('/').split('.')[0];
      await cloudinaryService.deleteImage(publicId);
    }

    // Update menu item with responsive breakpoints
    menuItem.images = {
      original: result.secure_url,
      large: result.responsive_breakpoints[0]?.breakpoints[0]?.secure_url,
      medium: result.responsive_breakpoints[0]?.breakpoints[1]?.secure_url,
      small: result.responsive_breakpoints[0]?.breakpoints[2]?.secure_url,
    };

    await menuItem.save();

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
```

#### 4. Environment Variables

Add to `.env`:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Storage mode
STORAGE_MODE=cloudinary
```

### Migration from Local to CDN

Script to migrate existing images to CDN:

Create `/src/scripts/migrateToS3.ts`:

```typescript
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem';
import s3Service from '../services/s3Service';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const migrateImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');

    const menuItems = await MenuItem.find({ image: { $exists: true, $ne: null } });
    console.log(`Found ${menuItems.length} menu items with images`);

    let migrated = 0;
    let failed = 0;

    for (const item of menuItems) {
      try {
        const localPath = path.join(process.cwd(), item.image);

        if (!fs.existsSync(localPath)) {
          console.log(`File not found: ${localPath}`);
          failed++;
          continue;
        }

        // Upload to S3
        const key = `menu-items/${item.restaurantId}/${path.basename(item.image)}`;
        const s3Url = await s3Service.uploadFile(
          localPath,
          key,
          'image/jpeg'
        );

        // Update database
        item.image = s3Url;
        await item.save();

        migrated++;
        console.log(`Migrated: ${item.name} (${migrated}/${menuItems.length})`);
      } catch (error) {
        console.error(`Failed to migrate ${item.name}:`, error);
        failed++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Failed: ${failed}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

migrateImages();
```

Run migration:

```bash
npm run migrate:s3
```

---

## Security Considerations

### File Type Validation

**Server-side validation** (current implementation):

```typescript
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;

  // Check extension
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  // Check MIME type
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};
```

**Enhanced validation** with file signature checking:

```typescript
import fileType from 'file-type';

const validateFileSignature = async (filePath: string): Promise<boolean> => {
  const type = await fileType.fromFile(filePath);

  if (!type) return false;

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return allowed.includes(type.mime);
};
```

### Size Limits

Multiple layers of size protection:

1. **Multer middleware** (immediate rejection):
```typescript
limits: {
  fileSize: 5 * 1024 * 1024, // 5MB
}
```

2. **Express body parser** (for base64 uploads):
```typescript
app.use(express.json({ limit: '10mb' }));
```

3. **Nginx/Reverse proxy** (in production):
```nginx
client_max_body_size 10M;
```

### Virus Scanning

#### Recommended: ClamAV Integration

Install ClamAV:
```bash
# Ubuntu/Debian
sudo apt-get install clamav clamav-daemon

# macOS
brew install clamav
```

Create virus scanning service:

```typescript
import { NodeClam } from 'clamscan';

class VirusScanService {
  private clam: any;

  async initialize() {
    this.clam = await new NodeClam().init({
      clamdscan: {
        path: '/usr/bin/clamdscan',
        multiscan: true,
      },
    });
  }

  async scanFile(filePath: string): Promise<boolean> {
    try {
      const { isInfected, viruses } = await this.clam.isInfected(filePath);

      if (isInfected) {
        console.error(`Virus detected: ${viruses.join(', ')}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Virus scan error:', error);
      return false;
    }
  }
}

export default new VirusScanService();
```

Update upload controller:

```typescript
import virusScanService from '../services/virusScanService';

export const uploadImage = async (req: Request, res: Response) => {
  // ... file validation

  // Scan for viruses
  const isSafe = await virusScanService.scanFile(req.file.path);

  if (!isSafe) {
    fs.unlinkSync(req.file.path); // Delete infected file
    res.status(400).json({
      success: false,
      message: 'File failed security scan',
    });
    return;
  }

  // ... continue with upload
};
```

### Access Control

#### Multi-tenant Isolation

Current implementation ensures tenant isolation:

```typescript
// CRITICAL: Always validate restaurantId
const menuItem = await MenuItem.findOne({
  _id: req.params.id,
  restaurantId: req.restaurantId, // From auth token
});
```

#### File System Isolation

Prevent path traversal attacks:

```typescript
const sanitizePath = (filename: string): string => {
  // Remove any path components
  return path.basename(filename);
};

const validatePath = (filePath: string): boolean => {
  const normalized = path.normalize(filePath);
  const uploadDir = path.normalize(process.env.UPLOAD_DIR || './uploads');

  // Ensure path is within upload directory
  return normalized.startsWith(uploadDir);
};
```

### Signed URLs for Private Images

For private/premium content:

```typescript
import crypto from 'crypto';

class SignedUrlService {
  private secret: string;

  constructor() {
    this.secret = process.env.URL_SIGNATURE_SECRET || 'change-me';
  }

  /**
   * Generate signed URL
   */
  generateSignedUrl(
    imagePath: string,
    expiresIn: number = 3600
  ): string {
    const expires = Date.now() + expiresIn * 1000;
    const signature = this.generateSignature(imagePath, expires);

    return `${imagePath}?expires=${expires}&signature=${signature}`;
  }

  /**
   * Validate signed URL
   */
  validateSignedUrl(
    imagePath: string,
    expires: number,
    signature: string
  ): boolean {
    // Check expiration
    if (Date.now() > expires) {
      return false;
    }

    // Verify signature
    const expectedSignature = this.generateSignature(imagePath, expires);
    return signature === expectedSignature;
  }

  private generateSignature(path: string, expires: number): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`${path}:${expires}`)
      .digest('hex');
  }
}

export default new SignedUrlService();
```

Middleware to validate signed URLs:

```typescript
export const validateSignedUrl = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { expires, signature } = req.query;

  if (!expires || !signature) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }

  const isValid = signedUrlService.validateSignedUrl(
    req.path,
    parseInt(expires as string),
    signature as string
  );

  if (!isValid) {
    res.status(403).json({ message: 'Invalid or expired URL' });
    return;
  }

  next();
};
```

---

## Best Practices

### 1. Use Thumbnails for Lists

Always use optimized thumbnails in list/grid views:

```typescript
// Bad - loads full image
<img src={item.image} alt={item.name} />

// Good - loads optimized thumbnail
<img src={item.images?.small || item.image} alt={item.name} />
```

### 2. Lazy Loading Images

Implement lazy loading for images below the fold:

```typescript
<img
  src={item.image}
  alt={item.name}
  loading="lazy"
  decoding="async"
/>
```

Or use Intersection Observer for more control:

```typescript
const LazyImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isLoaded ? src : '/placeholder.jpg'}
      alt={alt}
      className="w-full h-full object-cover"
    />
  );
};
```

### 3. Image Optimization Before Upload (Frontend)

Compress images client-side before upload:

```typescript
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Compression error:', error);
    return file;
  }
};

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Compress before upload
  const compressed = await compressImage(file);
  await uploadImage(compressed);
};
```

### 4. Caching Strategies

#### Server-side Caching

Already implemented in `server.ts`:

```typescript
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1d',          // Browser cache: 1 day
  etag: true,            // ETag for validation
  lastModified: true,    // Last-Modified header
}));
```

#### CDN Caching

Configure CDN cache headers:

```typescript
const s3Params = {
  Bucket: bucket,
  Key: key,
  Body: fileContent,
  ContentType: contentType,
  CacheControl: 'public, max-age=31536000', // 1 year
  Metadata: {
    'uploaded-at': new Date().toISOString(),
  },
};
```

#### Client-side Caching

Use service workers for offline support:

```typescript
// service-worker.js
const CACHE_NAME = 'images-v1';

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/uploads/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
```

### 5. Cleanup of Unused Images

Create cleanup script:

```typescript
import MenuItem from '../models/MenuItem';
import fs from 'fs';
import path from 'path';

const cleanupUnusedImages = async () => {
  const uploadDir = path.join(process.cwd(), 'uploads/menu-items');
  const files = fs.readdirSync(uploadDir);

  // Get all image paths from database
  const menuItems = await MenuItem.find({}, 'image');
  const usedImages = new Set(
    menuItems
      .map(item => item.image)
      .filter(Boolean)
      .map(img => path.basename(img))
  );

  // Delete unused files
  let deleted = 0;
  for (const file of files) {
    if (file !== '.gitkeep' && !usedImages.has(file)) {
      fs.unlinkSync(path.join(uploadDir, file));
      deleted++;
      console.log(`Deleted unused file: ${file}`);
    }
  }

  console.log(`Cleanup complete. Deleted ${deleted} unused images.`);
};

cleanupUnusedImages();
```

Schedule with cron:

```typescript
import cron from 'node-cron';

// Run cleanup every Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
  console.log('Running image cleanup...');
  await cleanupUnusedImages();
});
```

---

## Troubleshooting

### Common Errors and Solutions

#### 1. "MulterError: File too large"

**Cause:** File exceeds size limit

**Solution:**
```bash
# Increase limit in .env
MAX_FILE_SIZE=10485760  # 10MB

# Or in multer config
limits: {
  fileSize: 10 * 1024 * 1024,
}
```

#### 2. "Only image files are allowed"

**Cause:** Invalid file type or corrupted file

**Solution:**
- Check file extension matches content
- Try re-saving the image
- Ensure MIME type is correct
- Verify file isn't corrupted

```bash
# Check file type on server
file /path/to/uploaded/file
```

#### 3. "ENOENT: no such file or directory"

**Cause:** Upload directory doesn't exist

**Solution:**
```bash
# Create directory manually
mkdir -p uploads/menu-items

# Or ensure auto-creation in code
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
```

#### 4. "Request Entity Too Large"

**Cause:** Express body parser limit

**Solution:**
```typescript
// Increase body parser limit in server.ts
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

#### 5. "CORS Error"

**Cause:** Cross-origin request blocked

**Solution:**
```typescript
// Update CORS config in server.ts
const corsOptions = {
  origin: ['http://localhost:5173', 'https://yourapp.com'],
  credentials: true,
};
app.use(cors(corsOptions));
```

### Permission Issues

#### Linux/Unix Permission Errors

```bash
# Error: EACCES: permission denied
sudo chown -R $USER:$USER uploads/
chmod -R 755 uploads/
```

#### Docker Permission Issues

```dockerfile
# In Dockerfile
RUN mkdir -p /app/uploads && \
    chown -R node:node /app/uploads

USER node
```

### Memory Limits

#### Node.js Heap Out of Memory

```bash
# Increase Node memory limit
node --max-old-space-size=4096 dist/server.js

# Or in package.json
"start": "node --max-old-space-size=4096 dist/server.js"
```

#### Sharp Memory Issues

```typescript
// Limit Sharp concurrency
import sharp from 'sharp';

sharp.concurrency(1); // Process one image at a time
sharp.cache(false);   // Disable cache for low-memory systems
```

### Upload Timeouts

#### Nginx Timeout

```nginx
# /etc/nginx/nginx.conf
client_body_timeout 300s;
client_header_timeout 300s;
proxy_read_timeout 300s;
```

#### Express/Multer Timeout

```typescript
import timeout from 'connect-timeout';

// Set timeout middleware
app.use(timeout('300s')); // 5 minutes

// Upload route with extended timeout
router.post('/:id/image',
  timeout('300s'),
  uploadMenuImage.single('image'),
  uploadImage
);
```

#### Frontend Timeout

```typescript
const response = await axios.post(
  url,
  formData,
  {
    timeout: 300000, // 5 minutes
  }
);
```

### Debugging Tips

#### Enable Detailed Logging

```typescript
// Add logging middleware
app.use((req, res, next) => {
  if (req.file) {
    console.log('File upload:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      destination: req.file.destination,
      filename: req.file.filename,
    });
  }
  next();
});
```

#### Test Upload with cURL

```bash
# Test upload endpoint
curl -v -X POST http://localhost:5000/api/menu/MENU_ITEM_ID/image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-restaurant-id: RESTAURANT_ID" \
  -F "image=@test-image.jpg"
```

#### Check File System

```bash
# Verify uploads directory
ls -la uploads/menu-items/

# Check disk space
df -h

# Monitor real-time uploads
watch -n 1 'ls -lh uploads/menu-items/'
```

---

## Summary

This file upload system provides:

- **Secure** multi-tenant file handling with validation
- **Flexible** storage options (local, S3, Cloudinary)
- **Scalable** architecture supporting image optimization
- **Production-ready** with caching, compression, and CDN integration
- **Developer-friendly** with comprehensive error handling

### Quick Start Checklist

- [ ] Configure `.env` with upload settings
- [ ] Ensure `uploads/menu-items/` directory exists
- [ ] Test upload endpoint with sample image
- [ ] Verify images display in frontend
- [ ] Configure CDN for production (optional)
- [ ] Set up image optimization with Sharp (recommended)
- [ ] Implement virus scanning for production
- [ ] Configure cleanup script for unused images
- [ ] Set up monitoring and logging
- [ ] Test error scenarios and edge cases

### Next Steps

1. **Development:** Use local storage with current implementation
2. **Testing:** Implement Sharp for image optimization
3. **Security:** Add virus scanning and enhanced validation
4. **Production:** Migrate to S3/Cloudinary with CDN
5. **Monitoring:** Set up error tracking and performance monitoring

For additional help, refer to:
- [Admin API Documentation](./ADMIN_API_DOCUMENTATION.md)
- [Express Multer Documentation](https://github.com/expressjs/multer)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
