import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReviewResponse {
  text: string;
  respondedAt: Date;
  respondedBy?: Types.ObjectId;
}

export interface IReview extends Document {
  restaurantId: Types.ObjectId;
  customerId: Types.ObjectId | string; // Customer ObjectId or tableId for guest customers
  orderId: Types.ObjectId;
  menuItemId?: Types.ObjectId; // Optional - can review whole order or specific item
  rating: number; // 1-5
  comment: string;
  helpfulCount: number;
  helpfulBy: string[]; // Array of customer IDs who marked as helpful
  isVisible: boolean;
  response?: IReviewResponse;
  createdAt: Date;
  updatedAt: Date;
}

const reviewResponseSchema = new Schema<IReviewResponse>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Response cannot exceed 500 characters'],
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { _id: false }
);

const reviewSchema = new Schema<IReview>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance
    },
    customerId: {
      type: Schema.Types.Mixed, // Support both ObjectId (registered customers) and String (guest customers)
      required: [true, 'Customer ID is required'],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      minlength: [10, 'Comment must be at least 10 characters'],
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulBy: {
      type: [String],
      default: [],
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    response: {
      type: reviewResponseSchema,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Indexes for multi-tenancy and query performance
reviewSchema.index({ restaurantId: 1, createdAt: -1 });
reviewSchema.index({ restaurantId: 1, menuItemId: 1 });
reviewSchema.index({ restaurantId: 1, menuItemId: 1, isVisible: 1 });
reviewSchema.index({ restaurantId: 1, customerId: 1 });
reviewSchema.index({ restaurantId: 1, orderId: 1 });
reviewSchema.index({ restaurantId: 1, rating: -1 });

// Compound unique index to prevent duplicate reviews for same order/menuItem
reviewSchema.index(
  { restaurantId: 1, orderId: 1, menuItemId: 1, customerId: 1 },
  {
    unique: true,
    partialFilterExpression: { menuItemId: { $exists: true } }
  }
);

// Unique index for order-level reviews (without menuItemId)
reviewSchema.index(
  { restaurantId: 1, orderId: 1, customerId: 1 },
  {
    unique: true,
    partialFilterExpression: { menuItemId: { $exists: false } }
  }
);

export default mongoose.model<IReview>('Review', reviewSchema);
