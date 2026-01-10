import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// SuperAdmin interface
export interface ISuperAdmin extends Document {
  username: string;
  email: string;
  password: string;
  role: 'super_admin';
  firstName: string;
  lastName: string;
  permissions: string[];
  isActive: boolean;
  fcmTokens?: string[]; // Firebase Cloud Messaging device tokens (multiple devices/browsers)
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// SuperAdmin schema
const superAdminSchema = new Schema<ISuperAdmin>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [50, 'Username cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address',
    ],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password in queries by default
  },
  role: {
    type: String,
    default: 'super_admin',
    enum: ['super_admin'],
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
  permissions: {
    type: [String],
    default: [
      'restaurant:create',
      'restaurant:read',
      'restaurant:update',
      'restaurant:delete',
      'restaurant:view_all',
      'restaurant:toggle_status',
      'admin:create',
      'admin:read',
      'admin:update',
      'admin:delete',
      'analytics:global',
      'analytics:restaurant',
      'billing:manage',
      'system:configure',
    ],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  fcmTokens: {
    type: [String],
    default: [],
    required: false,
    index: true, // Index for efficient FCM token lookups
  },
  lastLoginAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
// Note: username and email already have unique indexes from field definitions
superAdminSchema.index({ isActive: 1 });
superAdminSchema.index({ fcmTokens: 1 }); // For efficient FCM token array lookups

// Pre-save hook to hash password
superAdminSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);

    // Hash password
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password for authentication
superAdminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Virtual for full name
superAdminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to check if super admin has specific permission
superAdminSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.includes(permission) || this.role === 'super_admin';
};

// Ensure virtuals are included when converting to JSON
superAdminSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    const { password: _, ...adminWithoutPassword } = ret;
    return adminWithoutPassword;
  },
});

const SuperAdmin = model<ISuperAdmin>('SuperAdmin', superAdminSchema);

export default SuperAdmin;
