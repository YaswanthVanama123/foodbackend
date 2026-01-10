import { Schema, model, Document } from 'mongoose';

// Interface for plan limits
interface IPlanLimits {
  maxTables: number;
  maxMenuItems: number;
  maxAdmins: number;
  maxOrders: number;
}

// Main Plan interface
export interface IPlan extends Document {
  name: 'Free' | 'Basic' | 'Pro' | 'Enterprise';
  description: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: IPlanLimits;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Plan limits sub-schema
const planLimitsSchema = new Schema<IPlanLimits>({
  maxTables: {
    type: Number,
    required: [true, 'Max tables limit is required'],
    min: [1, 'Max tables must be at least 1'],
  },
  maxMenuItems: {
    type: Number,
    required: [true, 'Max menu items limit is required'],
    min: [1, 'Max menu items must be at least 1'],
  },
  maxAdmins: {
    type: Number,
    required: [true, 'Max admins limit is required'],
    min: [1, 'Max admins must be at least 1'],
  },
  maxOrders: {
    type: Number,
    required: [true, 'Max orders limit is required'],
    min: [0, 'Max orders cannot be negative'],
  },
}, { _id: false });

// Main Plan schema
const planSchema = new Schema<IPlan>({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    enum: {
      values: ['Free', 'Basic', 'Pro', 'Enterprise'],
      message: 'Plan name must be one of: Free, Basic, Pro, Enterprise',
    },
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Plan description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: 3,
    maxlength: 3,
    trim: true,
  },
  billingCycle: {
    type: String,
    required: [true, 'Billing cycle is required'],
    enum: {
      values: ['monthly', 'yearly'],
      message: 'Billing cycle must be either monthly or yearly',
    },
  },
  features: {
    type: [String],
    required: [true, 'Features array is required'],
    validate: {
      validator: function(v: string[]) {
        return v && v.length > 0;
      },
      message: 'At least one feature must be specified',
    },
  },
  limits: {
    type: planLimitsSchema,
    required: [true, 'Plan limits are required'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    required: [true, 'Display order is required'],
    min: [0, 'Display order cannot be negative'],
  },
}, {
  timestamps: true,
});

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Note: name already has a unique index from field definition
// Compound index for active plans query (most common use case)
planSchema.index({ isActive: 1, displayOrder: 1 });

// Additional indexes for common queries
planSchema.index({ isActive: 1 });
planSchema.index({ displayOrder: 1 });
planSchema.index({ price: 1 });
planSchema.index({ name: 1 });
planSchema.index({ billingCycle: 1 });

// Method to check if plan is free
planSchema.methods.isFree = function(): boolean {
  return this.price === 0;
};

// Method to check if plan is active
planSchema.methods.isActivePlan = function(): boolean {
  return this.isActive === true;
};

// Static method to get all active plans
planSchema.statics.getActivePlans = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

// Static method to get plan by name
planSchema.statics.getPlanByName = function(name: string) {
  return this.findOne({ name, isActive: true });
};

const Plan = model<IPlan>('Plan', planSchema);

export default Plan;
