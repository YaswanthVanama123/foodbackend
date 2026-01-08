/**
 * CDN Configuration
 * Centralized configuration for cloud storage providers (AWS S3, Cloudinary)
 */

export enum StorageProvider {
  LOCAL = 'LOCAL',
  S3 = 'S3',
  CLOUDINARY = 'CLOUDINARY'
}

export enum ImageSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  ORIGINAL = 'original'
}

export interface CDNConfig {
  provider: StorageProvider;
  s3?: S3Config;
  cloudinary?: CloudinaryConfig;
  local?: LocalConfig;
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  cloudFrontUrl?: string;
  signedUrlExpiry?: number; // in seconds, default 3600
  acl?: string; // 'public-read' | 'private'
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
  secure?: boolean;
}

export interface LocalConfig {
  uploadDir: string;
  baseUrl: string;
}

export interface ImageTransformation {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpg' | 'png' | 'webp' | 'auto';
  crop?: 'fill' | 'fit' | 'scale' | 'crop';
}

// Size presets for different use cases
export const IMAGE_SIZE_PRESETS: Record<ImageSize, ImageTransformation> = {
  [ImageSize.SMALL]: {
    width: 150,
    height: 150,
    quality: 80,
    format: 'webp',
    crop: 'fill'
  },
  [ImageSize.MEDIUM]: {
    width: 400,
    height: 400,
    quality: 85,
    format: 'webp',
    crop: 'fit'
  },
  [ImageSize.LARGE]: {
    width: 800,
    height: 800,
    quality: 90,
    format: 'webp',
    crop: 'fit'
  },
  [ImageSize.ORIGINAL]: {
    quality: 100,
    format: 'auto'
  }
};

/**
 * Get CDN configuration from environment variables
 */
export const getCDNConfig = (): CDNConfig => {
  const provider = (process.env.CDN_PROVIDER?.toUpperCase() || 'LOCAL') as StorageProvider;

  const config: CDNConfig = {
    provider
  };

  // S3 Configuration
  if (provider === StorageProvider.S3) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are required when using S3 provider');
    }

    config.s3 = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || 'patlinks-images',
      cloudFrontUrl: process.env.AWS_CLOUDFRONT_URL,
      signedUrlExpiry: parseInt(process.env.AWS_SIGNED_URL_EXPIRY || '3600'),
      acl: process.env.AWS_S3_ACL || 'public-read'
    };
  }

  // Cloudinary Configuration
  if (provider === StorageProvider.CLOUDINARY) {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials are required when using CLOUDINARY provider');
    }

    config.cloudinary = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      folder: process.env.CLOUDINARY_FOLDER || 'patlinks',
      secure: process.env.CLOUDINARY_SECURE !== 'false'
    };
  }

  // Local Configuration
  if (provider === StorageProvider.LOCAL) {
    config.local = {
      uploadDir: process.env.UPLOAD_DIR || 'uploads',
      baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`
    };
  }

  return config;
};

/**
 * Validate CDN configuration
 */
export const validateCDNConfig = (config: CDNConfig): boolean => {
  switch (config.provider) {
    case StorageProvider.S3:
      return !!(config.s3?.accessKeyId && config.s3?.secretAccessKey && config.s3?.bucket);
    case StorageProvider.CLOUDINARY:
      return !!(config.cloudinary?.cloudName && config.cloudinary?.apiKey && config.cloudinary?.apiSecret);
    case StorageProvider.LOCAL:
      return !!(config.local?.uploadDir && config.local?.baseUrl);
    default:
      return false;
  }
};

export default getCDNConfig;
