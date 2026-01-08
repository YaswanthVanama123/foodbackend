# Audit Logging System Documentation

## Overview

The comprehensive audit logging system tracks all critical actions performed by super admins, admins, and customers within the Patlinks platform. It provides detailed tracking, filtering, export capabilities, and statistics for compliance and security purposes.

## Features

- Automatic logging of super-admin actions
- Manual logging for custom actions
- Advanced filtering and searching
- Pagination support
- CSV and JSON export
- Audit statistics and analytics
- Resource and actor tracking
- Severity levels (info, warning, error, critical)
- IP address and user agent tracking
- Response time tracking
- Data retention management

## Installation Requirements

Before using the audit logging system, install the required dependency:

```bash
cd /Users/yaswanthgandhi/Documents/patlinks/packages/backend
npm install json2csv
```

## Components

### 1. AuditLog Model (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/models/AuditLog.ts`)

The model defines the structure for audit log entries:

**Fields:**
- `action`: Action performed (e.g., 'restaurant.created', 'user.deleted')
- `actorType`: 'super_admin' | 'admin' | 'customer'
- `actorId`: ObjectId reference to the actor
- `actorName`: Display name of the actor
- `resourceType`: Type of resource affected (e.g., 'restaurant', 'user')
- `resourceId`: ObjectId reference to the resource
- `changes`: Before/after values of changes
- `metadata`: Additional data (IP, user agent, etc.)
- `severity`: 'info' | 'warning' | 'error' | 'critical'
- `timestamp`: Date of the action

**Indexes:**
- Single indexes on: action, actorId, resourceId, timestamp, actorType, resourceType, severity
- Compound indexes for common query patterns

### 2. Audit Service (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/services/auditService.ts`)

The service handles all audit logging operations:

**Methods:**
- `logAction()`: Create an audit log entry
- `getAuditLogs()`: Retrieve logs with filters and pagination
- `getAuditLogById()`: Get a specific log entry
- `getLogsByActor()`: Get all logs for a specific user
- `getLogsByResource()`: Get all logs for a specific resource
- `exportAuditLogs()`: Export logs to CSV or JSON
- `getAuditStatistics()`: Get audit statistics
- `deleteOldLogs()`: Data retention cleanup

### 3. Audit Controller (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/controllers/auditController.ts`)

The controller handles HTTP requests:

**Endpoints:**
- `getAuditLogs`: List logs with filtering
- `getAuditLogById`: Get single log details
- `exportAuditLogs`: Export to CSV/JSON
- `getAuditStatistics`: Get statistics
- `getLogsByActor`: Get logs by actor
- `getLogsByResource`: Get logs by resource
- `cleanupOldLogs`: Delete old logs

### 4. Audit Routes (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/routes/auditRoutes.ts`)

All routes are protected by super admin authentication:

- `GET /api/superadmin/audit-logs`: List audit logs
- `GET /api/superadmin/audit-logs/stats`: Get statistics
- `GET /api/superadmin/audit-logs/export`: Export logs
- `GET /api/superadmin/audit-logs/actor/:actorId`: Get logs by actor
- `GET /api/superadmin/audit-logs/resource/:resourceId`: Get logs by resource
- `GET /api/superadmin/audit-logs/:id`: Get single log
- `DELETE /api/superadmin/audit-logs/cleanup`: Delete old logs

### 5. Audit Middleware (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/middleware/auditMiddleware.ts`)

Middleware for automatic and manual logging:

**Functions:**
- `auditMiddleware()`: Automatic logging middleware
- `auditSuperAdminAction()`: Convenience wrapper for super admin actions
- `auditAdminAction()`: Convenience wrapper for admin actions
- `logAuditAction()`: Manual logging helper
- `auditAuthEvent()`: Log authentication events

## Usage Examples

### 1. Automatic Logging with Middleware

Apply the middleware to routes that need automatic audit logging:

```typescript
import { auditSuperAdminAction } from '../middleware/auditMiddleware';
import { superAdminAuth } from '../middleware/authMiddleware';

// Example: Log restaurant creation
router.post(
  '/restaurants',
  superAdminAuth,
  auditSuperAdminAction('restaurant.created', 'restaurant'),
  createRestaurant
);

// Example: Log restaurant deletion (critical action)
router.delete(
  '/restaurants/:id',
  superAdminAuth,
  auditSuperAdminAction('restaurant.deleted', 'restaurant', (req, res) => 'critical'),
  deleteRestaurant
);

// Example: Log admin update
router.put(
  '/admins/:id',
  superAdminAuth,
  auditSuperAdminAction('admin.updated', 'admin'),
  updateAdmin
);
```

### 2. Manual Logging

For complex operations or bulk actions, use manual logging:

