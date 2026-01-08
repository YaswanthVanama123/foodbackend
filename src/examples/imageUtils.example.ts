/**
 * Example usage of imageUtils.ts
 * This file demonstrates how to use the image optimization and processing utilities
 */

import {
  optimizeImage,
  generateThumbnails,
  validateImageFile,
  deleteImageWithThumbnails,
  getImageMetadata,
  formatFileSize,
} from './imageUtils';

// Example 1: Validate uploaded image file
async function exampleValidateImage(file: Express.Multer.File) {
  const validation = await validateImageFile(file);

  if (!validation.valid) {
    console.error('Validation failed:', validation.error);
    return false;
  }

  console.log('Image is valid!');
  console.log('Metadata:', validation.metadata);
  return true;
}

// Example 2: Optimize image with custom quality
async function exampleOptimizeImage(filePath: string) {
  try {
    const result = await optimizeImage(filePath, 85); // 85% quality

    console.log('Optimized image created at:', result.optimizedPath);
    console.log('Thumbnails:', result.thumbnails);
    console.log('Image size:', formatFileSize(result.metadata.size));
    console.log('Dimensions:', `${result.metadata.width}x${result.metadata.height}`);

    return result;
  } catch (error) {
    console.error('Optimization failed:', error);
    throw error;
  }
}

// Example 3: Generate thumbnails only
async function exampleGenerateThumbnails(filePath: string) {
  try {
    const thumbnails = await generateThumbnails(filePath);

    console.log('Small thumbnail (150x150):', thumbnails.small);
    console.log('Medium thumbnail (400x400):', thumbnails.medium);
    console.log('Large thumbnail (800x800):', thumbnails.large);

    return thumbnails;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    throw error;
  }
}

// Example 4: Get image metadata
async function exampleGetMetadata(filePath: string) {
  try {
    const metadata = await getImageMetadata(filePath);

    console.log('Format:', metadata.format);
    console.log('Dimensions:', `${metadata.width}x${metadata.height}`);
    console.log('Size:', formatFileSize(metadata.size));
    console.log('Color space:', metadata.space);
    console.log('Channels:', metadata.channels);
    console.log('Has alpha:', metadata.hasAlpha);

    if (metadata.exif) {
      console.log('EXIF data available');
    }

    return metadata;
  } catch (error) {
    console.error('Failed to get metadata:', error);
    throw error;
  }
}

// Example 5: Delete image with all thumbnails
async function exampleDeleteImage(filePath: string) {
  try {
    await deleteImageWithThumbnails(filePath);
    console.log('Image and all thumbnails deleted successfully');
  } catch (error) {
    console.error('Failed to delete image:', error);
    throw error;
  }
}

// Example 6: Complete workflow with multer upload
async function exampleCompleteWorkflow(file: Express.Multer.File) {
  try {
    // Step 1: Validate the uploaded file
    console.log('Step 1: Validating image...');
    const validation = await validateImageFile(file);

    if (!validation.valid) {
      throw new Error(`Invalid image: ${validation.error}`);
    }

    // Step 2: Optimize the image
    console.log('Step 2: Optimizing image...');
    const optimized = await optimizeImage(file.path, 80);

    // Step 3: Get metadata
    console.log('Step 3: Getting metadata...');
    const metadata = await getImageMetadata(optimized.optimizedPath);

    console.log('\nWorkflow completed successfully!');
    console.log('----------------------------------------');
    console.log('Original file:', file.originalname);
    console.log('Optimized file:', optimized.optimizedPath);
    console.log('File size reduction:',
      formatFileSize(file.size),
      '→',
      formatFileSize(metadata.size)
    );
    console.log('Thumbnails generated:');
    console.log('  - Small:', optimized.thumbnails.small);
    console.log('  - Medium:', optimized.thumbnails.medium);
    console.log('  - Large:', optimized.thumbnails.large);

    return {
      optimizedPath: optimized.optimizedPath,
      thumbnails: optimized.thumbnails,
      metadata,
    };
  } catch (error) {
    console.error('Workflow failed:', error);
    throw error;
  }
}

// Example 7: Usage in Express route handler
import express from 'express';
import multer from 'multer';
import path from 'path';

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = express.Router();

// Upload and optimize image endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate image
    const validation = await validateImageFile(req.file);
    if (!validation.valid) {
      // Delete invalid file
      await deleteImageWithThumbnails(req.file.path);
      return res.status(400).json({ error: validation.error });
    }

    // Optimize image
    const result = await optimizeImage(req.file.path, 80);

    // Delete original file (keep only optimized version)
    await deleteImageWithThumbnails(req.file.path);

    // Return success response
    res.json({
      success: true,
      message: 'Image uploaded and optimized successfully',
      data: {
        path: result.optimizedPath,
        thumbnails: result.thumbnails,
        metadata: {
          width: result.metadata.width,
          height: result.metadata.height,
          format: result.metadata.format,
          size: result.metadata.size,
        },
      },
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Cleanup on error
    if (req.file) {
      await deleteImageWithThumbnails(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get image metadata endpoint
router.get('/image-metadata/:filename', async (req, res) => {
  try {
    const filePath = path.join('uploads', req.params.filename);
    const metadata = await getImageMetadata(filePath);

    res.json({
      success: true,
      metadata,
    });
  } catch (error) {
    res.status(404).json({
      error: 'Failed to get image metadata',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete image endpoint
router.delete('/image/:filename', async (req, res) => {
  try {
    const filePath = path.join('uploads', req.params.filename);
    await deleteImageWithThumbnails(filePath);

    res.json({
      success: true,
      message: 'Image and thumbnails deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
