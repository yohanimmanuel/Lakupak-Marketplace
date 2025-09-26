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
import {
  Bell,
  ShoppingCart,
  MessageCircle,
  Gift,
  Tag,
  ChevronRight,
} from 'lucide-react-native';
import { useDataStore } from '../../stores/dataStore';
import { NotificationService, Notification } from '../../services/notificationService';

const { width: screenWidth } = Dimensions.get('window');

export default function NotificationsScreen() {
  const { user } = useDataStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from storage
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications();
        
        // Filter to only show non-order notifications
        const nonOrderNotifications = storedNotifications.filter(n => n.type !== 'order');
        
        // If no notifications exist, add some sample data for demonstration
        if (nonOrderNotifications.length === 0) {
          await addSampleNotifications();
          const allNotifications = await NotificationService.getNotifications();
          const filteredNotifications = allNotifications.filter(n => n.type !== 'order');
          setNotifications(filteredNotifications);
        } else {
          setNotifications(nonOrderNotifications);
        }
      } catch (error) {
      }
    };

    loadNotifications();
  }, []);

  // Add sample notifications for demonstration
  const addSampleNotifications = async () => {
    try {
      // Sample discount notifications
      await NotificationService.createDiscountNotification(
        'Special Discount Available',
        'Get 15% off on your next order from Laku-Laku Marketplace. Use code SAVE15 at checkout.'
      );
      await NotificationService.createDiscountNotification(
        'Bulk Order Discount',
        'Order 10+ items and get 20% discount. Limited time offer!'
      );
      
      // Sample promotion notifications
      await NotificationService.createPromotionNotification(
        'New Product Launch',
        'Check out our latest products from top distributors. Fresh arrivals every week!'
      );
      await NotificationService.createPromotionNotification(
        'Loyalty Rewards',
        'Earn points with every purchase and redeem them for exclusive rewards.'
      );
      
      // Sample update notifications
      await NotificationService.createUpdateNotification(
        'App Update Available',
        'Update to the latest version for better performance and new features.'
      );
    } catch (error) {
    }
  };

  // Refresh notifications when screen comes into focus
  useEffect(() => {
    const refreshNotifications = async () => {
      try {
        const storedNotifications = await NotificationService.getNotifications();
        const nonOrderNotifications = storedNotifications.filter(n => n.type !== 'order');
        setNotifications(nonOrderNotifications);
      } catch (error) {
      }
    };

    // Refresh when component mounts
    refreshNotifications();
  }, []);

  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'discount':
        return <Tag size={20} color="#ef4444" />;
      case 'promotion':
        return <Gift size={20} color="#3b82f6" />;
      case 'update':
        return <Bell size={20} color="#ef4444" />;
      default:
        return <Bell size={20} color="#ef4444" />;
    }
  };


  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
      // Refresh notifications after marking as read
      const updatedNotifications = await NotificationService.getNotifications();
      const nonOrderNotifications = updatedNotifications.filter(n => n.type !== 'order');
      setNotifications(nonOrderNotifications);
    } catch (error) {
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      // Refresh notifications after marking all as read
      const updatedNotifications = await NotificationService.getNotifications();
      const nonOrderNotifications = updatedNotifications.filter(n => n.type !== 'order');
      setNotifications(nonOrderNotifications);
    } catch (error) {
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Show only 1 notification per type */}
        {notifications
          .filter((notification, index, self) => 
            index === self.findIndex(n => n.type === notification.type)
          )
          .map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationItem, !notification.isRead && styles.unreadNotification]}
              onPress={() => markAsRead(notification.id)}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationIcon}>
                  {getNotificationIcon(notification)}
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
        
        {/* Message Notifications */}
        <TouchableOpacity
          style={[styles.notificationItem, styles.unreadNotification]}
          onPress={() => {}}
        >
          <View style={styles.notificationContent}>
            <View style={styles.notificationIcon}>
              <MessageCircle size={20} color="#3b82f6" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>Messages</Text>
              <Text style={styles.notificationMessage}>You have new messages from sellers</Text>
            </View>
            <View style={styles.notificationRight}>
              <View style={styles.unreadBadge} />
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
  },
  notificationItem: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 0,
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
});