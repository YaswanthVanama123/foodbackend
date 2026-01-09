import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrderCustomization {
  name: string;
  options: string[];
  priceModifier: number;
}

export interface IOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  customizations?: IOrderCustomization[];
  subtotal: number;
  specialInstructions?: string;
}

export interface IStatusHistory {
  status: string;
  timestamp: Date;
  updatedBy?: Types.ObjectId;
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface IOrder extends Document {
  restaurantId: Types.ObjectId;
  orderNumber: string;
  tableId: Types.ObjectId;
  tableNumber: string;
  customerId?: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  statusHistory: IStatusHistory[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  servedAt?: Date;
}

const orderCustomizationSchema = new Schema<IOrderCustomization>(
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

const orderItemSchema = new Schema<IOrderItem>(
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
      type: [orderCustomizationSchema],
    },
    subtotal: {
      type: Number,
      required: true,
    },
    specialInstructions: {
      type: String,
    },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IStatusHistory>(
  {
    status: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance
    },
    orderNumber: {
      type: String,
      required: true,
      // NOTE: unique constraint removed - now enforced by compound index
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    tableNumber: {
      type: String,
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['received', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'received',
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: function () {
        return [{ status: 'received', timestamp: new Date() }];
      },
    },
    notes: {
      type: String,
    },
    servedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Compound unique index for multi-tenancy
// Order number is unique within a restaurant, not globally
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
// Additional indexes for query performance
orderSchema.index({ restaurantId: 1, tableId: 1 });
orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, customerId: 1, createdAt: -1 });

// Auto-generate order number before validation (RESTAURANT-SCOPED)
// NOTE: Using pre('validate') instead of pre('save') to run before required field validation
orderSchema.pre('validate', async function (next) {
  // Only generate for new orders that don't already have an orderNumber
  if (!this.isNew || this.orderNumber) {
    return next();
  }

  try {
    console.log('[Order Hook] Generating orderNumber for new order');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

    // Create date boundaries for counting today's orders
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // CRITICAL: Count orders for THIS restaurant only
    const count = await mongoose.model('Order').countDocuments({
      restaurantId: this.restaurantId,
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    });

    this.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;
    console.log('[Order Hook] Generated orderNumber:', this.orderNumber);
    next();
  } catch (error: any) {
    console.error('[Order Hook] Error generating orderNumber:', error);
    next(error);
  }
});

export default mongoose.model<IOrder>('Order', orderSchema);
