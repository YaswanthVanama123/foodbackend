const metricsCollector = require('../services/metricsCollector');

/**
 * Performance Tracking Middleware
 * Automatically tracks all HTTP requests and their response times
 */
const performanceTrackingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override res.end to capture metrics when response finishes
  res.end = function(...args) {
    const duration = Date.now() - startTime;

    // Track request metrics
    metricsCollector.trackRequest(
      duration,
      res.statusCode,
      req.path || req.url,
      req.method
    );

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
};

module.exports = performanceTrackingMiddleware;
