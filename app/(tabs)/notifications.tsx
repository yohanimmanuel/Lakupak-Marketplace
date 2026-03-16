import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Text,
} from 'react-native';
import { Bell, MessageCircle, Gift, Tag, ChevronRight, AlertCircle, Package, CheckCircle, Truck, CreditCard, RotateCcw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { NotificationService, Notification } from '../../services/notificationService';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';

const { width: screenWidth } = Dimensions.get('window');

const MISSING_ORDER_TIMESTAMP_FALLBACK = '1970-01-01T00:00:00.000Z';
const warnedOrderIds = new Set<string>();

export default function NotificationsScreen() {
  const router = useRouter();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [orderNotifications, setOrderNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const orders = useDataStore(state => state.orders);
  
  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Load notifications from storage (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setAlerts([]);
      setError(null);
      return;
    }

    const loadNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications(authUser.id);
        const nonOrderNotifications = storedNotifications.filter(n => n.type !== 'order');
        setAlerts(nonOrderNotifications);
      } catch (error) {
        console.error('Failed to load marketplace notifications:', error);
        setError('Failed to load notifications. Pull to refresh or try again later.');
        setAlerts([]);
      }
    };

    loadNotifications();
  }, [isAuthenticated, authUser?.id]);

  // Refresh notifications when screen comes into focus
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setAlerts([]);
      setError(null);
      return;
    }

    const refreshNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications(authUser.id);
        const nonOrderNotifications = storedNotifications.filter(n => n.type !== 'order');
        setAlerts(nonOrderNotifications);
      } catch (error) {
        console.error('Failed to refresh marketplace notifications:', error);
        setError('Failed to refresh notifications. Some alerts may be missing.');
      }
    };

    // Refresh when component mounts
    refreshNotifications();
  }, [isAuthenticated, authUser?.id]);

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

  const getOrderIcon = (notification: Notification) => {
    if (notification.productImage) {
      return (
        <Image
          source={{ uri: notification.productImage }}
          style={styles.productImage}
          resizeMode="cover"
        />
      );
    }

    if (notification.status === 'failed') return <AlertCircle size={20} color="#ef4444" />;
    const s = notification.status;
    switch (s) {
      case 'delivered':
      case 'received':
        return <CheckCircle size={20} color="#10b981" />;
      case 'shipped':
        return <Truck size={20} color="#0a61d7" />;
      case 'confirmed':
        return <CreditCard size={20} color="#10b981" />;
      case 'returned':
        return <RotateCcw size={20} color="#f59e0b" />;
      default:
        return <Package size={20} color="#6b7280" />;
    }
  };

  // Derive order update notifications from current orders (same logic as Orders tab)
  useEffect(() => {
    if (!authUser?.id) {
      setOrderNotifications([]);
      return;
    }

    const dataStore = useDataStore.getState();
    const cachedUserId = dataStore.user?.id;
    const validOrders = cachedUserId === authUser.id ? orders : [];

    setOrderNotifications((prev) => {
      const previousMap = new Map(prev.map(notification => [notification.id, notification]));
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
        } else if ((order.orderStatus === 'Delivered' || order.orderStatus === 'Received') && Array.isArray(order.returnRequests) && order.returnRequests.some((rr: { status: string }) => rr.status === 'Pending')) {
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
          timestamp: new Date(timestampSource).toLocaleString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(',', ''),
          isRead: previousMap.get(`order_${order.orderId}`)?.isRead ?? false,
          orderId: order.orderId,
          status: normalizedStatus,
          productImage: order.orderItems?.[0]?.images?.[0],
        } as Notification;
      });

      return derived;
    });
  }, [orders, authUser?.id]);


  const unreadCount = alerts.filter(n => !n.isRead).length + orderNotifications.filter(n => !n.isRead).length;

  const markAsRead = async (notificationId: string) => {
    try {
      const userId = authUser?.id ?? null;
      await NotificationService.markAsRead(notificationId, userId);
      // Refresh notifications after marking as read
      const updatedNotifications = await NotificationService.getNotifications(userId);
      const nonOrderNotifications = updatedNotifications.filter(n => n.type !== 'order');
      setAlerts(nonOrderNotifications);
      setOrderNotifications(prev =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const userId = authUser?.id ?? null;
      await NotificationService.markAllAsRead(userId);
      // Refresh notifications after marking all as read
      const updatedNotifications = await NotificationService.getNotifications(userId);
      const nonOrderNotifications = updatedNotifications.filter(n => n.type !== 'order');
      setAlerts(nonOrderNotifications);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const hasAlerts = alerts.length > 0;
  const hasOrderUpdates = orderNotifications.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={!(hasAlerts || hasOrderUpdates || error) ? styles.emptyContent : undefined}
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
                    <View style={styles.notificationIcon}>
                      {getAlertIcon(notification)}
                    </View>
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

        {hasOrderUpdates && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>Order updates</Text>
            </View>
            {orderNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.orderUpdateCard}
                activeOpacity={0.7}
                onPress={async () => {
                  await markAsRead(notification.id);
                  if (notification.orderId) {
                    router.push({
                      pathname: '/components/ordersshipment/OrderDetails',
                      params: { orderId: notification.orderId },
                    });
                  }
                }}
              >
                <View style={styles.updateHeader}>
                  <View style={styles.updateHeaderLeft}>
                    <View style={styles.timelineDot}>
                      {getOrderIcon(notification)}
                    </View>
                    <View style={styles.updateTitleContainer}>
                      <Text style={styles.updateTitle}>{notification.title}</Text>
                      <Text style={styles.updateMessage}>{notification.message}</Text>
                      <Text style={styles.updateTime}>{notification.timestamp}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {!(hasAlerts || hasOrderUpdates) && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Bell size={32} color="#9ca3af" />
            </View>
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptySubtitle}>
              You have no alerts or order updates yet. We’ll show promos, app updates, and important order changes here.
            </Text>
          </View>
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
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 8,
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
  emptyContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 16,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#f9fafb',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderUpdateCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  updateHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  updateTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  updateMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});