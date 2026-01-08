/**
 * Admin Module
 * Restaurant administration functionality
 */

// Controllers
export * from './controllers/authController';
export * from './controllers/menuController';
export * from './controllers/categoryController';
export * from './controllers/tableController';
export * from './controllers/orderController';
export * from './controllers/orderModificationController';
export * from './controllers/kitchenController';
export * from './controllers/analyticsController';
export * from './controllers/bulkController';
export * from './controllers/searchController';
export * from './controllers/dashboardController';
export * from './controllers/uploadController';
export * from './controllers/orderBulkController';

// Routes
export { default as authRoutes } from './routes/authRoutes';
export { default as menuRoutes } from './routes/menuRoutes';
export { default as categoryRoutes } from './routes/categoryRoutes';
export { default as tableRoutes } from './routes/tableRoutes';
export { default as orderRoutes } from './routes/orderRoutes';
export { default as kitchenRoutes } from './routes/kitchenRoutes';
export { default as analyticsRoutes } from './routes/analyticsRoutes';
export { default as bulkRoutes } from './routes/bulkRoutes';
export { default as searchRoutes } from './routes/searchRoutes';
export { default as dashboardRoutes } from './routes/dashboardRoutes';
export { default as uploadRoutes } from './routes/uploadRoutes';
export { default as orderBulkRoutes } from './routes/orderBulkRoutes';
