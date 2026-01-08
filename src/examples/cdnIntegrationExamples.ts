/**
 * Example CDN Integration with Express Routes
 *
 * This file demonstrates how to integrate CDN utilities with your existing
 * Express routes for menu items and restaurant management.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import {
  uploadToS3,
  uploadToCloudinary,
  deleteFromCloud,
  getCloudImageUrl,
  getResponsiveImageUrls,
  getStorageInfo,
  ImageSize,
  FileInput
} from '../utils/cdnUtils';

const router = express.Router();

// Configure multer for memory storage (required for cloud uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

/**
 * Helper function to upload image based on configured provider
 */
async function uploadImage(file: Express.Multer.File, restaurantId: string): Promise<string> {
  const storageInfo = getStorageInfo();

  const fileInput: FileInput = {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size
  };

  if (storageInfo.provider === 'S3') {
    const result = await uploadToS3(fileInput, restaurantId);
    return result.url;
  } else if (storageInfo.provider === 'CLOUDINARY') {
    const result = await uploadToCloudinary(fileInput, restaurantId);
    return result.url;
  } else {
    // For local storage, you'd use your existing local upload logic
    // This is just a fallback example
    throw new Error('Local storage upload should be handled by existing middleware');
  }
}

/**
 * Example 1: Create Menu Item with Image Upload
 */
router.post('/menu-items', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.restaurantId; // From auth middleware
    const { name, description, price, category } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Upload image to cloud
    const imageUrl = await uploadImage(req.file, restaurantId);

    // Create menu item in database (pseudo-code - adjust to your model)
    const menuItem = await MenuItem.create({
      name,
      description,
      price,
      category,
      image: imageUrl,
      restaurantId
    });

    // Return with responsive image URLs
    const imageUrls = getResponsiveImageUrls(imageUrl, restaurantId);

    res.status(201).json({
      success: true,
      menuItem: {
        ...menuItem.toObject(),
        imageUrls // Include responsive URLs for frontend
      }
    });
  } catch (error) {
    console.error('Menu item creation failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create menu item'
    });
  }
});

/**
 * Example 2: Update Menu Item with Optional Image
 */
router.put('/menu-items/:id', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurantId;
    const { name, description, price, category } = req.body;

    // Find existing menu item
    const menuItem = await MenuItem.findOne({ _id: id, restaurantId });
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Handle image update if provided
    let imageUrl = menuItem.image;
    if (req.file) {
      // Delete old image from cloud
      if (menuItem.image) {
        await deleteFromCloud(menuItem.image);
      }

      // Upload new image
      imageUrl = await uploadImage(req.file, restaurantId);
    }

    // Update menu item
    menuItem.name = name || menuItem.name;
    menuItem.description = description || menuItem.description;
    menuItem.price = price || menuItem.price;
    menuItem.category = category || menuItem.category;
    menuItem.image = imageUrl;
    await menuItem.save();

    // Return with responsive image URLs
    const imageUrls = getResponsiveImageUrls(imageUrl, restaurantId);

    res.json({
      success: true,
      menuItem: {
        ...menuItem.toObject(),
        imageUrls
      }
    });
  } catch (error) {
    console.error('Menu item update failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update menu item'
    });
  }
});

/**
 * Example 3: Delete Menu Item with Image Cleanup
 */
router.delete('/menu-items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurantId;

    // Find menu item
    const menuItem = await MenuItem.findOne({ _id: id, restaurantId });
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Delete image from cloud storage
    if (menuItem.image) {
      const deleted = await deleteFromCloud(menuItem.image);
      if (!deleted) {
        console.warn(`Failed to delete image: ${menuItem.image}`);
        // Continue with deletion anyway - don't block on image cleanup
      }
    }

    // Delete menu item from database
    await menuItem.deleteOne();

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('Menu item deletion failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete menu item'
    });
  }
});

/**
 * Example 4: Get Menu Items with Optimized Images
 */
