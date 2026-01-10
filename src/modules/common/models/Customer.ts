import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomerPreferences {
  dietaryRestrictions: string[];
  allergens: string[];
  favoriteItems: Types.ObjectId[];
}

// Simplified Customer interface - Username only
export interface ICustomer extends Document {
  _id: Types.ObjectId;
  username: string;
  restaurantId: Types.ObjectId;
  isActive: boolean;
  fcmToken?: string; // Firebase Cloud Messaging device token (one per customer)
  createdAt: Date;
  updatedAt: Date;
  preferences: ICustomerPreferences;
}

const preferencesSchema = new Schema<ICustomerPreferences>(
  {
    dietaryRestrictions: {
      type: [String],
      default: [],
    },
    allergens: {
      type: [String],
      default: [],
    },
    favoriteItems: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

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
    fcmToken: {
      type: String,
      required: false,
      index: true, // Index for efficient FCM token lookups
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({
        dietaryRestrictions: [],
        allergens: [],
        favoriteItems: [],
      }),
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// CRITICAL: Compound unique index for multi-tenancy
// Username is unique within each restaurant but can be reused across restaurants
customerSchema.index(
  { restaurantId: 1, username: 1 },
  {
    unique: true,
    name: 'restaurant_username_unique',
  }
);

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Index for FCM token lookups (for push notifications)
customerSchema.index({ fcmToken: 1 });

// Additional indexes for common queries
customerSchema.index({ restaurantId: 1, isActive: 1 });

export default mongoose.model<ICustomer>('Customer', customerSchema);
