# Uploads Directory

This directory stores all uploaded files for the Patlinks food ordering system.

## Directory Structure

```
uploads/
├── .gitkeep                     # Keeps directory in git
├── README.md                    # This file
└── {restaurantId}/              # Tenant-scoped directories (auto-created)
    ├── {timestamp}-{random}.jpg
    ├── {timestamp}-{random}.png
    └── ...
```

## Tenant Isolation

Each restaurant has its own subdirectory identified by the restaurant's ObjectId. This ensures:

- **Data Isolation**: Files from different restaurants are completely separated
- **Security**: Restaurants can only access their own files
- **Organization**: Easy to manage and backup per-restaurant data
- **Scalability**: Simple to migrate individual restaurant data

### Example Structure

```
uploads/
├── 507f1f77bcf86cd799439011/     # Restaurant 1
│   ├── 1704123456789-abc123def456.jpg
│   ├── 1704123456790-xyz789ghi012.png
│   └── ...
├── 507f1f77bcf86cd799439012/     # Restaurant 2
│   ├── 1704123456791-mno345pqr678.jpg
│   └── ...
└── menu-items/                    # Legacy directory (backwards compatibility)
    └── menu-item-1704123456-123456789.jpg
```

## File Naming Convention

Files are named using the pattern: `{timestamp}-{randomString}.{extension}`

- **timestamp**: Unix timestamp in milliseconds (Date.now())
- **randomString**: 16-character hexadecimal string (crypto.randomBytes(8))
- **extension**: Original file extension (jpg, jpeg, png, gif, webp)

### Example Filenames

```
1704123456789-abc123def456.jpg
1704123456790-xyz789ghi012.png
1704123456791-mno345pqr678.webp
```

This naming convention ensures:

- **Uniqueness**: Collision probability is extremely low
- **Sortability**: Files are sorted by upload time
- **Security**: Original filenames are not exposed
- **Simplicity**: Easy to parse and validate

## File Types

Allowed image formats:

- **JPEG/JPG**: `image/jpeg` (`.jpg`, `.jpeg`)
- **PNG**: `image/png` (`.png`)
- **GIF**: `image/gif` (`.gif`)
- **WebP**: `image/webp` (`.webp`)

## File Size Limits

- **Maximum file size**: 5MB per file (configurable via `MAX_FILE_SIZE` env var)
- **Multiple upload limit**: 10 files maximum (configurable via `MAX_FILES_PER_UPLOAD` env var)

## API Endpoints

### Upload Single Image

```bash
POST /api/upload/image
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
  image: [File]
```

### Upload Multiple Images

```bash
POST /api/upload/images
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
  images: [File, File, ...]
```

### List Images

```bash
GET /api/upload/images
Authorization: Bearer {token}
```

### Get Image (Public)

```bash
GET /api/upload/{restaurantId}/{filename}
```

### Delete Image

```bash
DELETE /api/upload/image/{filename}
Authorization: Bearer {token}
```

## Security Features

1. **Tenant Isolation**: Files are scoped to restaurant context
2. **Authentication**: Upload/delete requires valid JWT token
3. **File Validation**:
   - MIME type checking
   - File extension validation
   - File size limits
4. **Path Traversal Prevention**: Filename validation prevents directory traversal attacks
5. **Secure Access**: Only restaurant admins can upload/delete their own files

## Storage Considerations

### Development

- Files are stored locally in the `uploads/` directory
- Served directly via Express static middleware
- Suitable for development and testing

### Production Recommendations

For production deployments, consider:

1. **Cloud Storage**:
   - AWS S3
   - Google Cloud Storage
   - Azure Blob Storage
   - Cloudinary

2. **CDN Integration**:
   - CloudFront (AWS)
   - Cloud CDN (Google)
   - Azure CDN
   - Cloudflare

3. **Benefits**:
   - Scalability
   - Global distribution
   - Automatic backups
   - Image optimization
   - Lower server load

### Migration to Cloud Storage

To migrate from local storage to cloud storage:

1. Update `uploadMiddleware.ts` to use multer-s3 or similar
2. Update `uploadController.ts` to generate cloud URLs
3. Update environment variables for cloud credentials
4. Migrate existing files to cloud storage
5. Update image URLs in database

## Backup Strategy

### Development

```bash
# Backup uploads directory
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### Production

- Enable automatic backups in cloud storage provider
- Set up versioning for file recovery
- Configure lifecycle policies for old files
- Implement disaster recovery plan

## Maintenance

### Cleanup Old Files

```bash
# Find files older than 90 days
find uploads/ -type f -mtime +90

# Delete files older than 90 days (be careful!)
find uploads/ -type f -mtime +90 -delete
```

### Monitor Disk Usage

```bash
# Check uploads directory size
du -sh uploads/

# Check per-restaurant usage
du -sh uploads/*/
```

### Orphaned Files

Periodically check for orphaned files (uploaded but not referenced in database):

1. Query all image references from database
2. List all files in uploads directory
3. Identify files not in database
4. Review and delete orphaned files

## Environment Variables

Configure upload behavior via `.env`:

```env
# Upload directory (default: ./uploads)
UPLOAD_DIR=./uploads

# Maximum file size in bytes (default: 5242880 = 5MB)
MAX_FILE_SIZE=5242880

# Maximum number of files per upload (default: 10)
MAX_FILES_PER_UPLOAD=10

# Base URL for generating image URLs (default: http://localhost:5000)
BASE_URL=http://localhost:5000
```

## Git Configuration

The `.gitkeep` file ensures the `uploads/` directory is tracked in git, but actual uploaded files should be ignored:

```gitignore
# Ignore uploaded files but keep directory structure
uploads/*
!uploads/.gitkeep
!uploads/README.md
```

## Troubleshooting

### Upload Fails

- Check file size (must be under 5MB)
- Verify file type (jpg, jpeg, png, gif, webp only)
- Ensure authentication token is valid
- Check disk space on server

### Image Not Displaying

- Verify file exists: `GET /api/upload/{restaurantId}/{filename}`
- Check file permissions
- Verify CORS settings for cross-origin requests
- Check browser console for errors

### Permission Errors

```bash
# Fix permissions (Linux/Mac)
chmod -R 755 uploads/

# Ensure Node.js process can write
chown -R node:node uploads/
```

## Testing

### Manual Testing

```bash
# Upload image
curl -X POST http://localhost:5000/api/upload/image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"

# List images
curl http://localhost:5000/api/upload/images \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get image
curl http://localhost:5000/api/upload/507f1f77bcf86cd799439011/1704123456789-abc123def456.jpg

# Delete image
curl -X DELETE http://localhost:5000/api/upload/image/1704123456789-abc123def456.jpg \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Support

For issues or questions about the upload system:

1. Check this README
2. Review API documentation
3. Check server logs
4. Contact development team
