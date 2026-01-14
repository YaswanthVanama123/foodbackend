import { Request, Response, NextFunction } from 'express';

// Import metrics collector for error tracking
const metricsCollector = require('../services/metricsCollector');

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);

  // Track error in metrics
  metricsCollector.trackError(err, {
    path: req.path,
    method: req.method,
    restaurantId: req.headers['x-restaurant-id'],
    statusCode: err.statusCode || 500,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e: any) => e.message);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
    return;
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
    return;
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
};
