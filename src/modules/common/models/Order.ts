import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrderCustomization {
  name: string;
  options: string[];
  priceModifier: number;
}

export interface IOrderAddOn {
  name: string;
  price: number;
}

export interface IOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  customizations?: IOrderCustomization[];
  addOns?: IOrderAddOn[];
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

const orderAddOnSchema = new Schema<IOrderAddOn>(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
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
    addOns: {
      type: [orderAddOnSchema],
      default: [],
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

// CRITICAL INDEXES FOR QUERY PERFORMANCE OPTIMIZATION
// 1. Active orders query (most frequently accessed) - getActiveOrders()
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

// 2. Orders by table query - getOrdersByTable()
orderSchema.index({ restaurantId: 1, tableId: 1, createdAt: -1 });

// 3. Order history with date range filtering - getOrderHistory()
orderSchema.index({ restaurantId: 1, createdAt: -1 });

// 4. Customer order history
orderSchema.index({ restaurantId: 1, customerId: 1, createdAt: -1 });

// 5. Customer active orders (for home page query)
orderSchema.index({ customerId: 1, restaurantId: 1, status: 1, createdAt: -1 });

// 6. Dashboard stats optimization - covers status + date queries
orderSchema.index({ restaurantId: 1, status: 1, createdAt: 1 });

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

    // Create date boundaries for today's orders
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // CRITICAL: Find the latest order number for THIS restaurant today
    // This is more reliable than countDocuments for handling race conditions
    // Sort by createdAt descending to get the most recent order
    const latestOrder = await mongoose.model('Order').findOne({
      restaurantId: this.restaurantId,
      orderNumber: { $regex: `^ORD-${dateStr}` }, // Only today's orders
    })
      .sort({ createdAt: -1 }) // Sort by creation time, not orderNumber string
      .select('orderNumber')
      .lean()
      .exec() as { orderNumber?: string } | null;

    let nextNumber = 1;

    if (latestOrder && latestOrder.orderNumber) {
      // Extract the numeric part from the order number (e.g., "ORD-20260110-001" -> 1)
      const parts = latestOrder.orderNumber.split('-');
      if (parts.length === 3) {
        const lastNumber = parseInt(parts[2], 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    this.orderNumber = `ORD-${dateStr}-${String(nextNumber).padStart(3, '0')}`;
    console.log('[Order Hook] Generated orderNumber:', this.orderNumber);
    next();
  } catch (error: any) {
    console.error('[Order Hook] Error generating orderNumber:', error);
    next(error);
  }
});

export default mongoose.model<IOrder>('Order', orderSchema);
