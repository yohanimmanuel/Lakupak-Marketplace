import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { NotificationService, Notification } from '../services/notificationService';
import { OrderUpdateRow } from './components/notifications/OrderUpdateRow';

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

  useEffect(() => {
    if (!authUser?.id) {
      setOrderNotifications([]);
      setLoading(false);
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
    setLoading(false);
  }, [orders, authUser?.id]);

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
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <ArrowLeft color={primaryBlue} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order updates</Text>
          </View>
        </View>
      </View>

      {!isAuthenticated ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Sign in to see your order notifications.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryBlue} />
        </View>
      ) : !hasRows ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>No order updates yet.</Text>
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
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
