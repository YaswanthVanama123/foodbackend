const os = require('os');
const mongoose = require('mongoose');

/**
 * Metrics Collector Service
 * Tracks real-time performance metrics for the platform
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        responseTimes: [],
      },
      database: {
        queries: 0,
        queryTimes: [],
        slowQueries: [],
        connections: 0,
      },
      errors: {
        total: 0,
        byType: {},
        recent: [],
      },
      cache: {
        hits: 0,
        misses: 0,
        totalRequests: 0,
      },
      system: {
        startTime: Date.now(),
        lastCheck: Date.now(),
      },
    };

    // Keep only last 1000 response times to avoid memory issues
    this.maxResponseTimes = 1000;
    this.maxSlowQueries = 100;
    this.maxRecentErrors = 100;

    // Start background cleanup
    this.startCleanup();
  }

  /**
   * Track HTTP request
   */
  trackRequest(duration, statusCode, endpoint, method) {
    this.metrics.requests.total++;

    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }

    // Add response time
    this.metrics.requests.responseTimes.push({
      duration,
      timestamp: Date.now(),
      endpoint,
      method,
      statusCode,
    });

    // Keep array size manageable
    if (this.metrics.requests.responseTimes.length > this.maxResponseTimes) {
      this.metrics.requests.responseTimes.shift();
    }
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(duration, operation, collection) {
    this.metrics.database.queries++;
    this.metrics.database.queryTimes.push({
      duration,
      timestamp: Date.now(),
      operation,
      collection,
    });

    // Track slow queries (>100ms)
    if (duration > 100) {
      this.metrics.database.slowQueries.push({
        duration,
        timestamp: Date.now(),
        operation,
        collection,
      });

      // Keep slow queries list manageable
      if (this.metrics.database.slowQueries.length > this.maxSlowQueries) {
        this.metrics.database.slowQueries.shift();
      }
    }

    // Keep query times manageable
    if (this.metrics.database.queryTimes.length > this.maxResponseTimes) {
      this.metrics.database.queryTimes.shift();
    }
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    this.metrics.errors.total++;

    const errorType = error.name || 'Unknown';
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

    // Add to recent errors
    this.metrics.errors.recent.push({
      type: errorType,
      message: error.message,
      timestamp: Date.now(),
      context,
    });

    // Keep recent errors manageable
    if (this.metrics.errors.recent.length > this.maxRecentErrors) {
      this.metrics.errors.recent.shift();
    }
  }

  /**
   * Track cache hit/miss
   */
  trackCache(isHit) {
    this.metrics.cache.totalRequests++;
    if (isHit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
  }

  /**
   * Get system metrics (CPU, Memory, Uptime)
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = Math.floor((Date.now() - this.metrics.system.startTime) / 1000);

    // Calculate Node.js heap usage percentage (more relevant for backend monitoring)
    const heapUsedPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const systemUsedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsedPercent, // Node.js heap usage % (recommended for monitoring)
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        systemTotal: Math.round(totalMem / 1024 / 1024), // MB
        systemFree: Math.round(freeMem / 1024 / 1024), // MB
        systemUsedPercent, // Total system memory % (includes all processes)
      },
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      uptime: {
        process: uptime,
        system: os.uptime(),
      },
      platform: {
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
      },
    };
  }

  /**
   * Get database connection metrics
   */
  getDatabaseMetrics() {
    const connectionState = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      state: stateMap[connectionState] || 'unknown',
      connected: connectionState === 1,
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown',
      collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0,
    };
  }

  /**
   * Calculate average response time
   */
  getAverageResponseTime(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentTimes = this.metrics.requests.responseTimes
      .filter(rt => rt.timestamp > cutoff)
      .map(rt => rt.duration);

    if (recentTimes.length === 0) return 0;

    const sum = recentTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / recentTimes.length);
  }

  /**
   * Calculate average database query time
   */
  getAverageDatabaseQueryTime(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentTimes = this.metrics.database.queryTimes
      .filter(qt => qt.timestamp > cutoff)
      .map(qt => qt.duration);

    if (recentTimes.length === 0) return 0;

    const sum = recentTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / recentTimes.length);
  }

  /**
   * Calculate error rate (errors per minute)
   */
  getErrorRate(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentErrors = this.metrics.errors.recent.filter(e => e.timestamp > cutoff);
    return (recentErrors.length / minutes).toFixed(2);
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate() {
    if (this.metrics.cache.totalRequests === 0) return 0;
    return Math.round((this.metrics.cache.hits / this.metrics.cache.totalRequests) * 100);
  }

  /**
   * Get comprehensive metrics snapshot
   */
  getSnapshot() {
    const system = this.getSystemMetrics();
    const database = this.getDatabaseMetrics();

    return {
      timestamp: new Date().toISOString(),
      system,
      database: {
        ...database,
        totalQueries: this.metrics.database.queries,
        averageQueryTime: this.getAverageDatabaseQueryTime(5),
        slowQueriesCount: this.metrics.database.slowQueries.length,
        recentSlowQueries: this.metrics.database.slowQueries.slice(-10),
      },
      api: {
        totalRequests: this.metrics.requests.total,
        successRequests: this.metrics.requests.success,
        errorRequests: this.metrics.requests.error,
        averageResponseTime: this.getAverageResponseTime(5),
        errorRate: parseFloat(this.getErrorRate(5)),
        recentRequests: this.metrics.requests.responseTimes.slice(-20),
      },
      cache: {
        hits: this.metrics.cache.hits,
        misses: this.metrics.cache.misses,
        totalRequests: this.metrics.cache.totalRequests,
        hitRate: this.getCacheHitRate(),
      },
      errors: {
        total: this.metrics.errors.total,
        byType: this.metrics.errors.byType,
        recentErrors: this.metrics.errors.recent.slice(-20),
        errorRate: parseFloat(this.getErrorRate(5)),
      },
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    const snapshot = this.getSnapshot();

    // Determine health status based on metrics
    const checks = {
      api: {
        healthy: snapshot.api.averageResponseTime < 500 && snapshot.api.errorRate < 5,
        value: snapshot.api.averageResponseTime,
        threshold: 500,
      },
      database: {
        healthy: snapshot.database.connected && snapshot.database.averageQueryTime < 100,
        value: snapshot.database.averageQueryTime,
        threshold: 100,
      },
      memory: {
        healthy: snapshot.system.memory.heapUsedPercent < 90,
        value: snapshot.system.memory.heapUsedPercent,
        threshold: 90,
        label: 'Backend Heap Usage',
      },
      errors: {
        healthy: snapshot.errors.errorRate < 1,
        value: snapshot.errors.errorRate,
        threshold: 1,
      },
    };

    const allHealthy = Object.values(checks).every(check => check.healthy);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics (useful for testing or manual resets)
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        responseTimes: [],
      },
      database: {
        queries: 0,
        queryTimes: [],
        slowQueries: [],
        connections: 0,
      },
      errors: {
        total: 0,
        byType: {},
        recent: [],
      },
      cache: {
        hits: 0,
        misses: 0,
        totalRequests: 0,
      },
      system: {
        startTime: Date.now(),
        lastCheck: Date.now(),
      },
    };
  }

  /**
   * Cleanup old metrics periodically
   */
  startCleanup() {
    setInterval(() => {
      const cutoff = Date.now() - (60 * 60 * 1000); // Keep last hour

      // Clean old response times
      this.metrics.requests.responseTimes = this.metrics.requests.responseTimes
        .filter(rt => rt.timestamp > cutoff);

      // Clean old query times
      this.metrics.database.queryTimes = this.metrics.database.queryTimes
        .filter(qt => qt.timestamp > cutoff);

      // Clean old errors
      this.metrics.errors.recent = this.metrics.errors.recent
        .filter(e => e.timestamp > cutoff);

      this.metrics.system.lastCheck = Date.now();
    }, 10 * 60 * 1000); // Run every 10 minutes
  }
}

// Create singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;
