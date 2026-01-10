import NodeCache from 'node-cache';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * QR Code Cache Service
 * Caches generated QR codes to avoid regenerating them on every request
 * Implements content-based hashing for cache invalidation
 */

// QR Code cache with long TTL (QR codes rarely change)
const qrCache = new NodeCache({
  stdTTL: 86400, // 24 hours - QR codes are stable
  checkperiod: 3600, // Check for expired keys every hour
  useClones: false, // Performance optimization
  maxKeys: 5000, // Support up to 5k cached QR codes
});

/**
 * QR Code generation options
 */
interface QROptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Default QR options optimized for performance
 */
const DEFAULT_QR_OPTIONS: QROptions = {
  errorCorrectionLevel: 'M', // Medium error correction (balance between size and reliability)
  type: 'image/png',
  quality: 0.92,
  margin: 1,
  width: 300,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
};

/**
 * Generate a cache key based on content and options
 */
const generateCacheKey = (content: string, options: QROptions = {}): string => {
  const optionsStr = JSON.stringify({ ...DEFAULT_QR_OPTIONS, ...options });
  const hash = crypto
    .createHash('sha256')
    .update(`${content}:${optionsStr}`)
    .digest('hex')
    .substring(0, 16);

  return `qr:${hash}`;
};

/**
 * Generate QR code with caching
 * Returns cached QR code if available, otherwise generates and caches
 */
export const generateQRCode = async (
  content: string,
  options: QROptions = {}
): Promise<string> => {
  const cacheKey = generateCacheKey(content, options);

  // Try to get from cache first
  const cached = qrCache.get<string>(cacheKey);
  if (cached) {
    console.log(`[QRCache] Cache HIT for key: ${cacheKey}`);
    return cached;
  }

  console.log(`[QRCache] Cache MISS for key: ${cacheKey}, generating...`);

  // Merge with default options
  const finalOptions = { ...DEFAULT_QR_OPTIONS, ...options };

  try {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(content, {
      errorCorrectionLevel: finalOptions.errorCorrectionLevel,
      type: finalOptions.type,
      quality: finalOptions.quality,
      margin: finalOptions.margin,
      width: finalOptions.width,
      color: finalOptions.color,
    });

    // Cache the generated QR code
    qrCache.set(cacheKey, qrDataUrl);

    console.log(`[QRCache] Generated and cached QR code: ${cacheKey}`);
    return qrDataUrl;
  } catch (error) {
    console.error('[QRCache] QR generation failed:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code buffer (for downloads) with caching
 */
export const generateQRCodeBuffer = async (
  content: string,
  options: QROptions = {}
): Promise<Buffer> => {
  const cacheKey = `${generateCacheKey(content, options)}:buffer`;

  // Try to get from cache first
  const cached = qrCache.get<Buffer>(cacheKey);
  if (cached) {
    console.log(`[QRCache] Buffer cache HIT for key: ${cacheKey}`);
    return cached;
  }

  console.log(`[QRCache] Buffer cache MISS for key: ${cacheKey}, generating...`);

  // Merge with default options
  const finalOptions = { ...DEFAULT_QR_OPTIONS, ...options };

  try {
    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(content, {
      errorCorrectionLevel: finalOptions.errorCorrectionLevel,
      type: 'png',
      quality: finalOptions.quality,
      margin: finalOptions.margin,
      width: finalOptions.width,
      color: finalOptions.color,
    });

    // Cache the buffer
    qrCache.set(cacheKey, qrBuffer);

    console.log(`[QRCache] Generated and cached QR buffer: ${cacheKey}`);
    return qrBuffer;
  } catch (error) {
    console.error('[QRCache] QR buffer generation failed:', error);
    throw new Error('Failed to generate QR code buffer');
  }
};

/**
 * Generate table QR code (convenience method)
 * Creates QR code for table ordering URL
 */
export const generateTableQRCode = async (
  restaurantSubdomain: string,
  tableNumber: string,
  options: QROptions = {}
): Promise<string> => {
  // Construct table URL
  const baseUrl = process.env.FRONTEND_URL || 'https://app.patlinks.com';
  const tableUrl = `${baseUrl}/${restaurantSubdomain}/table/${tableNumber}`;

  return generateQRCode(tableUrl, options);
};

/**
 * Generate table QR code buffer (for downloads)
 */
export const generateTableQRCodeBuffer = async (
  restaurantSubdomain: string,
  tableNumber: string,
  options: QROptions = {}
): Promise<Buffer> => {
  // Construct table URL
  const baseUrl = process.env.FRONTEND_URL || 'https://app.patlinks.com';
  const tableUrl = `${baseUrl}/${restaurantSubdomain}/table/${tableNumber}`;

  return generateQRCodeBuffer(tableUrl, options);
};

/**
 * Invalidate QR cache for specific content
 */
export const invalidateQRCache = (content: string, options: QROptions = {}) => {
  const cacheKey = generateCacheKey(content, options);
  qrCache.del(cacheKey);
  qrCache.del(`${cacheKey}:buffer`);
  console.log(`[QRCache] Invalidated cache for key: ${cacheKey}`);
};

/**
 * Invalidate table QR cache
 */
export const invalidateTableQRCache = (
  restaurantSubdomain: string,
  tableNumber: string
) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://app.patlinks.com';
  const tableUrl = `${baseUrl}/${restaurantSubdomain}/table/${tableNumber}`;
  invalidateQRCache(tableUrl);
};

/**
 * Clear all QR caches
 */
export const clearQRCache = () => {
  qrCache.flushAll();
  console.log('[QRCache] All QR caches cleared');
};

/**
 * Get QR cache statistics
 */
export const getQRCacheStats = () => {
  const stats = qrCache.getStats();
  return {
    ...stats,
    hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    size: qrCache.keys().length,
  };
};

/**
 * Batch generate QR codes for multiple tables
 * Pre-warms cache for all tables in a restaurant
 */
export const batchGenerateTableQRCodes = async (
  restaurantSubdomain: string,
  tableNumbers: string[],
  options: QROptions = {}
): Promise<{ success: number; failed: number }> => {
  console.log(`[QRCache] Batch generating ${tableNumbers.length} QR codes...`);

  let success = 0;
  let failed = 0;

  // Generate all QR codes in parallel
  const results = await Promise.allSettled(
    tableNumbers.map(tableNumber =>
      generateTableQRCode(restaurantSubdomain, tableNumber, options)
    )
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      console.error(
        `[QRCache] Failed to generate QR for table ${tableNumbers[index]}:`,
        result.reason
      );
    }
  });

  console.log(
    `[QRCache] Batch generation complete: ${success} success, ${failed} failed`
  );
  return { success, failed };
};
