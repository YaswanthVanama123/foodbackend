/**
 * CDN Helper Utility
 * Optimizes image URLs to use CDN links and reduces payload size
 */

const CDN_BASE_URL = process.env.CDN_BASE_URL || '';
const USE_CDN = process.env.USE_CDN === 'true';

export interface OptimizedImages {
  original?: string;
  large?: string;
  medium?: string;
  small?: string;
}

/**
 * Convert local image path to CDN URL
 */
export const toCDNUrl = (localPath: string | null | undefined): string | null => {
  if (!localPath) return null;

  // If already a full URL, return as is
  if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
    return localPath;
  }

  // If CDN is enabled, prepend CDN base URL
  if (USE_CDN && CDN_BASE_URL) {
    // Remove leading slash if present
    const path = localPath.startsWith('/') ? localPath.substring(1) : localPath;
    return `${CDN_BASE_URL}/${path}`;
  }

  // Return original path (will be served by backend)
  return localPath;
};

/**
 * Optimize menu item images for response
 * Only returns CDN URLs and excludes empty values
 */
export const optimizeMenuItemImages = (images?: OptimizedImages): OptimizedImages | null => {
  if (!images) return null;

  const optimized: OptimizedImages = {};

  const originalUrl = toCDNUrl(images.original);
  const largeUrl = toCDNUrl(images.large);
  const mediumUrl = toCDNUrl(images.medium);
  const smallUrl = toCDNUrl(images.small);

  if (originalUrl) optimized.original = originalUrl;
  if (largeUrl) optimized.large = largeUrl;
  if (mediumUrl) optimized.medium = mediumUrl;
  if (smallUrl) optimized.small = smallUrl;

  // Return null if no images are present
  return Object.keys(optimized).length > 0 ? optimized : null;
};

/**
 * Get optimized image URL for specific size
 * Falls back to next available size if requested size not found
 */
export const getOptimizedImageUrl = (
  images?: OptimizedImages,
  size: 'small' | 'medium' | 'large' | 'original' = 'medium'
): string | null => {
  if (!images) return null;

  // Try requested size first
  if (images[size]) return toCDNUrl(images[size]);

  // Fallback order based on requested size
  const fallbackOrder: Record<string, Array<keyof OptimizedImages>> = {
    small: ['small', 'medium', 'large', 'original'],
    medium: ['medium', 'small', 'large', 'original'],
    large: ['large', 'medium', 'original', 'small'],
    original: ['original', 'large', 'medium', 'small'],
  };

  const order = fallbackOrder[size] || fallbackOrder.medium;
  for (const fallbackSize of order) {
    if (images[fallbackSize]) {
      return toCDNUrl(images[fallbackSize]);
    }
  }

  return null;
};

/**
 * Transform menu item to include optimized image URLs
 * Used for response transformation
 */
export const transformMenuItemWithCDN = (item: any): any => {
  if (!item) return item;

  const transformed = { ...item };

  // Optimize images object
  if (transformed.images) {
    transformed.images = optimizeMenuItemImages(transformed.images);
  }

  // Handle legacy image field (backward compatibility)
  if (transformed.image) {
    transformed.image = toCDNUrl(transformed.image);
  } else if (transformed.images?.original) {
    transformed.image = toCDNUrl(transformed.images.original);
  }

  return transformed;
};

/**
 * Batch transform multiple menu items
 */
export const transformMenuItemsWithCDN = (items: any[]): any[] => {
  return items.map(transformMenuItemWithCDN);
};
