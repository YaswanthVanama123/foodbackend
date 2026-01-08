import { Types } from 'mongoose';
import AuditLog, { IAuditLog } from './models/AuditLog';
import { Parser } from 'json2csv';

// Interface for actor information
interface IActor {
  type: 'super_admin' | 'admin' | 'customer';
  id: string | Types.ObjectId;
  name: string;
}

// Interface for resource information
interface IResource {
  type: string;
  id?: string | Types.ObjectId;
}

// Interface for change tracking
interface IChanges {
  before?: any;
  after?: any;
}

// Interface for metadata
interface IMetadata {
  ip?: string;
  userAgent?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

// Interface for filters
interface IAuditFilters {
  action?: string;
  actorType?: 'super_admin' | 'admin' | 'customer';
  actorId?: string | Types.ObjectId;
  resourceType?: string;
  resourceId?: string | Types.ObjectId;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
}

// Interface for pagination
interface IPagination {
  page: number;
  limit: number;
  sort?: string;
}

// Interface for export options
interface IExportOptions {
  format: 'csv' | 'json';
  fields?: string[];
}

class AuditService {
  /**
   * Log an action to the audit trail
   * @param action - Action performed (e.g., 'restaurant.created', 'user.deleted')
   * @param actor - Information about who performed the action
   * @param resource - Information about what was affected
   * @param changes - Before/after values of changes
   * @param metadata - Additional metadata (IP, user agent, etc.)
   * @param severity - Severity level of the action
   * @returns Promise<IAuditLog> - The created audit log entry
   */
  async logAction(
    action: string,
    actor: IActor,
    resource: IResource,
    changes?: IChanges,
    metadata?: IMetadata,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): Promise<IAuditLog> {
    try {
      const auditLog = await AuditLog.create({
        action,
        actorType: actor.type,
        actorId: actor.id,
        actorName: actor.name,
        resourceType: resource.type,
        resourceId: resource.id || undefined,
        changes: changes || undefined,
        metadata: metadata || undefined,
        severity,
        timestamp: new Date(),
      });

      return auditLog;
    } catch (error: any) {
      console.error('Error creating audit log:', error);
      throw new Error(`Failed to create audit log: ${error.message}`);
    }
  }

  /**
   * Get audit logs with filters and pagination
   * @param filters - Filters to apply
   * @param pagination - Pagination options
   * @returns Promise with logs and pagination info
   */
  async getAuditLogs(
    filters: IAuditFilters = {},
    pagination: IPagination = { page: 1, limit: 50 }
  ): Promise<{
    logs: IAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      // Use the static method from the model
      const result = await (AuditLog as any).getFilteredLogs(filters, pagination);
      return result;
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
  }

  /**
   * Get a single audit log by ID
   * @param id - Audit log ID
   * @returns Promise<IAuditLog | null>
   */
  async getAuditLogById(id: string | Types.ObjectId): Promise<IAuditLog | null> {
    try {
      const auditLog = await AuditLog.findById(id);
      return auditLog;
    } catch (error: any) {
      console.error('Error fetching audit log by ID:', error);
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }
  }

  /**
   * Get audit logs for a specific actor
   * @param actorId - Actor ID
   * @param actorType - Actor type
   * @param pagination - Pagination options
   * @returns Promise with logs and pagination info
   */
  async getLogsByActor(
    actorId: string | Types.ObjectId,
    actorType: 'super_admin' | 'admin' | 'customer',
    pagination: IPagination = { page: 1, limit: 50 }
  ): Promise<{
    logs: IAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      return await this.getAuditLogs(
        { actorId, actorType },
        pagination
      );
    } catch (error: any) {
      console.error('Error fetching logs by actor:', error);
      throw new Error(`Failed to fetch logs by actor: ${error.message}`);
    }
  }

