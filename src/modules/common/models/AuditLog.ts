import { Schema, model, Document, Types } from 'mongoose';

// Interface for audit log changes (before/after values)
interface IAuditChanges {
  before?: any;
  after?: any;
}

// Interface for audit log metadata
interface IAuditMetadata {
  ip?: string;
  userAgent?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

// Main AuditLog interface
export interface IAuditLog extends Document {
  // Action details
  action: string;
  actorType: 'super_admin' | 'admin' | 'customer';
  actorId: Types.ObjectId;
  actorName: string;

  // Resource details
  resourceType: string;
  resourceId?: Types.ObjectId;

  // Change tracking
  changes?: IAuditChanges;

  // Additional metadata
  metadata?: IAuditMetadata;

  // Severity level
  severity: 'info' | 'warning' | 'error' | 'critical';

  // Timestamp
  timestamp: Date;
}

// Changes sub-schema
const changesSchema = new Schema<IAuditChanges>({
  before: {
    type: Schema.Types.Mixed,
    default: null,
  },
  after: {
    type: Schema.Types.Mixed,
    default: null,
  },
}, { _id: false });

// Metadata sub-schema
const metadataSchema = new Schema<IAuditMetadata>({
  ip: {
    type: String,
    trim: true,
  },
  userAgent: {
    type: String,
    trim: true,
  },
  method: {
    type: String,
    uppercase: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
  endpoint: {
    type: String,
    trim: true,
  },
  statusCode: {
    type: Number,
    min: 100,
    max: 599,
  },
  duration: {
    type: Number,
    min: 0,
  },
}, { _id: false, strict: false }); // Allow additional fields

// Main AuditLog schema
const auditLogSchema = new Schema<IAuditLog>({
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    maxlength: [200, 'Action cannot exceed 200 characters'],
    index: true,
  },
  actorType: {
    type: String,
    required: [true, 'Actor type is required'],
    enum: {
      values: ['super_admin', 'admin', 'customer'],
      message: 'Actor type must be either super_admin, admin, or customer',
    },
    index: true,
  },
  actorId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Actor ID is required'],
    index: true,
  },
  actorName: {
    type: String,
    required: [true, 'Actor name is required'],
    trim: true,
    maxlength: [200, 'Actor name cannot exceed 200 characters'],
  },
  resourceType: {
    type: String,
    required: [true, 'Resource type is required'],
    trim: true,
    maxlength: [100, 'Resource type cannot exceed 100 characters'],
    index: true,
  },
  resourceId: {
    type: Schema.Types.ObjectId,
    index: true,
  },
  changes: {
    type: changesSchema,
  },
  metadata: {
    type: metadataSchema,
    default: () => ({}),
  },
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: {
      values: ['info', 'warning', 'error', 'critical'],
      message: 'Severity must be info, warning, error, or critical',
    },
    default: 'info',
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false, // We're using our own timestamp field
  collection: 'auditlogs',
});

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Compound indexes for common query patterns
auditLogSchema.index({ timestamp: -1 }); // Most recent first
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });
auditLogSchema.index({ actorType: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ actorType: 1, actorId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });

// Additional single field indexes
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ actorType: 1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ resourceType: 1 });
auditLogSchema.index({ resourceId: 1 });
auditLogSchema.index({ severity: 1 });

// TTL index to automatically delete logs older than 1 year (365 days)
// IMPORTANT: This is a TTL index that will delete old audit logs automatically
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 365 days

// Virtual for human-readable action
auditLogSchema.virtual('actionDescription').get(function() {
  const actionMap: { [key: string]: string } = {
    'restaurant.created': 'Created a restaurant',
    'restaurant.updated': 'Updated restaurant details',
    'restaurant.deleted': 'Deleted a restaurant',
    'restaurant.suspended': 'Suspended a restaurant',
    'restaurant.activated': 'Activated a restaurant',
    'admin.created': 'Created an admin',
    'admin.updated': 'Updated admin details',
    'admin.deleted': 'Deleted an admin',
    'admin.role_changed': 'Changed admin role',
    'user.created': 'Created a user',
    'user.updated': 'Updated user details',
    'user.deleted': 'Deleted a user',
    'order.created': 'Created an order',
    'order.updated': 'Updated an order',
    'order.cancelled': 'Cancelled an order',
    'order.completed': 'Completed an order',
    'menu.created': 'Created a menu item',
    'menu.updated': 'Updated a menu item',
    'menu.deleted': 'Deleted a menu item',
    'settings.updated': 'Updated settings',
    'subscription.updated': 'Updated subscription',
    'login.success': 'Successful login',
    'login.failed': 'Failed login attempt',
    'logout': 'Logged out',
  };

  return actionMap[this.action] || this.action;
});

// Method to get formatted log entry
auditLogSchema.methods.getFormattedLog = function(): string {
  const timestamp = this.timestamp.toISOString();
  const severity = this.severity.toUpperCase();
  return `[${timestamp}] [${severity}] ${this.actorName} (${this.actorType}): ${this.actionDescription || this.action}`;
};

// Static method to get logs with filters
auditLogSchema.statics.getFilteredLogs = async function(
  filters: any,
  pagination: { page: number; limit: number; sort?: string }
) {
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

  // Calculate skip
  const skip = (pagination.page - 1) * pagination.limit;

  // Determine sort order
  const sort = pagination.sort || '-timestamp'; // Default: most recent first

  // Execute query
  const [logs, total] = await Promise.all([
    this.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pagination.limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  };
};

// Ensure virtuals are included when converting to JSON
auditLogSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    const { _id, __v, ...auditLogWithoutMetadata } = ret;
    return {
      id: _id,
      ...auditLogWithoutMetadata,
    };
  },
});

const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
