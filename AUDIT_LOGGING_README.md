# Audit Logging System - Quick Start

## Overview

A comprehensive audit logging system has been implemented for the Patlinks platform to track all critical actions performed by super admins, admins, and customers.

## What's Been Created

### Core Components

1. **AuditLog Model** (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/models/AuditLog.ts`)
   - MongoDB schema with comprehensive fields
   - Optimized indexes for fast queries
   - Support for before/after change tracking
   - Severity levels (info, warning, error, critical)

2. **Audit Service** (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/services/auditService.ts`)
   - `logAction()`: Create audit log entries
   - `getAuditLogs()`: Retrieve logs with filters and pagination
   - `exportAuditLogs()`: Export to CSV/JSON
   - `getAuditStatistics()`: Get audit statistics
   - `deleteOldLogs()`: Data retention management

3. **Audit Controller** (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/controllers/auditController.ts`)
   - Request handlers for all audit operations
   - Validation and error handling
   - Support for filtering, pagination, and export

4. **Audit Routes** (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/routes/auditRoutes.ts`)
   - All routes protected with super admin authentication
   - RESTful endpoint design

5. **Audit Middleware** (`/Users/yaswanthgandhi/Documents/patlinks/packages/backend/src/middleware/auditMiddleware.ts`)
   - Automatic logging middleware
   - Manual logging helpers
   - Authentication event logging
   - Asynchronous logging (non-blocking)

### Documentation

1. **AUDIT_LOGGING_DOCUMENTATION.md**: Comprehensive documentation with API examples
2. **AUDIT_INTEGRATION_GUIDE.md**: Step-by-step integration guide for existing routes

### Server Integration

- Routes mounted at `/api/superadmin/audit-logs`
- Added to API documentation endpoint
- Listed in server startup banner

## Installation & Setup

### Step 1: Install Dependencies

```bash
cd /Users/yaswanthgandhi/Documents/patlinks/packages/backend
npm install json2csv
```

### Step 2: Start the Server

```bash
npm run dev
```

The audit logging system is now active!

## Available API Endpoints

All endpoints require super admin authentication.

- `GET /api/superadmin/audit-logs` - List audit logs with filtering
- `GET /api/superadmin/audit-logs/stats` - Get statistics
- `GET /api/superadmin/audit-logs/export` - Export to CSV/JSON
- `GET /api/superadmin/audit-logs/actor/:actorId` - Get logs by actor
- `GET /api/superadmin/audit-logs/resource/:resourceId` - Get logs by resource
- `GET /api/superadmin/audit-logs/:id` - Get single log details
- `DELETE /api/superadmin/audit-logs/cleanup` - Delete old logs

## Quick Usage Examples

### 1. Automatic Logging (Recommended)

Add middleware to your routes:

```typescript
import { auditSuperAdminAction } from '../middleware/auditMiddleware';

router.post(
  '/restaurants',
  superAdminAuth,
  auditSuperAdminAction('restaurant.created', 'restaurant'),
  createRestaurant
);

router.delete(
  '/restaurants/:id',
  superAdminAuth,
  auditSuperAdminAction('restaurant.deleted', 'restaurant', (req, res) => 'critical'),
  deleteRestaurant
);
```

### 2. Manual Logging

For complex operations:

```typescript
import { logAuditAction } from '../middleware/auditMiddleware';

export const bulkDelete = async (req: Request, res: Response) => {
  // Perform operation
  const result = await Restaurant.deleteMany({ _id: { $in: ids } });

  // Log action
  await logAuditAction(
    req,
    'restaurant.bulk_deleted',
    'restaurant',
    { after: { deletedCount: result.deletedCount } },
    undefined,
    'critical'
  );

  res.json({ success: true, data: result });
};
```

### 3. Authentication Event Logging

```typescript
import { auditAuthEvent } from '../middleware/auditMiddleware';

// Log successful login
await auditAuthEvent(
  'login.success',
  'super_admin',
  superAdmin._id.toString(),
  superAdmin.username,
  req,
  'info'
);
```

## Testing the System

### Test with cURL

