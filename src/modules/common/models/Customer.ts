import mongoose, { Document, Schema, Types } from 'mongoose';

// Simplified Customer interface - Username only
export interface ICustomer extends Document {
  _id: Types.ObjectId;
  username: string;
  restaurantId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance and tenant isolation
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound index for unique username per restaurant
// This ensures usernames are unique within each restaurant but can be reused across restaurants
customerSchema.index(
  { restaurantId: 1, username: 1 },
  {
    unique: true,
    name: 'restaurant_username_unique',
  }
);

// Index for quick customer lookup
customerSchema.index({ restaurantId: 1, isActive: 1 });

export default mongoose.model<ICustomer>('Customer', customerSchema);
