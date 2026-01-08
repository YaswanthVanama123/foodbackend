import { Request, Response, NextFunction } from 'express';
import auditService from './services/auditService';

/**
 * Audit Middleware - Automatically logs super admin actions
 *
 * This middleware should be applied to routes that need automatic audit logging.
 * It captures request details, user information, and response status.
 *
 * Usage:
 * - Apply after authentication middleware
 * - Apply to routes that modify data (POST, PUT, PATCH, DELETE)
 *
 * Example:
 * router.post('/restaurants', superAdminAuth, auditMiddleware('restaurant.created', 'restaurant'), createRestaurant);
 */

/**
 * Create audit middleware for a specific action
 * @param action - The action being performed (e.g., 'restaurant.created', 'user.deleted')
 * @param resourceType - The type of resource being affected (e.g., 'restaurant', 'user')
 * @param getSeverity - Optional function to determine severity based on request/response
 */
export const auditMiddleware = (
  action: string,
  resourceType: string,
  getSeverity?: (req: Request, res: Response) => 'info' | 'warning' | 'error' | 'critical'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original end function
    const originalEnd = res.end;
    const originalJson = res.json;

    // Track timing
    const startTime = Date.now();

    // Variables to capture response data
    let responseBody: any = null;
    let statusCode = 200;

    // Override res.json to capture response body
    res.json = function(body?: any): Response {
      responseBody = body;
      statusCode = res.statusCode;
      return originalJson.call(this, body);
    };

    // Override res.end to log after response is sent
    res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Restore original functions
      res.end = originalEnd;
      res.json = originalJson;

      // Log asynchronously (don't block response)
      setImmediate(async () => {
        try {
          // Determine actor
          let actor: any = null;
          let actorType: 'super_admin' | 'admin' | 'customer' = 'super_admin';

          if (req.superAdmin) {
            actor = req.superAdmin;
            actorType = 'super_admin';
          } else if (req.admin) {
            actor = req.admin;
            actorType = 'admin';
          } else if (req.customer) {
            actor = req.customer;
            actorType = 'customer';
          }

          // Skip logging if no authenticated user
          if (!actor) {
            return;
          }

          // Get actor name
          const actorName = actor.fullName || actor.username || actor.email || 'Unknown';

          // Get resource ID from response body or request params
          let resourceId = null;
          if (responseBody && responseBody.data) {
            // Try to extract ID from response
            resourceId = responseBody.data._id || responseBody.data.id || null;
          }
          if (!resourceId && req.params.id) {
            // Try to get from request params
            resourceId = req.params.id;
          }

          // Build metadata
          const metadata = {
            ip: req.ip || req.connection.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            method: req.method,
            endpoint: req.originalUrl || req.url,
            statusCode: statusCode,
            duration: duration,
          };

          // Determine severity
          let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';
          if (getSeverity) {
            severity = getSeverity(req, res);
          } else {
            // Default severity based on status code
            if (statusCode >= 500) {
              severity = 'error';
            } else if (statusCode >= 400) {
              severity = 'warning';
            } else {
              severity = 'info';
            }
          }

          // Determine if this is a delete/critical operation
          if (action.includes('deleted') || action.includes('suspended') || req.method === 'DELETE') {
            severity = 'critical';
          }

          // Build changes object for update operations
          let changes: any = undefined;
          if (req.method === 'PUT' || req.method === 'PATCH') {
            changes = {
              before: null, // Could be populated if we fetch the resource before update
              after: req.body,
            };
          } else if (req.method === 'POST') {
            changes = {
              after: req.body,
            };
          } else if (req.method === 'DELETE') {
            changes = {
              before: null, // Could be populated if we fetch the resource before delete
            };
          }

          // Log the action
          await auditService.logAction(
            action,
            {
              type: actorType,
              id: actor._id,
              name: actorName,
            },
            {
              type: resourceType,
              id: resourceId,
            },
            changes,
            metadata,
            severity
          );
        } catch (error) {
          console.error('Error logging audit trail:', error);
          // Don't throw - we don't want audit logging to break the application
        }
      });

      // Call original end function
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
};

/**
 * Audit middleware for super admin actions
 * This is a convenience wrapper that sets the default actor type to super_admin
 */
export const auditSuperAdminAction = (
  action: string,
  resourceType: string,
  getSeverity?: (req: Request, res: Response) => 'info' | 'warning' | 'error' | 'critical'
) => {
  return auditMiddleware(action, resourceType, getSeverity);
};

/**
 * Audit middleware for admin actions
 * This is a convenience wrapper that sets the default actor type to admin
 */
export const auditAdminAction = (
  action: string,
  resourceType: string,
  getSeverity?: (req: Request, res: Response) => 'info' | 'warning' | 'error' | 'critical'
) => {
  return auditMiddleware(action, resourceType, getSeverity);
};

/**
 * Manual audit logging helper
 * Use this when you need to log an action that doesn't fit the middleware pattern
 *
 * Example:
 * await logAuditAction(req, 'restaurant.bulk_updated', 'restaurant', { updated: 5 });
 */
export const logAuditAction = async (
  req: Request,
  action: string,
  resourceType: string,
  changes?: any,
  resourceId?: string,
  severity?: 'info' | 'warning' | 'error' | 'critical'
): Promise<void> => {
  try {
    // Determine actor
    let actor: any = null;
    let actorType: 'super_admin' | 'admin' | 'customer' = 'super_admin';

    if (req.superAdmin) {
      actor = req.superAdmin;
      actorType = 'super_admin';
    } else if (req.admin) {
      actor = req.admin;
      actorType = 'admin';
    } else if (req.customer) {
      actor = req.customer;
      actorType = 'customer';
    }

    // Skip logging if no authenticated user
    if (!actor) {
      return;
    }

    // Get actor name
    const actorName = actor.fullName || actor.username || actor.email || 'Unknown';

    // Build metadata
    const metadata = {
      ip: req.ip || req.connection.remoteAddress || '',
      userAgent: req.get('user-agent') || '',
      method: req.method,
      endpoint: req.originalUrl || req.url,
    };

    // Log the action
    await auditService.logAction(
      action,
      {
        type: actorType,
        id: actor._id,
        name: actorName,
      },
      {
        type: resourceType,
        id: resourceId,
      },
      changes,
      metadata,
      severity || 'info'
    );
  } catch (error) {
    console.error('Error logging audit trail:', error);
    // Don't throw - we don't want audit logging to break the application
  }
};

/**
 * Audit middleware for authentication events
 * Logs login, logout, and authentication failures
 */
export const auditAuthEvent = async (
  action: 'login.success' | 'login.failed' | 'logout',
  actorType: 'super_admin' | 'admin' | 'customer',
  actorId: string,
  actorName: string,
  req: Request,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
): Promise<void> => {
  try {
    const metadata = {
      ip: req.ip || req.connection.remoteAddress || '',
      userAgent: req.get('user-agent') || '',
      method: req.method,
      endpoint: req.originalUrl || req.url,
    };

    await auditService.logAction(
      action,
      {
        type: actorType,
        id: actorId,
        name: actorName,
      },
      {
        type: 'authentication',
      },
      undefined,
      metadata,
      severity
    );
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
};
