import express, { Application } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';

// Import from common module
import connectDB from './modules/common/config/database';
import { initializeSocket } from './modules/common/config/socket';
import { initSocketService } from './modules/common/services/socketService';
import { extractTenant } from './modules/common/middleware/tenantMiddleware';
import { errorHandler } from './modules/common/middleware/errorHandler';
import firebaseService from './services/firebase.service';

// Import performance tracking
const performanceTrackingMiddleware = require('./modules/common/middleware/performanceTrackingMiddleware');

// Load environment variables
dotenv.config();

// Ensure NODE_ENV defaults to development when not provided
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Import routes from admin module
import {
  authRoutes,
  categoryRoutes,
  addOnRoutes,
  menuRoutes,
  tableRoutes,
  orderRoutes,
  orderBulkRoutes,
  dashboardRoutes,
  searchRoutes,
  analyticsRoutes,
  bulkRoutes,
  kitchenRoutes,
  uploadRoutes,
  restaurantRoutes,
  fcmTokenRoutes as adminFcmTokenRoutes,
} from './modules/admin';

// Import routes from user module
import {
  customerAuthRoutes,
  customerCartRoutes,
  customerOrderRoutes,
  reviewRoutes,
  favoritesRoutes,
  fcmTokenRoutes,
  homeRoutes,
} from './modules/user';

// Import routes from superadmin module
import {
  superAdminRoutes,
  subscriptionRoutes,
  platformAnalyticsRoutes,
  planRoutes,
  ticketRoutes,
  auditRoutes,
  fcmTokenRoutes as superAdminFcmTokenRoutes,
} from './modules/superadmin';
import monitoringRoutes from './modules/superadmin/routes/monitoring';

// Import public routes from common module
import publicRoutes from './modules/common/routes/publicRoutes';

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);
initSocketService(io);

// Connect to MongoDB
connectDB();

// Initialize Firebase Admin SDK for push notifications
firebaseService.initialize();

// Trust proxy (for CORS and security)
app.set('trust proxy', 1);

// CORS Headers - Apply FIRST before any other middleware
// This ensures CORS headers are sent for all responses
app.use((req, res, next) => {
  // Allow any origin
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  // Allow any HTTP method
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  // Allow any headers
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-restaurant-id, x-subdomain');
  // Allow credentials (cookies, authorization headers)
  res.header('Access-Control-Allow-Credentials', 'true');
  // Cache preflight requests for 24 hours
  res.header('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable for development, configure properly in production
}));

// Compression Middleware (gzip)
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Performance Tracking Middleware
// Track all API requests for monitoring dashboard
app.use(performanceTrackingMiddleware);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data Sanitization against NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_',
}));

// Serve static files (uploaded images) with caching
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
}));

// Serve print service installers
app.use('/downloads', express.static(path.join(__dirname, '../public/downloads'), {
  maxAge: '7d', // Cache for 7 days (installers don't change often)
  etag: true,
  lastModified: true,
}));

/**
 * ============================================
 * MULTI-TENANT ROUTING ARCHITECTURE
 * ============================================
 *
 * MODULAR STRUCTURE:
 * - modules/admin     - Restaurant admin functionality
 * - modules/user      - Customer-facing functionality
 * - modules/superadmin - Platform management
 * - modules/common    - Shared resources (models, middleware, services)
 *
 * Super Admin Routes (No tenant context required):
 * - /api/super-admin/* - Platform management
 *
 * Tenant Routes (Require subdomain extraction):
 * - All other /api/* routes require restaurant context
 */

// Public Routes (NO authentication or tenant context required)
// These routes are used for initial restaurant lookup before login
app.use('/api/public', publicRoutes);

// Super Admin Routes (NO tenant middleware - operates at platform level)
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/super-admin', superAdminFcmTokenRoutes); // Super Admin FCM token management
app.use('/api/superadmin/analytics', platformAnalyticsRoutes);
app.use('/api/superadmin/subscriptions', subscriptionRoutes);
app.use('/api/superadmin/plans', planRoutes);
app.use('/api/superadmin/tickets', ticketRoutes);
app.use('/api/superadmin/audit-logs', auditRoutes);
app.use('/api/superadmin/monitoring', monitoringRoutes); // Real-time monitoring and metrics

// Apply Tenant Extraction Middleware to all other API routes
// This extracts subdomain and validates restaurant before processing requests
app.use('/api/', extractTenant);

// Tenant-Scoped API Routes (All require valid restaurant context)
// Admin Routes (from modules/admin)
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/addons', addOnRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders/bulk', orderBulkRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminFcmTokenRoutes); // Admin FCM token management

// Customer Routes (from modules/user - All tenant-scoped)
app.use('/api/home', homeRoutes); // Combined home page data
app.use('/api/customers/auth', customerAuthRoutes);
app.use('/api/customers/cart', customerCartRoutes);
app.use('/api/customers/favorites', favoritesRoutes);
app.use('/api/customers/orders', customerOrderRoutes);
app.use('/api/customers', fcmTokenRoutes); // FCM token management
app.use('/api/reviews', reviewRoutes);

// Upload Routes (from modules/admin - Tenant-scoped)
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  });
});

