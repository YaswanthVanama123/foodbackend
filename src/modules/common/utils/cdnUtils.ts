/**
 * CDN Utilities for Production Image Serving
 * Supports AWS S3, Cloudinary, and Local storage with automatic provider detection
 */

import {
  getCDNConfig,
  StorageProvider,
  ImageSize,
  IMAGE_SIZE_PRESETS,
  ImageTransformation,
  CDNConfig
} from './config/cdn.config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * AWS S3 Types (avoiding dependency if not installed)
 */
interface S3UploadParams {
  Bucket: string;
  Key: string;
  Body: Buffer;
  ContentType: string;
  ACL?: string;
  CacheControl?: string;
  Metadata?: Record<string, string>;
}

interface S3DeleteParams {
  Bucket: string;
  Key: string;
}

/**
 * Cloudinary Types
 */
interface CloudinaryUploadOptions {
  folder: string;
  resource_type: 'image' | 'video' | 'raw' | 'auto';
  public_id?: string;
  overwrite?: boolean;
  invalidate?: boolean;
  transformation?: any[];
  tags?: string[];
}

/**
 * Upload result interface
 */
export interface UploadResult {
  url: string;
  publicId?: string;
  provider: StorageProvider;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  };
}

/**
 * File input interface
 */
export interface FileInput {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  originalname: string;
  size?: number;
}

/**
 * Initialize AWS S3 Client (lazy loading)
 */
let s3Client: any = null;

const getS3Client = async () => {
  if (s3Client) return s3Client;

  try {
    // Dynamic import to avoid requiring aws-sdk if not used
    const { S3Client } = await import('@aws-sdk/client-s3');
    const config = getCDNConfig();

    if (!config.s3) {
      throw new Error('S3 configuration not found');
    }

    s3Client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey
      }
    });

    return s3Client;
  } catch (error) {
    throw new Error(`Failed to initialize S3 client: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure to install @aws-sdk/client-s3`);
  }
};

/**
 * Initialize Cloudinary (lazy loading)
 */
let cloudinary: any = null;

const getCloudinary = async () => {
  if (cloudinary) return cloudinary;

  try {
    // Dynamic import to avoid requiring cloudinary if not used
    const cloudinaryModule = await import('cloudinary');
    const config = getCDNConfig();

    if (!config.cloudinary) {
      throw new Error('Cloudinary configuration not found');
    }

    cloudinaryModule.v2.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: config.cloudinary.secure !== false
    });

    cloudinary = cloudinaryModule.v2;
    return cloudinary;
  } catch (error) {
    throw new Error(`Failed to initialize Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure to install cloudinary`);
  }
};

/**
 * Generate a unique filename
 */
const generateFilename = (originalName: string, restaurantId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = path.extname(originalName);
  const basename = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
  return `${restaurantId}-${basename}-${timestamp}-${random}${ext}`;
};

/**
 * Get file buffer from FileInput
 */
const getFileBuffer = async (file: FileInput): Promise<Buffer> => {
  if (file.buffer) {
    return file.buffer;
  }
  if (file.path) {
    return await readFile(file.path);
  }
  throw new Error('File must have either buffer or path');
};

/**
 * Upload to AWS S3
 * @param file - File to upload (buffer or path)
 * @param restaurantId - Restaurant identifier for folder structure
 * @returns Upload result with public URL
 */
