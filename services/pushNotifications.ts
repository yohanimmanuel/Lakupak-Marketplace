import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from './config';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled,
  getPushOrdersEnabled,
  getPushLatestUpdatesEnabled,
  getPushPromotionsEnabled,
  setPushOrdersEnabled,
  setPushLatestUpdatesEnabled,
  setPushPromotionsEnabled,
  type PushNotificationCategory,
} from '../utils/preferences';
import { getBuyerOrderNotificationStrings } from '../utils/orderNotificationI18n';

/** Map payload + Android channel to a user-controlled notification category. */
export function resolvePushCategory(
  data: Record<string, unknown> | undefined,
  channelId: string,
): PushNotificationCategory {
  const type = typeof data?.type === 'string' ? data.type : undefined;
  if (type === 'order' || type === 'payment') return 'orders';
  if (type === 'platform_announcement' || type === 'system') return 'latestUpdates';
  if (type === 'promotion') return 'promotions';
  if (channelId === 'promotions') return 'promotions';
  if (channelId === 'system') return 'latestUpdates';
  return 'orders';
}

export interface PushNotificationData {
  type: 'order' | 'promotion' | 'system';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  /** Last Expo token successfully persisted to the server (dedup for foreground re-saves). */
  private lastSavedToken: string | null = null;
  private lastPlatformAnnouncementShown: { announcementId: string; at: number } | null = null;
  private static readonly PLATFORM_ANNOUNCEMENT_DEDUP_MS = 8000;
  private masterEnabled: boolean | null = null;
  private categoryEnabled: Record<PushNotificationCategory, boolean | null> = {
    orders: null,
    latestUpdates: null,
    promotions: null,
  };
  /** Push toggles are read from storage per logged-in user (or guest when logged out). */
  private preferenceUserId: number | null = null;
  /** Bumps when preference scope changes so async hydrations discard stale results. */
  private categoryHydrationGen = 0;

  setPreferenceUserScope(userId: number | null): void {
    if (this.preferenceUserId !== userId) {
      this.preferenceUserId = userId;
      this.masterEnabled = null;
      this.categoryEnabled = { orders: null, latestUpdates: null, promotions: null };
      this.categoryHydrationGen++;
    }
  }

  /** Overall push switch (`pushEnabled` in storage). When off, no notifications are shown. */
  async hydrateMasterEnabled(): Promise<boolean> {
    if (this.masterEnabled != null) return this.masterEnabled;

    const gen = this.categoryHydrationGen;
    const userIdAtStart = this.preferenceUserId;
    const v = await getPushNotificationsEnabled(userIdAtStart);

    if (this.categoryHydrationGen !== gen || this.preferenceUserId !== userIdAtStart) {
      return this.masterEnabled ?? v;
    }

    this.masterEnabled = v;
    return v;
  }

  async setMasterEnabled(enabled: boolean): Promise<void> {
    const targetUserId = this.preferenceUserId;
    this.masterEnabled = enabled;
    await setPushNotificationsEnabled(enabled, targetUserId);
  }

  async hydrateCategoryEnabled(category: PushNotificationCategory): Promise<boolean> {
    if (!(await this.hydrateMasterEnabled())) return false;

    if (this.categoryEnabled[category] != null) return this.categoryEnabled[category]!;

    const gen = this.categoryHydrationGen;
    const userIdAtStart = this.preferenceUserId;

    const read =
      category === 'orders'
        ? getPushOrdersEnabled
        : category === 'latestUpdates'
          ? getPushLatestUpdatesEnabled
          : getPushPromotionsEnabled;
    const v = await read(userIdAtStart);

    if (this.categoryHydrationGen !== gen || this.preferenceUserId !== userIdAtStart) {
      return this.categoryEnabled[category] ?? v;
    }

    this.categoryEnabled[category] = v;
    return v;
  }

  async hydrateAllCategoryPreferences(): Promise<void> {
    await this.hydrateMasterEnabled();
    await Promise.all([
      this.hydrateCategoryEnabled('orders'),
      this.hydrateCategoryEnabled('latestUpdates'),
      this.hydrateCategoryEnabled('promotions'),
    ]);
  }