// API documentation endpoint
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Patlinks Food Ordering API - Multi-Tenant SaaS Platform',
    version: '3.1.0',
    architecture: 'Multi-Tenant (Subdomain-based) with Modular Structure',
    modules: {
      admin: 'Restaurant administration (13 controllers, 12 routes)',
      user: 'Customer-facing functionality (5 controllers, 5 routes)',
      superadmin: 'Platform management (6 controllers, 6 routes)',
      common: 'Shared resources (15 models, 4 middleware, 2 services)',
    },
    endpoints: {
      superAdmin: '/api/super-admin (Platform management)',
      subscriptions: '/api/superadmin/subscriptions (Subscription management)',
      tickets: '/api/superadmin/tickets (Support ticket system)',
      plans: '/api/superadmin/plans (Subscription plans)',
      auditLogs: '/api/superadmin/audit-logs (Audit logging system)',
      auth: '/api/auth (Admin authentication - Tenant-scoped)',
      categories: '/api/categories (Tenant-scoped)',
      menu: '/api/menu (Tenant-scoped)',
      tables: '/api/tables (Tenant-scoped)',
      orders: '/api/orders (Admin orders - Tenant-scoped)',
      dashboard: '/api/dashboard (Tenant-scoped)',
      search: '/api/search (Tenant-scoped)',
      analytics: '/api/analytics (Tenant-scoped)',
      bulk: '/api/bulk (Tenant-scoped)',
      kitchen: '/api/kitchen (Tenant-scoped)',
      customerAuth: '/api/customers/auth (Customer authentication - Tenant-scoped)',
      customerCart: '/api/customers/cart (Customer cart - Tenant-scoped)',
      customerFavorites: '/api/customers/favorites (Customer favorites - Tenant-scoped)',
      customerOrders: '/api/customers/orders (Customer orders - Tenant-scoped)',
      reviews: '/api/reviews (Customer reviews - Tenant-scoped)',
      upload: '/api/upload (File upload system - Tenant-scoped)',
    },
    features: [
      'Multi-tenant architecture with subdomain isolation',
      'Modular structure for scalability and maintainability',
      'Super admin platform management',
      'Support ticket management system',
      'Subscription management for restaurants',
      'Comprehensive audit logging system',
      'Per-restaurant branding customization',
      'Customer authentication and registration',
      'Customer persistent cart management',
      'Customer favorites management',
      'Customer order history and reordering',
      'Customer reviews and ratings',
      'Tenant-scoped file upload system',
      'Image management for menu items and logos',
      'Advanced search and filtering',
      'Comprehensive analytics',
      'Bulk operations',
      'Order modifications',
      'Kitchen display system',
      'Export functionality',
      'Real-time updates via Socket.io namespaces',
    ],
    tenantAccess: 'Access via subdomain: restaurant1.patlinks.com',
    documentation: 'See API_DOCUMENTATION.md and modules/README.md for full API reference',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: _req.originalUrl,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🍽️  Patlinks Ordering System - Backend Server v3.1    ║
║   🏢  Multi-Tenant SaaS Platform (Modular Architecture)  ║
║                                                           ║
║   Server: http://localhost:${PORT}                        ║
║   Environment: ${NODE_ENV.toUpperCase().padEnd(14)}                      ║
║   Socket.io: ✓ Namespace-Based Isolation                 ║
║   Firebase: ${firebaseService.isReady() ? '✓ Push Notifications Enabled' : '⚠️  Not Configured'}           ║
║   Compression: ✓ Enabled                                  ║
║   Rate Limiting: ✓ Enabled                                ║
║   Security: ✓ Enhanced                                    ║
║                                                           ║
║   API: http://localhost:${PORT}/api                       ║
║   Health: http://localhost:${PORT}/health                 ║
║   Super Admin: http://localhost:${PORT}/api/super-admin   ║
║                                                           ║
║   🏗️  MODULAR ARCHITECTURE:                              ║
║   • modules/admin      - 13 controllers, 12 routes ✓     ║
║   • modules/user       - 5 controllers, 5 routes ✓       ║
║   • modules/superadmin - 6 controllers, 6 routes ✓       ║
║   • modules/common     - Shared resources ✓               ║
║                                                           ║
║   🏢  MULTI-TENANT FEATURES:                              ║
║   • Subdomain-based tenant isolation ✓                    ║
║   • Per-restaurant data segregation ✓                     ║
║   • Super admin platform management ✓                     ║
║   • Custom branding per restaurant ✓                      ║
║   • Socket.io namespace isolation ✓                       ║
║                                                           ║
║   📊 FEATURES:                                            ║
║   • Advanced Search & Filtering ✓                         ║
║   • Analytics & Reports ✓                                 ║
║   • Customer Authentication ✓                             ║
║   • Customer Favorites ✓                                  ║
║   • Customer Reviews & Ratings ✓                          ║
║   • Bulk Operations ✓                                     ║
║   • Order Modifications ✓                                 ║
║   • Kitchen Display System ✓                              ║
║   • Export Functionality ✓                                ║
║                                                           ║
║   🔒 Security & Performance:                              ║
║   • Request validation ✓                                  ║
║   • MongoDB query optimization ✓                          ║
║   • Gzip compression ✓                                    ║
║   • Static file caching ✓                                 ║
║   • NoSQL injection protection ✓                          ║
║   • Tenant data isolation ✓                               ║
║   • CORS enabled for all origins ✓                        ║
║                                                           ║
║   📋 Total Endpoints: 130+                                ║
║   📁 Total Files: 74+ modular files                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  if (NODE_ENV === 'development') {
    console.log('💡 Development mode active');
    console.log('📝 Logging: Detailed');
    console.log('🔄 Hot reload: Enabled');
    console.log('🏗️  Modular structure: Active');
    console.log('🏢 Tenant mode: Subdomain-based (use x-restaurant-id header for dev bypass)\n');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated!');
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n👋 SIGINT RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated!');
    process.exit(0);
  });
});

export default app;
