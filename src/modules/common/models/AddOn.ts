import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddOn extends Document {
  restaurantId: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const addOnSchema = new Schema<IAddOn>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Add-on name is required'],
      trim: true,
      minlength: [2, 'Add-on name must be at least 2 characters'],
      maxlength: [100, 'Add-on name must not exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description must not exceed 200 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Indexes for multi-tenancy and query performance
addOnSchema.index({ restaurantId: 1, name: 1 });
addOnSchema.index({ restaurantId: 1, isAvailable: 1 });
addOnSchema.index({ restaurantId: 1, displayOrder: 1 });

export default mongoose.model<IAddOn>('AddOn', addOnSchema);
