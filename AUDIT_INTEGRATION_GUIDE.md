# Audit Logging Integration Guide

This guide shows how to integrate audit logging into existing super admin routes.

## Step 1: Install Required Dependency

```bash
cd /Users/yaswanthgandhi/Documents/patlinks/packages/backend
npm install json2csv
```

## Step 2: Import Audit Middleware

Add the import to your route file:

```typescript
import { auditSuperAdminAction, logAuditAction } from '../middleware/auditMiddleware';
```

## Step 3: Apply Middleware to Routes

### Example: Restaurant Routes

```typescript
import express from 'express';
import { superAdminAuth } from '../middleware/authMiddleware';
import { auditSuperAdminAction } from '../middleware/auditMiddleware';
import {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  suspendRestaurant,
  activateRestaurant,
} from '../controllers/superAdminController';

const router = express.Router();

// CREATE - Automatically log restaurant creation
router.post(
  '/restaurants',
  superAdminAuth,
  auditSuperAdminAction('restaurant.created', 'restaurant'),
  createRestaurant
);

// UPDATE - Automatically log restaurant updates
router.put(
  '/restaurants/:id',
  superAdminAuth,
  auditSuperAdminAction('restaurant.updated', 'restaurant'),
  updateRestaurant
);

// DELETE - Log as critical action
router.delete(
  '/restaurants/:id',
  superAdminAuth,
  auditSuperAdminAction('restaurant.deleted', 'restaurant', (req, res) => 'critical'),
  deleteRestaurant
);

// SUSPEND - Log as critical action
router.patch(
  '/restaurants/:id/suspend',
  superAdminAuth,
  auditSuperAdminAction('restaurant.suspended', 'restaurant', (req, res) => 'critical'),
  suspendRestaurant
);

// ACTIVATE - Log as info
router.patch(
  '/restaurants/:id/activate',
  superAdminAuth,
  auditSuperAdminAction('restaurant.activated', 'restaurant'),
  activateRestaurant
);

export default router;
```

### Example: Admin Management Routes

```typescript
import express from 'express';
import { superAdminAuth } from '../middleware/authMiddleware';
import { auditSuperAdminAction } from '../middleware/auditMiddleware';
import {
  createAdmin,
  updateAdmin,
  deleteAdmin,
  updateAdminRole,
} from '../controllers/adminController';

const router = express.Router();

router.post(
  '/admins',
  superAdminAuth,
  auditSuperAdminAction('admin.created', 'admin'),
  createAdmin
);

router.put(
  '/admins/:id',
  superAdminAuth,
  auditSuperAdminAction('admin.updated', 'admin'),
  updateAdmin
);

router.delete(
  '/admins/:id',
  superAdminAuth,
  auditSuperAdminAction('admin.deleted', 'admin', (req, res) => 'critical'),
  deleteAdmin
);

router.patch(
  '/admins/:id/role',
  superAdminAuth,
  auditSuperAdminAction('admin.role_changed', 'admin', (req, res) => 'warning'),
  updateAdminRole
);

export default router;
```

## Step 4: Add Manual Logging for Complex Operations

For bulk operations or custom logic, use manual logging:

```typescript
import { Request, Response } from 'express';
import { logAuditAction } from '../middleware/auditMiddleware';
import Restaurant from '../models/Restaurant';

export const bulkUpdateRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantIds, updates } = req.body;

    // Perform bulk update
    const result = await Restaurant.updateMany(
      { _id: { $in: restaurantIds } },
      { $set: updates }
    );

    // Manually log the bulk operation
    await logAuditAction(
      req,
      'restaurant.bulk_updated',
      'restaurant',
      {
        after: {
          updatedCount: result.modifiedCount,
          restaurantIds: restaurantIds,
          updates: updates,
        },
      },
      undefined,
      'info'
    );

    res.status(200).json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error: any) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update restaurants',
      error: error.message,
    });
  }
};

export const bulkDeleteRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantIds } = req.body;

    // Fetch restaurant names before deletion for logging
    const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } }).select('name subdomain');

    // Perform bulk delete
    const result = await Restaurant.deleteMany({ _id: { $in: restaurantIds } });

    // Manually log the bulk deletion as critical
    await logAuditAction(
      req,
      'restaurant.bulk_deleted',
      'restaurant',
      {
        before: {
          restaurants: restaurants.map(r => ({ id: r._id, name: r.name, subdomain: r.subdomain })),
        },
        after: {
          deletedCount: result.deletedCount,
        },
      },
      undefined,
      'critical'
    );

    res.status(200).json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete restaurants',
      error: error.message,
    });
  }
};
```

