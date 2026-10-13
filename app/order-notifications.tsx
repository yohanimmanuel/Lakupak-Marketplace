import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { OrderNotificationsListSkeleton } from './components/SkeletonLoader';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { isWithinOrderNotificationWindow, NotificationService, Notification } from '../services/notificationService';
import { OrderUpdateRow } from '../components/notifications/OrderUpdateRow';
import { useTranslation } from 'react-i18next';
import { getOrderPreviewStrings } from '../utils/orderNotificationI18n';

const MISSING_ORDER_TIMESTAMP_FALLBACK = '1970-01-01T00:00:00.000Z';
const warnedOrderIds = new Set<string>();

export default function OrderNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const orders = useDataStore((state) => state.orders);
  const isAuthenticated = !!token && !!authUser;
  const [orderNotifications, setOrderNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';

  useEffect(() => {
    if (!authUser?.id) {
      setOrderNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const userId = authUser.id;
    const dataStore = useDataStore.getState();
    const cachedUserId = dataStore.user?.id;
    const validOrders = cachedUserId === userId ? orders : [];

    void (async () => {
      if (cancelled) return;

      setOrderNotifications((prev) => {
        const previousMap = new Map(prev.map((notification) => [notification.id, notification]));
        const derived = validOrders
          .filter((order) =>
            isWithinOrderNotificationWindow(order.updatedAt || order.createdAt || order.orderDate),
          )
          .sort((left, right) => {
            const leftAt = Date.parse(left.updatedAt || left.createdAt || left.orderDate || '') || 0;
            const rightAt = Date.parse(right.updatedAt || right.createdAt || right.orderDate || '') || 0;
            return rightAt - leftAt;
          })
          .map((order) => {
          const { title, message } = getOrderPreviewStrings(
            {
              orderId: order.orderId,
              orderStatus: order.orderStatus,
              paymentStatus: order.paymentStatus,
              totalAmount: order.totalAmount,
              returnItemsReceivedAt: order.returnItemsReceivedAt,
              returnRequests: order.returnRequests,
              trackingNumber: order.trackingNumber,
              assignedLogistics: order.assignedLogistics,
            },
            t,
          );

          let timestampSource = order.updatedAt || order.createdAt || order.orderDate;
          if (!timestampSource) {
            const orderKey = order.orderId ?? String(order.id ?? '');
            if (orderKey && !warnedOrderIds.has(orderKey)) {
              warnedOrderIds.add(orderKey);
            }
            timestampSource = MISSING_ORDER_TIMESTAMP_FALLBACK;
          }
          const normalizedStatus = (order.orderStatus || '').toLowerCase() as Notification['status'];

          const notificationKey = order.orderId ?? order.id;
          return {
            id: `order_${notificationKey}`,
            type: 'order' as const,
            title,
            message,
            timestamp: new Date(timestampSource)
              .toLocaleString(locale, {
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
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [orders, authUser?.id, locale, t]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const userId = authUser?.id ?? null;
        await NotificationService.markAsRead(notificationId, userId);
        setOrderNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
      } catch {
        // ignore
      }
    },
    [authUser?.id]
  );

  const hasRows = orderNotifications.length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityLabel={t('orderUpdates.a11y.back')}
              accessibilityRole="button"
            >
              <ArrowLeft color={primaryBlue} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('orderUpdates.title')}</Text>
          </View>
        </View>
      </View>

      {!isAuthenticated ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>{t('orderUpdates.states.signIn')}</Text>
        </View>
      ) : loading ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <OrderNotificationsListSkeleton />
        </ScrollView>
      ) : !hasRows ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>{t('orderUpdates.states.empty')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.orderListSection}>
            {orderNotifications.map((notification, index) => (
            <OrderUpdateRow
              key={notification.id}
              notification={notification}
              isLast={index === orderNotifications.length - 1}
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
          ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 35,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  orderListSection: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});
