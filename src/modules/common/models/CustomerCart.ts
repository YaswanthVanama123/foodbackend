import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICartItemCustomization {
  name: string;
  options: string[];
  priceModifier: number;
}

export interface ICartItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  customizations?: ICartItemCustomization[];
  specialInstructions?: string;
  addedAt: Date;
}

export interface ICustomerCart extends Document {
  customerId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemCustomizationSchema = new Schema<ICartItemCustomization>(
  {
    name: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    priceModifier: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const cartItemSchema = new Schema<ICartItem>(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    customizations: {
      type: [cartItemCustomizationSchema],
    },
    specialInstructions: {
      type: String,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const customerCartSchema = new Schema<ICustomerCart>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
      index: true,
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Compound unique index - one cart per customer per restaurant
customerCartSchema.index({ customerId: 1, restaurantId: 1 }, { unique: true });

// Additional indexes for query performance
customerCartSchema.index({ restaurantId: 1, updatedAt: -1 });

// Automatically remove empty carts after 7 days of inactivity
customerCartSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { 'items.0': { $exists: false } }, // Only for empty carts
  }
);

export default mongoose.model<ICustomerCart>('CustomerCart', customerCartSchema);