  async setCategoryEnabled(category: PushNotificationCategory, enabled: boolean): Promise<void> {
    const targetUserId = this.preferenceUserId;
    this.categoryEnabled[category] = enabled;
    if (category === 'orders') await setPushOrdersEnabled(enabled, targetUserId);
    else if (category === 'latestUpdates') await setPushLatestUpdatesEnabled(enabled, targetUserId);
    else await setPushPromotionsEnabled(enabled, targetUserId);
  }

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
  async savePushTokenToServer(
    userId: number,
    token: string,
    authToken?: string,
    language?: string,
  ): Promise<boolean> {
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
          ...(language ? { language } : {}),
        }),
      });

      if (response.ok) this.lastSavedToken = token;
      return response.ok;
    } catch (error) {
      console.error('Error saving push token to server:', error);
      return false;
    }
  }

  /** Token already persisted this session; callers use it to avoid redundant POSTs. */
  getLastSavedToken(): string | null {
    return this.lastSavedToken;
  }

  /** Update language on all active push tokens (no Expo token required). */
  async setMarketplaceUserPushLanguage(authToken: string, language: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/push-token`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ language }),
      });
      return res.ok;
    } catch (error) {
      console.error('Error updating push language on server:', error);
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

  /**
   * Deregister this device's push token on logout so the account stops receiving pushes here.
   * Must be called while the auth token is still valid (the DELETE endpoint requires auth).
   * Resets the save-dedup marker so the next signed-in user re-registers this device.
   */
  async deregisterCurrentDevice(authToken?: string): Promise<void> {
    const token = this.expoPushToken;
    this.lastSavedToken = null;
    if (!token) return;
    try {
      await this.removePushTokenFromServer(token, authToken);
    } catch (error) {
      console.error('Error deregistering push token on logout:', error);
    }
  }

  // Schedule a local notification (for testing or immediate display)
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    channelId: string = 'orders'
  ): Promise<string> {
    const category = resolvePushCategory(data, channelId);
    if (!(await this.hydrateCategoryEnabled(category))) return '';

    // Dedup platform announcements: WebSocket can deliver duplicates when reconnecting or when multiple
    // subscribers are active temporarily; avoid spamming identical notifications.
    const aType = (data as { type?: unknown } | undefined)?.type;
    const announcementId = (data as { announcementId?: unknown } | undefined)?.announcementId;
    if (
      (aType === 'platform_announcement' || aType === 'promotion') &&
      announcementId != null
    ) {
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
  private lastOrderNotificationShown: { orderId: string; orderStatus: string; titleKey: string; at: number } | null = null;
  private static readonly ORDER_NOTIFICATION_DEDUP_MS = 5000;

  /**
   * Show one in-app order notification when app is in foreground. Deduplicates push vs WebSocket.
   */
  showOrderNotificationInApp(
    orderId: string,
    orderStatus: string,
    customTitle?: string,
    customMessage?: string,
  ): void {
    if (AppState.currentState !== 'active') return;
    void this.showOrderNotification(orderId, orderStatus, customTitle, customMessage);
  }

  // Show order status notification
  async showOrderNotification(
    orderId: string,
    orderStatus: string,
    customTitle?: string,
    customMessage?: string,
  ): Promise<void> {
    const { title, body } =
      customTitle != null &&
      customTitle !== '' &&
      customMessage != null &&
      customMessage !== ''
        ? { title: customTitle, body: customMessage }
        : getBuyerOrderNotificationStrings(orderId, orderStatus);

    // Dedup includes the title so non-status events (e.g. return/refund submitted) aren't
    // suppressed by a recent status banner sharing the same `(orderId, orderStatus)` pair.
    const now = Date.now();
    const statusKey = (orderStatus || 'unknown').toLowerCase();
    const titleKey = title || '';
    if (
      this.lastOrderNotificationShown &&
      this.lastOrderNotificationShown.orderId === orderId &&
      this.lastOrderNotificationShown.orderStatus === statusKey &&
      this.lastOrderNotificationShown.titleKey === titleKey &&
      now - this.lastOrderNotificationShown.at < PushNotificationService.ORDER_NOTIFICATION_DEDUP_MS
    ) {
      return;
    }
    this.lastOrderNotificationShown = { orderId, orderStatus: statusKey, titleKey, at: now };

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

// Configure notification handler (shouldShowBanner/shouldShowList replace deprecated shouldShowAlert)
// Strategy:
// - Remote push: respect per-category toggles; foreground rules unchanged below
// - Local notifications: category gating happens in scheduleLocalNotification
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAppInForeground = AppState.currentState === 'active';

    const trigger = notification.request.trigger;
    const isRemoteNotification = trigger && 'type' in trigger && trigger.type === 'push';

    const data = notification.request.content.data as Record<string, unknown> | undefined;

    if (isRemoteNotification) {
      const category = resolvePushCategory(data, 'orders');
      if (!(await pushNotificationService.hydrateCategoryEnabled(category))) {
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
    }

    const dataType = typeof data?.type === 'string' ? data.type : undefined;
    const allowRemoteInForeground =
      dataType === 'platform_announcement' || dataType === 'promotion';

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