## Step 5: Add Authentication Event Logging

Update your authentication controllers:

```typescript
import { Request, Response } from 'express';
import { auditAuthEvent } from '../middleware/auditMiddleware';
import SuperAdmin from '../models/SuperAdmin';
import jwt from 'jsonwebtoken';

export const superAdminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Find super admin
    const superAdmin = await SuperAdmin.findOne({ username }).select('+password');

    if (!superAdmin) {
      // Log failed login attempt (unknown user)
      await auditAuthEvent(
        'login.failed',
        'super_admin',
        'unknown',
        username,
        req,
        'warning'
      );

      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Check password
    const isPasswordMatch = await superAdmin.comparePassword(password);

    if (!isPasswordMatch) {
      // Log failed login attempt (wrong password)
      await auditAuthEvent(
        'login.failed',
        'super_admin',
        superAdmin._id.toString(),
        superAdmin.username,
        req,
        'warning'
      );

      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate token
    const token = generateSuperAdminToken(superAdmin._id.toString());

    // Update last login
    superAdmin.lastLoginAt = new Date();
    await superAdmin.save();

    // Log successful login
    await auditAuthEvent(
      'login.success',
      'super_admin',
      superAdmin._id.toString(),
      superAdmin.username,
      req,
      'info'
    );

    res.status(200).json({
      success: true,
      data: {
        superAdmin: superAdmin,
        token,
      },
    });
  } catch (error: any) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const superAdminLogout = async (req: Request, res: Response): Promise<void> => {
  try {
    // Log logout event
    await auditAuthEvent(
      'logout',
      'super_admin',
      req.superAdmin._id.toString(),
      req.superAdmin.username,
      req,
      'info'
    );

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
```

## Step 6: Track Before/After Changes

For update operations, track the changes:

```typescript
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch current state before update
    const restaurantBefore = await Restaurant.findById(id).lean();

    if (!restaurantBefore) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Perform update
    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Manually log with before/after changes
    await logAuditAction(
      req,
      'restaurant.updated',
      'restaurant',
      {
        before: restaurantBefore,
        after: restaurant?.toObject(),
      },
      id,
      'info'
    );

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (error: any) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update restaurant',
      error: error.message,
    });
  }
};
```

## Step 7: Add Custom Metadata

Add custom metadata to audit logs:

```typescript
import { logAuditAction } from '../middleware/auditMiddleware';
import auditService from '../services/auditService';

export const performCriticalOperation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Perform operation
    const result = await someOperation();

    // Log with custom metadata
    await auditService.logAction(
      'system.critical_operation',
      {
        type: 'super_admin',
        id: req.superAdmin._id,
        name: req.superAdmin.username,
      },
      {
        type: 'system',
      },
      {
        after: result,
      },
      {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        method: req.method,
        endpoint: req.originalUrl,
        customField: 'custom value',
        operationDuration: 1234,
      },
      'critical'
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
```

## Summary of Changes Needed

1. Install `json2csv` package
2. Import audit middleware in route files
3. Add middleware to POST, PUT, PATCH, DELETE routes
4. Use manual logging for bulk operations
5. Add authentication event logging to login/logout
6. Track before/after changes for updates
7. Set appropriate severity levels
8. Test the audit logging system

## Quick Checklist

- [ ] Install json2csv: `npm install json2csv`
- [ ] Import audit middleware in super admin routes
- [ ] Add middleware to restaurant CRUD routes
- [ ] Add middleware to admin management routes
- [ ] Add middleware to subscription routes
- [ ] Add authentication event logging
- [ ] Add manual logging for bulk operations
- [ ] Test audit log creation
- [ ] Test audit log retrieval with filters
- [ ] Test audit log export (CSV/JSON)
- [ ] Verify audit statistics endpoint
- [ ] Configure data retention policy

## Testing

After integration, test the audit logging:

```bash
# 1. Make a request to create a restaurant (with super admin token)
POST /api/super-admin/restaurants

# 2. Check if audit log was created
GET /api/superadmin/audit-logs?action=restaurant.created

# 3. Test filtering
GET /api/superadmin/audit-logs?actorType=super_admin&severity=critical

# 4. Test export
GET /api/superadmin/audit-logs/export?format=csv

# 5. Test statistics
GET /api/superadmin/audit-logs/stats
```
