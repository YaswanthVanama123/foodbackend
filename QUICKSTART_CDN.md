# CDN Integration - Quick Start Guide

Get up and running with cloud storage in 5 minutes.

## Step 1: Choose Your Provider

### Option A: Local Storage (Default - No Setup)
Already configured! Perfect for development.

```env
CDN_PROVIDER=LOCAL
```

### Option B: Cloudinary (Recommended for Quick Start)

1. Sign up at [cloudinary.com](https://cloudinary.com/) (Free tier available)
2. Get credentials from Dashboard > Account Details
3. Add to `.env`:

```env
CDN_PROVIDER=CLOUDINARY
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

4. Install dependency:
```bash
npm install cloudinary
```

### Option C: AWS S3 (Best for Production)

1. Create S3 bucket in AWS Console
2. Create IAM user with S3 permissions
3. Add to `.env`:

```env
CDN_PROVIDER=S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

4. Install dependencies:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Step 2: Update Your Upload Route

Replace your existing file upload logic with CDN utilities:

```typescript
import { uploadToS3, uploadToCloudinary, getStorageInfo } from './utils/cdnUtils';

// In your route handler:
const storageInfo = getStorageInfo();

let imageUrl;
if (storageInfo.provider === 'S3') {
  const result = await uploadToS3(req.file, restaurantId);
  imageUrl = result.url;
} else if (storageInfo.provider === 'CLOUDINARY') {
  const result = await uploadToCloudinary(req.file, restaurantId);
  imageUrl = result.url;
}

// Save imageUrl to database
menuItem.image = imageUrl;
```

## Step 3: Add Image Deletion

Update delete routes to clean up cloud storage:

```typescript
import { deleteFromCloud } from './utils/cdnUtils';

// Before deleting from database:
await deleteFromCloud(menuItem.image);
await menuItem.deleteOne();
```

## Step 4: Serve Optimized Images

Return responsive image URLs to frontend:

```typescript
import { getResponsiveImageUrls } from './utils/cdnUtils';

const imageUrls = getResponsiveImageUrls(menuItem.image, restaurantId);

// Returns:
// {
//   small: 'https://...150x150...',
//   medium: 'https://...400x400...',
//   large: 'https://...800x800...',
//   original: 'https://...original...'
// }
```

## Step 5: Migrate Existing Images (Optional)

If you have existing local images, migrate them to cloud:

```bash
# Preview what will be migrated (dry run)
npm run migrate:images -- --dry-run

# Migrate all restaurants
npm run migrate:images

# Migrate specific restaurant
npm run migrate:images -- --restaurant=restaurant-id
```

## Complete Example

Here's a complete menu item creation route:

```typescript
import express from 'express';
import multer from 'multer';
import { uploadToCloudinary, getResponsiveImageUrls } from './utils/cdnUtils';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/menu-items', upload.single('image'), async (req, res) => {
  try {
    const restaurantId = req.restaurantId; // From auth middleware

    // Upload to cloud
    const result = await uploadToCloudinary(req.file, restaurantId);

    // Create menu item
    const menuItem = await MenuItem.create({
      name: req.body.name,
      price: req.body.price,
      image: result.url,
      restaurantId
    });

    // Return with responsive URLs
    const imageUrls = getResponsiveImageUrls(result.url, restaurantId);

    res.json({
      success: true,
      menuItem: {
        ...menuItem.toObject(),
        imageUrls
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Testing

Test your CDN setup:

```bash
# Check CDN health
curl http://localhost:5000/api/storage/info

# Upload a test image
curl -X POST http://localhost:5000/api/menu-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test-image.jpg" \
  -F "name=Test Item" \
  -F "price=9.99"
```

## Utilities Available

| Function | Purpose | Example |
|----------|---------|---------|
| `uploadToS3()` | Upload to AWS S3 | `await uploadToS3(file, restaurantId)` |
| `uploadToCloudinary()` | Upload to Cloudinary | `await uploadToCloudinary(file, restaurantId)` |
| `deleteFromCloud()` | Delete from any provider | `await deleteFromCloud(imageUrl)` |
| `getCloudImageUrl()` | Get optimized URL | `getCloudImageUrl(filename, restaurantId, 'medium')` |
| `getResponsiveImageUrls()` | Get all size URLs | `getResponsiveImageUrls(filename, restaurantId)` |
| `migrateLocalToCloud()` | Migrate local images | `await migrateLocalToCloud(restaurantId)` |
| `checkCDNHealth()` | Health check | `await checkCDNHealth()` |

## Image Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| `small` | 150x150px | Thumbnails, avatars |
| `medium` | 400x400px | Grid views, cards |
| `large` | 800x800px | Detail views, modals |
| `original` | Full size | Downloads, print |

## Frontend Usage

Use responsive image URLs in your React components:

```tsx
function MenuItem({ item }) {
  return (
    <img
      src={item.imageUrls.medium}
      srcSet={`
        ${item.imageUrls.small} 150w,
        ${item.imageUrls.medium} 400w,
        ${item.imageUrls.large} 800w
      `}
      sizes="(max-width: 600px) 150px, (max-width: 1200px) 400px, 800px"
      alt={item.name}
      loading="lazy"
    />
  );
}
```

## Cleanup Orphaned Images

Remove unused images from cloud storage:

```bash
# Preview what will be deleted (dry run)
npm run cleanup:images -- --dry-run

# Clean up all restaurants
npm run cleanup:images

# Clean up specific restaurant
npm run cleanup:images -- --restaurant=restaurant-id
```

## Environment Variables Summary

```env
# Provider Selection
CDN_PROVIDER=LOCAL|S3|CLOUDINARY

# Local (default)
UPLOAD_DIR=uploads
BASE_URL=http://localhost:5000

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=bucket-name
AWS_CLOUDFRONT_URL=https://xxx.cloudfront.net  # Optional

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
CLOUDINARY_FOLDER=patlinks  # Optional
```

## Troubleshooting

### Images not uploading

1. Check CDN provider is configured:
   ```bash
   npm run dev
   # Look for "CDN Status: ..." in logs
   ```

2. Verify credentials in `.env`

3. Install required dependencies:
   ```bash
   npm install cloudinary  # For Cloudinary
   # OR
   npm install @aws-sdk/client-s3  # For S3
   ```

### Images not loading

1. Check CORS configuration (for S3)
2. Verify bucket/folder permissions
3. Test URL directly in browser

### Migration fails

1. Check local files exist in `uploads/` directory
2. Verify database connection
3. Review error messages in console

## Next Steps

1. ✅ Configure your preferred CDN provider
2. ✅ Update upload routes with CDN utilities
3. ✅ Add image deletion to delete routes
4. ✅ Return responsive URLs to frontend
5. ⚠️ Migrate existing images (if any)
6. ⚠️ Update frontend to use responsive images
7. ⚠️ Set up monitoring and error tracking
8. ⚠️ Configure CDN caching rules

## Need Help?

- **Configuration**: Check `/src/config/cdn.config.ts`
- **Usage Examples**: Check `/src/examples/cdnIntegrationExamples.ts`
- **Full Documentation**: Check `/src/utils/CDN_USAGE.md`
- **Provider Docs**: [AWS S3](https://docs.aws.amazon.com/s3/) | [Cloudinary](https://cloudinary.com/documentation)

## Best Practices

1. **Development**: Use `LOCAL` provider
2. **Staging**: Use `CLOUDINARY` for easy testing
3. **Production**: Use `S3` with CloudFront for best performance
4. **Always** add error handling around CDN operations
5. **Always** use responsive images in frontend
6. **Regularly** run cleanup script to remove orphaned images
7. **Monitor** CDN costs and usage

## Cost Optimization

- **Cloudinary**: Free tier includes 25GB storage + 25GB bandwidth
- **AWS S3**: $0.023/GB storage + $0.09/GB transfer (first 10TB)
- **CloudFront**: Reduces S3 transfer costs significantly
- **Tip**: Use cleanup script monthly to remove unused images

---

**You're ready to go!** Start with Cloudinary for quickest setup, then migrate to S3 when you're ready for production.
