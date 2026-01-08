import { Schema, model, Document, Types } from 'mongoose';

// Interface for ticket message
interface ITicketMessage {
  sender: 'restaurant' | 'super_admin' | 'system';
  senderName: string;
  senderId?: Types.ObjectId;
  message: string;
  timestamp: Date;
  attachments?: string[];
  isInternal?: boolean; // Internal notes visible only to super admins
}

// Main Ticket interface
export interface ITicket extends Document {
  ticketNumber: string;
  restaurantId?: Types.ObjectId;
  restaurantName: string;
  title: string;
  description: string;
  category: 'technical' | 'billing' | 'feature_request' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: Types.ObjectId;
  assignedToName?: string;
  messages: ITicketMessage[];
  tags: string[];
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message sub-schema
const messageSchema = new Schema<ITicketMessage>({
  sender: {
    type: String,
    enum: ['restaurant', 'super_admin', 'system'],
    required: [true, 'Sender type is required'],
  },
  senderName: {
    type: String,
    required: [true, 'Sender name is required'],
    trim: true,
  },
  senderId: {
    type: Schema.Types.ObjectId,
    refPath: 'messages.sender',
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  attachments: {
    type: [String],
    default: [],
  },
  isInternal: {
    type: Boolean,
    default: false,
  },
}, { _id: true });

// Main Ticket schema
const ticketSchema = new Schema<ITicket>({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    index: true,
  },
  restaurantName: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [100, 'Restaurant name cannot exceed 100 characters'],
  },
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  category: {
    type: String,
    enum: ['technical', 'billing', 'feature_request', 'other'],
    required: [true, 'Category is required'],
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    required: true,
    index: true,
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    index: true,
  },
  assignedToName: {
    type: String,
    trim: true,
  },
  messages: {
    type: [messageSchema],
    default: [],
  },
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: function(tags: string[]) {
        return tags.length <= 10;
      },
      message: 'Cannot have more than 10 tags',
    },
  },
  resolvedAt: {
    type: Date,
  },
  closedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for performance
ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ restaurantId: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ status: 1, priority: -1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ tags: 1 });

// Counter schema for auto-generating ticket numbers
interface ITicketCounter extends Document {
  _id: string;
  seq: number;
}

const ticketCounterSchema = new Schema<ITicketCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const TicketCounter = model<ITicketCounter>('TicketCounter', ticketCounterSchema);

// Pre-save hook to auto-generate ticket number
ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      const counter = await TicketCounter.findByIdAndUpdate(
        { _id: 'ticketNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const paddedNumber = counter.seq.toString().padStart(6, '0');
      this.ticketNumber = `TKT-${paddedNumber}`;
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

// Pre-save hook to update resolvedAt when status changes to resolved
ticketSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

// Method to add a message to the ticket
ticketSchema.methods.addMessage = function(messageData: Partial<ITicketMessage>) {
  this.messages.push({
    ...messageData,
    timestamp: new Date(),
  });
  return this.save();
};

// Method to check if ticket is overdue (open for more than 7 days)
ticketSchema.methods.isOverdue = function(): boolean {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return this.status === 'open' && this.createdAt < sevenDaysAgo;
};

// Method to get response time (time between ticket creation and first response)
ticketSchema.methods.getResponseTime = function(): number | null {
  const firstAdminMessage = this.messages.find((msg: ITicketMessage) => msg.sender === 'super_admin');
  if (firstAdminMessage) {
    return firstAdminMessage.timestamp.getTime() - this.createdAt.getTime();
  }
  return null;
};

// Method to get resolution time (time between ticket creation and resolution)
ticketSchema.methods.getResolutionTime = function(): number | null {
  if (this.resolvedAt) {
    return this.resolvedAt.getTime() - this.createdAt.getTime();
  }
  return null;
};

// Static method to get ticket statistics
ticketSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        statusCounts: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ],
        priorityCounts: [
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ],
        categoryCounts: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ],
        avgResponseTime: [
          {
            $match: {
              messages: { $elemMatch: { sender: 'super_admin' } },
            },
          },
          {
            $addFields: {
              firstAdminMessage: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$messages',
                      as: 'msg',
                      cond: { $eq: ['$$msg.sender', 'super_admin'] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          {
            $addFields: {
              responseTime: {
                $subtract: ['$firstAdminMessage.timestamp', '$createdAt'],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgResponseTime: { $avg: '$responseTime' },
            },
          },
        ],
        avgResolutionTime: [
          {
            $match: { resolvedAt: { $exists: true } },
          },
          {
            $addFields: {
              resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTime: { $avg: '$resolutionTime' },
            },
          },
        ],
      },
    },
  ]);

  return stats[0];
};

// Ensure virtuals are included when converting to JSON
ticketSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    return ret;
  },
});

const Ticket = model<ITicket>('Ticket', ticketSchema);

export default Ticket;
export { TicketCounter };
