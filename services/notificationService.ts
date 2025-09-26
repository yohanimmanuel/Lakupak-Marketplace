import AsyncStorage from '@react-native-async-storage/async-storage';

export type Notification = {
  id: string;
  type: 'order' | 'discount' | 'promotion' | 'update';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  orderId?: string;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  icon?: string;
  actionText?: string;
  productImage?: string;
};

const NOTIFICATIONS_KEY = 'laku_laku_notifications';

export class NotificationService {
  // Get all notifications
  static async getNotifications(): Promise<Notification[]> {
    try {
      const notificationsJson = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (notificationsJson) {
        return JSON.parse(notificationsJson);
      }
      return [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Save notifications
  static async saveNotifications(notifications: Notification[]): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  // Add a new notification
  static async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const newNotification: Notification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      await this.saveNotifications(notifications);
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      );
      await this.saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.map(notification => ({
        ...notification,
        isRead: true
      }));
      await this.saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Get unread count
  static async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(notification => !notification.isRead).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Create order-related notifications
  static async createOrderNotifications(orderId: string, orderCount: number = 1, productImages?: string[]): Promise<void> {
    try {
      // Payment Confirmed notification
      await this.addNotification({
        type: 'order',
        title: 'Payment Confirmed',
        message: `Payment for order ${orderId} has been confirmed and we've notified the seller. Kindly wait for your shipment.`,
        orderId: orderId,
        status: 'confirmed',
        productImage: productImages?.[0] // Use first product image
      });

      // If multiple orders, add a summary notification
      if (orderCount > 1) {
        await this.addNotification({
          type: 'order',
          title: 'Multiple Orders Created',
          message: `You have successfully placed ${orderCount} orders. Each order will be processed separately by their respective distributors.`,
          orderId: orderId,
          status: 'confirmed',
          productImage: productImages?.[0] // Use first product image
        });
      }
    } catch (error) {
      console.error('Error creating order notifications:', error);
    }
  }

  // Create shipping notification
  static async createShippingNotification(orderId: string, trackingNumber: string): Promise<void> {
    try {
      await this.addNotification({
        type: 'order',
        title: 'Shipped Out',
        message: `Parcel ${trackingNumber} for your order ${orderId} has been shipped out by Laku-Laku Logistics. Click here to see order details and track your parcel.`,
        orderId: orderId,
        status: 'shipped'
      });
    } catch (error) {
      console.error('Error creating shipping notification:', error);
    }
  }

  // Create delivery notification
  static async createDeliveryNotification(orderId: string, trackingNumber: string): Promise<void> {
    try {
      await this.addNotification({
        type: 'order',
        title: 'Parcel Delivered',
        message: `Parcel ${trackingNumber} for your order ${orderId} has been delivered.`,
        orderId: orderId,
        status: 'delivered',
        actionText: 'Confirm Receipt'
      });

      // Add confirm receipt notification
      await this.addNotification({
        type: 'order',
        title: 'Confirm Receipt',
        message: `Please check that all items for your order ${orderId} have been delivered. Thank you for shopping with Laku-Laku!`,
        orderId: orderId,
        status: 'delivered'
      });
    } catch (error) {
      console.error('Error creating delivery notification:', error);
    }
  }

  // Create discount notification
  static async createDiscountNotification(title: string, message: string): Promise<void> {
    try {
      await this.addNotification({
        type: 'discount',
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error creating discount notification:', error);
    }
  }

  // Create promotion notification
  static async createPromotionNotification(title: string, message: string): Promise<void> {
    try {
      await this.addNotification({
        type: 'promotion',
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error creating promotion notification:', error);
    }
  }

  // Create update notification
  static async createUpdateNotification(title: string, message: string): Promise<void> {
    try {
      await this.addNotification({
        type: 'update',
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error creating update notification:', error);
    }
  }

  // Clean up orphaned notifications (notifications for orders that no longer exist)
  static async cleanupOrphanedNotifications(existingOrderIds: string[]): Promise<void> {
    try {
      const notifications = await this.getNotifications();
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
        
        await this.saveNotifications(validNotifications);
        console.log(`Cleaned up ${orphanedNotifications.length} orphaned notifications`);
      }
    } catch (error) {
      console.error('Error cleaning up orphaned notifications:', error);
    }
  }
}
