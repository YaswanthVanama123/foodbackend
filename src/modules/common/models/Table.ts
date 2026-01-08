import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITable extends Document {
  restaurantId: Types.ObjectId;
  tableNumber: string;
  capacity: number;
  isActive: boolean;
  isOccupied: boolean;
  currentOrderId?: Types.ObjectId;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const tableSchema = new Schema<ITable>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true, // CRITICAL: Index for query performance
    },
    tableNumber: {
      type: String,
      required: [true, 'Table number is required'],
      trim: true,
      // NOTE: unique constraint removed - now enforced by compound index
    },
    capacity: {
      type: Number,
      required: [true, 'Table capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isOccupied: {
      type: Boolean,
      default: false,
    },
    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    location: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Compound unique index for multi-tenancy
// Table number is unique within a restaurant, not globally
tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });
// Additional indexes for query performance
tableSchema.index({ restaurantId: 1, isActive: 1 });
tableSchema.index({ restaurantId: 1, isOccupied: 1 });

export default mongoose.model<ITable>('Table', tableSchema);
