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
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import {
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
import { useDataStore } from '../../stores/dataStore';
import { useAuthStore } from '../../stores/authStore';
import { NotificationService, Notification } from '../../services/notificationService';
import { API_BASE_URL } from '../../services/config';

const { width: screenWidth } = Dimensions.get('window');

export default function OrdersScreen() {
  const { user } = useDataStore();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  
  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Load notifications from storage (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setNotifications([]);
      return;
    }

    const loadNotifications = async () => {
      try {
        // Get user-specific notifications
        const storedNotifications = await NotificationService.getNotifications(authUser.id);
        
        // Filter to only show order notifications
        const orderNotifications = storedNotifications.filter(n => n.type === 'order');
        
        // If no notifications exist, fetch from backend API
        // ALWAYS fetch fresh - no caching
        try {
          try {
            // Fetch user's orders from mobile API
            const response = await fetch(`${API_BASE_URL}/api/mobile/orders?userId=${authUser.id}&limit=50`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              const orders = data.orders || [];
              
              // Create notifications from actual orders with correct status
              const orderNotifications = orders.map((order: any) => {
                // Determine the correct title and message based on BOTH order status AND payment status
                let title = 'Payment Required';
                let message = `Your order ${order.orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing. Once payment is confirmed, we'll start preparing your order for shipment.`;
                
                // Check payment status first, then order status
                if (order.paymentStatus === 'Unpaid' && order.orderStatus === 'Pending') {
                  title = 'Payment Required';
                  message = `Your order ${order.orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing. Once payment is confirmed, we'll start preparing your order for shipment.`;
                } else if (order.orderStatus === 'Confirmed') {
                  title = 'Order Confirmed';
                  message = `Excellent! Your order ${order.orderId} has been confirmed by our distributor and is now being processed. Our team is preparing your items for packaging. We'll keep you updated on the progress. Expected processing time is 1-2 business days.`;
                } else if (order.orderStatus === 'Packed') {
                  title = 'Order Packed';
                  message = `Fantastic! Your order ${order.orderId} has been carefully packed and is ready for shipment. All items have been quality-checked and securely packaged. Your order will be handed over to our delivery partner soon. You'll receive tracking information once it ships.`;
                } else if (order.orderStatus === 'Shipped') {
                  title = 'Order Shipped';
                  message = `Exciting news! Your order ${order.orderId} has been shipped and is now on its way to you. Our delivery partner has collected your package and it's in transit. You can expect delivery within the estimated timeframe. We'll notify you once it's delivered.`;
                } else if (order.orderStatus === 'Delivered') {
                  title = 'Order Delivered';
                  message = `🎉 Congratulations! Your order ${order.orderId} has been successfully delivered to your specified address. We hope you're satisfied with your purchase! Please take a moment to rate your experience and leave a review. Thank you for shopping with Laku-Laku!`;
                } else if (order.orderStatus === 'Cancelled') {
                  title = 'Order Cancelled';
                  message = `We regret to inform you that your order ${order.orderId} has been cancelled. This may be due to product unavailability, payment issues, or other circumstances. If you have any questions or concerns, please contact our customer support team. We apologize for any inconvenience caused.`;
                } else if (order.orderStatus === 'Returned') {
                  title = 'Order Returned';
                  message = `Your order ${order.orderId} has been returned to us. We're currently processing the return and will handle any refunds or exchanges according to our return policy. Our customer service team will contact you soon with further details. Thank you for your patience.`;
                }
                
                return {
                  id: `order_${order.orderId}`,
                  type: 'order' as const,
                  title: title,
                  message: message,
                  timestamp: new Date(order.createdAt).toLocaleString('en-US', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }).replace(',', ''),
                  isRead: false,
                  orderId: order.orderId,
                  status: order.orderStatus?.toLowerCase() as any,
                  productImage: order.orderItems?.[0]?.images?.[0]
                };
              });
              
              // FORCE: Just show all orders from API, no storage bullshit
              setNotifications(orderNotifications);
            } else {
              setNotifications([]);
            }
          } catch (apiError) {
            // Fallback to stored notifications
            setNotifications(orderNotifications);
          }
        } catch (error) {
          setNotifications([]);
        }
      } catch (error) {
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [isAuthenticated, authUser?.id, token]);

  // Refresh notifications when screen comes into focus (only when authenticated)
  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated || !authUser?.id) {
        setNotifications([]);
        return;
      }

      const refreshNotifications = async () => {
        try {
          // First, get user-specific notifications
          const storedNotifications = await NotificationService.getNotifications(authUser.id);
          const orderNotifications = storedNotifications.filter(n => n.type === 'order');
          
          // Extract order IDs from notifications
          const notificationOrderIds = orderNotifications
            .map(n => n.orderId)
            .filter(Boolean) as string[];
          
          // Clean up orphaned notifications (notifications for orders that no longer exist)
          if (notificationOrderIds.length > 0) {
            try {
              // Check which orders still exist in the database
              const response = await fetch(`${API_BASE_URL}/api/orders?checkExists=true&orderIds=${encodeURIComponent(JSON.stringify(notificationOrderIds))}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (response.ok) {
                const { existingOrderIds } = await response.json();
                await NotificationService.cleanupOrphanedNotifications(existingOrderIds, authUser.id);
              }
            } catch (apiError) {
              // If API fails, just use the current notifications
            }
            
            // Refresh notifications after cleanup
            const cleanedNotifications = await NotificationService.getNotifications(authUser.id);
            const cleanedOrderNotifications = cleanedNotifications.filter(n => n.type === 'order');
            setNotifications(cleanedOrderNotifications);
          } else {
            // If no stored notifications, try to fetch from backend
            try {
              const response = await fetch(`${API_BASE_URL}/api/mobile/orders?userId=${authUser.id}&limit=50`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                const orders = data.orders || [];
                
                const orderNotifications = orders.map((order: any) => {
                  // Determine the correct title and message based on BOTH order status AND payment status
                  let title = 'Payment Required';
                  let message = `Your order ${order.orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing. Once payment is confirmed, we'll start preparing your order for shipment.`;
                  
                  // Check payment status first, then order status
                  if (order.paymentStatus === 'Unpaid' && order.orderStatus === 'Pending') {
                    title = 'Payment Required';
                    message = `Your order ${order.orderId} has been created successfully and is pending payment confirmation. Please complete your payment to proceed with processing.`;
                  } else if (order.orderStatus === 'Confirmed') {
                    title = 'Order Confirmed';
                    message = `Excellent! Your order ${order.orderId} has been confirmed by our distributor and is now being processed. Our team is preparing your items for packaging.`;
                  } else if (order.orderStatus === 'Packed') {
                    title = 'Order Packed';
                    message = `Fantastic! Your order ${order.orderId} has been carefully packed and is ready for shipment. Your order will be handed over to our delivery partner soon.`;
                  } else if (order.orderStatus === 'Shipped') {
                    title = 'Order Shipped';
                    message = `Exciting news! Your order ${order.orderId} has been shipped and is now on its way to you. Our delivery partner has collected your package and it's in transit.`;
                  } else if (order.orderStatus === 'Delivered') {
                    title = 'Order Delivered';
                    message = `🎉 Congratulations! Your order ${order.orderId} has been successfully delivered to your specified address. We hope you're satisfied with your purchase!`;
                  } else if (order.orderStatus === 'Cancelled') {
                    title = 'Order Cancelled';
                    message = `We regret to inform you that your order ${order.orderId} has been cancelled. This may be due to product unavailability, payment issues, or other circumstances.`;
                  } else if (order.orderStatus === 'Returned') {
                    title = 'Order Returned';
                    message = `Your order ${order.orderId} has been returned to us. We're currently processing the return and will handle any refunds or exchanges according to our return policy.`;
                  }
                  
                  return {
                    id: `order_${order.orderId}`,
                    type: 'order' as const,
                    title: title,
                    message: message,
                    timestamp: new Date(order.createdAt).toLocaleString('en-US', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }).replace(',', ''),
                    isRead: false,
                    orderId: order.orderId,
                    status: order.orderStatus?.toLowerCase() as any,
                    productImage: order.orderItems?.[0]?.images?.[0]
                  };
                });
                
                // FORCE: Just show all orders from API, no storage bullshit
                setNotifications(orderNotifications);
              } else {
                setNotifications([]);
              }
            } catch (apiError) {
              setNotifications([]);
            }
          }
        } catch (error) {
          setNotifications([]);
        }
      };

      refreshNotifications();
    }, [isAuthenticated, authUser?.id, token])
  );

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
        switch (notification.status) {
          case 'delivered':
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
        return '#10b981';
      case 'shipped':
        return '#0a61d7';
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };


  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (notificationId: string) => {
    if (!isAuthenticated) return;
    
    try {
      await NotificationService.markAsRead(notificationId);
      // Refresh notifications after marking as read
      const updatedNotifications = await NotificationService.getNotifications();
      setNotifications(updatedNotifications);
    } catch (error) {
      // Handle error silently
    }
  };

  const markAllAsRead = async () => {
    if (!isAuthenticated) return;
    
    try {
      await NotificationService.markAllAsRead();
      // Refresh notifications after marking all as read
      const updatedNotifications = await NotificationService.getNotifications();
      setNotifications(updatedNotifications);
    } catch (error) {
      // Handle error silently
    }
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
          /* Order Updates */
          notifications.length > 0 ? (
            notifications.map((notification, index) => {
              const isOpen = openDropdowns.has(notification.id);
              return (
                <View key={notification.id} style={styles.orderUpdateCard}>
                  <View style={styles.updateHeader}>
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
                      onPress={() => toggleDropdown(notification.id)}
                      style={styles.dropdownButton}
                    >
                      {isOpen ? (
                        <ChevronUp size={20} color="#6b7280" />
                      ) : (
                        <ChevronDown size={20} color="#6b7280" />
                      )}
                    </TouchableOpacity>
                  </View>
                  
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
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
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
  orderUpdateCard: {
    backgroundColor: '#ffffff',
    marginTop: 8,
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
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
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
    marginTop: 8,
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
