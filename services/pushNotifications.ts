import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from './config';

// Configure notification handler (shouldShowBanner/shouldShowList replace deprecated shouldShowAlert)
// Strategy:
// - Remote push notifications: only show when app is closed/background
// - Local notifications (from WebSocket): always show (for in-app notifications)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAppInForeground = AppState.currentState === 'active';
    
    // Check if this is a remote notification (from Expo push) or local (from WebSocket)
    // Remote push notifications have trigger.type === 'push'
    const trigger = notification.request.trigger;
    const isRemoteNotification = trigger && 'type' in trigger && trigger.type === 'push';
    
    // If it's a remote push and app is in foreground:
    // - Platform announcements: show (these may arrive in bursts; WebSocket also updates the in-app list)
    // - Everything else: don't show (WebSocket/in-app handlers will handle it)
    const data = notification.request.content.data as { type?: unknown } | undefined;
    const dataType = typeof data?.type === 'string' ? data.type : undefined;
    const allowRemoteInForeground = dataType === 'platform_announcement';

    // If it's a local notification (WebSocket), always show.
    const shouldShow =
      !isRemoteNotification ||
      !isAppInForeground ||
      (isRemoteNotification && isAppInForeground && allowRemoteInForeground);
    
    return {
      shouldPlaySound: shouldShow,
      shouldSetBadge: true,
      shouldShowBanner: shouldShow,
      shouldShowList: shouldShow,
    };
  },
});

export interface PushNotificationData {
  type: 'order' | 'promotion' | 'system';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private lastPlatformAnnouncementShown: { announcementId: string; at: number } | null = null;
  private static readonly PLATFORM_ANNOUNCEMENT_DEDUP_MS = 8000;

