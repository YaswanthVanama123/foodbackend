import Order, { IOrderItem } from '../models/Order';
import Table from '../models/Table';

const TAX_RATE = 0.08; // 8% tax rate (adjust as needed)

// Calculate order totals
export const calculateOrderTotals = (items: IOrderItem[]) => {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.subtotal;
  }, 0);

  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

// Calculate item subtotal with customizations
export const calculateItemSubtotal = (price: number, quantity: number, customizations?: any[]) => {
  let customizationTotal = 0;

  if (customizations && customizations.length > 0) {
    customizationTotal = customizations.reduce((sum, custom) => {
      return sum + (custom.priceModifier || 0);
    }, 0);
  }

  const itemTotal = (price + customizationTotal) * quantity;
  return parseFloat(itemTotal.toFixed(2));
};

// Get active orders (tenant-scoped)
export const getActiveOrders = async (restaurantId: string) => {
  return await Order.find({
    restaurantId,
    status: { $in: ['received', 'preparing', 'ready'] },
  })
    .populate('tableId', 'tableNumber')
    .sort({ createdAt: -1 });
};

// Get orders by table (tenant-scoped)
export const getOrdersByTable = async (tableId: string, restaurantId: string) => {
  return await Order.find({ tableId, restaurantId })
    .sort({ createdAt: -1 })
    .limit(10);
};

// Update order status (tenant-scoped)
export const updateOrderStatus = async (
  orderId: string,
  status: string,
  restaurantId: string,
  adminId?: string
) => {
  const order = await Order.findOne({ _id: orderId, restaurantId });

  if (!order) {
    throw new Error('Order not found');
  }

  // Update status
  order.status = status as any;

  // Add to status history
  order.statusHistory.push({
    status,
    timestamp: new Date(),
    updatedBy: adminId as any,
  });

  // If served, set servedAt
  if (status === 'served') {
    order.servedAt = new Date();

    // Update table occupancy (tenant-scoped)
    const table = await Table.findOne({ _id: order.tableId, restaurantId });
    if (table) {
      table.isOccupied = false;
      table.currentOrderId = undefined;
      await table.save();
    }
  }

  await order.save();
  return order;
};

// Get dashboard stats (tenant-scoped)
export const getDashboardStats = async (restaurantId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalOrdersToday = await Order.countDocuments({
    restaurantId,
    createdAt: { $gte: today },
  });

  const activeOrders = await Order.countDocuments({
    restaurantId,
    status: { $in: ['received', 'preparing', 'ready'] },
  });

  const servedOrdersToday = await Order.countDocuments({
    restaurantId,
    createdAt: { $gte: today },
    status: 'served',
  });

  const revenueResult = await Order.aggregate([
    {
      $match: {
        restaurantId,
        createdAt: { $gte: today },
        status: 'served',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' },
      },
    },
  ]);

  const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  return {
    totalOrdersToday,
    activeOrders,
    servedOrdersToday,
    revenue: parseFloat(revenue.toFixed(2)),
  };
};
