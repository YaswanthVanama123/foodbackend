import express from 'express';
import {
  getAuditLogs,
  getAuditLogById,
  exportAuditLogs,
  getAuditStatistics,
  getLogsByActor,
  getLogsByResource,
  cleanupOldLogs,
  getAuditLogsPageData,
} from '../controllers/auditController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = express.Router();

/**
 * All audit routes require super admin authentication
 * These routes are prefixed with /api/super-admin/audit-logs
 */

// Apply super admin authentication to all routes
router.use(superAdminAuth);

/**
 * @route   GET /api/super-admin/audit-logs/page-data
 * @desc    Get audit logs page data (logs + admins) - OPTIMIZED (SINGLE REQUEST)
 * @access  Super Admin Only
 * @query   action, actorType, actorId, resourceType, resourceId, severity, startDate, endDate, search, page, limit, sort
 */
router.get('/page-data', getAuditLogsPageData);

/**
 * @route   GET /api/super-admin/audit-logs
 * @desc    Get audit logs with filtering and pagination
 * @access  Super Admin Only
 * @query   action, actorType, actorId, resourceType, resourceId, severity, startDate, endDate, search, page, limit, sort
 */
router.get('/', getAuditLogs);

/**
 * @route   GET /api/super-admin/audit-logs/stats
 * @desc    Get audit log statistics
 * @access  Super Admin Only
 * @query   action, actorType, actorId, resourceType, resourceId, startDate, endDate
 */
router.get('/stats', getAuditStatistics);

/**
 * @route   GET /api/super-admin/audit-logs/export
 * @desc    Export audit logs to CSV or JSON
 * @access  Super Admin Only
 * @query   action, actorType, actorId, resourceType, resourceId, severity, startDate, endDate, search, format, fields
 */
router.get('/export', exportAuditLogs);

/**
 * @route   GET /api/super-admin/audit-logs/actor/:actorId
 * @desc    Get audit logs for a specific actor
 * @access  Super Admin Only
 * @param   actorId - Actor's ID
 * @query   actorType, page, limit
 */
router.get('/actor/:actorId', getLogsByActor);

/**
 * @route   GET /api/super-admin/audit-logs/resource/:resourceId
 * @desc    Get audit logs for a specific resource
 * @access  Super Admin Only
 * @param   resourceId - Resource's ID
 * @query   resourceType, page, limit
 */
router.get('/resource/:resourceId', getLogsByResource);

/**
 * @route   DELETE /api/super-admin/audit-logs/cleanup
 * @desc    Delete old audit logs (data retention)
 * @access  Super Admin Only
 * @query   daysToKeep - Number of days to keep logs (default: 365)
 */
router.delete('/cleanup', cleanupOldLogs);

/**
 * @route   GET /api/super-admin/audit-logs/:id
 * @desc    Get a single audit log by ID
 * @access  Super Admin Only
 * @param   id - Audit log ID
 */
router.get('/:id', getAuditLogById);

export default router;
