import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  StatusBar,
  Text,
  Alert,
  RefreshControl,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  Bell,
  Gift,
  Tag,
  ChevronRight,
  Megaphone,
  Wrench,
  FileText,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { NotificationService, Notification } from '../../services/notificationService';
import {
  fetchPublishedLatestUpdates,
  getDismissedAnnouncementIds,
  getReadAnnouncementIds,
  dismissAnnouncementFromList,
  markAnnouncementsRead,
  type PlatformAnnouncement,
} from '../../services/latestUpdatesService';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { usePlatformAnnouncementsRealtimeStore } from '../../stores/platformAnnouncementsRealtimeStore';
import { OrderUpdateRow } from '../../components/notifications/OrderUpdateRow';
import { useTranslation } from 'react-i18next';
import { getOrderPreviewStrings } from '../../utils/orderNotificationI18n';
import { NotificationsTabSkeleton } from '../components/SkeletonLoader';

const MISSING_ORDER_TIMESTAMP_FALLBACK = '1970-01-01T00:00:00.000Z';
const warnedOrderIds = new Set<string>();
const ORDER_PREVIEW_LIMIT = 5;
const primaryBlue = '#0a61d7';

function isStillAuthenticatedUser(requestUserId: number): boolean {
  const { token, user } = useAuthStore.getState();
  return !!token && user?.id === requestUserId;
}

