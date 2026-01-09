/**
 * User Module
 * Customer-facing functionality
 */

// Controllers
export * from './controllers/customerAuthController';
export * from './controllers/customerCartController';
export * from './controllers/customerOrderController';
export * from './controllers/reviewController';
// export * from './controllers/favoritesController'; // Disabled - not needed for simple username auth
// Routes
export { default as customerAuthRoutes } from './routes/customerAuthRoutes';
export { default as customerCartRoutes } from './routes/customerCartRoutes';
export { default as customerOrderRoutes } from './routes/customerOrderRoutes';
export { default as reviewRoutes } from './routes/reviewRoutes';
// export { default as favoritesRoutes } from './routes/favoritesRoutes'; // Disabled - not needed for simple username auth

