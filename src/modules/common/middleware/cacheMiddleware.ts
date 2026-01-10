import { Request, Response, NextFunction } from 'express';

/**
 * HTTP Caching Middleware
 * Implements ETag and Cache-Control headers for optimal caching
 */

interface CacheOptions {
  maxAge?: number; // seconds
  sMaxAge?: number; // CDN cache duration in seconds
  staleWhileRevalidate?: number; // seconds
  staleIfError?: number; // seconds
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
}

/**
 * Middleware to set HTTP cache headers
 */
export const cacheControl = (options: CacheOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const directives: string[] = [];

    // Public vs Private
    if (options.public) {
      directives.push('public');
    } else if (options.private) {
      directives.push('private');
    }

    // No cache/store
    if (options.noCache) {
      directives.push('no-cache');
    }
    if (options.noStore) {
      directives.push('no-store');
    }

    // Max age
    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }

    // CDN cache (s-maxage)
    if (options.sMaxAge !== undefined) {
      directives.push(`s-maxage=${options.sMaxAge}`);
    }

    // Stale handling
    if (options.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }
    if (options.staleIfError !== undefined) {
      directives.push(`stale-if-error=${options.staleIfError}`);
    }

    // Must revalidate
    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (directives.length > 0) {
      res.setHeader('Cache-Control', directives.join(', '));
    }

    next();
  };
};

/**
 * Middleware to handle ETag and 304 Not Modified responses
 */
export const etagSupport = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to add ETag
    res.json = function(body: any): Response {
      // Generate ETag from response body
      const etag = generateETag(body);
      res.setHeader('ETag', etag);

      // Check if client has matching ETag
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        // Return 304 Not Modified
        res.status(304).end();
        return res;
      }

      // Send normal response
      return originalJson(body);
    };

    next();
  };
};

/**
 * Generate ETag from data
 */
function generateETag(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `W/"${Math.abs(hash).toString(36)}"`;
}

/**
 * Preset cache configurations
 */
export const CachePresets = {
  // Public menu - aggressive caching (30 minutes)
  publicMenu: {
    public: true,
    maxAge: 1800, // 30 minutes
    sMaxAge: 3600, // 1 hour CDN cache
    staleWhileRevalidate: 600, // 10 minutes
    staleIfError: 86400, // 24 hours on error
  },

  // Public restaurant data - moderate caching (15 minutes)
  publicRestaurant: {
    public: true,
    maxAge: 900, // 15 minutes
    sMaxAge: 1800, // 30 minutes CDN cache
    staleWhileRevalidate: 300, // 5 minutes
  },

  // User favorites - short cache (1 minute)
  userFavorites: {
    private: true,
    maxAge: 60, // 1 minute
    mustRevalidate: true,
  },

  // No cache for mutations
  noCache: {
    noStore: true,
    noCache: true,
  },
};

/**
 * Vary header middleware for proper CDN caching
 */
export const varyHeader = (...headers: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const existing = res.getHeader('Vary') as string | undefined;
    const varyHeaders = existing
      ? [...existing.split(',').map((h) => h.trim()), ...headers]
      : headers;

    res.setHeader('Vary', Array.from(new Set(varyHeaders)).join(', '));
    next();
  };
};
