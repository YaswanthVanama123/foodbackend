import { Schema, model, Document, Types } from 'mongoose';

// Interface for payment history record
interface IPaymentRecord {
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentDate: Date;
  description?: string;
  metadata?: Record<string, any>;
}

// Main Subscription interface
export interface ISubscription extends Document {
  restaurantId: Types.ObjectId;
  planId?: Types.ObjectId; // Optional reference to Plan model
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startDate: Date;
  endDate: Date;
  renewalDate?: Date;
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  autoRenew: boolean;
  paymentHistory: IPaymentRecord[];
  cancellationReason?: string;
  cancelledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Payment record sub-schema
const paymentRecordSchema = new Schema<IPaymentRecord>({
  transactionId: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    minlength: 3,
    maxlength: 3,
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  description: {
    type: String,
    trim: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, { _id: true, timestamps: false });

// Main Subscription schema
const subscriptionSchema = new Schema<ISubscription>({
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'Restaurant ID is required'],
    index: true,
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending',
    required: true,
    index: true,
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  renewalDate: {
    type: Date,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    minlength: 3,
    maxlength: 3,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
    default: 'monthly',
  },
  autoRenew: {
    type: Boolean,
    default: true,
  },
  paymentHistory: {
    type: [paymentRecordSchema],
    default: [],
  },
  cancellationReason: {
    type: String,
    trim: true,
  },
  cancelledAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Compound index for fast subscription checks (CRITICAL OPTIMIZATION)
subscriptionSchema.index({ restaurantId: 1, status: 1, endDate: -1 });

// Compound index for finding expiring subscriptions
subscriptionSchema.index({ endDate: 1, status: 1 });

// Compound index for auto-renewal processing
subscriptionSchema.index({ renewalDate: 1, autoRenew: 1 });

// Additional indexes for common queries
subscriptionSchema.index({ restaurantId: 1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ createdAt: -1 });

// TTL index for automatic cleanup of expired subscriptions (30 days after expiry)
// This will automatically delete expired subscriptions after 30 days
subscriptionSchema.index({ endDate: 1 }, { expireAfterSeconds: 2592000, partialFilterExpression: { status: 'expired' } });

// Pre-save hook to set renewal date
subscriptionSchema.pre('save', function(next) {
  // Only set renewal date if autoRenew is enabled and status is active
  if (this.autoRenew && this.status === 'active' && !this.renewalDate) {
    this.renewalDate = this.endDate;
  }
  next();
});

// Instance method to check if subscription is active and valid
subscriptionSchema.methods.isValid = function(): boolean {
  return this.status === 'active' && this.endDate > new Date();
};

// Instance method to check if subscription is expiring soon
subscriptionSchema.methods.isExpiringSoon = function(daysThreshold: number = 7): boolean {
  const daysUntilExpiry = Math.ceil((this.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return this.status === 'active' && daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
};

// Instance method to add payment record
subscriptionSchema.methods.addPayment = function(paymentData: IPaymentRecord): void {
  this.paymentHistory.push(paymentData);
};

// Instance method to get last payment
subscriptionSchema.methods.getLastPayment = function(): IPaymentRecord | null {
  if (this.paymentHistory.length === 0) return null;
  return this.paymentHistory[this.paymentHistory.length - 1];
};

// Instance method to calculate total revenue
subscriptionSchema.methods.getTotalRevenue = function(): number {
  return this.paymentHistory
    .filter((payment: IPaymentRecord) => payment.status === 'completed')
    .reduce((total: number, payment: IPaymentRecord) => total + payment.amount, 0);
};

// Static method to find active subscriptions
subscriptionSchema.statics.findActiveSubscriptions = function() {
  return this.find({
    status: 'active',
    endDate: { $gt: new Date() },
  });
};

// Static method to find expiring subscriptions
subscriptionSchema.statics.findExpiringSubscriptions = function(daysThreshold: number = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  return this.find({
    status: 'active',
    endDate: {
      $gt: new Date(),
      $lte: futureDate,
    },
  });
};

// Static method to find expired subscriptions that need status update
subscriptionSchema.statics.findExpiredSubscriptions = function() {
  return this.find({
    status: 'active',
    endDate: { $lte: new Date() },
  });
};

const Subscription = model<ISubscription>('Subscription', subscriptionSchema);

export default Subscription;