  // Request permissions and get push token
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId =
        process.env.EXPO_PUBLIC_PROJECT_ID ??
        Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error(
          'Expo project ID is not configured. Set EXPO_PUBLIC_PROJECT_ID or expo.extra.eas.projectId.'
        );
      }

      // Try to get Expo push token
      // This may fail if FCM is not configured for Android
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        this.expoPushToken = tokenData.data;
      } catch {
        // FCM not configured - push notifications won't work but app should continue
        if (Platform.OS === 'android') {
          await this.setupAndroidChannels();
        }
        return null;
      }

      // Configure Android notification channels
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      return this.expoPushToken;
    } catch {
      return null;
    }
  }

  // Setup Android notification channels (can work without FCM for local notifications)
  private async setupAndroidChannels(): Promise<void> {
    try {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0a61d7',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('promotions', {
        name: 'Promotions & Offers',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#10b981',
      });

      await Notifications.setNotificationChannelAsync('system', {
        name: 'System Notifications',
        importance: Notifications.AndroidImportance.LOW,
      });
    } catch {
      // ignore
    }
  }

  // Save push token to server (requires auth token for /api/mobile/push-token)
  async savePushTokenToServer(userId: number, token: string, authToken?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(`${API_BASE_URL}/api/mobile/push-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          token,
          platform: Platform.OS,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error saving push token to server:', error);
      return false;
    }
  }

  // Remove push token from server on logout (requires auth token for /api/mobile/push-token)
  async removePushTokenFromServer(token: string, authToken?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(`${API_BASE_URL}/api/mobile/push-token`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ token }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error removing push token from server:', error);
      return false;
    }
  }

  // Schedule a local notification (for testing or immediate display)
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    channelId: string = 'orders'
  ): Promise<string> {
    // Dedup platform announcements: WebSocket can deliver duplicates when reconnecting or when multiple
    // subscribers are active temporarily; avoid spamming identical notifications.
    const aType = (data as { type?: unknown } | undefined)?.type;
    const announcementId = (data as { announcementId?: unknown } | undefined)?.announcementId;
    if (aType === 'platform_announcement' && announcementId != null) {
      const idStr = String(announcementId);
      const now = Date.now();
      if (
        this.lastPlatformAnnouncementShown &&
        this.lastPlatformAnnouncementShown.announcementId === idStr &&
        now - this.lastPlatformAnnouncementShown.at < PushNotificationService.PLATFORM_ANNOUNCEMENT_DEDUP_MS
      ) {
        return '';
      }
      this.lastPlatformAnnouncementShown = { announcementId: idStr, at: now };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: null, // Immediate
    });

    return notificationId;
  }

  // Dedup: avoid showing the same order notification twice when multiple channels deliver (push/WebSocket/realtime)
  private lastOrderNotificationShown: { orderId: string; orderStatus: string; at: number } | null = null;
  private static readonly ORDER_NOTIFICATION_DEDUP_MS = 5000;

  /**
   * Show one in-app order notification when app is in foreground. Deduplicates push vs WebSocket.
   * Call this from WebSocket handler or from push received listener so user sees same content and no duplicate.
   */
  showOrderNotificationInApp(
    orderId: string,
    orderStatus: string,
    customTitle?: string,
    customMessage?: string
  ): void {
    if (AppState.currentState !== 'active') return;
    this.showOrderNotification(orderId, orderStatus, customTitle, customMessage);
  }

  // Show order status notification
  async showOrderNotification(
    orderId: string,
    orderStatus: string,
    customTitle?: string,
    customMessage?: string
  ): Promise<void> {
    const now = Date.now();
    const statusKey = (orderStatus || 'unknown').toLowerCase();
    if (
      this.lastOrderNotificationShown &&
      this.lastOrderNotificationShown.orderId === orderId &&
      this.lastOrderNotificationShown.orderStatus === statusKey &&
      now - this.lastOrderNotificationShown.at < PushNotificationService.ORDER_NOTIFICATION_DEDUP_MS
    ) {
      return;
    }
    this.lastOrderNotificationShown = { orderId, orderStatus: statusKey, at: now };

    let title = customTitle || '';
    let body = customMessage || '';

    if (!customTitle || !customMessage) {
      switch (orderStatus.toLowerCase()) {
        case 'pending':
          title = 'Order Placed';
          body = `Your order #${orderId} has been placed and is awaiting confirmation.`;
          break;
        case 'confirmed':
          title = 'Order Confirmed';
          body = `Great news! Your order #${orderId} has been confirmed and is being processed.`;
          break;
        case 'packed':
          title = 'Order Packed';
          body = `Your order #${orderId} has been packed and is ready for shipping.`;
          break;
        case 'shipped':
          title = 'Order Shipped';
          body = `Your order #${orderId} is on its way! Track your delivery for updates.`;
          break;
        case 'delivered':
          title = 'Order Delivered';
          body = `Your order #${orderId} has been delivered. Enjoy your purchase!`;
          break;
        case 'received':
          title = 'Order Received';
          body = `Your order #${orderId} has been marked as received. Thank you for confirming!`;
          break;
        case 'cancelled':
          title = 'Order Cancelled';
          body = `Your order #${orderId} has been cancelled.`;
          break;
        case 'returned':
          title = 'Order Returned';
          body = `Your order #${orderId} return has been processed.`;
          break;
        case 'failed':
          title = 'Delivery Failed';
          body = `We're sorry. Delivery of your order #${orderId} could not be completed. Please contact support.`;
          break;
        default:
          title = 'Order Update';
          body = `Your order #${orderId} status has been updated to ${orderStatus}.`;
      }
    }

    await this.scheduleLocalNotification(title, body, {
      type: 'order',
      orderId,
      orderStatus,
    }, 'orders');
  }

  // Show promotion notification
  async showPromotionNotification(
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.scheduleLocalNotification(title, message, {
      type: 'promotion',
      ...data,
    }, 'promotions');
  }

  // Add notification response listener
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Add notification received listener (when app is in foreground)
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  // Get current push token
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }
}

export const pushNotificationService = new PushNotificationService();
