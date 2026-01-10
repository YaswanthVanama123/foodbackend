import { Request, Response, NextFunction } from 'express';

/**
 * Middleware timeout wrapper
 * Rejects requests that take longer than specified timeout
 */
export const withTimeout = (timeoutMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
        });
      }
    }, timeoutMs);

    // Clear timeout on response finish
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Request timing middleware
 * Adds timing information to response headers
 */
export const requestTimer = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Add timing header on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);
    });

    next();
  };
};

/**
 * Error wrapper for async middleware
 * Automatically catches errors and passes to error handler
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Compose multiple middleware functions into one
 */
export const composeMiddleware = (...middlewares: Function[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const executeMiddleware = (index: number) => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index];
      middleware(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }
        executeMiddleware(index + 1);
      });
    };

    executeMiddleware(0);
  };
};

/**
 * CORS whitelist configuration
 * Supports both specific origins and subdomain patterns
 */
export const getCorsOptions = () => {
  const whitelist = process.env.CORS_WHITELIST?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174', // User app
    'http://localhost:5175', // Admin app
  ];

  return {
    origin: (origin: string | undefined, callback: Function) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check exact whitelist match
      if (whitelist.indexOf(origin) !== -1) {
        callback(null, true);
        return;
      }

      // Support subdomain patterns: *.localhost:port and *.yourdomain.com
      try {
        const url = new URL(origin);

        // Allow all *.localhost subdomains (for local development)
        if (url.hostname.endsWith('.localhost') || url.hostname === 'localhost') {
          callback(null, true);
          return;
        }

        // Allow production domain subdomains (replace 'yourdomain.com' with your actual domain)
        if (url.hostname.endsWith('.yourdomain.com')) {
          callback(null, true);
          return;
        }
      } catch (e) {
        // Invalid URL
      }

      // Not allowed
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Restaurant-ID'],
  };
};

/**
 * Performance monitoring middleware
 * Tracks slow requests and logs warnings
 */
export const performanceMonitor = (thresholdMs: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        console.warn(`[SLOW REQUEST] ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  };
};