  /**
   * Get audit logs for a specific resource
   * @param resourceId - Resource ID
   * @param resourceType - Resource type
   * @param pagination - Pagination options
   * @returns Promise with logs and pagination info
   */
  async getLogsByResource(
    resourceId: string | Types.ObjectId,
    resourceType: string,
    pagination: IPagination = { page: 1, limit: 50 }
  ): Promise<{
    logs: IAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      return await this.getAuditLogs(
        { resourceId, resourceType },
        pagination
      );
    } catch (error: any) {
      console.error('Error fetching logs by resource:', error);
      throw new Error(`Failed to fetch logs by resource: ${error.message}`);
    }
  }

  /**
   * Export audit logs to CSV or JSON
   * @param filters - Filters to apply
   * @param options - Export options (format, fields)
   * @returns Promise<string> - Exported data as string
   */
  async exportAuditLogs(
    filters: IAuditFilters = {},
    options: IExportOptions = { format: 'csv' }
  ): Promise<string> {
    try {
      // Fetch all matching logs (no pagination limit for export)
      const query: any = {};

      // Apply filters
      if (filters.action) query.action = filters.action;
      if (filters.actorType) query.actorType = filters.actorType;
      if (filters.actorId) query.actorId = filters.actorId;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.resourceId) query.resourceId = filters.resourceId;
      if (filters.severity) query.severity = filters.severity;

      // Date range filters
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      // Search in action or actorName
      if (filters.search) {
        query.$or = [
          { action: { $regex: filters.search, $options: 'i' } },
          { actorName: { $regex: filters.search, $options: 'i' } },
        ];
      }

      // Fetch logs
      const logs = await AuditLog.find(query)
        .sort('-timestamp')
        .limit(10000) // Safety limit to prevent memory issues
        .lean();

      if (options.format === 'json') {
        return JSON.stringify(logs, null, 2);
      }

      // CSV Export
      const fields = options.fields || [
        'timestamp',
        'action',
        'actorType',
        'actorName',
        'resourceType',
        'resourceId',
        'severity',
        'metadata.ip',
        'metadata.method',
        'metadata.endpoint',
        'metadata.statusCode',
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(logs);

      return csv;
    } catch (error: any) {
      console.error('Error exporting audit logs:', error);
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }
  }

  /**
   * Get audit log statistics
   * @param filters - Filters to apply
   * @returns Promise with statistics
   */
  async getAuditStatistics(
    filters: IAuditFilters = {}
  ): Promise<{
    total: number;
    bySeverity: { [key: string]: number };
    byActorType: { [key: string]: number };
    byAction: { action: string; count: number }[];
    recent: IAuditLog[];
  }> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.action) query.action = filters.action;
      if (filters.actorType) query.actorType = filters.actorType;
      if (filters.actorId) query.actorId = filters.actorId;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.resourceId) query.resourceId = filters.resourceId;

      // Date range filters
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      // Get total count
      const total = await AuditLog.countDocuments(query);

      // Get counts by severity
      const bySeverityResult = await AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]);
      const bySeverity: { [key: string]: number } = {};
      bySeverityResult.forEach((item: any) => {
        bySeverity[item._id] = item.count;
      });

      // Get counts by actor type
      const byActorTypeResult = await AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$actorType', count: { $sum: 1 } } },
      ]);
      const byActorType: { [key: string]: number } = {};
      byActorTypeResult.forEach((item: any) => {
        byActorType[item._id] = item.count;
      });

      // Get top actions
      const byActionResult = await AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);
      const byAction = byActionResult.map((item: any) => ({
        action: item._id,
        count: item.count,
      }));

      // Get recent logs
      const recent = await AuditLog.find(query)
        .sort('-timestamp')
        .limit(10)
        .lean();

      return {
        total,
        bySeverity,
        byActorType,
        byAction,
        recent,
      };
    } catch (error: any) {
      console.error('Error fetching audit statistics:', error);
      throw new Error(`Failed to fetch audit statistics: ${error.message}`);
    }
  }

  /**
   * Delete old audit logs (data retention)
   * @param daysToKeep - Number of days to keep logs
   * @returns Promise with number of deleted logs
   */
  async deleteOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      return result.deletedCount || 0;
    } catch (error: any) {
      console.error('Error deleting old audit logs:', error);
      throw new Error(`Failed to delete old audit logs: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new AuditService();
