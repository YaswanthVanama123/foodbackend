/**
 * Image Processing Service using Sharp
 *
 * Features:
 * - Image compression with quality optimization
 * - Thumbnail generation for fast loading
 * - Multiple format support (JPEG, PNG, WebP)
 * - Metadata stripping for privacy
 * - Progressive JPEG for better UX
 */

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

interface ProcessedImage {
  originalPath: string;
  compressedPath: string;
  thumbnailPath?: string;
  originalSize: number;
  compressedSize: number;
  thumbnailSize?: number;
  compressionRatio: number;
  metadata: {
    width: number;
    height: number;
    format: string;
  };
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 85,
  format: 'jpeg',
  generateThumbnail: true,
  thumbnailSize: 300,
};

/**
 * Process and compress an uploaded image
 */
export async function processImage(
  inputPath: string,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Read original file size
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    // Load and process image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Generate output paths
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const dirName = path.dirname(inputPath);

    const compressedPath = path.join(
      dirName,
      `${baseName}-compressed${ext}`
    );
    const thumbnailPath = opts.generateThumbnail
      ? path.join(dirName, `${baseName}-thumb${ext}`)
      : undefined;

    // Process main image
    await image
      .resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: opts.quality,
        progressive: true,
        mozjpeg: true,
      })
      .withMetadata({
        // Remove EXIF data except orientation
        orientation: metadata.orientation,
      })
      .toFile(compressedPath);

    const compressedStats = fs.statSync(compressedPath);
    const compressedSize = compressedStats.size;

    // Generate thumbnail if requested
    let thumbnailSize: number | undefined;
    if (opts.generateThumbnail && thumbnailPath) {
      await sharp(inputPath)
        .resize(opts.thumbnailSize, opts.thumbnailSize, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 80,
          progressive: true,
        })
        .toFile(thumbnailPath);

      const thumbStats = fs.statSync(thumbnailPath);
      thumbnailSize = thumbStats.size;
    }

    // Delete original uncompressed file
    fs.unlinkSync(inputPath);

    // Rename compressed file to original name
    fs.renameSync(compressedPath, inputPath);

    const compressionRatio =
      ((originalSize - compressedSize) / originalSize) * 100;

    return {
      originalPath: inputPath,
      compressedPath: inputPath,
      thumbnailPath,
      originalSize,
      compressedSize,
      thumbnailSize,
      compressionRatio,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
      },
    };
  } catch (error: any) {
    console.error('Image processing error:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Process multiple images in parallel
 */
export async function processImages(
  inputPaths: string[],
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage[]> {
  const promises = inputPaths.map((path) => processImage(path, options));
  return Promise.all(promises);
}

/**
 * Generate thumbnail from existing image
 */
export async function generateThumbnail(
  imagePath: string,
  size: number = 300
): Promise<string> {
  try {
    const ext = path.extname(imagePath);
    const baseName = path.basename(imagePath, ext);
    const dirName = path.dirname(imagePath);
    const thumbnailPath = path.join(dirName, `${baseName}-thumb${ext}`);

    await sharp(imagePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 80,
        progressive: true,
      })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error: any) {
    console.error('Thumbnail generation error:', error);
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

/**
 * Validate image file before processing
 */
export async function validateImage(
  filePath: string
): Promise<{ valid: boolean; error?: string; metadata?: any }> {
  try {
    const metadata = await sharp(filePath).metadata();

    // Check if it's a valid image format
    if (!metadata.format) {
      return {
        valid: false,
        error: 'Invalid image format',
      };
    }

    // Check dimensions
    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'Unable to determine image dimensions',
      };
    }

    // Check for corrupted images
    if (metadata.width < 1 || metadata.height < 1) {
      return {
        valid: false,
        error: 'Invalid image dimensions',
      };
    }

    return {
      valid: true,
      metadata,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Image validation failed: ${error.message}`,
    };
  }
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(filePath: string) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: fs.statSync(filePath).size,
      space: metadata.space,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
    };
  } catch (error: any) {
    console.error('Get metadata error:', error);
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
}

/**
 * Convert image to WebP format for better compression
 */
export async function convertToWebP(
  inputPath: string,
  quality: number = 85
): Promise<string> {
  try {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const dirName = path.dirname(inputPath);
    const webpPath = path.join(dirName, `${baseName}.webp`);

    await sharp(inputPath)
      .webp({
        quality,
        effort: 6,
      })
      .toFile(webpPath);

    return webpPath;
  } catch (error: any) {
    console.error('WebP conversion error:', error);
    throw new Error(`Failed to convert to WebP: ${error.message}`);
  }
}

/**
 * Delete image and its variants (thumbnail, etc.)
 */
export async function deleteImageWithVariants(imagePath: string): Promise<void> {
  try {
    const ext = path.extname(imagePath);
    const baseName = path.basename(imagePath, ext);
    const dirName = path.dirname(imagePath);

    // Delete main image
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Delete thumbnail
    const thumbnailPath = path.join(dirName, `${baseName}-thumb${ext}`);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    // Delete WebP version if exists
    const webpPath = path.join(dirName, `${baseName}.webp`);
    if (fs.existsSync(webpPath)) {
      fs.unlinkSync(webpPath);
    }
  } catch (error: any) {
    console.error('Delete image variants error:', error);
    throw new Error(`Failed to delete image variants: ${error.message}`);
  }
}
