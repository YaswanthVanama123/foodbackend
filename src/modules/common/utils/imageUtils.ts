import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

// TypeScript interfaces
export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size: number;
  space?: string;
  channels?: number;
  depth?: string;
  density?: number;
  hasAlpha?: boolean;
  orientation?: number;
  exif?: Record<string, any>;
}

export interface ThumbnailPaths {
  small: string;
  medium: string;
  large: string;
}

export interface OptimizedImageResult {
  optimizedPath: string;
  thumbnails: ThumbnailPaths;
  metadata: ImageMetadata;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  metadata?: ImageMetadata;
}

// Configuration constants
const MAX_IMAGE_DIMENSION = 1200;
const DEFAULT_QUALITY = 80;
const THUMBNAIL_SIZES = {
  small: 150,
  medium: 400,
  large: 800,
};

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Optimize an image by compressing, resizing, and converting to WebP format
 * @param filePath - Path to the original image file
 * @param quality - Quality percentage (0-100), defaults to 80
 * @returns Promise with optimized image path, thumbnails, and metadata
 */
export async function optimizeImage(
  filePath: string,
  quality: number = DEFAULT_QUALITY
): Promise<OptimizedImageResult> {
  try {
    // Validate file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Validate quality parameter
    if (quality < 0 || quality > 100) {
      throw new Error('Quality must be between 0 and 100');
    }

    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Calculate new dimensions maintaining aspect ratio
    let newWidth = metadata.width || MAX_IMAGE_DIMENSION;
    let newHeight = metadata.height || MAX_IMAGE_DIMENSION;

    if (newWidth > MAX_IMAGE_DIMENSION || newHeight > MAX_IMAGE_DIMENSION) {
      if (newWidth > newHeight) {
        newHeight = Math.round((newHeight * MAX_IMAGE_DIMENSION) / newWidth);
        newWidth = MAX_IMAGE_DIMENSION;
      } else {
        newWidth = Math.round((newWidth * MAX_IMAGE_DIMENSION) / newHeight);
        newHeight = MAX_IMAGE_DIMENSION;
      }
    }

    // Generate optimized image path (WebP format)
    const parsedPath = path.parse(filePath);
    const optimizedPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}-optimized.webp`
    );

    // Optimize and convert to WebP
    await image
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toFile(optimizedPath);

    // Generate thumbnails
    const thumbnails = await generateThumbnails(optimizedPath);

    // Get metadata of optimized image
    const optimizedMetadata = await getImageMetadata(optimizedPath);

    return {
      optimizedPath,
      thumbnails,
      metadata: optimizedMetadata,
    };
  } catch (error) {
    throw new Error(
      `Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate thumbnails in multiple sizes
 * @param filePath - Path to the source image
 * @returns Promise with paths to all generated thumbnails
 */
export async function generateThumbnails(
  filePath: string
): Promise<ThumbnailPaths> {
  try {
    // Validate file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const parsedPath = path.parse(filePath);
    const thumbnailPaths: ThumbnailPaths = {
      small: '',
      medium: '',
      large: '',
    };

    // Generate small thumbnail (150x150)
    thumbnailPaths.small = path.join(
      parsedPath.dir,
      `${parsedPath.name}-thumb-small${parsedPath.ext}`
    );
    await sharp(filePath)
      .resize(THUMBNAIL_SIZES.small, THUMBNAIL_SIZES.small, {
        fit: 'cover',
        position: 'center',
      })
      .toFile(thumbnailPaths.small);

    // Generate medium thumbnail (400x400)
    thumbnailPaths.medium = path.join(
      parsedPath.dir,
      `${parsedPath.name}-thumb-medium${parsedPath.ext}`
    );
    await sharp(filePath)
      .resize(THUMBNAIL_SIZES.medium, THUMBNAIL_SIZES.medium, {
        fit: 'cover',
        position: 'center',
      })
      .toFile(thumbnailPaths.medium);

    // Generate large thumbnail (800x800)
    thumbnailPaths.large = path.join(
      parsedPath.dir,
      `${parsedPath.name}-thumb-large${parsedPath.ext}`
    );
    await sharp(filePath)
      .resize(THUMBNAIL_SIZES.large, THUMBNAIL_SIZES.large, {
        fit: 'cover',
        position: 'center',
      })
      .toFile(thumbnailPaths.large);

    return thumbnailPaths;
  } catch (error) {
    throw new Error(
      `Failed to generate thumbnails: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate an uploaded image file
 * @param file - Multer file object or file path
 * @returns Promise with validation result
 */
export async function validateImageFile(
  file: Express.Multer.File | string
): Promise<ImageValidationResult> {
  try {
    let filePath: string;
    let mimeType: string | undefined;
    let fileSize: number;

    // Handle both Multer file objects and file paths
    if (typeof file === 'string') {
      filePath = file;
      const stats = await fs.stat(filePath);
      fileSize = stats.size;
    } else {
      filePath = file.path;
      mimeType = file.mimetype;
      fileSize = file.size;
    }

    // Validate file exists
    if (!existsSync(filePath)) {
      return {
        valid: false,
        error: 'File not found',
      };
    }

    // Check file size
    if (fileSize > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      };
    }

    // Validate MIME type if provided
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid MIME type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    // Verify actual file content using sharp
    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Check if the file is actually an image
      if (!metadata.format) {
        return {
          valid: false,
          error: 'File is not a valid image',
        };
      }

      // Check dimensions (at least 10x10 pixels)
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width < 10 ||
        metadata.height < 10
      ) {
        return {
          valid: false,
          error: 'Image dimensions are too small (minimum 10x10 pixels)',
        };
      }

      // Check maximum dimensions (e.g., 10000x10000)
      if (metadata.width > 10000 || metadata.height > 10000) {
        return {
          valid: false,
          error: 'Image dimensions are too large (maximum 10000x10000 pixels)',
        };
      }

      // Get full metadata
      const fullMetadata = await getImageMetadata(filePath);

      return {
        valid: true,
        metadata: fullMetadata,
      };
    } catch (sharpError) {
      return {
        valid: false,
        error: `Corrupted or invalid image file: ${sharpError instanceof Error ? sharpError.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Delete an image file and all its thumbnails
 * @param filePath - Path to the original image file
 * @returns Promise that resolves when all files are deleted
 */
export async function deleteImageWithThumbnails(
  filePath: string
): Promise<void> {
  try {
    const parsedPath = path.parse(filePath);
    const filesToDelete: string[] = [filePath];

    // Add potential thumbnail paths
    const thumbnailVariants = [
      `${parsedPath.name}-thumb-small${parsedPath.ext}`,
      `${parsedPath.name}-thumb-medium${parsedPath.ext}`,
      `${parsedPath.name}-thumb-large${parsedPath.ext}`,
    ];

    // Add potential optimized version
    const optimizedPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}-optimized.webp`
    );
    filesToDelete.push(optimizedPath);

    // Add optimized thumbnails
    const optimizedThumbnails = [
      `${parsedPath.name}-optimized-thumb-small.webp`,
      `${parsedPath.name}-optimized-thumb-medium.webp`,
      `${parsedPath.name}-optimized-thumb-large.webp`,
    ];

    // Build complete list of files to check
    for (const variant of thumbnailVariants) {
      filesToDelete.push(path.join(parsedPath.dir, variant));
    }

    for (const variant of optimizedThumbnails) {
      filesToDelete.push(path.join(parsedPath.dir, variant));
    }

    // Delete all files that exist
    const deletePromises = filesToDelete.map(async (file) => {
      try {
        if (existsSync(file)) {
          await fs.unlink(file);
          console.log(`Deleted: ${file}`);
        }
      } catch (error) {
        // Log error but don't throw - continue deleting other files
        console.error(
          `Failed to delete ${file}:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });

    await Promise.allSettled(deletePromises);
  } catch (error) {
    throw new Error(
      `Failed to delete image files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract metadata from an image file
 * @param filePath - Path to the image file
 * @returns Promise with image metadata
 */
export async function getImageMetadata(
  filePath: string
): Promise<ImageMetadata> {
  try {
    // Validate file exists
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const image = sharp(filePath);
    const metadata = await image.metadata();
    const stats = await fs.stat(filePath);

    // Extract EXIF data if available
    let exifData: Record<string, any> | undefined;
    if (metadata.exif) {
      try {
        // Parse EXIF buffer if present
        exifData = metadata.exif as unknown as Record<string, any>;
      } catch (error) {
        console.error('Failed to parse EXIF data:', error);
      }
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      exif: exifData,
    };
  } catch (error) {
    throw new Error(
      `Failed to get image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  };

  return mimeMap[mimeType] || '.jpg';
}

export default {
  optimizeImage,
  generateThumbnails,
  validateImageFile,
  deleteImageWithThumbnails,
  getImageMetadata,
  formatFileSize,
  getExtensionFromMimeType,
};
