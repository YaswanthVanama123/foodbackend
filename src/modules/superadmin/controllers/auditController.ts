import { Request, Response } from 'express';
import auditService from '../../common/services/auditService';
import { Types } from 'mongoose';

/**
 * @desc    Get audit logs with filtering and pagination
 * @route   GET /api/super-admin/audit-logs
 * @access  Super Admin Only
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters
    const {
      action,
      actorType,
      actorId,
      resourceType,
      resourceId,
      severity,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '50',
      sort = '-timestamp',
    } = req.query;

    // Build filters
    const filters: any = {};
    if (action) filters.action = action as string;
    if (actorType) filters.actorType = actorType as string;
    if (actorId) filters.actorId = actorId as string;
    if (resourceType) filters.resourceType = resourceType as string;
    if (resourceId) filters.resourceId = resourceId as string;
    if (severity) filters.severity = severity as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (search) filters.search = search as string;

    // Pagination
    const pagination = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sort: sort as string,
    };

    // Validate pagination
    if (pagination.page < 1) pagination.page = 1;
    if (pagination.limit < 1 || pagination.limit > 100) pagination.limit = 50;

    // Fetch logs
    const result = await auditService.getAuditLogs(filters, pagination);

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
      filters: filters,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
};

/**
 * @desc    Get a single audit log by ID
 * @route   GET /api/super-admin/audit-logs/:id
 * @access  Super Admin Only
 */
export const getAuditLogById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid audit log ID',
      });
      return;
    }

    // Fetch log
    const auditLog = await auditService.getAuditLogById(id);

    if (!auditLog) {
      res.status(404).json({
        success: false,
        message: 'Audit log not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: auditLog,
    });
  } catch (error: any) {
    console.error('Error fetching audit log by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log',
      error: error.message,
    });
  }
};

/**
 * @desc    Export audit logs to CSV or JSON
 * @route   GET /api/super-admin/audit-logs/export
 * @access  Super Admin Only
 */
export const exportAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters
    const {
      action,
      actorType,
      actorId,
      resourceType,
      resourceId,
      severity,
      startDate,
      endDate,
      search,
      format = 'csv',
      fields,
    } = req.query;

    // Build filters
    const filters: any = {};
    if (action) filters.action = action as string;
    if (actorType) filters.actorType = actorType as string;
    if (actorId) filters.actorId = actorId as string;
    if (resourceType) filters.resourceType = resourceType as string;
    if (resourceId) filters.resourceId = resourceId as string;
    if (severity) filters.severity = severity as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (search) filters.search = search as string;

    // Export options
    const exportOptions: any = {
      format: format as string,
    };

    if (fields && typeof fields === 'string') {
      exportOptions.fields = fields.split(',');
    }

    // Validate format
    if (exportOptions.format !== 'csv' && exportOptions.format !== 'json') {
      res.status(400).json({
        success: false,
        message: 'Invalid export format. Must be "csv" or "json"',
      });
      return;
    }

    // Export logs
    const exportData = await auditService.exportAuditLogs(filters, exportOptions);

    // Set appropriate headers based on format
    if (exportOptions.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
    }

    res.status(200).send(exportData);
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
      error: error.message,
    });
  }
};

/**
 * @desc    Get audit log statistics
 * @route   GET /api/super-admin/audit-logs/stats
 * @access  Super Admin Only
 */
export const getAuditStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters
    const {
      action,
      actorType,
      actorId,
      resourceType,
      resourceId,
      startDate,
      endDate,
    } = req.query;

    // Build filters
    const filters: any = {};
    if (action) filters.action = action as string;
    if (actorType) filters.actorType = actorType as string;
    if (actorId) filters.actorId = actorId as string;
    if (resourceType) filters.resourceType = resourceType as string;
    if (resourceId) filters.resourceId = resourceId as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;

    // Fetch statistics
    const stats = await auditService.getAuditStatistics(filters);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get audit logs for a specific actor
 * @route   GET /api/super-admin/audit-logs/actor/:actorId
 * @access  Super Admin Only
 */
export const getLogsByActor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actorId } = req.params;
    const { actorType, page = '1', limit = '50' } = req.query;

    // Validate actor ID
    if (!Types.ObjectId.isValid(actorId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid actor ID',
      });
      return;
    }

    // Validate actor type
    if (!actorType || !['super_admin', 'admin', 'customer'].includes(actorType as string)) {
      res.status(400).json({
        success: false,
        message: 'Valid actor type is required (super_admin, admin, or customer)',
      });
      return;
    }

    // Pagination
    const pagination = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    // Fetch logs
    const result = await auditService.getLogsByActor(
      actorId,
      actorType as 'super_admin' | 'admin' | 'customer',
      pagination
    );

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('Error fetching logs by actor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs by actor',
      error: error.message,
    });
  }
};

/**
 * @desc    Get audit logs for a specific resource
 * @route   GET /api/super-admin/audit-logs/resource/:resourceId
 * @access  Super Admin Only
 */
export const getLogsByResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resourceId } = req.params;
    const { resourceType, page = '1', limit = '50' } = req.query;

    // Validate resource ID
    if (!Types.ObjectId.isValid(resourceId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid resource ID',
      });
      return;
    }

    // Validate resource type
    if (!resourceType) {
      res.status(400).json({
        success: false,
        message: 'Resource type is required',
      });
      return;
    }

    // Pagination
    const pagination = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    };

    // Fetch logs
    const result = await auditService.getLogsByResource(
      resourceId,
      resourceType as string,
      pagination
    );

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('Error fetching logs by resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs by resource',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete old audit logs (data retention)
 * @route   DELETE /api/super-admin/audit-logs/cleanup
 * @access  Super Admin Only
 */
export const cleanupOldLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daysToKeep = '365' } = req.query;

    // Validate days
    const days = parseInt(daysToKeep as string, 10);
    if (days < 1) {
      res.status(400).json({
        success: false,
        message: 'Days to keep must be at least 1',
      });
      return;
    }

    // Delete old logs
    const deletedCount = await auditService.deleteOldLogs(days);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} old audit logs`,
      data: {
        deletedCount,
        daysToKeep: days,
      },
    });
  } catch (error: any) {
    console.error('Error cleaning up old audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up old audit logs',
      error: error.message,
    });
  }
};
