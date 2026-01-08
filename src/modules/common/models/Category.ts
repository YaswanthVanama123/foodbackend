import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategoryImages {
  original?: string;
  large?: string;
  medium?: string;
  small?: string;
}

export interface ICategory extends Document {
  restaurantId: Types.ObjectId;
  name: string;
  description?: string;
  images?: ICategoryImages;
  image?: string; // Virtual field for backward compatibility
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      // NOTE: unique constraint removed - now enforced by compound index
    },
    description: {
      type: String,
      trim: true,
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
    displayOrder: {
      type: Number,
      default: 0,
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
// Category name is unique within a restaurant, not globally
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
// Additional indexes for query performance
categorySchema.index({ restaurantId: 1, displayOrder: 1 });
categorySchema.index({ restaurantId: 1, isActive: 1 });

// Virtual field for backward compatibility: returns images.original if available
categorySchema.virtual('image').get(function() {
  return this.images?.original || null;
}).set(function(value: string) {
  // When setting via the virtual, store in images.original for backward compatibility
  if (!this.images) {
    this.images = {};
  }
  this.images.original = value;
});

// Post-find hook to ensure virtual field is populated
categorySchema.post('findOne', function(doc) {
  if (doc && !doc.image && doc.images?.original) {
    doc.image = doc.images.original;
  }
});

categorySchema.post('find', function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc && !doc.image && doc.images?.original) {
        doc.image = doc.images.original;
      }
    });
  }
});

export default mongoose.model<ICategory>('Category', categorySchema);
