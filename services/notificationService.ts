import AsyncStorage from '@react-native-async-storage/async-storage';

export type Notification = {
  id: string;
  type: 'order' | 'discount' | 'promotion' | 'update';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  orderId?: string;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'received' | 'cancelled' | 'returned' | 'failed';
  icon?: string;
  actionText?: string;
  productImage?: string;
};

const NOTIFICATIONS_KEY_PREFIX = 'laku_notifications_';
/** Stored and shown order updates expire three days after they are received. */
export const ORDER_NOTIFICATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const ORDER_STATUS_VALUES = new Set([
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'received',
  'cancelled',
  'returned',
  'failed',
]);

export function isWithinOrderNotificationWindow(iso?: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const at = Date.parse(String(iso));
  if (Number.isNaN(at)) return false;
  return now - at <= ORDER_NOTIFICATION_TTL_MS;
}

function notificationReceivedAt(notification: Notification & { receivedAt?: string }): number | null {
  if (notification.receivedAt) {
    const at = Date.parse(notification.receivedAt);
    if (!Number.isNaN(at)) return at;
  }
  const parsed = Date.parse(notification.timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Pricing, checkout summaries, and promo alerts are not order-status updates. */
function isOrderStatusNotification(notification: Notification): boolean {
  if (notification.type !== 'order') return false;
  const status = (notification.status || '').toLowerCase();
  if (!ORDER_STATUS_VALUES.has(status)) return false;
  const title = notification.title.toLowerCase();
  if (title.includes('pricing') || title.includes('multiple orders')) return false;
  return true;
}

export class NotificationService {
  // Get user-specific storage key
  private static getUserKey(userId: number | null): string {
    return userId ? `${NOTIFICATIONS_KEY_PREFIX}${userId}` : `${NOTIFICATIONS_KEY_PREFIX}anonymous`;
  }

  // Get all notifications for a specific user
  static async getNotifications(userId: number | null = null): Promise<Notification[]> {
    try {
      const key = this.getUserKey(userId);
      const notificationsJson = await AsyncStorage.getItem(key);
      if (!notificationsJson) return [];
      const parsed = JSON.parse(notificationsJson) as Notification[];
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      const kept = parsed.filter((notification) => {
        const receivedAt = notificationReceivedAt(notification);
        if (receivedAt == null || now - receivedAt > ORDER_NOTIFICATION_TTL_MS) return false;
        return isOrderStatusNotification(notification);
      });
      if (kept.length !== parsed.length) {
        await AsyncStorage.setItem(key, JSON.stringify(kept));
      }
      return kept;
    } catch (error) {
      return [];
    }
  }

  /** Stored order events (e.g. pricing_sent) for Order updates — not Alerts. */
  static async getStoredOrderNotifications(userId: number | null = null): Promise<Notification[]> {
    const all = await this.getNotifications(userId);
    return all.filter((n) => n.type === 'order');
  }

  /**
   * Merge derived order-status rows with persisted order events.
   * Stored rows keep their event timestamps; ids already in `derived` are skipped.
   */
  static mergeDerivedWithStoredOrderNotifications(
    derived: Notification[],
    storedOrder: Notification[],
  ): Notification[] {
    const seenIds = new Set(derived.map((n) => n.id));
    const extras = storedOrder.filter((n) => n.type === 'order' && !seenIds.has(n.id));
    // Stored list is newest-first (unshift on write); keep that order ahead of derived.
    return [...extras, ...derived];
  }

  // Save notifications for a specific user
  static async saveNotifications(notifications: Notification[], userId: number | null = null): Promise<void> {
    try {
      const key = this.getUserKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(notifications));
    } catch (error) {
      // Handle error silently
    }
  }

  // Add a new notification for a specific user
  static async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>, userId: number | null = null): Promise<void> {
    try {
      if (!isOrderStatusNotification({ ...notification, id: '', timestamp: '', isRead: false })) return;
      const notifications = await this.getNotifications(userId);
      const receivedAt = new Date().toISOString();
      const newNotification: Notification & { receivedAt: string } = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        receivedAt,
        timestamp: new Date().toLocaleString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', ''),
        isRead: false
      };
      
      notifications.unshift(newNotification); // Add to beginning
      await this.saveNotifications(notifications, userId);
    } catch (error) {
      // Handle error silently
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string, userId: number | null = null): Promise<void> {
    try {
      const notifications = await this.getNotifications(userId);
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      );
      await this.saveNotifications(updatedNotifications, userId);
    } catch (error) {
      // Handle error silently
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: number | null = null): Promise<void> {
    try {
      const notifications = await this.getNotifications(userId);
      const updatedNotifications = notifications.map(notification => ({
        ...notification,
        isRead: true
      }));
      await this.saveNotifications(updatedNotifications, userId);
    } catch (error) {
      // Handle error silently
    }
  }

  // Get unread count
  static async getUnreadCount(userId: number | null = null): Promise<number> {
    try {
      const notifications = await this.getNotifications(userId);
      return notifications.filter(notification => !notification.isRead).length;
    } catch (error) {
      return 0;
    }
  }

  // Create order-related notifications
  static async createOrderNotifications(
    orderId: string, 
    _orderCount: number = 1, 
    productImages?: string[], 
    userId: number | null = null,
    orderStatus?: string,
    orderDescription?: string
  ): Promise<void> {
    try {
        // Use provided order status and description directly - no hardcoding
        const title = orderStatus || 'Payment Required';
        const message = orderDescription || `Your order ${orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing.`;
      
      // Map order status to notification status (Notification.status union)
      type OrderNotificationStatus = NonNullable<Notification['status']>;
      let notificationStatus: OrderNotificationStatus = 'pending';
      if (orderStatus) {
        switch (orderStatus.toLowerCase()) {
          case 'confirmed':
          case 'packed':
            notificationStatus = 'confirmed';
            break;
          case 'shipped':
            notificationStatus = 'shipped';
            break;
          case 'delivered':
            notificationStatus = 'delivered';
            break;
          case 'received':
            notificationStatus = 'received';
            break;
          case 'cancelled':
            notificationStatus = 'cancelled';
            break;
          case 'returned':
            notificationStatus = 'returned';
            break;
          case 'failed':
            notificationStatus = 'failed';
            break;
          case 'pending':
            notificationStatus = 'pending';
            break;
          default:
            notificationStatus = 'pending';
            break;
        }
      }

      // Create notification with completely dynamic content
      await this.addNotification({
        type: 'order',
        title: title,
        message: message,
        orderId: orderId,
        status: notificationStatus,
        productImage: productImages?.[0] // Use first product image
      }, userId);

    } catch (error) {
      // Handle error silently
    }
  }

  /** Distributor sent or updated PO pricing — buyer should review amounts on the order. */
  static async createPricingSentNotification(
    _orderId: string,
    _userId: number | null = null,
    _title?: string,
    _message?: string,
  ): Promise<void> {
    // Pricing is not an order-status update. The phone banner can still show it.
  }

  // Create shipping notification
  static async createShippingNotification(orderId: string, trackingNumber: string, userId: number | null = null): Promise<void> {
    try {
      await this.addNotification({
        type: 'order',
        title: 'Shipped Out',
        message: `Parcel ${trackingNumber} for your order ${orderId} has been shipped out by Lakupak Logistics. Click here to see order details and track your parcel.`,
        orderId: orderId,
        status: 'shipped'
      }, userId);
    } catch (error) {
    }
  }

  // Create delivery notification
  static async createDeliveryNotification(orderId: string, trackingNumber: string, userId: number | null = null): Promise<void> {
    try {
      await this.addNotification({
        type: 'order',
        title: 'Parcel Delivered',
        message: `Parcel ${trackingNumber} for your order ${orderId} has been delivered.`,
        orderId: orderId,
        status: 'delivered',
        actionText: 'Confirm Receipt'
      }, userId);

      // Add confirm receipt notification
      await this.addNotification({
        type: 'order',
        title: 'Confirm Receipt',
        message: `Please check that all items for your order ${orderId} have been delivered. Thank you for shopping with Lakupak!`,
        orderId: orderId,
        status: 'delivered'
      }, userId);
    } catch (error) {
    }
  }

  // Create discount notification
  static async createDiscountNotification(title: string, message: string, userId: number | null = null): Promise<void> {
    try {
      await this.addNotification({
        type: 'discount',
        title: title,
        message: message
      }, userId);
    } catch (error) {
    }
  }

  // Create promotion notification
  static async createPromotionNotification(title: string, message: string, userId: number | null = null): Promise<void> {
    try {
      await this.addNotification({
        type: 'promotion',
        title: title,
        message: message
      }, userId);
    } catch (error) {
    }
  }

  // Create update notification
  static async createUpdateNotification(title: string, message: string, userId: number | null = null): Promise<void> {
    try {
      await this.addNotification({
        type: 'update',
        title: title,
        message: message
      }, userId);
    } catch (error) {
    }
  }

  // Clean up orphaned notifications (notifications for orders that no longer exist)
  static async cleanupOrphanedNotifications(existingOrderIds: string[], userId: number | null = null): Promise<void> {
    try {
      const notifications = await this.getNotifications(userId);
      const orderNotifications = notifications.filter(n => n.type === 'order' && n.orderId);
      
      // Find notifications for orders that no longer exist
      const orphanedNotifications = orderNotifications.filter(n => 
        n.orderId && !existingOrderIds.includes(n.orderId)
      );
      
      if (orphanedNotifications.length > 0) {
        // Remove orphaned notifications
        const validNotifications = notifications.filter(n => 
          !(n.type === 'order' && n.orderId && !existingOrderIds.includes(n.orderId))
        );
        
        await this.saveNotifications(validNotifications, userId);
      }
    } catch (error) {
      // Handle error silently
    }
  }
}