router.get('/menu-items', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.restaurantId;
    const { size = 'medium' } = req.query;

    // Fetch menu items
    const menuItems = await MenuItem.find({ restaurantId });

    // Add optimized image URLs
    const menuItemsWithImages = menuItems.map(item => {
      const optimizedUrl = getCloudImageUrl(
        item.image,
        restaurantId,
        size as ImageSize
      );

      return {
        ...item.toObject(),
        optimizedImage: optimizedUrl,
        imageUrls: getResponsiveImageUrls(item.image, restaurantId)
      };
    });

    res.json({
      success: true,
      menuItems: menuItemsWithImages
    });
  } catch (error) {
    console.error('Failed to fetch menu items:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch menu items'
    });
  }
});

/**
 * Example 5: Update Restaurant Logo
 */
router.put('/restaurant/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.restaurantId;

    if (!req.file) {
      return res.status(400).json({ error: 'Logo file is required' });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Delete old logo if exists
    if (restaurant.logo) {
      await deleteFromCloud(restaurant.logo);
    }

    // Upload new logo
    const logoUrl = await uploadImage(req.file, restaurantId);

    // Update restaurant
    restaurant.logo = logoUrl;
    await restaurant.save();

    // Return with responsive logo URLs
    const logoUrls = getResponsiveImageUrls(logoUrl, restaurantId);

    res.json({
      success: true,
      restaurant: {
        ...restaurant.toObject(),
        logoUrls
      }
    });
  } catch (error) {
    console.error('Logo update failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update logo'
    });
  }
});

/**
 * Example 6: Batch Upload Multiple Images
 */
router.post('/menu-items/batch', upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const restaurantId = req.restaurantId;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const menuItemsData = JSON.parse(req.body.menuItems); // Array of menu item data

    if (files.length !== menuItemsData.length) {
      return res.status(400).json({ error: 'Number of images must match number of menu items' });
    }

    const createdItems = [];
    const errors = [];

    // Process each item
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const itemData = menuItemsData[i];

        // Upload image
        const imageUrl = await uploadImage(file, restaurantId);

        // Create menu item
        const menuItem = await MenuItem.create({
          ...itemData,
          image: imageUrl,
          restaurantId
        });

        createdItems.push({
          ...menuItem.toObject(),
          imageUrls: getResponsiveImageUrls(imageUrl, restaurantId)
        });
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }

    res.status(201).json({
      success: true,
      created: createdItems.length,
      failed: errors.length,
      menuItems: createdItems,
      errors
    });
  } catch (error) {
    console.error('Batch upload failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch upload failed'
    });
  }
});

/**
 * Example 7: Get Storage Info (for debugging/monitoring)
 */
router.get('/storage/info', async (req: Request, res: Response) => {
  try {
    const storageInfo = getStorageInfo();

    res.json({
      success: true,
      storage: storageInfo
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get storage info'
    });
  }
});

/**
 * Example 8: Get Optimized Image URL (utility endpoint)
 */
router.get('/images/optimize', async (req: Request, res: Response) => {
  try {
    const { url, size = 'medium' } = req.query;
    const restaurantId = req.restaurantId;

    if (!url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Extract filename from URL
    const filename = (url as string).split('/').pop() || '';

    const optimizedUrl = getCloudImageUrl(
      filename,
      restaurantId,
      size as ImageSize
    );

    res.json({
      success: true,
      optimizedUrl,
      allSizes: getResponsiveImageUrls(filename, restaurantId)
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to optimize image'
    });
  }
});

/**
 * Middleware to attach restaurant ID from auth
 * Add this to your actual auth middleware
 */
declare global {
  namespace Express {
    interface Request {
      restaurantId?: string;
    }
  }
}

// Example auth middleware (adjust to your actual implementation)
router.use((req: Request, res: Response, next) => {
  // Get restaurant ID from JWT token or header
  req.restaurantId = req.headers['x-restaurant-id'] as string || 'default-restaurant';
  next();
});

export default router;

/**
 * NOTES FOR INTEGRATION:
 *
 * 1. Update your existing routes to use these patterns
 * 2. Replace local file upload logic with cloud upload functions
 * 3. Add deleteFromCloud() to your delete routes
 * 4. Use getResponsiveImageUrls() to provide optimized images to frontend
 * 5. Configure CDN provider in .env file
 * 6. Install required dependencies:
 *    - For S3: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *    - For Cloudinary: npm install cloudinary
 * 7. Run migration script to move existing images to cloud:
 *    npm run migrate:images
 */
