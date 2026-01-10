import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomizationOption {
  label: string;
  priceModifier: number;
}

export interface ICustomization {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: ICustomizationOption[];
}

export interface IMenuItemImages {
  original?: string;
  large?: string;
  medium?: string;
  small?: string;
}

export interface IMenuItem extends Document {
  restaurantId: Types.ObjectId;
  name: string;
  description?: string;
  categoryId: Types.ObjectId;
  price: number;
  originalPrice?: number;
  images?: IMenuItemImages;
  image?: string; // Virtual field for backward compatibility
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isNonVeg: boolean;
  customizationOptions?: ICustomization[];
  addOnIds?: Types.ObjectId[]; // Reference to AddOn collection
  preparationTime?: number;
  averageRating: number;
  ratingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const customizationOptionSchema = new Schema<ICustomizationOption>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    priceModifier: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const customizationSchema = new Schema<ICustomization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['single', 'multiple'],
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [customizationOptionSchema],
      required: true,
    },
  },
  { _id: false }
);

const menuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance
    },
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    originalPrice: {
      type: Number,
      required: false,
      min: [0, 'Original price must be positive'],
    },
    images: {
      type: {
        original: {
          type: String,
          default: null,
        },
        large: {
          type: String,
          default: null,
        },
        medium: {
          type: String,
          default: null,
        },
        small: {
          type: String,
          default: null,
        },
      },
      default: () => ({}),
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    isVegan: {
      type: Boolean,
      default: false,
    },
    isGlutenFree: {
      type: Boolean,
      default: false,
    },
    isNonVeg: {
      type: Boolean,
      default: false,
    },
    customizationOptions: {
      type: [customizationSchema],
    },
    addOnIds: {
      type: [Schema.Types.ObjectId],
      ref: 'AddOn',
      default: [],
    },
    preparationTime: {
      type: Number,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Indexes for multi-tenancy and query performance
// Compound index for filtering menu items by restaurant, category, and availability
menuItemSchema.index({ restaurantId: 1, categoryId: 1, isAvailable: 1 });

// Additional indexes for common queries
menuItemSchema.index({ restaurantId: 1, name: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });
menuItemSchema.index({ restaurantId: 1, createdAt: -1 }); // For sorting by creation date
menuItemSchema.index({ restaurantId: 1, isAvailable: 1, createdAt: -1 }); // Compound for filtered lists with date sort
menuItemSchema.index({ restaurantId: 1, categoryId: 1, createdAt: -1 }); // For category + date sorting
menuItemSchema.index({ categoryId: 1 });

// Text search index for searching menu items by name and description (restaurant-scoped)
menuItemSchema.index({ restaurantId: 1, name: 'text', description: 'text' });

// Virtual field for backward compatibility: returns images.original if available
menuItemSchema.virtual('image').get(function() {
  return this.images?.original || null;
}).set(function(value: string) {
  // When setting via the virtual, store in images.original for backward compatibility
  if (!this.images) {
    this.images = {};
  }
  this.images.original = value;
});

// Pre-save hook to migrate legacy image field to images.original
menuItemSchema.pre('save', function(next) {
  // This handles migration of existing data with the old 'image' field structure
  // MongoDB stores the virtual, so we need to handle it manually if needed
  next();
});

// Post-find hook to ensure virtual field is populated
menuItemSchema.post('findOne', function(doc) {
  if (doc && !doc.image && doc.images?.original) {
    doc.image = doc.images.original;
  }
});

menuItemSchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc && !doc.image && doc.images?.original) {
        doc.image = doc.images.original;
      }
    });
  }
});

export default mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
