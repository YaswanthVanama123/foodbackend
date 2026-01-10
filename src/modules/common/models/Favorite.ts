import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFavorite extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  menuItemId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
      index: true,
    },
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: [true, 'Menu item ID is required'],
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Compound unique index to ensure a customer can favorite an item only once
favoriteSchema.index({ customerId: 1, menuItemId: 1, restaurantId: 1 }, { unique: true });

// CRITICAL INDEXES FOR QUERY PERFORMANCE
// Index for efficient querying of all favorites for a customer
favoriteSchema.index({ customerId: 1, restaurantId: 1 });

// Additional indexes for common queries
favoriteSchema.index({ menuItemId: 1 });
favoriteSchema.index({ restaurantId: 1 });
favoriteSchema.index({ customerId: 1 });

const Favorite = mongoose.model<IFavorite>('Favorite', favoriteSchema);

export default Favorite;