```bash
# Get audit logs (replace with your super admin token)
curl -X GET "http://localhost:5000/api/superadmin/audit-logs" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Get statistics
curl -X GET "http://localhost:5000/api/superadmin/audit-logs/stats" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Export to CSV
curl -X GET "http://localhost:5000/api/superadmin/audit-logs/export?format=csv" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -o audit-logs.csv

# Filter by severity
curl -X GET "http://localhost:5000/api/superadmin/audit-logs?severity=critical&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

## Features

- Automatic logging via middleware
- Manual logging for custom operations
- Advanced filtering (by action, actor, resource, severity, date range, search)
- Pagination support
- CSV and JSON export
- Audit statistics and analytics
- Before/after change tracking
- IP address and user agent tracking
- Response time tracking
- Configurable data retention
- Optimized database indexes
- Asynchronous logging (non-blocking)

## Standard Action Names

Use these standardized action names:

**Restaurant Actions:**
- `restaurant.created`, `restaurant.updated`, `restaurant.deleted`
- `restaurant.suspended`, `restaurant.activated`

**Admin Actions:**
- `admin.created`, `admin.updated`, `admin.deleted`
- `admin.role_changed`, `admin.permissions_updated`

**Authentication Actions:**
- `login.success`, `login.failed`, `logout`

**System Actions:**
- `settings.updated`, `subscription.updated`, `system.backup_created`

See `AUDIT_LOGGING_DOCUMENTATION.md` for the complete list.

## Severity Levels

- **info**: Normal operations (create, read, update)
- **warning**: Suspicious activities or validation failures
- **error**: Failed operations or errors
- **critical**: Deletions, suspensions, security changes

## Next Steps

1. **Install json2csv**: `npm install json2csv`
2. **Review Documentation**: Read `AUDIT_LOGGING_DOCUMENTATION.md`
3. **Integrate into Routes**: Follow `AUDIT_INTEGRATION_GUIDE.md`
4. **Test the System**: Use the provided cURL examples
5. **Configure Retention**: Set up data retention policies
6. **Monitor Critical Logs**: Set up alerts for critical events

## File Locations

```
/Users/yaswanthgandhi/Documents/patlinks/packages/backend/
├── src/
│   ├── models/
│   │   └── AuditLog.ts                    # MongoDB model
│   ├── services/
│   │   └── auditService.ts                # Business logic
│   ├── controllers/
│   │   └── auditController.ts             # Request handlers
│   ├── routes/
│   │   └── auditRoutes.ts                 # API routes
│   ├── middleware/
│   │   └── auditMiddleware.ts             # Logging middleware
│   └── server.ts                          # Routes mounted here
├── AUDIT_LOGGING_DOCUMENTATION.md         # Comprehensive docs
├── AUDIT_INTEGRATION_GUIDE.md             # Integration guide
└── AUDIT_LOGGING_README.md                # This file
```

## Support

For questions or issues:
1. Check the comprehensive documentation: `AUDIT_LOGGING_DOCUMENTATION.md`
2. Review the integration guide: `AUDIT_INTEGRATION_GUIDE.md`
3. Examine the code comments in the source files
4. Test with the provided examples

## Architecture Highlights

- **Non-blocking**: Logging happens asynchronously after response is sent
- **Scalable**: Optimized indexes for fast queries on large datasets
- **Secure**: All routes require super admin authentication
- **Immutable**: Logs are read-only (no update endpoint)
- **Flexible**: Support for automatic and manual logging
- **Compliant**: Export functionality for compliance requirements

## Performance Considerations

- Asynchronous logging doesn't block API responses
- Optimized compound indexes for common query patterns
- Export limited to 10,000 records to prevent memory issues
- Pagination required for large result sets
- Optional TTL index for automatic cleanup

## Security Features

- Super admin authentication required for all endpoints
- No modification of existing logs (immutable)
- IP address and user agent tracking
- Failed login attempt logging
- Critical action logging with high severity

## Database Indexes

The following indexes are created automatically:

- Single indexes: action, actorId, resourceId, timestamp, actorType, resourceType, severity
- Compound indexes for common queries
- Optional TTL index for automatic cleanup (disabled by default)

## System Status

- Status: Ready to use
- Installation Required: `npm install json2csv`
- Routes Mounted: `/api/superadmin/audit-logs`
- Authentication: Super admin required
- Documentation: Complete
- Integration Guide: Available
