# File Upload System API Documentation

Complete API documentation for the tenant-scoped file upload system in the Patlinks backend.

## Overview

The file upload system provides secure, tenant-isolated image management for the Patlinks multi-tenant food ordering platform. All uploads are automatically scoped to the current restaurant context.

### Key Features

- **Tenant Isolation**: Each restaurant has its own dedicated upload directory
- **Security**: JWT authentication, file validation, and path traversal protection
- **Format Support**: JPEG, PNG, GIF, WebP images
- **Size Limits**: 5MB per file, 10 files max per batch
- **Public Access**: Images are publicly accessible via GET endpoint
- **File Management**: Upload, list, serve, and delete operations

---

## Base URL

```
Development: http://localhost:5000/api/upload
Production: https://api.patlinks.com/api/upload
```

---

## Authentication

Most endpoints require JWT authentication via Bearer token in the Authorization header.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

**Exception:** The GET endpoint for serving images is public and does not require authentication.

---

## API Endpoints

### 1. Upload Single Image

Upload a single image file (menu items, logos, etc.)

**Endpoint:** `POST /api/upload/image`

**Authentication:** Required (Admin/Staff)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `image` (file, required): Image file to upload

**File Constraints:**
- Maximum size: 5MB
- Allowed formats: jpg, jpeg, png, gif, webp
- MIME type validation: image/jpeg, image/png, image/gif, image/webp

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "filename": "1704123456789-abc123def456.jpg",
    "path": "507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
    "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
    "size": 245678,
    "mimetype": "image/jpeg",
    "originalName": "menu-item.jpg"
  }
}
```

**Error Responses:**

*No file provided (400):*
```json
{
  "success": false,
  "message": "No image file provided. Please upload an image.",
  "code": "NO_FILE_UPLOADED"
}
```

*File too large (400):*
```json
{
  "success": false,
  "message": "File size exceeds limit of 5MB"
}
```

*Invalid file type (400):*
```json
{
  "success": false,
  "message": "Invalid file type. Only image/jpeg, image/jpg, image/png, image/gif, image/webp are allowed."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/upload/image \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('http://localhost:5000/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log(result.data.url); // Image URL
```

---

### 2. Upload Multiple Images

Upload multiple image files in a single request

**Endpoint:** `POST /api/upload/images`

**Authentication:** Required (Admin/Staff)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `images` (files array, required): Multiple image files to upload

**File Constraints:**
- Maximum size per file: 5MB
- Maximum files per request: 10
- Allowed formats: jpg, jpeg, png, gif, webp

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully uploaded 3 image(s)",
  "count": 3,
  "data": [
    {
      "filename": "1704123456789-abc123def456.jpg",
      "path": "507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
      "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg",
      "size": 245678,
      "mimetype": "image/jpeg",
      "originalName": "image1.jpg"
    },
    {
      "filename": "1704123456790-xyz789ghi012.png",
      "path": "507f1f77bcf86cd799439011/1704123456790-xyz789ghi012.png",
      "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456790-xyz789ghi012.png",
      "size": 156789,
      "mimetype": "image/png",
      "originalName": "image2.png"
    },
    {
      "filename": "1704123456791-mno345pqr678.webp",
      "path": "507f1f77bcf86cd799439011/1704123456791-mno345pqr678.webp",
      "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456791-mno345pqr678.webp",
      "size": 198234,
      "mimetype": "image/webp",
      "originalName": "image3.webp"
    }
  ]
}
```

**Error Responses:**

*No files provided (400):*
```json
{
  "success": false,
  "message": "No image files provided. Please upload at least one image.",
  "code": "NO_FILES_UPLOADED"
}
```

*Too many files (400):*
```json
{
  "success": false,
  "message": "Too many files. Maximum 10 files allowed per upload."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/upload/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png" \
  -F "images=@/path/to/image3.webp"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
imageFiles.forEach(file => {
  formData.append('images', file);
});

const response = await fetch('http://localhost:5000/api/upload/images', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log(`Uploaded ${result.count} images`);
```

---

### 3. Get Image (Serve)

Serve an uploaded image (publicly accessible)

**Endpoint:** `GET /api/upload/:restaurantId/:filename`

**Authentication:** None (Public)

**URL Parameters:**
- `restaurantId` (string, required): Restaurant ID (MongoDB ObjectId)
- `filename` (string, required): Image filename

**Response:** Binary image data with appropriate Content-Type header

**Headers:**
- `Content-Type`: image/jpeg | image/png | image/gif | image/webp
- `Cache-Control`: public, max-age=86400 (1 day)
- `ETag`: Filename-based ETag for caching

**Error Responses:**

*Image not found (404):*
```json
{
  "success": false,
  "message": "Image not found",
  "code": "FILE_NOT_FOUND"
}
```

*Invalid filename (400):*
```json
{
  "success": false,
  "message": "Invalid filename",
  "code": "INVALID_FILENAME"
}
```

**Usage Examples:**

*Direct image URL:*
```html
<img src="http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg" alt="Menu Item" />
```

*cURL:*
```bash
curl http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg \
  --output downloaded-image.jpg
```

---

### 4. List Images

Get a list of all images for the current restaurant

**Endpoint:** `GET /api/upload/images`

**Authentication:** Required (Admin/Staff)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Images retrieved successfully",
  "count": 5,
  "data": [
    {
      "filename": "1704123456791-mno345pqr678.webp",
      "path": "507f1f77bcf86cd799439011/1704123456791-mno345pqr678.webp",
      "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456791-mno345pqr678.webp",
      "size": 198234,
      "createdAt": "2024-01-01T12:35:56.791Z",
      "modifiedAt": "2024-01-01T12:35:56.791Z"
    },
    {
      "filename": "1704123456790-xyz789ghi012.png",
      "path": "507f1f77bcf86cd799439011/1704123456790-xyz789ghi012.png",
      "url": "http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456790-xyz789ghi012.png",
      "size": 156789,
      "createdAt": "2024-01-01T12:34:56.790Z",
      "modifiedAt": "2024-01-01T12:34:56.790Z"
    },
    ...
  ]
}
```

**Notes:**
- Images are sorted by newest first (descending creation time)
- Only includes image files (jpg, jpeg, png, gif, webp)
- Tenant-scoped (only shows current restaurant's images)

**cURL Example:**
```bash
curl http://localhost:5000/api/upload/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 5. Delete Image

Delete an uploaded image

**Endpoint:** `DELETE /api/upload/image/:filename`

**Authentication:** Required (Admin/Staff)

**URL Parameters:**
- `filename` (string, required): Image filename (not full path)

**Security:**
- Only deletes files from the current restaurant's directory
- Filename validation prevents directory traversal attacks
- Requires authentication

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Error Responses:**

*Image not found (404):*
```json
{
  "success": false,
  "message": "Image not found",
  "code": "FILE_NOT_FOUND"
}
```

*Invalid filename (400):*
```json
{
  "success": false,
  "message": "Invalid filename",
  "code": "INVALID_FILENAME"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:5000/api/upload/image/1704123456789-abc123def456.jpg \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript Example:**
```javascript
const response = await fetch(
  `http://localhost:5000/api/upload/image/${filename}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const result = await response.json();
console.log(result.message);
```

---

## Error Handling

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NO_FILE_UPLOADED` | 400 | No file provided in request |
| `NO_FILES_UPLOADED` | 400 | No files provided in multiple upload |
| `INVALID_FILENAME` | 400 | Filename contains invalid characters |
| `INVALID_PARAMETERS` | 400 | Missing or invalid parameters |
| `FILE_NOT_FOUND` | 404 | Requested file does not exist |
| `TENANT_CONTEXT_MISSING` | 400 | Restaurant context not found |
| `NO_TOKEN` | 401 | No authentication token provided |
| `INVALID_TOKEN` | 401 | JWT token is invalid |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `RESTAURANT_MISMATCH` | 403 | Token restaurant doesn't match context |

### Multer-Specific Errors

| Error | Status | Description |
|-------|--------|-------------|
| `LIMIT_FILE_SIZE` | 400 | File exceeds 5MB size limit |
| `LIMIT_FILE_COUNT` | 400 | Too many files (max 10) |
| `LIMIT_UNEXPECTED_FILE` | 400 | Wrong field name (use 'image' or 'images') |

---

## File Storage Structure

Files are stored in a tenant-isolated directory structure:

```
uploads/
├── 507f1f77bcf86cd799439011/        # Restaurant 1
│   ├── 1704123456789-abc123def456.jpg
│   ├── 1704123456790-xyz789ghi012.png
│   └── 1704123456791-mno345pqr678.webp
├── 507f1f77bcf86cd799439012/        # Restaurant 2
│   ├── 1704123456792-def456ghi789.jpg
│   └── ...
└── menu-items/                       # Legacy (backwards compatibility)
    └── menu-item-1704123456-123456789.jpg
```

### Filename Format

`{timestamp}-{randomString}.{extension}`

- **timestamp**: Unix timestamp in milliseconds (Date.now())
- **randomString**: 16-character hexadecimal string (crypto.randomBytes(8))
- **extension**: Original file extension (lowercase)

**Example:** `1704123456789-abc123def456.jpg`

---

## Security Considerations

### 1. Tenant Isolation

- Each restaurant's files are stored in separate directories
- Path traversal prevention (validates filenames)
- Restaurant ID validation from JWT token

### 2. Authentication

- Upload/Delete: Requires valid JWT token with admin role
- List: Requires authentication
- Get: Public access (for displaying on menu)

### 3. File Validation

- MIME type checking (Content-Type header)
- File extension validation
- File size limits (5MB per file)
- Sanitized filenames (no special characters)

### 4. Best Practices

- Always use HTTPS in production
- Implement rate limiting on upload endpoints
- Consider adding virus scanning for production
- Use CDN for serving images in production
- Implement automatic cleanup of orphaned files

---

## Configuration

Environment variables for customization:

```env
# Upload directory (default: ./uploads)
UPLOAD_DIR=./uploads

# Maximum file size in bytes (default: 5242880 = 5MB)
MAX_FILE_SIZE=5242880

# Maximum files per upload (default: 10)
MAX_FILES_PER_UPLOAD=10

# Base URL for image URLs (default: http://localhost:5000)
BASE_URL=http://localhost:5000
```

---

## Integration Examples

### React Upload Component

```jsx
import { useState } from 'react';

function ImageUpload({ token, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:5000/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Node.js Client

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadImage(token, filePath) {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(filePath));

  try {
    const response = await axios.post(
      'http://localhost:5000/api/upload/image',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    console.log('Upload successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
}
```

---

## Testing

### Manual Testing with cURL

```bash
# 1. Login to get token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Upload image
curl -X POST http://localhost:5000/api/upload/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@./test-image.jpg"

# 3. List images
curl http://localhost:5000/api/upload/images \
  -H "Authorization: Bearer $TOKEN"

# 4. Get image (public)
curl http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg \
  --output downloaded.jpg

# 5. Delete image
curl -X DELETE http://localhost:5000/api/upload/image/1704123456789-abc123def456.jpg \
  -H "Authorization: Bearer $TOKEN"
```

---

## Production Recommendations

### 1. Cloud Storage Migration

For production, consider migrating to cloud storage:

- **AWS S3**: Use multer-s3 for direct uploads
- **Google Cloud Storage**: Use @google-cloud/storage
- **Azure Blob Storage**: Use @azure/storage-blob
- **Cloudinary**: All-in-one image management

### 2. CDN Integration

- Serve images through CloudFront, Cloud CDN, or Cloudflare
- Reduces server load
- Improves global performance
- Automatic image optimization

### 3. Security Enhancements

- Add virus scanning (ClamAV)
- Implement rate limiting (already configured in server)
- Add watermarking for copyrighted images
- Enable CORS only for trusted domains

### 4. Performance Optimizations

- Image compression (sharp, jimp)
- Automatic thumbnail generation
- WebP conversion for browsers that support it
- Lazy loading on frontend

---

## Troubleshooting

### Upload fails with "No file uploaded"

- Check field name is 'image' (single) or 'images' (multiple)
- Verify Content-Type is multipart/form-data
- Check file is actually being sent in request

### "LIMIT_FILE_SIZE" error

- File exceeds 5MB limit
- Reduce file size or increase MAX_FILE_SIZE env var
- Consider client-side compression before upload

### "Invalid token" errors

- Token expired - user needs to log in again
- Token type mismatch - ensure using admin token
- Restaurant mismatch - token belongs to different restaurant

### Images not displaying

- Verify file exists: `GET /api/upload/{restaurantId}/{filename}`
- Check file permissions (chmod 755)
- Ensure BASE_URL is correct
- Check CORS settings if accessing from different domain

---

## Support

For issues or questions:

1. Check this documentation
2. Review server logs for errors
3. Test with cURL to isolate frontend issues
4. Contact development team

---

## Changelog

### Version 1.0.0 (2024-01-08)

- Initial release
- Tenant-scoped file uploads
- Single and multiple image upload
- Image listing and deletion
- Public image serving
- JWT authentication
- File validation and security
