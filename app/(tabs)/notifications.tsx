import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Text,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  Gift,
  Tag,
  ChevronRight,
  Megaphone,
  Wrench,
  FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { NotificationService, Notification } from '../../services/notificationService';
import {
  fetchPublishedLatestUpdates,
  getReadAnnouncementIds,
  markAnnouncementRead,
  markAnnouncementsRead,
  type PlatformAnnouncement,
} from '../../services/latestUpdatesService';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { usePlatformAnnouncementsRealtimeStore } from '../../stores/platformAnnouncementsRealtimeStore';
import { OrderUpdateRow } from '../components/notifications/OrderUpdateRow';

const MISSING_ORDER_TIMESTAMP_FALLBACK = '1970-01-01T00:00:00.000Z';
const warnedOrderIds = new Set<string>();
const ORDER_PREVIEW_LIMIT = 5;
const primaryBlue = '#0a61d7';

/** Fixed marketplace “Latest updates” filters (must match admin `PlatformAnnouncement.category` values, case-insensitive). */
type LatestUpdateTabId = 'all' | 'update' | 'promotion' | 'maintenance' | 'policy';

const LATEST_UPDATE_TABS: { id: LatestUpdateTabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'update', label: 'Updates' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'policy', label: 'Policy' },
];

function normalizeAnnouncementCategory(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/** Map stored category to a tab id for row icons (unknown → updates). */
function announcementCategoryToTabId(category: string | null | undefined): Exclude<LatestUpdateTabId, 'all'> {
  const n = normalizeAnnouncementCategory(category);
  if (n === 'promotion' || n === 'promotions') return 'promotion';
  if (n === 'maintenance') return 'maintenance';
  if (n === 'policy' || n === 'policies') return 'policy';
  if (n === 'update' || n === 'updates') return 'update';
  return 'update';
}

function formatAnnouncementTime(iso: string | null, fallbackIso: string) {
  const raw = iso || fallbackIso;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrateFromStorage);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [orderNotifications, setOrderNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const orders = useDataStore((state) => state.orders);

  const [latestUpdates, setLatestUpdates] = useState<PlatformAnnouncement[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<number>>(new Set());
  const [selectedUpdateCategory, setSelectedUpdateCategory] = useState<LatestUpdateTabId>('all');

  const paRealtimeVersion = usePlatformAnnouncementsRealtimeStore((s) => s.version);

  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setAlerts([]);
      setError(null);
      return;
    }

    const loadNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications(authUser.id);
        const nonOrderNotifications = storedNotifications.filter((n) => n.type !== 'order');
        setAlerts(nonOrderNotifications);
      } catch {
        setError('Failed to load notifications. Pull to refresh or try again later.');
        setAlerts([]);
      }
    };

    loadNotifications();
  }, [isAuthenticated, authUser?.id]);

  useEffect(() => {
    let cancelled = false;
    const marketplaceUserId = isAuthenticated && authUser?.id != null ? authUser.id : null;
    (async () => {
      const ids = await getReadAnnouncementIds(marketplaceUserId);
      if (!cancelled) setReadAnnouncementIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authUser?.id]);

  const loadLatestUpdates = useCallback(async () => {
    setLatestLoading(true);
    setLatestError(null);
    try {
      const list = await fetchPublishedLatestUpdates({ limit: 80 });
      setLatestUpdates(list);
    } catch (e) {
      setLatestError(e instanceof Error ? e.message : 'Could not load latest updates.');
      setLatestUpdates([]);
    } finally {
      setLatestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatestUpdates();
  }, [loadLatestUpdates]);

  useEffect(() => {
    const s = usePlatformAnnouncementsRealtimeStore.getState();
    if (s.lastIncoming) {
      const incoming = s.lastIncoming;
      setLatestUpdates((prev) => {
        if (prev.some((x) => x.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    }
    if (typeof s.lastUnpublishedId === 'number') {
      const id = s.lastUnpublishedId;
      setLatestUpdates((prev) => prev.filter((x) => x.id !== id));
      setReadAnnouncementIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [paRealtimeVersion]);

  const filteredLatestUpdates = useMemo(() => {
    if (selectedUpdateCategory === 'all') return latestUpdates;
    const key = selectedUpdateCategory;
    return latestUpdates.filter((a) => normalizeAnnouncementCategory(a.category) === key);
  }, [latestUpdates, selectedUpdateCategory]);

  const getAlertIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'discount':
        return <Tag size={20} color="#ef4444" />;
      case 'promotion':
        return <Gift size={20} color="#3b82f6" />;
      case 'update':
      default:
        return <Bell size={20} color="#ef4444" />;
    }
  };

  const getUpdateTabIcon = (tabId: LatestUpdateTabId, active: boolean) => {
    const color = active ? primaryBlue : '#9ca3af';
    const size = 20;
    switch (tabId) {
      case 'all':
        return <Megaphone size={size} color={color} />;
      case 'update':
        return <Bell size={size} color={color} />;
      case 'promotion':
        return <Gift size={size} color={color} />;
      case 'maintenance':
        return <Wrench size={size} color={color} />;
      case 'policy':
        return <FileText size={size} color={color} />;
      default:
        return <Bell size={size} color={color} />;
    }
  };

  useEffect(() => {
    if (!authUser?.id) {
      setOrderNotifications([]);
      return;
    }

    const dataStore = useDataStore.getState();
    const cachedUserId = dataStore.user?.id;
    const validOrders = cachedUserId === authUser.id ? orders : [];

    setOrderNotifications((prev) => {
      const previousMap = new Map(prev.map((notification) => [notification.id, notification]));
      const derived = validOrders.map((order) => {
        let title = 'Order Placed';
        let message = `Your order ${order.orderId} has been placed.`;

        if (order.paymentStatus === 'Unpaid' && order.orderStatus === 'Pending') {
          title = 'Payment Required';
          message = `Your order ${order.orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing.`;
        } else if (order.orderStatus === 'Confirmed') {
          title = 'Order Confirmed';
          message = `Excellent! Your order ${order.orderId} has been confirmed by our distributor and is now being processed.`;
        } else if (order.orderStatus === 'Packed') {
          title = 'Order Packed';
          message = `Fantastic! Your order ${order.orderId} has been carefully packed and is ready for shipment.`;
        } else if (order.orderStatus === 'Shipped') {
          title = 'Order Shipped';
          message = `Exciting news! Your order ${order.orderId} has been shipped and is now on its way to you.`;
        } else if (
          (order.orderStatus === 'Delivered' || order.orderStatus === 'Received') &&
          Array.isArray(order.returnRequests) &&
          order.returnRequests.some((rr: { status: string }) => rr.status === 'Pending')
        ) {
          title = 'Return Request Submitted';
          message = `Your return request for order ${order.orderId} has been submitted. We will process it and contact you if needed.`;
        } else if (order.orderStatus === 'Delivered') {
          title = 'Order Delivered';
          message = `🎉 Congratulations! Your order ${order.orderId} has been successfully delivered!`;
        } else if (order.orderStatus === 'Received') {
          title = 'Order Received';
          message = `Thank you! You marked order ${order.orderId} as received. We hope you enjoy your purchase!`;
        } else if (order.orderStatus === 'Cancelled') {
          title = 'Order Cancelled';
          message = `We regret to inform you that your order ${order.orderId} has been cancelled.`;
        } else if (order.orderStatus === 'Returned') {
          title = 'Order Returned';
          message = `Your order ${order.orderId} has been returned to us.`;
        } else if (order.orderStatus === 'Failed') {
          title = 'Delivery Failed';
          message = `We're sorry. Delivery of your order ${order.orderId} could not be completed. Please contact support.`;
        }

        let timestampSource = order.createdAt || order.orderDate;
        if (!timestampSource) {
          const orderKey = order.orderId ?? String(order.id ?? '');
          if (orderKey && !warnedOrderIds.has(orderKey)) {
            console.warn('[Notifications] Order missing timestamp fields; using fallback.', {
              orderId: orderKey,
            });
            warnedOrderIds.add(orderKey);
          }
          timestampSource = MISSING_ORDER_TIMESTAMP_FALLBACK;
        }
        const normalizedStatus = (order.orderStatus || '').toLowerCase() as Notification['status'];

        return {
          id: `order_${order.orderId}`,
          type: 'order' as const,
          title,
          message,
          timestamp: new Date(timestampSource)
            .toLocaleString('en-US', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
            .replace(',', ''),
          isRead: previousMap.get(`order_${order.orderId}`)?.isRead ?? false,
          orderId: order.orderId,
          status: normalizedStatus,
          productImage: order.orderItems?.[0]?.images?.[0],
        } as Notification;
      });

      return derived;
    });
  }, [orders, authUser?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const userId = authUser?.id ?? null;
      await NotificationService.markAsRead(notificationId, userId);
      const updatedNotifications = await NotificationService.getNotifications(userId);
      const nonOrderNotifications = updatedNotifications.filter((n) => n.type !== 'order');
      setAlerts(nonOrderNotifications);
      setOrderNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const onReadAllLatest = async () => {
    const uid = authUser?.id ?? null;
    const ids = filteredLatestUpdates.map((a) => a.id);
    await markAnnouncementsRead(ids, uid);
    setReadAnnouncementIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const hasAlerts = alerts.length > 0;
  const hasOrderUpdates = orderNotifications.length > 0;
  const previewOrders = orderNotifications.slice(0, ORDER_PREVIEW_LIMIT);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {hasAlerts && (
          <>
            {alerts.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, !notification.isRead && styles.unreadNotification]}
                onPress={() => markAsRead(notification.id)}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.notificationIcon}>{getAlertIcon(notification)}</View>
                  <View style={styles.notificationText}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                  </View>
                  <View style={styles.notificationRight}>
                    {!notification.isRead && <View style={styles.unreadBadge} />}
                    <ChevronRight size={16} color="#9ca3af" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={[styles.latestSectionWrap, styles.orderUpdatesSectionBelowGap]}>
          <View style={styles.latestSection}>
            <View style={styles.latestSectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Order updates</Text>
              <TouchableOpacity
                onPress={() => router.push('/order-notifications')}
                hitSlop={8}
                disabled={!hasOrderUpdates}
                style={styles.sectionHeaderAction}
              >
                <Text
                  style={[
                    styles.sectionHeaderActionText,
                    !hasOrderUpdates && styles.sectionHeaderActionDisabled,
                  ]}
                >
                  View all
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.orderUpdatesListBox}>
              {!hasOrderUpdates ? (
                <Text style={styles.orderUpdatesEmpty}>No orders available yet</Text>
              ) : (
                previewOrders.map((notification, index) => (
                  <OrderUpdateRow
                    key={notification.id}
                    notification={notification}
                    isLast={index === previewOrders.length - 1}
                    onPress={async () => {
                      await markAsRead(notification.id);
                      if (notification.orderId) {
                        router.push({
                          pathname: '/components/ordersshipment/OrderDetails',
                          params: { orderId: notification.orderId },
                        });
                      }
                    }}
                  />
                ))
              )}
            </View>
          </View>
        </View>

        <View style={styles.latestSectionWrap}>
          <View style={styles.latestSection}>
            <View style={styles.latestSectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Latest updates</Text>
              <TouchableOpacity
                onPress={onReadAllLatest}
                hitSlop={8}
                disabled={filteredLatestUpdates.length === 0}
                style={styles.sectionHeaderAction}
              >
                <Text
                  style={[
                    styles.sectionHeaderActionText,
                    filteredLatestUpdates.length === 0 && styles.sectionHeaderActionDisabled,
                  ]}
                >
                  Read all
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabScrollContent}
            >
              {LATEST_UPDATE_TABS.map(({ id, label }) => {
                const active = selectedUpdateCategory === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.tabItem}
                    onPress={() => setSelectedUpdateCategory(id)}
                  >
                    <View style={styles.tabIconWrap}>{getUpdateTabIcon(id, active)}</View>
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
                    {active ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlinePlaceholder} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {latestLoading && (
              <View style={styles.latestLoadingRow}>
                <ActivityIndicator size="small" color={primaryBlue} />
                <Text style={styles.latestLoadingText}>Loading updates…</Text>
              </View>
            )}

            {latestError && !latestLoading && (
              <View style={styles.latestErrorBanner}>
                <Text style={styles.errorBannerText}>{latestError}</Text>
              </View>
            )}

            {!latestLoading && !latestError && latestUpdates.length === 0 && (
              <Text style={styles.latestEmpty}>No updates</Text>
            )}

            {!latestLoading &&
              !latestError &&
              latestUpdates.length > 0 &&
              filteredLatestUpdates.length === 0 && (
                <Text style={styles.latestEmpty}>No updates in this category.</Text>
              )}

            {!latestLoading &&
              !latestError &&
              filteredLatestUpdates.map((item) => {
                const read = readAnnouncementIds.has(item.id);
                const timeLabel = formatAnnouncementTime(item.publishedAt, item.createdAt);
                const rowTab = announcementCategoryToTabId(item.category);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.latestCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: '/components/notifications/latest-update/[id]',
                        params: { id: String(item.id) },
                      })
                    }
                  >
                    <View style={styles.latestRowCompact}>
                      <View style={styles.latestIcon}>{getUpdateTabIcon(rowTab, false)}</View>
                      <View style={styles.latestTextColCompact}>
                        <View style={styles.latestTitleRow}>
                          {!read ? <View style={styles.unreadDotBlue} /> : null}
                          <Text style={styles.latestTitleOneLine} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                        <Text style={styles.latestTimeCompact}>{timeLabel}</Text>
                      </View>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.latestThumbSmall}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    paddingTop: 0,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  errorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  /** Full-width white panel (Shopee-style section on gray page). */
  latestSectionWrap: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  /** Space between Order updates and Latest updates sections. */
  orderUpdatesSectionBelowGap: {
    marginBottom: 8,
  },
  latestSection: {
    backgroundColor: '#ffffff',
    paddingBottom: 4,
  },
  /** Bordered inner list for order update rows (inside white section). */
  orderUpdatesListBox: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  orderUpdatesEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#6b7280',
  },
  latestSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  latestErrorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  notificationItem: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadNotification: {
    backgroundColor: '#ffffff',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notificationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionHeaderActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: primaryBlue,
  },
  sectionHeaderActionDisabled: {
    color: '#9ca3af',
  },
  tabScroll: {
    maxHeight: 88,
    marginTop: 15,
    marginBottom: 4,
  },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
    alignItems: 'flex-end',
  },
  tabItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    minWidth: 56,
  },
  tabIconWrap: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: primaryBlue,
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 6,
    height: 3,
    width: '100%',
    minWidth: 40,
    backgroundColor: primaryBlue,
    borderRadius: 2,
  },
  tabUnderlinePlaceholder: {
    marginTop: 6,
    height: 3,
    width: '100%',
    minWidth: 40,
  },
  latestLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  latestLoadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  latestEmpty: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  latestCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  latestIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  latestRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  latestTextColCompact: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  latestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  unreadDotBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: primaryBlue,
  },
  latestTitleOneLine: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  latestTimeCompact: {
    marginTop: 2,
    fontSize: 12,
    color: '#9ca3af',
  },
  latestThumbSmall: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
});