```typescript
import { logAuditAction } from '../middleware/auditMiddleware';

export const bulkDeleteRestaurants = async (req: Request, res: Response) => {
  try {
    const { restaurantIds } = req.body;

    // Perform bulk delete
    const result = await Restaurant.deleteMany({ _id: { $in: restaurantIds } });

    // Manually log the action
    await logAuditAction(
      req,
      'restaurant.bulk_deleted',
      'restaurant',
      {
        after: {
          deletedCount: result.deletedCount,
          restaurantIds: restaurantIds,
        },
      },
      undefined,
      'critical'
    );

    res.status(200).json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

### 3. Log Authentication Events

Use the auth event logger for login/logout:

```typescript
import { auditAuthEvent } from '../middleware/auditMiddleware';

export const superAdminLogin = async (req: Request, res: Response) => {
  try {
    // ... authentication logic ...

    if (isPasswordMatch) {
      // Log successful login
      await auditAuthEvent(
        'login.success',
        'super_admin',
        superAdmin._id.toString(),
        superAdmin.username,
        req,
        'info'
      );

      res.status(200).json({ success: true, token });
    } else {
      // Log failed login attempt
      await auditAuthEvent(
        'login.failed',
        'super_admin',
        superAdmin._id.toString(),
        superAdmin.username,
        req,
        'warning'
      );

      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

### 4. Direct Service Usage

Use the audit service directly for custom logging:

```typescript
import auditService from '../services/auditService';

// Create a log entry
await auditService.logAction(
  'custom.action',
  {
    type: 'super_admin',
    id: req.superAdmin._id,
    name: req.superAdmin.username,
  },
  {
    type: 'system',
    id: undefined,
  },
  {
    before: { setting: 'old_value' },
    after: { setting: 'new_value' },
  },
  {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    method: req.method,
    endpoint: req.originalUrl,
  },
  'info'
);
```

## API Usage Examples

### Get Audit Logs with Filters

```bash
# Get all audit logs
GET /api/superadmin/audit-logs
Authorization: Bearer <super_admin_token>

# Filter by action
GET /api/superadmin/audit-logs?action=restaurant.created
Authorization: Bearer <super_admin_token>

# Filter by actor type
GET /api/superadmin/audit-logs?actorType=super_admin
Authorization: Bearer <super_admin_token>

# Filter by severity
GET /api/superadmin/audit-logs?severity=critical
Authorization: Bearer <super_admin_token>

# Filter by date range
GET /api/superadmin/audit-logs?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <super_admin_token>

# Search in action or actor name
GET /api/superadmin/audit-logs?search=restaurant
Authorization: Bearer <super_admin_token>

# Pagination
GET /api/superadmin/audit-logs?page=2&limit=50
Authorization: Bearer <super_admin_token>

# Combine filters
GET /api/superadmin/audit-logs?actorType=super_admin&severity=critical&page=1&limit=20
Authorization: Bearer <super_admin_token>
```

### Get Audit Statistics

```bash
GET /api/superadmin/audit-logs/stats
Authorization: Bearer <super_admin_token>

# With filters
GET /api/superadmin/audit-logs/stats?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <super_admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "bySeverity": {
      "info": 1200,
      "warning": 200,
      "error": 80,
      "critical": 20
    },
    "byActorType": {
      "super_admin": 500,
      "admin": 800,
      "customer": 200
    },
    "byAction": [
      { "action": "restaurant.created", "count": 50 },
      { "action": "order.created", "count": 300 },
      { "action": "menu.updated", "count": 150 }
    ],
    "recent": [
      // 10 most recent logs
    ]
  }
}
```

### Export Audit Logs

```bash
# Export to CSV
GET /api/superadmin/audit-logs/export?format=csv
Authorization: Bearer <super_admin_token>

# Export to JSON
GET /api/superadmin/audit-logs/export?format=json
Authorization: Bearer <super_admin_token>

# Export with filters
GET /api/superadmin/audit-logs/export?format=csv&startDate=2024-01-01&severity=critical
Authorization: Bearer <super_admin_token>

# Export with custom fields
GET /api/superadmin/audit-logs/export?format=csv&fields=timestamp,action,actorName,severity
Authorization: Bearer <super_admin_token>
```

### Get Logs by Actor

```bash
GET /api/superadmin/audit-logs/actor/507f1f77bcf86cd799439011?actorType=super_admin&page=1&limit=50
Authorization: Bearer <super_admin_token>
```

### Get Logs by Resource

```bash
GET /api/superadmin/audit-logs/resource/507f1f77bcf86cd799439011?resourceType=restaurant&page=1&limit=50
Authorization: Bearer <super_admin_token>
```

### Get Single Audit Log

```bash
GET /api/superadmin/audit-logs/507f1f77bcf86cd799439011
Authorization: Bearer <super_admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "action": "restaurant.created",
    "actorType": "super_admin",
    "actorId": "507f191e810c19729de860ea",
    "actorName": "admin@example.com",
    "resourceType": "restaurant",
    "resourceId": "507f1f77bcf86cd799439012",
    "changes": {
      "after": {
        "name": "New Restaurant",
        "subdomain": "new-restaurant"
      }
    },
    "metadata": {
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "method": "POST",
      "endpoint": "/api/super-admin/restaurants",
      "statusCode": 201,
      "duration": 245
    },
    "severity": "info",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Data Retention - Delete Old Logs

```bash
# Delete logs older than 365 days (default)
DELETE /api/superadmin/audit-logs/cleanup
Authorization: Bearer <super_admin_token>

# Delete logs older than 90 days
DELETE /api/superadmin/audit-logs/cleanup?daysToKeep=90
Authorization: Bearer <super_admin_token>
```

Response:
```json
{
  "success": true,
  "message": "Successfully deleted 1500 old audit logs",
  "data": {
    "deletedCount": 1500,
    "daysToKeep": 90
  }
}
```

## Common Action Names

Use these standardized action names for consistency:

### Restaurant Actions
- `restaurant.created`
- `restaurant.updated`
- `restaurant.deleted`
- `restaurant.suspended`
- `restaurant.activated`
- `restaurant.branding_updated`
- `restaurant.settings_updated`

### Admin Actions
- `admin.created`
- `admin.updated`
- `admin.deleted`
- `admin.role_changed`
- `admin.permissions_updated`

### User/Customer Actions
- `user.created`
- `user.updated`
- `user.deleted`
- `customer.registered`
- `customer.updated`

### Order Actions
- `order.created`
- `order.updated`
- `order.cancelled`
- `order.completed`
- `order.refunded`

### Menu Actions
- `menu.created`
- `menu.updated`
- `menu.deleted`
- `menu.price_updated`

### Authentication Actions
- `login.success`
- `login.failed`
- `logout`
- `password.changed`
- `password.reset`

### System Actions
- `settings.updated`
- `subscription.updated`
- `subscription.cancelled`
- `system.backup_created`
- `system.maintenance`

## Severity Levels

Use appropriate severity levels:

- **info**: Normal operations (create, read, update)
- **warning**: Suspicious activities or validation failures
- **error**: Failed operations or errors
- **critical**: Deletions, suspensions, or security-related actions

## Best Practices

1. **Always log critical actions**: Deletions, suspensions, and security changes
2. **Use descriptive action names**: Follow the standardized naming convention
3. **Include relevant metadata**: IP address, user agent, and endpoint
4. **Track changes**: Include before/after values for updates
5. **Set appropriate severity**: Critical for deletions, warning for failures
6. **Regular cleanup**: Schedule periodic cleanup of old logs
7. **Monitor critical logs**: Set up alerts for critical severity logs
8. **Export for compliance**: Regularly export logs for compliance purposes

## Performance Considerations

1. **Indexes**: The model includes optimized indexes for common queries
2. **Async logging**: Middleware logs asynchronously to avoid blocking responses
3. **Pagination**: Always use pagination for large result sets
4. **Export limits**: Export is limited to 10,000 records for performance
5. **TTL index**: Uncomment the TTL index in the model for automatic cleanup

## Security Considerations

1. **Super admin only**: All audit routes require super admin authentication
2. **No modification**: Audit logs are read-only (no update endpoint)
3. **Immutable**: Once created, logs cannot be modified
4. **Retention**: Configure appropriate data retention policies
5. **Access logging**: Consider logging access to audit logs themselves

## Testing the Audit System

1. **Install dependencies**:
```bash
cd /Users/yaswanthgandhi/Documents/patlinks/packages/backend
npm install json2csv
```

2. **Start the server**:
```bash
npm run dev
```

3. **Test automatic logging**: Make a request to a protected route
4. **Test manual logging**: Call the service directly
5. **View logs**: Use the API endpoints to retrieve and filter logs
6. **Export logs**: Test CSV and JSON export functionality

## Troubleshooting

**Issue**: Logs not being created
- Check if middleware is applied to the route
- Verify authentication is working
- Check console for error messages

**Issue**: Export fails
- Install json2csv: `npm install json2csv`
- Check if logs exist for the given filters

**Issue**: Performance issues
- Add indexes if querying by custom fields
- Use pagination for large result sets
- Consider archiving old logs

## Future Enhancements

- Real-time audit log streaming via WebSocket
- Advanced analytics dashboard
- Automated alert system for critical events
- Integration with external logging services
- Audit log archiving to cold storage
- Machine learning for anomaly detection