export const uploadToS3 = async (
  file: FileInput,
  restaurantId: string
): Promise<UploadResult> => {
  try {
    const config = getCDNConfig();

    if (!config.s3) {
      throw new Error('S3 configuration not available');
    }

    const client = await getS3Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const buffer = await getFileBuffer(file);
    const filename = generateFilename(file.originalname, restaurantId);
    const key = `${restaurantId}/images/${filename}`;

    const params: S3UploadParams = {
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype,
      ACL: config.s3.acl as any,
      CacheControl: 'public, max-age=31536000, immutable', // 1 year cache
      Metadata: {
        restaurantId,
        originalName: file.originalname,
        uploadDate: new Date().toISOString()
      }
    };

    const command = new PutObjectCommand(params);
    await client.send(command);

    // Generate public URL
    let url: string;
    if (config.s3.cloudFrontUrl) {
      // Use CloudFront URL if available
      url = `${config.s3.cloudFrontUrl}/${key}`;
    } else {
      // Use S3 bucket URL
      url = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
    }

    return {
      url,
      publicId: key,
      provider: StorageProvider.S3,
      metadata: {
        size: file.size,
        format: path.extname(file.originalname).slice(1)
      }
    };
  } catch (error) {
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate signed URL for S3 (for private content)
 */
export const getS3SignedUrl = async (
  key: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const config = getCDNConfig();

    if (!config.s3) {
      throw new Error('S3 configuration not available');
    }

    const client = await getS3Client();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Upload to Cloudinary
 * @param file - File to upload (buffer or path)
 * @param restaurantId - Restaurant identifier for folder structure
 * @returns Upload result with transformation URLs
 */
export const uploadToCloudinary = async (
  file: FileInput,
  restaurantId: string
): Promise<UploadResult> => {
  try {
    const config = getCDNConfig();

    if (!config.cloudinary) {
      throw new Error('Cloudinary configuration not available');
    }

    const cloudinaryClient = await getCloudinary();
    const folder = config.cloudinary.folder
      ? `${config.cloudinary.folder}/${restaurantId}`
      : restaurantId;

    const filename = generateFilename(file.originalname, restaurantId);
    const publicId = `${folder}/${path.parse(filename).name}`;

    let uploadResult: any;

    if (file.buffer) {
      // Upload from buffer
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinaryClient.uploader.upload_stream(
          {
            folder,
            public_id: path.parse(filename).name,
            resource_type: 'image' as const,
            overwrite: false,
            invalidate: true,
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ],
            tags: [restaurantId, 'menu-item']
          },
          (error: any, result: any) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });
    } else if (file.path) {
      // Upload from file path
      uploadResult = await cloudinaryClient.uploader.upload(file.path, {
        folder,
        public_id: path.parse(filename).name,
        resource_type: 'image',
        overwrite: false,
        invalidate: true,
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ],
        tags: [restaurantId, 'menu-item']
      });
    } else {
      throw new Error('File must have either buffer or path');
    }

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      provider: StorageProvider.CLOUDINARY,
      metadata: {
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.bytes
      }
    };
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete from cloud storage
 * Automatically detects provider from URL and calls appropriate delete method
 * @param imageUrl - Full URL of the image to delete
 * @returns Success status
 */
export const deleteFromCloud = async (imageUrl: string): Promise<boolean> => {
  try {
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    const config = getCDNConfig();

    // Determine provider from URL
    if (imageUrl.includes('cloudinary.com')) {
      // Cloudinary delete
      const cloudinaryClient = await getCloudinary();

      // Extract public_id from URL
      // Format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
      const urlParts = imageUrl.split('/upload/');
      if (urlParts.length < 2) {
        throw new Error('Invalid Cloudinary URL format');
      }

      const pathParts = urlParts[1].split('/').slice(1); // Remove version
      const publicId = pathParts.join('/').replace(/\.[^/.]+$/, ''); // Remove extension

      await cloudinaryClient.uploader.destroy(publicId);
      return true;
    }
    else if (imageUrl.includes('s3.amazonaws.com') || imageUrl.includes('s3-') ||
             (config.s3?.cloudFrontUrl && imageUrl.includes(config.s3.cloudFrontUrl))) {
      // S3 delete
      const client = await getS3Client();
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      if (!config.s3) {
        throw new Error('S3 configuration not available');
      }

      // Extract key from URL
      let key: string;
      if (config.s3.cloudFrontUrl && imageUrl.includes(config.s3.cloudFrontUrl)) {
        // CloudFront URL
        key = imageUrl.replace(`${config.s3.cloudFrontUrl}/`, '');
      } else {
        // S3 direct URL
        const bucketPattern = new RegExp(`https://${config.s3.bucket}\\.s3\\..*\\.amazonaws\\.com/`);
        key = imageUrl.replace(bucketPattern, '');
      }

      const params: S3DeleteParams = {
        Bucket: config.s3.bucket,
        Key: key
      };

      const command = new DeleteObjectCommand(params);
      await client.send(command);
      return true;
    }
    else if (config.provider === StorageProvider.LOCAL && config.local) {
      // Local file delete
      const baseUrl = config.local.baseUrl;
      const filePath = imageUrl.replace(baseUrl, '');
      const fullPath = path.join(process.cwd(), filePath);

      if (fs.existsSync(fullPath)) {
        await unlink(fullPath);
        return true;
      }
      throw new Error('Local file not found');
    }
    else {
      throw new Error('Unable to determine storage provider from URL');
    }
  } catch (error) {
    console.error('Delete from cloud failed:', error);
    // Don't throw error, just log it and return false for graceful degradation
    return false;
  }
};

/**
 * Get optimized cloud image URL with transformations
 * @param filename - Image filename or public ID
 * @param restaurantId - Restaurant identifier
 * @param size - Image size preset
 * @returns Optimized CDN URL with transformations
 */
export const getCloudImageUrl = (
  filename: string,
  restaurantId: string,
  size: ImageSize = ImageSize.MEDIUM
): string => {
  try {
    const config = getCDNConfig();
    const preset = IMAGE_SIZE_PRESETS[size];

    switch (config.provider) {
      case StorageProvider.CLOUDINARY: {
        if (!config.cloudinary) {
          throw new Error('Cloudinary configuration not available');
        }

        const folder = config.cloudinary.folder
          ? `${config.cloudinary.folder}/${restaurantId}`
          : restaurantId;

        // Build transformation string
        const transformations: string[] = [];

        if (preset.width || preset.height) {
          const crop = preset.crop || 'fit';
          const dims: string[] = [];
          if (preset.width) dims.push(`w_${preset.width}`);
          if (preset.height) dims.push(`h_${preset.height}`);
          transformations.push(`${dims.join(',')},c_${crop}`);
        }

        if (preset.quality) {
          transformations.push(`q_${preset.quality}`);
        }

        if (preset.format) {
          transformations.push(`f_${preset.format}`);
        }

        // Add lazy loading and performance optimizations
        transformations.push('fl_progressive');
        transformations.push('fl_lossy');

        const transformStr = transformations.join(',');
        const publicId = `${folder}/${path.parse(filename).name}`;

        return `https://res.cloudinary.com/${config.cloudinary.cloudName}/image/upload/${transformStr}/${publicId}`;
      }

      case StorageProvider.S3: {
        if (!config.s3) {
          throw new Error('S3 configuration not available');
        }

        const key = `${restaurantId}/images/${filename}`;

        // If CloudFront is configured, use it
        if (config.s3.cloudFrontUrl) {
          // Note: For S3/CloudFront transformations, you'd typically use Lambda@Edge or CloudFront Functions
          // This returns the base URL - transformations would need to be handled separately
          return `${config.s3.cloudFrontUrl}/${key}`;
        }

        // Direct S3 URL
        return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
      }

      case StorageProvider.LOCAL: {
        if (!config.local) {
          throw new Error('Local configuration not available');
        }

        // For local storage, return direct URL
        // Image transformations would need to be handled by an image processing middleware
        return `${config.local.baseUrl}/${config.local.uploadDir}/${restaurantId}/${filename}`;
      }

      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  } catch (error) {
    console.error('Failed to generate cloud image URL:', error);
    // Return a fallback/placeholder URL
    return '/images/placeholder.jpg';
  }
};

/**
 * Get multiple size URLs for responsive images
 * @param filename - Image filename or public ID
 * @param restaurantId - Restaurant identifier
 * @returns Object with URLs for all sizes
 */
export const getResponsiveImageUrls = (
  filename: string,
  restaurantId: string
): Record<ImageSize, string> => {
  return {
    [ImageSize.SMALL]: getCloudImageUrl(filename, restaurantId, ImageSize.SMALL),
    [ImageSize.MEDIUM]: getCloudImageUrl(filename, restaurantId, ImageSize.MEDIUM),
    [ImageSize.LARGE]: getCloudImageUrl(filename, restaurantId, ImageSize.LARGE),
    [ImageSize.ORIGINAL]: getCloudImageUrl(filename, restaurantId, ImageSize.ORIGINAL)
  };
};

/**
 * Migrate local images to cloud storage
 * @param restaurantId - Restaurant identifier
 * @returns Migration results with success/failure counts
 */
export interface MigrationResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ file: string; error: string }>;
  migratedUrls: Array<{ oldUrl: string; newUrl: string }>;
}

