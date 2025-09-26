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
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  ShoppingCart,
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
} from 'lucide-react-native';
import { useDataStore } from '../../stores/dataStore';
import { NotificationService, Notification } from '../../services/notificationService';
import { API_BASE_URL } from '../../services/config';

const { width: screenWidth } = Dimensions.get('window');

export default function OrdersScreen() {
  const { user } = useDataStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

  // Load notifications from storage
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications();
        
        // Filter to only show order notifications
        const orderNotifications = storedNotifications.filter(n => n.type === 'order');
        
        // If no notifications exist, add some sample data for demonstration
        if (orderNotifications.length === 0) {
          await addSampleOrderNotifications();
          const allNotifications = await NotificationService.getNotifications();
          const filteredNotifications = allNotifications.filter(n => n.type === 'order');
          setNotifications(filteredNotifications);
        } else {
          setNotifications(orderNotifications);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, []);

  // Add sample order notifications for demonstration
  const addSampleOrderNotifications = async () => {
    try {
      // Sample order notifications
      await NotificationService.createOrderNotifications('LKO-12345678', 1);
      await NotificationService.createShippingNotification('LKO-12345678', 'LKU123456789');
      await NotificationService.createDeliveryNotification('LKO-12345678', 'LKU123456789');
    } catch (error) {
      console.error('Error adding sample order notifications:', error);
    }
  };

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshNotifications = async () => {
        try {
          // First, get all notifications
          const storedNotifications = await NotificationService.getNotifications();
          const orderNotifications = storedNotifications.filter(n => n.type === 'order');
          
          // Extract order IDs from notifications
          const notificationOrderIds = orderNotifications
            .map(n => n.orderId)
            .filter(Boolean) as string[];
          
          // Clean up orphaned notifications (notifications for orders that no longer exist)
          if (notificationOrderIds.length > 0) {
            try {
              // Check which orders still exist in the database
              const response = await fetch(`${API_BASE_URL}/api/orders?checkExists=true&orderIds=${encodeURIComponent(JSON.stringify(notificationOrderIds))}`);

              if (response.ok) {
                const { existingOrderIds } = await response.json();
                await NotificationService.cleanupOrphanedNotifications(existingOrderIds);
              }
            } catch (apiError) {
              console.error('Error checking order existence:', apiError);
              // If API fails, just use the current notifications
            }
            
            // Refresh notifications after cleanup
            const cleanedNotifications = await NotificationService.getNotifications();
            const cleanedOrderNotifications = cleanedNotifications.filter(n => n.type === 'order');
            setNotifications(cleanedOrderNotifications);
          } else {
            setNotifications(orderNotifications);
          }
        } catch (error) {
          console.error('Error refreshing notifications:', error);
        }
      };

      refreshNotifications();
    }, [])
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
    try {
      await NotificationService.markAsRead(notificationId);
      // Refresh notifications after marking as read
      const updatedNotifications = await NotificationService.getNotifications();
      setNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      // Refresh notifications after marking all as read
      const updatedNotifications = await NotificationService.getNotifications();
      setNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Updates */}
        {notifications.length > 0 ? (
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
            <Text style={styles.noOrdersText}>No orders yet</Text>
          </View>
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
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  noOrdersText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
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
});
