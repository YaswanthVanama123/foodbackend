import firebaseService from './firebase.service';

/**
 * Notification Helper Service
 * Provides high-level methods for sending notifications throughout the app
 */
class NotificationService {
  /**
   * Send notification when order status changes
   * DATA-ONLY NOTIFICATION - Client handles display (toast in foreground, system notification in background)
   */
  public async notifyOrderStatusChange(
    userToken: string | string[],
    orderId: string,
    orderNumber: string,
    status: string,
    restaurantName: string
  ): Promise<void> {
    const statusMessages: Record<string, { title: string; body: string }> = {
      pending: {
        title: '🕐 Order Received',
        body: `Your order #${orderNumber} has been received and is being prepared.`,
      },
      confirmed: {
        title: '✅ Order Confirmed',
        body: `Your order #${orderNumber} at ${restaurantName} has been confirmed!`,
      },
      preparing: {
        title: '👨‍🍳 Order Preparing',
        body: `Your order #${orderNumber} is being prepared in the kitchen.`,
      },
      ready: {
        title: '🎉 Order Ready',
        body: `Your order #${orderNumber} is ready for pickup!`,
      },
      served: {
        title: '🍽️ Order Served',
        body: `Your order #${orderNumber} has been served. Enjoy your meal!`,
      },
      completed: {
        title: '✨ Order Completed',
        body: `Your order #${orderNumber} has been completed. Enjoy your meal!`,
      },
      cancelled: {
        title: '❌ Order Cancelled',
        body: `Your order #${orderNumber} has been cancelled.`,
      },
    };

    const message = statusMessages[status] || {
      title: 'Order Update',
      body: `Your order #${orderNumber} status has been updated.`,
    };

    console.log('📤 [NotificationService] Sending order status notification...');
    console.log('   Status:', status);
    console.log('   Title:', message.title);
    console.log('   Body:', message.body);
    console.log('   Order ID:', orderId);
    console.log('   Order Number:', orderNumber);

    // Send ACTIVE notification WITH notification field
    // This allows foreground display via onMessage AND background via service worker
    await firebaseService.sendActiveNotification(
      userToken,
      {
        title: message.title,
        body: message.body,
        clickAction: `/order/${orderId}`,
      },
      {
        category: 'order_status',
        orderId,
        orderNumber,
        status,
        action: 'refresh_order',
      }
    );

    console.log('✅ [NotificationService] Notification sent via Firebase service');
  }

  /**
   * Send silent notification to refresh order data
   * SILENT NOTIFICATION - No visible alert, just triggers API call
   */
  public async notifyOrderUpdate(
    userToken: string | string[],
    orderId: string,
    updateType: 'status' | 'items' | 'all'
  ): Promise<void> {
    await firebaseService.sendSilentNotification(userToken, {
      type: 'order_update',
      orderId,
      updateType,
      action: 'refresh_order',
    });
  }

  /**
   * Send notification when new order is placed (to kitchen/admin)
   * ACTIVE NOTIFICATION
   */
  public async notifyNewOrder(
    adminTokens: string[],
    orderId: string,
    orderNumber: string,
    tableNumber: string,
    totalAmount: number
  ): Promise<void> {
    await firebaseService.sendActiveNotification(
      adminTokens,
      {
        title: '🆕 New Order Received',
        body: `Table ${tableNumber} - Order #${orderNumber} - $${totalAmount.toFixed(2)}`,
        clickAction: `/admin/orders/${orderId}`,
      },
      {
        type: 'new_order',
        orderId,
        orderNumber,
        tableNumber,
        action: 'refresh_orders',
      }
    );
  }

  /**
   * Send silent notification to refresh menu items
   * SILENT NOTIFICATION
   */
  public async notifyMenuUpdate(
    restaurantTopic: string,
    updateType: 'item' | 'category' | 'availability',
    itemId?: string
  ): Promise<void> {
    await firebaseService.sendToTopic(
      restaurantTopic,
      { title: '', body: '' },
      {
        type: 'menu_update',
        updateType,
        itemId: itemId || '',
        action: 'refresh_menu',
      },
      true // silent
    );
  }

  /**
   * Send active notification for menu item availability change
   * ACTIVE NOTIFICATION - Only if user has favorited the item
   */
  public async notifyItemAvailabilityChange(
    userTokens: string[],
    itemName: string,
    isAvailable: boolean
  ): Promise<void> {
    if (userTokens.length === 0) return;

    await firebaseService.sendActiveNotification(
      userTokens,
      {
        title: isAvailable ? '✅ Item Available' : '⚠️ Item Unavailable',
        body: isAvailable
          ? `${itemName} is now available to order!`
          : `${itemName} is currently unavailable.`,
      },
      {
        type: 'item_availability',
        itemName,
        isAvailable: isAvailable.toString(),
        action: 'refresh_menu',
      }
    );
  }

  /**
   * Send silent notification to refresh user's cart
   * SILENT NOTIFICATION
   */
  public async notifyCartUpdate(userToken: string, updateType: 'price' | 'availability'): Promise<void> {
    await firebaseService.sendSilentNotification(userToken, {
      type: 'cart_update',
      updateType,
      action: 'refresh_cart',
    });
  }