export const migrateLocalToCloud = async (
  restaurantId: string
): Promise<MigrationResult> => {
  const config = getCDNConfig();

  if (config.provider === StorageProvider.LOCAL) {
    throw new Error('Cannot migrate to cloud when using LOCAL provider. Set CDN_PROVIDER to S3 or CLOUDINARY');
  }

  const result: MigrationResult = {
    success: 0,
    failed: 0,
    total: 0,
    errors: [],
    migratedUrls: []
  };

  try {
    // Determine local upload directory
    const uploadDir = config.local?.uploadDir || process.env.UPLOAD_DIR || 'uploads';
    const restaurantDir = path.join(process.cwd(), uploadDir, restaurantId);

    // Check if restaurant directory exists
    if (!fs.existsSync(restaurantDir)) {
      throw new Error(`Local directory not found: ${restaurantDir}`);
    }

    // Get all image files
    const files = await readdir(restaurantDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    result.total = imageFiles.length;

    console.log(`Starting migration of ${result.total} images for restaurant ${restaurantId}`);

    // Upload each file to cloud
    for (const filename of imageFiles) {
      try {
        const filePath = path.join(restaurantDir, filename);
        const stats = await stat(filePath);
        const buffer = await readFile(filePath);

        // Determine mimetype from extension
        const ext = path.extname(filename).toLowerCase();
        const mimetypeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };

        const fileInput: FileInput = {
          buffer,
          path: filePath,
          mimetype: mimetypeMap[ext] || 'image/jpeg',
          originalname: filename,
          size: stats.size
        };

        // Upload based on provider
        let uploadResult: UploadResult;
        if (config.provider === StorageProvider.S3) {
          uploadResult = await uploadToS3(fileInput, restaurantId);
        } else if (config.provider === StorageProvider.CLOUDINARY) {
          uploadResult = await uploadToCloudinary(fileInput, restaurantId);
        } else {
          throw new Error('Unsupported provider for migration');
        }

        const oldUrl = `${config.local?.baseUrl}/${uploadDir}/${restaurantId}/${filename}`;

        result.migratedUrls.push({
          oldUrl,
          newUrl: uploadResult.url
        });

        result.success++;

        // Optional: Delete local file after successful upload
        // Uncomment the following lines to enable auto-cleanup
        // await unlink(filePath);
        // console.log(`Deleted local file: ${filename}`);

        console.log(`Migrated: ${filename} -> ${uploadResult.url}`);
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ file: filename, error: errorMessage });
        console.error(`Failed to migrate ${filename}:`, errorMessage);
      }
    }

    console.log(`Migration complete: ${result.success} succeeded, ${result.failed} failed out of ${result.total} total`);

    return result;
  } catch (error) {
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Update database URLs after migration
 * Note: This requires database models to be imported
 */
export const updateDatabaseUrls = async (
  migrationResult: MigrationResult,
  models: { MenuItem?: any; Restaurant?: any }
): Promise<void> => {
  try {
    const urlMap = new Map(
      migrationResult.migratedUrls.map(item => [item.oldUrl, item.newUrl])
    );

    // Update MenuItem images
    if (models.MenuItem) {
      for (const [oldUrl, newUrl] of urlMap.entries()) {
        await models.MenuItem.updateMany(
          { image: oldUrl },
          { $set: { image: newUrl } }
        );
      }
      console.log('Updated MenuItem image URLs');
    }

    // Update Restaurant logo
    if (models.Restaurant) {
      for (const [oldUrl, newUrl] of urlMap.entries()) {
        await models.Restaurant.updateMany(
          { logo: oldUrl },
          { $set: { logo: newUrl } }
        );
      }
      console.log('Updated Restaurant logo URLs');
    }

    console.log('Database URL update complete');
  } catch (error) {
    throw new Error(`Database update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Cleanup orphaned cloud images
 * Delete images from cloud that are not referenced in the database
 */
export const cleanupOrphanedImages = async (
  restaurantId: string,
  activeUrls: string[]
): Promise<{ deleted: number; errors: string[] }> => {
  const config = getCDNConfig();
  const result = { deleted: 0, errors: [] as string[] };

  try {
    if (config.provider === StorageProvider.CLOUDINARY) {
      const cloudinaryClient = await getCloudinary();
      const folder = config.cloudinary?.folder
        ? `${config.cloudinary.folder}/${restaurantId}`
        : restaurantId;

      // Get all resources in the folder
      const resources = await cloudinaryClient.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 500
      });

      // Filter out active URLs
      const activePublicIds = new Set(
        activeUrls
          .filter(url => url.includes('cloudinary.com'))
          .map(url => {
            const urlParts = url.split('/upload/');
            if (urlParts.length < 2) return null;
            const pathParts = urlParts[1].split('/').slice(1);
            return pathParts.join('/').replace(/\.[^/.]+$/, '');
          })
          .filter(Boolean)
      );

      // Delete orphaned resources
      for (const resource of resources.resources) {
        if (!activePublicIds.has(resource.public_id)) {
          try {
            await cloudinaryClient.uploader.destroy(resource.public_id);
            result.deleted++;
          } catch (error) {
            result.errors.push(`Failed to delete ${resource.public_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    } else if (config.provider === StorageProvider.S3) {
      // S3 cleanup implementation
      const client = await getS3Client();
      const { ListObjectsV2Command, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      if (!config.s3) {
        throw new Error('S3 configuration not available');
      }

      // List all objects in the restaurant folder
      const listCommand = new ListObjectsV2Command({
        Bucket: config.s3.bucket,
        Prefix: `${restaurantId}/images/`
      });

      const listResponse = await client.send(listCommand);
      const objects = listResponse.Contents || [];

      // Filter out active URLs
      const activeKeys = new Set(
        activeUrls
          .filter(url => url.includes('s3.amazonaws.com') ||
                         (config.s3?.cloudFrontUrl && url.includes(config.s3.cloudFrontUrl)))
          .map(url => {
            if (config.s3?.cloudFrontUrl && url.includes(config.s3.cloudFrontUrl)) {
              return url.replace(`${config.s3.cloudFrontUrl}/`, '');
            }
            const bucketPattern = new RegExp(`https://${config.s3!.bucket}\\.s3\\..*\\.amazonaws\\.com/`);
            return url.replace(bucketPattern, '');
          })
      );

      // Delete orphaned objects
      for (const obj of objects) {
        if (obj.Key && !activeKeys.has(obj.Key)) {
          try {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: config.s3.bucket,
              Key: obj.Key
            });
            await client.send(deleteCommand);
            result.deleted++;
          } catch (error) {
            result.errors.push(`Failed to delete ${obj.Key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get storage provider info
 */
export const getStorageInfo = (): {
  provider: StorageProvider;
  isCloud: boolean;
  supportsTransformations: boolean;
} => {
  const config = getCDNConfig();
  return {
    provider: config.provider,
    isCloud: config.provider !== StorageProvider.LOCAL,
    supportsTransformations: config.provider === StorageProvider.CLOUDINARY
  };
};

/**
 * Health check for CDN service
 */
export const checkCDNHealth = async (): Promise<{
  healthy: boolean;
  provider: StorageProvider;
  message: string;
}> => {
  try {
    const config = getCDNConfig();

    switch (config.provider) {
      case StorageProvider.S3: {
        const client = await getS3Client();
        const { HeadBucketCommand } = await import('@aws-sdk/client-s3');

        if (!config.s3) {
          throw new Error('S3 configuration not available');
        }

        await client.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
        return {
          healthy: true,
          provider: StorageProvider.S3,
          message: 'S3 connection successful'
        };
      }

      case StorageProvider.CLOUDINARY: {
        const cloudinaryClient = await getCloudinary();
        await cloudinaryClient.api.ping();
        return {
          healthy: true,
          provider: StorageProvider.CLOUDINARY,
          message: 'Cloudinary connection successful'
        };
      }

      case StorageProvider.LOCAL: {
        const uploadDir = config.local?.uploadDir || 'uploads';
        const dirPath = path.join(process.cwd(), uploadDir);

        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        return {
          healthy: true,
          provider: StorageProvider.LOCAL,
          message: 'Local storage accessible'
        };
      }

      default:
        throw new Error('Unknown storage provider');
    }
  } catch (error) {
    return {
      healthy: false,
      provider: getCDNConfig().provider,
      message: error instanceof Error ? error.message : 'Health check failed'
    };
  }
};

export default {
  uploadToS3,
  uploadToCloudinary,
  deleteFromCloud,
  getCloudImageUrl,
  getResponsiveImageUrls,
  migrateLocalToCloud,
  updateDatabaseUrls,
  cleanupOrphanedImages,
  getStorageInfo,
  checkCDNHealth,
  getS3SignedUrl
};
