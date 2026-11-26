import { DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NotificationService } from './notificationService';
import { pushNotificationService } from './pushNotifications';
import i18n from '../i18n';

export const MEMBERSHIP_ACCESS_EVENT = 'membership-access-updated';

function membershipDataType(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const type = (data as { type?: unknown }).type;
  return typeof type === 'string' ? type : undefined;
}

/** Ensure the Notifications-tab Alerts row exists (deduped). */
export async function ensureMembershipPendingInbox(opts: {
  userId: number;
  title: string;
  body: string;
}): Promise<void> {
  await NotificationService.createMembershipPendingNotification(opts.title, opts.body, opts.userId);
}

/** Persist Alerts-tab row + show a local OS notification for pending marketplace access. */
export async function notifyMembershipPending(opts: {
  userId: number;
  title: string;
  body: string;
}): Promise<void> {
  await ensureMembershipPendingInbox(opts);
  try {
    await pushNotificationService.scheduleLocalNotification(
      opts.title,
      opts.body,
      { type: 'membership', actionPath: '/useraccounts/loginsignup/access-pending' },
      'system',
    );
  } catch {
    // Local banner is best-effort; inbox row still matters.
  }
  DeviceEventEmitter.emit(MEMBERSHIP_ACCESS_EVENT, { status: 'pending' });
}

let lastApprovedAt = 0;
let lastApprovedBannerAt = 0;

/**
 * Clear the pending Alerts row after distributor approval.
 * OS push is the only user-facing notice — do not add an Alerts inbox row.
 */
export async function notifyMembershipApproved(opts: {
  userId: number;
  title: string;
  body: string;
  showLocalBanner?: boolean;
  /** Remote push already showed an OS banner — suppress a duplicate local one from WebSocket. */
  remotePushDelivered?: boolean;
}): Promise<void> {
  const now = Date.now();
  const fresh = now - lastApprovedAt >= 2500;
  lastApprovedAt = now;

  if (opts.remotePushDelivered) {
    lastApprovedBannerAt = now;
  }

  await NotificationService.clearMembershipPendingNotification(opts.userId);
  // Drop any legacy "access approved" Alerts rows from earlier builds.
  await NotificationService.clearMembershipApprovedNotification(opts.userId);

  if (opts.showLocalBanner) {
    // Push + WS often arrive together; wait briefly so a remote banner isn't duplicated.
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (Date.now() - lastApprovedBannerAt >= 2500) {
      lastApprovedBannerAt = Date.now();
      try {
        await pushNotificationService.scheduleLocalNotification(
          opts.title,
          opts.body,
          { type: 'membership_approved', actionPath: '/(tabs)/home' },
          'system',
        );
      } catch {
        // best-effort
      }
    }
  }

  if (fresh) {
    DeviceEventEmitter.emit(MEMBERSHIP_ACCESS_EVENT, { status: 'active' });
  }
}

/**
 * When the app opens after a kill/background, clear pending if an approval
 * push is still in the tray or was the last notification the user opened.
 */
export async function syncMembershipApprovedFromSystemTray(userId: number): Promise<void> {
  try {
    const [presented, lastResponse] = await Promise.all([
      Notifications.getPresentedNotificationsAsync(),
      Notifications.getLastNotificationResponseAsync(),
    ]);
    const fromPresented = presented.some(
      (row) => membershipDataType(row.request.content.data) === 'membership_approved',
    );
    const fromLast =
      membershipDataType(lastResponse?.notification.request.content.data) === 'membership_approved';
    if (!fromPresented && !fromLast) return;

    await notifyMembershipApproved({
      userId,
      title: i18n.t('tabsNotifications.membershipApproved.title'),
      body: i18n.t('tabsNotifications.membershipApproved.body'),
      showLocalBanner: false,
      remotePushDelivered: true,
    });
  } catch {
    // best-effort
  }
}
