import Order, { IOrderItem } from '../models/Order';
import Table from '../models/Table';

const TAX_RATE = 0.08; // 8% tax rate (adjust as needed)

// Calculate order totals
export const calculateOrderTotals = (items: IOrderItem[], tip: number = 0) => {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.subtotal;
  }, 0);

  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax + tip;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    tip: parseFloat(tip.toFixed(2)),
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
  return await Order.find(
    {
      restaurantId,
      status: { $in: ['received', 'preparing', 'ready'] },
    },
    {
      // Select only required fields for performance
      orderNumber: 1,
      tableNumber: 1,
      tableId: 1,
      items: 1,
      total: 1,
      status: 1,
      createdAt: 1,
      customerId: 1,
    }
  )
    .populate('tableId', 'tableNumber location')
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

// Get orders by table (tenant-scoped)
export const getOrdersByTable = async (tableId: string, restaurantId: string) => {
  return await Order.find(
    { tableId, restaurantId },
    {
      // Select only required fields for performance
      orderNumber: 1,
      tableNumber: 1,
      items: 1,
      total: 1,
      status: 1,
      createdAt: 1,
      customerId: 1,
    }
  )
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()
    .exec();
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

  // Optimize with single aggregation pipeline instead of multiple queries
  const stats = await Order.aggregate([
    {
      $match: {
        restaurantId,
      },
    },
    {
      $facet: {
        // Total orders today
        totalOrdersToday: [
          {
            $match: {
              createdAt: { $gte: today },
            },
          },
          {
            $count: 'count',
          },
        ],
        // Active orders count
        activeOrders: [
          {
            $match: {
              status: { $in: ['received', 'preparing', 'ready'] },
            },
          },
          {
            $count: 'count',
          },
        ],
        // Served orders today
        servedOrdersToday: [
          {
            $match: {
              createdAt: { $gte: today },
              status: 'served',
            },
          },
          {
            $count: 'count',
          },
        ],
        // Revenue today
        revenueToday: [
          {
            $match: {
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
        ],
      },
    },
  ]);

  const result = stats[0];

  return {
    totalOrdersToday: result.totalOrdersToday[0]?.count || 0,
    activeOrders: result.activeOrders[0]?.count || 0,
    servedOrdersToday: result.servedOrdersToday[0]?.count || 0,
    revenue: parseFloat((result.revenueToday[0]?.total || 0).toFixed(2)),
  };
};
