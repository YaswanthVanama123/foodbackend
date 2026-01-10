import { Schema, model, Document, Types } from 'mongoose';

// Interface for address
interface IAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Interface for branding configuration
interface IBrandingLogo {
  original?: string;
  medium?: string;
  small?: string;
}

interface IBranding {
  logo: IBrandingLogo | string; // Support both new format and legacy string
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  theme: 'light' | 'dark';
  customCSS?: string;
}

// Interface for restaurant settings
interface ISettings {
  currency: string;
  taxRate: number;
  serviceChargeRate: number;
  timezone: string;
  locale: string;
  orderNumberPrefix: string;
}

// Interface for subscription
interface ISubscription {
  plan: 'trial' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  billingCycle: 'monthly' | 'yearly';
  maxTables: number;
  maxMenuItems: number;
  maxAdmins: number;
}

// Main Restaurant interface
export interface IRestaurant extends Document {
  // Core Identity
  subdomain: string;
  name: string;
  slug: string;

  // Contact & Location
  email: string;
  phone: string;
  address: IAddress;

  // Branding Configuration
  branding: IBranding;

  // Business Settings
  settings: ISettings;

  // Subscription & Billing
  subscription: ISubscription;

  // Operational Status
  isActive: boolean;
  isOnboarded: boolean;
  onboardingStep: number;

  // Audit Fields
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Address sub-schema
const addressSchema = new Schema<IAddress>({
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'USA',
  },
}, { _id: false });

// Branding sub-schema
const brandingSchema = new Schema<IBranding>({
  logo: new Schema({
    original: {
      type: String,
      default: '',
    },
    medium: {
      type: String,
      default: '',
    },
    small: {
      type: String,
      default: '',
    },
  }, { _id: false }),
  primaryColor: {
    type: String,
    default: '#1976d2',
    match: [/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format'],
  },
  secondaryColor: {
    type: String,
    default: '#dc004e',
    match: [/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format'],
  },
  accentColor: {
    type: String,
    default: '#9c27b0',
    match: [/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format'],
  },
  fontFamily: {
    type: String,
    default: 'Roboto, sans-serif',
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light',
  },
  customCSS: {
    type: String,
    default: '',
  },
}, { _id: false });

// Settings sub-schema
const settingsSchema = new Schema<ISettings>({
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%'],
  },
  serviceChargeRate: {
    type: Number,
    default: 0,
    min: [0, 'Service charge rate cannot be negative'],
    max: [100, 'Service charge rate cannot exceed 100%'],
  },
  timezone: {
    type: String,
    default: 'America/New_York',
  },
  locale: {
    type: String,
    default: 'en-US',
  },
  orderNumberPrefix: {
    type: String,
    default: 'ORD',
    uppercase: true,
    maxlength: 5,
  },
}, { _id: false });

// Subscription sub-schema
const subscriptionSchema = new Schema<ISubscription>({
  plan: {
    type: String,
    enum: ['trial', 'basic', 'pro', 'enterprise'],
    default: 'trial',
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'expired'],
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  },
  maxTables: {
    type: Number,
    default: 20,
    min: [1, 'Must allow at least 1 table'],
  },
  maxMenuItems: {
    type: Number,
    default: 100,
    min: [1, 'Must allow at least 1 menu item'],
  },
  maxAdmins: {
    type: Number,
    default: 3,
    min: [1, 'Must allow at least 1 admin'],
  },
}, { _id: false });

// Main Restaurant schema
const restaurantSchema = new Schema<IRestaurant>({
  subdomain: {
    type: String,
    required: [true, 'Subdomain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Subdomain must be at least 3 characters'],
    maxlength: [63, 'Subdomain cannot exceed 63 characters'],
    match: [
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
      'Subdomain must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
    ],
  },
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    minlength: [2, 'Restaurant name must be at least 2 characters'],
    maxlength: [100, 'Restaurant name cannot exceed 100 characters'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
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
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  address: {
    type: addressSchema,
    required: [true, 'Address is required'],
  },
  branding: {
    type: brandingSchema,
    default: () => ({}),
  },
  settings: {
    type: settingsSchema,
    default: () => ({}),
  },
  subscription: {
    type: subscriptionSchema,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isOnboarded: {
    type: Boolean,
    default: false,
  },
  onboardingStep: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'SuperAdmin',
  },
  lastLoginAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Note: subdomain, slug, and email already have unique indexes from field definitions

// OPTIMIZATION 3.1: Subdomain lookup (CRITICAL - most common query)
restaurantSchema.index({ subdomain: 1, isActive: 1 }); // Compound for fast active subdomain lookup

// OPTIMIZATION 3.2: Status filtering
restaurantSchema.index({ isActive: 1, 'subscription.status': 1 });

// OPTIMIZATION 3.3: Time-based queries
restaurantSchema.index({ createdAt: -1 });
restaurantSchema.index({ lastLoginAt: -1 }); // For recent activity tracking

// OPTIMIZATION 3.4: Super admin queries
restaurantSchema.index({ createdBy: 1 }); // For filtering by creator
restaurantSchema.index({ 'subscription.plan': 1 }); // For plan-based queries
restaurantSchema.index({ 'subscription.endDate': 1 }); // For expiration checks
restaurantSchema.index({ isActive: 1, createdAt: -1 }); // Compound for active restaurant listings with sorting

// Additional single field indexes for common lookups
restaurantSchema.index({ subdomain: 1 });
restaurantSchema.index({ slug: 1 });
restaurantSchema.index({ email: 1 });
restaurantSchema.index({ isActive: 1 });
restaurantSchema.index({ 'subscription.status': 1 });

// Pre-save hook to auto-generate slug from subdomain if not provided
restaurantSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.subdomain;
  }
  next();
});

// Virtual for full address
restaurantSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Migration helper: normalize logo format for backward compatibility
function normalizeLogo(logo: any): IBrandingLogo {
  if (!logo) return {};
  if (typeof logo === 'string') {
    // Legacy format: convert string to object
    return { original: logo || '' };
  }
  return logo;
}

// Post-find hook to ensure logo is always in object format
restaurantSchema.post('findOne', function(doc) {
  if (doc && doc.branding) {
    doc.branding.logo = normalizeLogo(doc.branding.logo);
  }
});

restaurantSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc && doc.branding) {
        doc.branding.logo = normalizeLogo(doc.branding.logo);
      }
    });
  }
});

restaurantSchema.post('findOneAndUpdate', function(doc) {
  if (doc && doc.branding) {
    doc.branding.logo = normalizeLogo(doc.branding.logo);
  }
});

// Method to check if subscription is valid
restaurantSchema.methods.isSubscriptionValid = function(): boolean {
  return this.subscription.status === 'active' && this.subscription.endDate > new Date();
};

// Method to check if restaurant can add more tables
restaurantSchema.methods.canAddTable = async function(currentTableCount: number): Promise<boolean> {
  return currentTableCount < this.subscription.maxTables;
};

// Method to check if restaurant can add more menu items
restaurantSchema.methods.canAddMenuItem = async function(currentMenuItemCount: number): Promise<boolean> {
  return currentMenuItemCount < this.subscription.maxMenuItems;
};

// Method to check if restaurant can add more admins
restaurantSchema.methods.canAddAdmin = async function(currentAdminCount: number): Promise<boolean> {
  return currentAdminCount < this.subscription.maxAdmins;
};

const Restaurant = model<IRestaurant>('Restaurant', restaurantSchema);

export default Restaurant;
