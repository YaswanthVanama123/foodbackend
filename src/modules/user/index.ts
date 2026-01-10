/**
 * User Module
 * Customer-facing functionality
 */

// Controllers
export * from './controllers/customerAuthController';
export * from './controllers/customerCartController';
export * from './controllers/customerOrderController';
export * from './controllers/reviewController';
export * from './controllers/favoritesController';
export * from './controllers/fcmTokenController';
// Note: homeController is not exported to avoid naming conflict with fcmTokenController
// Both export registerFCMToken function, but serve different routes

// Routes
export { default as customerAuthRoutes } from './routes/customerAuthRoutes';
export { default as customerCartRoutes } from './routes/customerCartRoutes';
export { default as customerOrderRoutes } from './routes/customerOrderRoutes';
export { default as reviewRoutes } from './routes/reviewRoutes';
export { default as favoritesRoutes } from './routes/favoritesRoutes';
export { default as fcmTokenRoutes } from './routes/fcmTokenRoutes';
export { default as homeRoutes } from './routes/homeRoutes';

