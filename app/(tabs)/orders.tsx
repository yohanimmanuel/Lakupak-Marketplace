import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Text,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import {
  AlertCircle,
  Bell,
  ShoppingCart,
  ShoppingBag,
  MessageCircle,
  Package,
  CheckCircle,
  Truck,
  CreditCard,
  Gift,
  Tag,
  Megaphone,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User as UserIcon,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { API_BASE_URL } from '../../services/config';
import { Notification } from '../../services/notificationService';
import { useDataStore } from '../../stores/dataStore';
import { useRouter } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

export default function OrdersScreen() {
  const router = useRouter();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const orders = useDataStore(state => state.orders);
  const isOrdersLoading = useDataStore(state => state.isOrdersLoading);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  
  const isAuthenticated = !!token && !!authUser;

  // SIMPLE: Load immediately when component mounts
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Load orders initially when authenticated (WebSocket will handle updates)
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setNotifications([]);
      // Clear orders if user is not authenticated
      const dataStore = useDataStore.getState();
      if (dataStore.orders.length > 0) {
        dataStore.setOrders([]);
      }
      return;
    }
    
    // Validate that cached orders belong to current user
    const dataStore = useDataStore.getState();
    const cachedUserId = dataStore.user?.id;
    
    // If user changed, clear old orders and force refresh
    if (cachedUserId !== authUser.id && dataStore.orders.length > 0) {
      dataStore.setOrders([]);
      loadOrdersData(true); // Force refresh with correct user
    } else {
    // Only load if we don't have orders yet (initial load)
    loadOrdersData(false);
    }
  }, [isAuthenticated, authUser?.id, loadOrdersData]);

  // Keep notifications in sync with store orders while preserving read state
  // CRITICAL: Validate orders belong to current user before displaying
  useEffect(() => {
    if (!authUser?.id) {
      setNotifications([]);
      return;
    }
    
    // Filter orders to ensure they belong to current user
    // This prevents showing other users' orders during race conditions
    const dataStore = useDataStore.getState();
    const cachedUserId = dataStore.user?.id;
    const validOrders = cachedUserId === authUser.id ? orders : [];
    
    setNotifications((prev) => {
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

        const timestampSource = order.createdAt || order.orderDate || new Date().toISOString();

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
          isRead: false,
          orderId: order.orderId,
          status: normalizedStatus,
          productImage: order.orderItems?.[0]?.images?.[0]
        };
      });

      return derived.map((notification) => {
        const existing = previousMap.get(notification.id);
        return existing ? { ...notification, isRead: existing.isRead } : notification;
      });
    });
  }, [orders, authUser?.id]);

  // WebSocket handles updates automatically - no need to refresh on focus

  const getNotificationIcon = (notification: Notification) => {
    // For order notifications, use product image if available, otherwise fallback to status icon
    if (notification.type === 'order' && notification.productImage) {
      return (
        <Image 
          source={{ uri: notification.productImage }} 
          style={styles.productImage}
          resizeMode="cover"
        />
      );
    }
    
    // Fallback to status icons
    switch (notification.type) {
      case 'order':
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
          default:
            return <Package size={20} color="#6b7280" />;
        }
      case 'discount':
        return <Tag size={20} color="#f59e0b" />;
      case 'promotion':
        return <Gift size={20} color="#8b5cf6" />;
      case 'update':
        return <Bell size={20} color="#6b7280" />;
      default:
        return <Bell size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered':
      case 'received':
        return '#10b981';
      case 'shipped':
        return '#0a61d7';
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };


  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead).length,
    [notifications]
  );

  const markAsRead = async (notificationId: string) => {
    // SIMPLE: Just update local state
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = async () => {
    // SIMPLE: Just update local state
    setNotifications(prev => 
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  const toggleDropdown = (notificationId: string) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.order;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleOrderCardPress = (notification: Notification) => {
    if (notification.type === 'order' && notification.orderId) {
      router.push({
        pathname: '/components/ordersshipment/OrderDetails',
        params: { orderId: notification.orderId }
      });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        // Update local notifications
        setNotifications(prev => 
          prev.map(n => 
            n.orderId === orderId 
              ? { ...n, status: status.toLowerCase() as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' }
              : n
          )
        );
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const renderLoginPrompt = () => (
    <View style={styles.loginPromptContainer}>
      <View style={styles.loginPromptIcon}>
        <UserIcon color="#0a61d7" size={28} />
      </View>
      <Text style={styles.loginPromptTitle}>
        Create an account to win first-order benefits!
      </Text>
      <View style={styles.loginPromptButtons}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={styles.signupButton}>
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isAuthenticated ? (
          isOrdersLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading your orders...</Text>
            </View>
          ) : notifications.length > 0 ? (
            notifications.map((notification, index) => {
              const isOpen = openDropdowns.has(notification.id);
              return (
                <View key={notification.id} style={styles.orderUpdateCard}>
                  <TouchableOpacity 
                    style={styles.updateHeader}
                    onPress={() => handleOrderCardPress(notification)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.updateHeaderLeft}>
                      <View style={styles.timelineDot}>
                        {getNotificationIcon(notification)}
                      </View>
                      <View style={styles.updateTitleContainer}>
                        <Text style={styles.updateTitle}>{notification.title}</Text>
                        <Text style={styles.updateMessage}>{notification.message}</Text>
                        <Text style={styles.updateTime}>{notification.timestamp}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleDropdown(notification.id);
                      }}
                      style={styles.dropdownButton}
                    >
                      {isOpen ? (
                        <ChevronUp size={20} color="#6b7280" />
                      ) : (
                        <ChevronDown size={20} color="#6b7280" />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                  
                  {/* Dropdown Content */}
                  {isOpen && (
                    <View style={styles.dropdownContent}>
                      {notification.actionText ? (
                        <TouchableOpacity style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>{notification.actionText}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.noUpdatesText}>No available updates</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.noOrdersCard}>
              <View style={styles.noOrdersIconContainer}>
                <ShoppingBag size={48} color="#d1d5db" />
              </View>
              <Text style={styles.noOrdersTitle}>No Orders Yet</Text>
              <Text style={styles.noOrdersSubDescription}>
                Once you place your first order, you'll see detailed updates here including order confirmation, packing status, shipping information, and delivery notifications. We'll keep you informed every step of the way!
              </Text>
              <View style={styles.noOrdersFeatures}>
                <Text style={styles.noOrdersFeatureTitle}>What you'll see here:</Text>
                <Text style={styles.noOrdersFeatureItem}>• Real-time order status updates</Text>
                <Text style={styles.noOrdersFeatureItem}>• Shipping and delivery notifications</Text>
                <Text style={styles.noOrdersFeatureItem}>• Order history and tracking</Text>
                <Text style={styles.noOrdersFeatureItem}>• Important order communications</Text>
              </View>
              <Text style={styles.noOrdersCTA}>
                Ready to start shopping? Browse our amazing products and place your first order to see the magic happen!
              </Text>
            </View>
          )
        ) : (
          /* Show login prompt when not authenticated */
          renderLoginPrompt()
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
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#111827',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
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
    marginBottom: 8,
  },
  updateTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dropdownButton: {
    padding: 8,
  },
  dropdownContent: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  noOrdersCard: {
    backgroundColor: '#f9fafb',
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  noOrdersIconContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 50,
  },
  noOrdersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  noOrdersDescription: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  noOrdersSubDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  noOrdersFeatures: {
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  noOrdersFeatureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noOrdersFeatureItem: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 18,
  },
  noOrdersCTA: {
    fontSize: 15,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  noOrdersText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  noUpdatesText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  orderUpdateItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineContainer: {
    position: 'relative',
    marginRight: 16,
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    top: 20,
    left: 19,
    width: 2,
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  productImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  updateContent: {
    flex: 1,
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0a61d7',
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  loginPromptContainer: {
    backgroundColor: '#ffffff',
    padding: 26,
    alignItems: 'center',
  },
  loginPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  signupButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a61d7',
    flex: 1,
  },
  signupButtonText: {
    color: '#0a61d7',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