  /**
   * Send notification for table status change
   * ACTIVE NOTIFICATION
   */
  public async notifyTableStatusChange(
    userToken: string,
    tableNumber: string,
    status: string
  ): Promise<void> {
    await firebaseService.sendActiveNotification(
      userToken,
      {
        title: '📍 Table Update',
        body: `Table ${tableNumber} status: ${status}`,
      },
      {
        type: 'table_status',
        tableNumber,
        status,
        action: 'refresh_table',
      }
    );
  }

  /**
   * Send notification for order payment status
   * ACTIVE NOTIFICATION
   */
  public async notifyPaymentStatus(
    userToken: string,
    orderId: string,
    orderNumber: string,
    paymentStatus: 'success' | 'failed' | 'pending'
  ): Promise<void> {
    const messages = {
      success: {
        title: '💳 Payment Successful',
        body: `Payment for order #${orderNumber} was successful!`,
      },
      failed: {
        title: '❌ Payment Failed',
        body: `Payment for order #${orderNumber} failed. Please try again.`,
      },
      pending: {
        title: '⏳ Payment Pending',
        body: `Payment for order #${orderNumber} is being processed.`,
      },
    };

    await firebaseService.sendActiveNotification(
      userToken,
      {
        title: messages[paymentStatus].title,
        body: messages[paymentStatus].body,
        clickAction: `/order/${orderId}`,
      },
      {
        type: 'payment_status',
        orderId,
        orderNumber,
        paymentStatus,
        action: 'refresh_order',
      }
    );
  }

  /**
   * Subscribe user to restaurant-specific updates
   */
  public async subscribeToRestaurant(userToken: string, restaurantId: string): Promise<void> {
    await firebaseService.subscribeToTopic(userToken, `restaurant_${restaurantId}`);
  }

  /**
   * Unsubscribe user from restaurant-specific updates
   */
  public async unsubscribeFromRestaurant(userToken: string, restaurantId: string): Promise<void> {
    await firebaseService.unsubscribeFromTopic(userToken, `restaurant_${restaurantId}`);
  }

  /**
   * Send notification to all super admins when a new restaurant is registered
   * ACTIVE NOTIFICATION
   */
  public async notifyNewRestaurant(
    superAdminTokens: string[],
    restaurantName: string,
    restaurantId: string,
    subdomain: string
  ): Promise<void> {
    if (superAdminTokens.length === 0) {
      console.log('⚠️  No super admin tokens available for new restaurant notification');
      return;
    }

    await firebaseService.sendActiveNotification(
      superAdminTokens,
      {
        title: '🏢 New Restaurant Registered',
        body: `${restaurantName} (${subdomain}) has been registered on the platform`,
        clickAction: `/super-admin/restaurants/${restaurantId}`,
      },
      {
        category: 'restaurant_registration',
        restaurantId,
        restaurantName,
        subdomain,
        action: 'view_restaurant',
      }
    );

    console.log(`✅ [NotificationService] New restaurant notification sent to ${superAdminTokens.length} super admin(s)`);
  }

  /**
   * Send notification to all super admins when a new admin user is created
   * ACTIVE NOTIFICATION
   */
  public async notifyNewAdmin(
    superAdminTokens: string[],
    adminUsername: string,
    adminEmail: string,
    restaurantName: string,
    restaurantId: string
  ): Promise<void> {
    if (superAdminTokens.length === 0) {
      console.log('⚠️  No super admin tokens available for new admin notification');
      return;
    }

    await firebaseService.sendActiveNotification(
      superAdminTokens,
      {
        title: '👤 New Admin User Created',
        body: `New admin ${adminUsername} created for ${restaurantName}`,
        clickAction: `/super-admin/restaurants/${restaurantId}`,
      },
      {
        category: 'admin_creation',
        adminUsername,
        adminEmail,
        restaurantName,
        restaurantId,
        action: 'view_restaurant',
      }
    );

    console.log(`✅ [NotificationService] New admin notification sent to ${superAdminTokens.length} super admin(s)`);
  }

  /**
   * Send system alert to all super admins
   * ACTIVE NOTIFICATION
   */
  public async notifySystemAlert(
    superAdminTokens: string[],
    alertTitle: string,
    alertMessage: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    metadata?: Record<string, string>
  ): Promise<void> {
    if (superAdminTokens.length === 0) {
      console.log('⚠️  No super admin tokens available for system alert');
      return;
    }

    const severityEmojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    };

    await firebaseService.sendActiveNotification(
      superAdminTokens,
      {
        title: `${severityEmojis[severity]} ${alertTitle}`,
        body: alertMessage,
        clickAction: '/super-admin/dashboard',
      },
      {
        category: 'system_alert',
        severity,
        action: 'view_dashboard',
        ...(metadata || {}),
      }
    );

    console.log(`✅ [NotificationService] System alert (${severity}) sent to ${superAdminTokens.length} super admin(s)`);
  }
}

export default new NotificationService();
