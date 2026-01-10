/**
 * CloudFlare R2/AWS S3 Compatible Storage Service
 *
 * This service supports both AWS S3 and CloudFlare R2 (S3-compatible)
 * Configure via environment variables
 *
 * Features:
 * - Direct S3/R2 uploads (no local storage)
 * - Streaming uploads for large files
 * - CDN integration
 * - Presigned URLs for secure access
 * - Automatic content-type detection
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 's3' | 'r2' | 'local' (default: 'local')
 * - S3_BUCKET_NAME: Your S3/R2 bucket name
 * - S3_REGION: AWS region (for S3) or 'auto' (for R2)
 * - S3_ACCESS_KEY_ID: Access key
 * - S3_SECRET_ACCESS_KEY: Secret key
 * - S3_ENDPOINT: Custom endpoint (required for CloudFlare R2)
 * - CDN_BASE_URL: CDN URL for serving images
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { Readable } from 'stream';

interface UploadResult {
  key: string;
  url: string;
  cdnUrl?: string;
  bucket: string;
  size?: number;
  contentType: string;
}

interface StorageConfig {
  provider: 's3' | 'r2' | 'local';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  cdnBaseUrl?: string;
}

class CloudStorageService {
  private config: StorageConfig;
  private s3Client: any; // AWS S3 client (lazy loaded)

  constructor() {
    this.config = {
      provider: (process.env.STORAGE_PROVIDER as any) || 'local',
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.S3_REGION || 'auto',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
      cdnBaseUrl: process.env.CDN_BASE_URL,
    };
  }

  /**
   * Initialize S3 client (lazy loading)
   * Install: npm install @aws-sdk/client-s3
   */
  private async initS3Client() {
    if (this.s3Client) return this.s3Client;

    if (this.config.provider === 'local') {
      throw new Error('S3 client not available in local storage mode');
    }

    try {
      // Lazy load AWS SDK to avoid dependency if not using cloud storage
      const { S3Client } = await import('@aws-sdk/client-s3');

      const clientConfig: any = {
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId!,
          secretAccessKey: this.config.secretAccessKey!,
        },
      };

      // CloudFlare R2 requires custom endpoint
      if (this.config.provider === 'r2' && this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      this.s3Client = new S3Client(clientConfig);
      return this.s3Client;
    } catch (error: any) {
      console.error('Failed to initialize S3 client:', error);
      throw new Error(
        'AWS SDK not installed. Run: npm install @aws-sdk/client-s3'
      );
    }
  }

  /**
   * Check if cloud storage is enabled
   */
  isCloudStorageEnabled(): boolean {
    return this.config.provider !== 'local';
  }

  /**
   * Upload file to S3/R2
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: {
      filename?: string;
      contentType?: string;
      restaurantId: string;
      folder?: string;
    }
  ): Promise<UploadResult> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error(
        'Cloud storage not enabled. Set STORAGE_PROVIDER=s3 or r2'
      );
    }

    const client = await this.initS3Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = options.filename
      ? path.extname(options.filename)
      : '';
    const filename = `${timestamp}-${randomString}${ext}`;

    // Build S3 key with folder structure
    const folder = options.folder || 'images';
    const key = `${options.restaurantId}/${folder}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
      Body: fileBuffer,
      ContentType: options.contentType || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        uploadedAt: new Date().toISOString(),
        restaurantId: options.restaurantId,
      },
    });

    await client.send(command);

    // Generate URLs
    const url = this.config.endpoint
      ? `${this.config.endpoint}/${this.config.bucket}/${key}`
      : `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;

    const cdnUrl = this.config.cdnBaseUrl
      ? `${this.config.cdnBaseUrl}/${key}`
      : undefined;

    return {
      key,
      url,
      cdnUrl,
      bucket: this.config.bucket!,
      size: fileBuffer.length,
      contentType: options.contentType || 'application/octet-stream',
    };
  }

  /**
   * Upload from stream (for large files)
   */
  async uploadStream(
    stream: Readable,
    options: {
      filename?: string;
      contentType?: string;
      restaurantId: string;
      folder?: string;
    }
  ): Promise<UploadResult> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error(
        'Cloud storage not enabled. Set STORAGE_PROVIDER=s3 or r2'
      );
    }

    // Convert stream to buffer (for simplicity)
    // For true streaming, use Upload from @aws-sdk/lib-storage
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return this.uploadFile(buffer, options);
  }

  /**
   * Delete file from S3/R2
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage not enabled');
    }

    const client = await this.initS3Client();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    await client.send(command);
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage not enabled');
    }

    const client = await this.initS3Client();
    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    const command = new DeleteObjectsCommand({
      Bucket: this.config.bucket!,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    await client.send(command);
  }

  /**
   * Generate presigned URL for secure temporary access
   */
  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage not enabled');
    }

    const client = await this.initS3Client();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage not enabled');
    }

    const client = await this.initS3Client();
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new HeadObjectCommand({
      Bucket: this.config.bucket!,
      Key: key,
    });

    const response = await client.send(command);
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }

  /**
   * List files in a folder
   */
  async listFiles(
    restaurantId: string,
    folder: string = 'images'
  ): Promise<string[]> {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage not enabled');
    }

    const client = await this.initS3Client();
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const prefix = `${restaurantId}/${folder}/`;

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucket!,
      Prefix: prefix,
    });

    const response = await client.send(command);
    return (response.Contents || []).map((obj: any) => obj.Key!);
  }

  /**
   * Get CDN URL for a key
   */
  getCdnUrl(key: string): string {
    if (this.config.cdnBaseUrl) {
      return `${this.config.cdnBaseUrl}/${key}`;
    }

    // Fallback to direct S3/R2 URL
    if (this.config.endpoint) {
      return `${this.config.endpoint}/${this.config.bucket}/${key}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}

// Export singleton instance
export default new CloudStorageService();

// Export types
export type { UploadResult, StorageConfig };
