import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// Customer preferences interface
export interface ICustomerPreferences {
  dietaryRestrictions: string[];
  allergens: string[];
  favoriteItems: Types.ObjectId[];
}

// Customer notifications interface
export interface ICustomerNotifications {
  email: boolean;
  push: boolean;
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  restaurantId: Types.ObjectId;
  preferences: ICustomerPreferences;
  notifications: ICustomerNotifications;
  language: string;
  theme: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const customerSchema = new Schema<ICustomer>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance and tenant isolation
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      // NOTE: unique constraint removed - now enforced by compound index
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\d\s\-\+\(\)]+$/, 'Please provide a valid phone number'],
    },
    preferences: {
      dietaryRestrictions: {
        type: [String],
        default: [],
      },
      allergens: {
        type: [String],
        default: [],
      },
      favoriteItems: {
        type: [Schema.Types.ObjectId],
        ref: 'MenuItem',
        default: [],
      },
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'],
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Compound unique index for multi-tenancy
// Email is unique within a restaurant, not globally
customerSchema.index({ restaurantId: 1, email: 1 }, { unique: true });

// Additional indexes for query performance
customerSchema.index({ restaurantId: 1, isActive: 1 });
customerSchema.index({ restaurantId: 1, createdAt: -1 });

// Hash password before saving
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
customerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export default Customer;