/** Fixed marketplace “Latest updates” filters (must match admin `PlatformAnnouncement.category` values, case-insensitive). */
type LatestUpdateTabId = 'all' | 'update' | 'promotion' | 'maintenance' | 'policy';

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
  const { t, i18n } = useTranslation();
  const orderPreviewLocale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrateFromStorage);
  const LATEST_UPDATE_TABS: { id: LatestUpdateTabId; label: string }[] = [
    { id: 'all', label: t('tabsNotifications.tabs.all') },
    { id: 'update', label: t('tabsNotifications.tabs.update') },
    { id: 'promotion', label: t('tabsNotifications.tabs.promotion') },
    { id: 'maintenance', label: t('tabsNotifications.tabs.maintenance') },
    { id: 'policy', label: t('tabsNotifications.tabs.policy') },
  ];

  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [orderNotifications, setOrderNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const orders = useDataStore((state) => state.orders);
  const loadOrdersData = useDataStore((state) => state.loadOrdersData);

  const [latestUpdates, setLatestUpdates] = useState<PlatformAnnouncement[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<number>>(new Set());
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<number>>(new Set());
  const [selectedUpdateCategory, setSelectedUpdateCategory] = useState<LatestUpdateTabId>('all');

  const paRealtimeVersion = usePlatformAnnouncementsRealtimeStore((s) => s.version);

  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadAlerts = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) {
      setAlerts([]);
      setError(null);
      return;
    }

    const requestUserId = authUser.id;
    try {
      const storedNotifications = await NotificationService.getNotifications(requestUserId);
      if (!isStillAuthenticatedUser(requestUserId)) return;
      const nonOrderNotifications = storedNotifications.filter((n) => n.type !== 'order');
      setAlerts(nonOrderNotifications);
      setError(null);
    } catch {
      if (!isStillAuthenticatedUser(requestUserId)) return;
      setError(t('tabsNotifications.errors.loadFailed'));
      setAlerts([]);
    }
  }, [isAuthenticated, authUser?.id, t]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

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

  useEffect(() => {
    let cancelled = false;
    const marketplaceUserId = isAuthenticated && authUser?.id != null ? authUser.id : null;
    (async () => {
      const dismissed = await getDismissedAnnouncementIds(marketplaceUserId);
      if (!cancelled) setDismissedAnnouncementIds(dismissed);
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
    } catch {
      setLatestError(t('tabsNotifications.errors.latestUpdatesFailed'));
      setLatestUpdates([]);
    } finally {
      setLatestLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLatestUpdates();
  }, [loadLatestUpdates]);

  useEffect(() => {
    if (!latestLoading && !refreshing) {
      setHasInitiallyLoaded(true);
    }
  }, [latestLoading, refreshing]);

  const showPageSkeleton = refreshing || (!hasInitiallyLoaded && latestLoading);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks: Promise<void>[] = [loadLatestUpdates()];
      if (isAuthenticated && authUser?.id) {
        const requestUserId = authUser.id;
        tasks.push(loadAlerts());
        tasks.push(loadOrdersData(true));
        tasks.push(
          getReadAnnouncementIds(requestUserId).then((ids) => {
            if (!isStillAuthenticatedUser(requestUserId)) return;
            setReadAnnouncementIds(ids);
          }),
        );
        tasks.push(
          getDismissedAnnouncementIds(requestUserId).then((dismissed) => {
            if (!isStillAuthenticatedUser(requestUserId)) return;
            setDismissedAnnouncementIds(dismissed);
          }),
        );
      }
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [loadLatestUpdates, loadAlerts, isAuthenticated, authUser?.id, loadOrdersData]);

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
      setDismissedAnnouncementIds((prev) => {
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

  const visibleFilteredLatestUpdates = useMemo(
    () => filteredLatestUpdates.filter((a) => !dismissedAnnouncementIds.has(a.id)),
    [filteredLatestUpdates, dismissedAnnouncementIds],
  );

  const handleDismissLatestUpdate = useCallback(
    async (announcementId: number) => {
      const uid = authUser?.id ?? null;
      try {
        await dismissAnnouncementFromList(announcementId, uid);
        setDismissedAnnouncementIds((prev) => {
          const next = new Set(prev);
          next.add(announcementId);
          return next;
        });
      } catch (err) {
        console.error('[Notifications] dismissAnnouncementFromList failed', err);
        Alert.alert(
          t('tabsNotifications.latestUpdates.dismissFailedTitle'),
          t('tabsNotifications.latestUpdates.dismissFailedBody'),
        );
      }
    },
    [authUser?.id, t],
  );

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
        const { title, message } = getOrderPreviewStrings(
          {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            returnItemsReceivedAt: order.returnItemsReceivedAt,
            returnRequests: order.returnRequests,
            trackingNumber: order.trackingNumber,
            assignedLogistics: order.assignedLogistics,
          },
          t,
        );

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
            .toLocaleString(orderPreviewLocale, {
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
  }, [orders, authUser?.id, t, orderPreviewLocale]);

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
    const ids = visibleFilteredLatestUpdates.map((a) => a.id);
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryBlue}
            colors={[primaryBlue]}
          />
        }
      >
        {showPageSkeleton ? (
          <NotificationsTabSkeleton />
        ) : (
          <>
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
              <Text style={styles.sectionHeaderTitle}>{t('tabsNotifications.orderUpdates.title')}</Text>
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
                  {t('tabsNotifications.orderUpdates.viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.orderUpdatesListBox}>
              {!hasOrderUpdates ? (
                <Text style={styles.orderUpdatesEmpty}>{t('tabsNotifications.orderUpdates.empty')}</Text>
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
              <Text style={styles.sectionHeaderTitle}>{t('tabsNotifications.latestUpdates.title')}</Text>
              <TouchableOpacity
                onPress={onReadAllLatest}
                hitSlop={8}
                disabled={visibleFilteredLatestUpdates.length === 0}
                style={styles.sectionHeaderAction}
              >
                <Text
                  style={[
                    styles.sectionHeaderActionText,
                    visibleFilteredLatestUpdates.length === 0 && styles.sectionHeaderActionDisabled,
                  ]}
                >
                  {t('tabsNotifications.latestUpdates.readAll')}
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

            {latestError && (
              <View style={styles.latestErrorBanner}>
                <Text style={styles.errorBannerText}>{latestError}</Text>
              </View>
            )}

            {!latestLoading && !latestError && latestUpdates.length === 0 && (
              <Text style={styles.latestEmpty}>{t('tabsNotifications.latestUpdates.empty')}</Text>
            )}

            {!latestLoading &&
              !latestError &&
              latestUpdates.length > 0 &&
              filteredLatestUpdates.length === 0 && (
                <Text style={styles.latestEmpty}>{t('tabsNotifications.latestUpdates.emptyCategory')}</Text>
              )}

            {!latestLoading &&
              !latestError &&
              latestUpdates.length > 0 &&
              filteredLatestUpdates.length > 0 &&
              visibleFilteredLatestUpdates.length === 0 && (
                <Text style={styles.latestEmpty}>{t('tabsNotifications.latestUpdates.dismissedAll')}</Text>
              )}

            {visibleFilteredLatestUpdates.map((item) => {
                const read = readAnnouncementIds.has(item.id);
                const timeLabel = formatAnnouncementTime(item.publishedAt, item.createdAt);
                const rowTab = announcementCategoryToTabId(item.category);
                return (
                  <ReanimatedSwipeable
                    key={item.id}
                    friction={2}
                    overshootRight={false}
                    containerStyle={styles.latestSwipeContainer}
                    childrenContainerStyle={styles.latestSwipeChild}
                    renderRightActions={() => (
                      <View style={styles.latestSwipeDeleteBg}>
                        <TouchableOpacity
                          style={styles.latestSwipeDeleteBtn}
                          onPress={() => handleDismissLatestUpdate(item.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t('tabsNotifications.latestUpdates.deleteA11y')}
                        >
                          <Trash2 size={22} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  >
                    <TouchableOpacity
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
                  </ReanimatedSwipeable>
                );
              })}
          </View>
        </View>
          </>
        )}
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
  latestSwipeContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    overflow: 'hidden',
  },
  latestSwipeChild: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  latestSwipeDeleteBg: {
    width: 88,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: primaryBlue,
  },
  latestSwipeDeleteBtn: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
});
