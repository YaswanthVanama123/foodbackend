import { Server, Socket, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';

interface SocketJwtPayload {
  id: string;
  restaurantId?: string;
  type: 'admin' | 'customer';
}

/**
 * Socket Service with Multi-Tenant Namespace Isolation
 *
 * Each restaurant gets an isolated namespace: /restaurant/{restaurantId}
 * This prevents cross-tenant data leaks in real-time events
 */
export class SocketService {
  private io: Server;
  private namespaces: Map<string, Namespace> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupDefaultNamespace();
  }

  /**
   * Setup default namespace (for connection testing only)
   */
  private setupDefaultNamespace() {
    this.io.on('connection', (socket: Socket) => {
      console.log('⚠️  Root connection detected - redirecting to use restaurant namespace');
      socket.emit('use-namespace', {
        message: 'Please connect to /restaurant/{restaurantId} namespace',
      });
      socket.disconnect();
    });
  }

  /**
   * Get or create namespace for a restaurant
   * Namespaces are created dynamically on first access
   */
  public getRestaurantNamespace(restaurantId: string): Namespace {
    const namespacePath = `/restaurant/${restaurantId}`;

    // Return existing namespace if already created
    if (this.namespaces.has(restaurantId)) {
      return this.namespaces.get(restaurantId)!;
    }

    // Create new namespace
    const namespace = this.io.of(namespacePath);

    // Setup authentication middleware for this namespace
    namespace.use((socket, next) => {
      this.authenticateSocket(socket, restaurantId, next);
    });

    // Setup event handlers
    namespace.on('connection', (socket: Socket) => {
      this.handleConnection(socket, restaurantId);
    });

    this.namespaces.set(restaurantId, namespace);
    console.log(`✓ Created namespace for restaurant: ${restaurantId}`);

    return namespace;
  }

  /**
   * Authenticate socket connection with JWT (Optional)
   */
  private authenticateSocket(
    socket: Socket,
    restaurantId: string,
    next: (err?: Error) => void
  ) {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    // Allow connections without token (guest users)
    if (!token) {
      console.log(`Guest socket connection to restaurant ${restaurantId}`);
      socket.data.userId = null;
      socket.data.restaurantId = restaurantId;
      socket.data.userType = 'guest';
      return next();
    }

    try {
      const decoded = jwt.verify(token, jwtConfig.secret) as SocketJwtPayload;

      // For admin connections, verify restaurant match
      if (decoded.type === 'admin' && decoded.restaurantId !== restaurantId) {
        return next(new Error('Restaurant ID mismatch'));
      }

      // For customer connections, verify restaurant match
      if (decoded.type === 'customer' && decoded.restaurantId !== restaurantId) {
        return next(new Error('Restaurant ID mismatch'));
      }

      // Attach user data to socket
      socket.data.userId = decoded.id;
      socket.data.restaurantId = restaurantId;
      socket.data.userType = decoded.type;

      next();
    } catch (error) {
      // If token is invalid, allow as guest instead of rejecting
      console.log(`Invalid token, allowing as guest for restaurant ${restaurantId}`);
      socket.data.userId = null;
      socket.data.restaurantId = restaurantId;
      socket.data.userType = 'guest';
      next();
    }
  }

  /**
   * Handle socket connection (within namespace)
   */
  private handleConnection(socket: Socket, restaurantId: string) {
    const { userId, userType } = socket.data;
    console.log(`✓ Socket connected to restaurant ${restaurantId}: ${socket.id} (${userType})`);

    // Handle customer joining table room
    socket.on('join-table', (data: { tableNumber: string }) => {
      const { tableNumber } = data;
      const roomName = `table-${tableNumber}`;

      socket.join(roomName);
      console.log(`  → Socket ${socket.id} joined ${roomName} in restaurant ${restaurantId}`);

      socket.emit('table-joined', {
        tableNumber,
        success: true,
      });
    });

    // Handle admin joining admin room
    socket.on('join-admin', () => {
      if (userType !== 'admin') {
        socket.emit('error', { message: 'Only admins can join admin room' });
        return;
      }

      socket.join('admin-room');
      console.log(`  → Admin ${userId} joined admin room in restaurant ${restaurantId}`);

      socket.emit('admin-joined', { success: true });
    });

    // Handle order tracking
    socket.on('track-order', (data: { orderId: string }) => {
      const orderRoom = `order-${data.orderId}`;
      socket.join(orderRoom);
      console.log(`  → Socket ${socket.id} tracking order: ${data.orderId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`✗ Socket disconnected from restaurant ${restaurantId}: ${socket.id}`);
    });
  }

  /**
   * Emit new order to admin room (tenant-scoped)
   */
  public emitNewOrder(restaurantId: string, orderData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);
    namespace.to('admin-room').emit('new-order', orderData);
    console.log(`📢 Emitted new order to restaurant ${restaurantId}:`, orderData.orderNumber);
  }

  /**
   * Emit order status update to customer (tenant-scoped)
   */
  public emitOrderStatusUpdate(
    restaurantId: string,
    tableNumber: string,
    orderData: any
  ) {
    const namespace = this.getRestaurantNamespace(restaurantId);
    const roomName = `table-${tableNumber}`;

    namespace.to(roomName).emit('order-status-updated', {
      orderId: orderData._id,
      status: orderData.status,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted status update to table ${tableNumber} in restaurant ${restaurantId}`);
  }

  /**
   * Emit order status change to all admins (tenant-scoped)
   */
  public emitOrderStatusChange(restaurantId: string, orderData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    namespace.to('admin-room').emit('order-status-changed', {
      orderId: orderData._id,
      orderNumber: orderData.orderNumber,
      status: orderData.status,
      tableNumber: orderData.tableNumber,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted status change to admins in restaurant ${restaurantId}:`, orderData.orderNumber);
  }

  /**
   * Emit updated order to specific order trackers (tenant-scoped)
   */
  public emitOrderUpdate(restaurantId: string, orderId: string, orderData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);
    const orderRoom = `order-${orderId}`;

    namespace.to(orderRoom).emit('order-updated', {
      orderId,
      order: orderData,
    });

    console.log(`📢 Emitted order update for ${orderId} in restaurant ${restaurantId}`);
  }

  /**
   * Emit active orders update to admins (tenant-scoped)
   */
  public emitActiveOrdersUpdate(restaurantId: string, orders: any[]) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    namespace.to('admin-room').emit('active-orders-updated', {
      orders,
    });

    console.log(`📢 Emitted active orders update to restaurant ${restaurantId}`);
  }

  /**
   * Get Socket.io instance
   */
  public getIO(): Server {
    return this.io;
  }

  /**
   * Close namespace (cleanup when restaurant is deleted)
   */
  public closeRestaurantNamespace(restaurantId: string) {
    const namespace = this.namespaces.get(restaurantId);
    if (namespace) {
      // Disconnect all sockets in this namespace
      namespace.disconnectSockets(true);

      // Remove namespace from map
      this.namespaces.delete(restaurantId);

      console.log(`✗ Closed namespace for restaurant: ${restaurantId}`);
    }
  }

  /**
   * Emit table created event to admins (tenant-scoped)
   */
  public emitTableCreated(restaurantId: string, tableData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    namespace.to('admin-room').emit('table-created', {
      table: tableData,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted table-created to restaurant ${restaurantId}:`, tableData.tableNumber);
  }

  /**
   * Emit table updated event to admins and customers (tenant-scoped)
   */
  public emitTableUpdated(restaurantId: string, tableData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    // Emit to admin room
    namespace.to('admin-room').emit('table-updated', {
      table: tableData,
      timestamp: new Date(),
    });

    // Also emit to the specific table room (for customers at that table)
    const tableRoom = `table-${tableData.tableNumber}`;
    namespace.to(tableRoom).emit('table-status-changed', {
      tableNumber: tableData.tableNumber,
      isActive: tableData.isActive,
      isOccupied: tableData.isOccupied,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted table-updated to restaurant ${restaurantId}:`, tableData.tableNumber);
  }

  /**
   * Emit table deleted event to admins (tenant-scoped)
   */
  public emitTableDeleted(restaurantId: string, tableData: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    namespace.to('admin-room').emit('table-deleted', {
      tableId: tableData._id,
      tableNumber: tableData.tableNumber,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted table-deleted to restaurant ${restaurantId}:`, tableData.tableNumber);
  }

  /**
   * Emit bulk table update event to admins (tenant-scoped)
   */
  public emitTableBulkUpdated(restaurantId: string, data: any) {
    const namespace = this.getRestaurantNamespace(restaurantId);

    namespace.to('admin-room').emit('tables-bulk-updated', {
      tableIds: data.tableIds,
      updates: data.updates,
      modifiedCount: data.modifiedCount,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted tables-bulk-updated to restaurant ${restaurantId}: ${data.modifiedCount} tables`);
  }

  /**
   * Emit table status change to specific table room (tenant-scoped)
   * Used for real-time status updates to customers
   */
  public emitTableStatusToCustomers(
    restaurantId: string,
    tableNumber: string,
    statusData: any
  ) {
    const namespace = this.getRestaurantNamespace(restaurantId);
    const tableRoom = `table-${tableNumber}`;

    namespace.to(tableRoom).emit('table-status-changed', {
      tableNumber,
      isOccupied: statusData.isOccupied,
      isActive: statusData.isActive,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted table-status to customers at table ${tableNumber} in restaurant ${restaurantId}`);
  }

  /**
   * Get statistics for all namespaces (for monitoring)
   */
  public getStats() {
    const stats = {
      totalNamespaces: this.namespaces.size,
      namespaces: [] as any[],
    };

    this.namespaces.forEach((namespace, restaurantId) => {
      const sockets = namespace.sockets;
      stats.namespaces.push({
        restaurantId,
        connectedSockets: sockets.size,
        rooms: Array.from(namespace.adapter.rooms.keys()),
      });
    });

    return stats;
  }
}

// Singleton instance
let socketService: SocketService | null = null;

export const initSocketService = (io: Server): SocketService => {
  socketService = new SocketService(io);
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error('Socket service not initialized. Call initSocketService first.');
  }
  return socketService;
};
