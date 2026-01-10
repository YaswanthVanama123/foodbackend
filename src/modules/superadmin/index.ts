/**
 * SuperAdmin Module
 * Platform administration functionality
 */

// Controllers
export * from './controllers/superAdminController';
export * from './controllers/subscriptionController';
export * from './controllers/planController';
export * from './controllers/ticketController';
export * from './controllers/auditController';
export * from './controllers/platformAnalyticsController';
export * from './controllers/fcmTokenController';

// Routes
export { default as superAdminRoutes } from './routes/superAdminRoutes';
export { default as subscriptionRoutes } from './routes/subscriptionRoutes';
export { default as planRoutes } from './routes/planRoutes';
export { default as ticketRoutes } from './routes/ticketRoutes';
export { default as auditRoutes } from './routes/auditRoutes';
export { default as platformAnalyticsRoutes } from './routes/platformAnalyticsRoutes';
export { default as fcmTokenRoutes } from './routes/fcmTokenRoutes';
