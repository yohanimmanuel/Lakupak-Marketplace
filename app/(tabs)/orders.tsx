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
  RotateCcw,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore, type MarketplaceOrder, type MarketplaceOrderItem } from '../../stores/dataStore';
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
  // notifications state no longer used; kept only if needed later
  // Local notification state no longer needed here; notifications now live in the Notifications tab
  const isAuthenticated = !!token && !!authUser;

  // SIMPLE: Load immediately when component mounts
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Load orders initially when authenticated (WebSocket will handle updates)
  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
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

  // WebSocket handles updates automatically - no need to derive notifications here anymore

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered':
      case 'received':
        return '#10b981';
      case 'returned':
        return '#f59e0b';
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


  const formatOrderDate = (order: MarketplaceOrder) => {
    const src = order.orderDate || order.createdAt || order.updatedAt;
    if (!src) return '';
    const d = new Date(src);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getOrderStatusColor = (status?: string) => {
    switch ((status || '').toLowerCase()) {
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
      case 'returned':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  /** Filled badge style like dashboard: { backgroundColor, color } */
  const getOrderStatusBadgeStyle = (status?: string): { backgroundColor: string; color: string } => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return { backgroundColor: '#fefce8', color: '#a16207' };
      case 'confirmed':
        return { backgroundColor: '#eff6ff', color: '#1d4ed8' };
      case 'packed':
        return { backgroundColor: '#eef2ff', color: '#4338ca' };
      case 'shipped':
        return { backgroundColor: '#f0f9ff', color: '#0369a1' };
      case 'delivered':
      case 'received':
        return { backgroundColor: '#ecfdf5', color: '#047857' };
      case 'failed':
      case 'cancelled':
        return { backgroundColor: '#fff1f2', color: '#be123c' };
      case 'returned':
        return { backgroundColor: '#f3f4f6', color: '#4b5563' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getOrderAmountColor = (paymentStatus?: string) => {
    const status = (paymentStatus || '').toLowerCase();
    if (status === 'unpaid') return '#dc2626'; // red-600
    if (status === 'paid') return '#16a34a'; // green-600
    return '#111827';
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
          ) : orders.length > 0 ? (
            orders.map((order: MarketplaceOrder) => {
              const totalProducts =
                Array.isArray(order.orderItems) && order.orderItems.length > 0
                  ? order.orderItems.length
                  : 0;
              const itemsLabel =
                totalProducts > 0
                  ? `${totalProducts} product${totalProducts > 1 ? 's' : ''}`
                  : 'No products';

              const dateLabel = formatOrderDate(order);
              const statusBadgeStyle = getOrderStatusBadgeStyle(order.orderStatus);
              const firstImage = order.orderItems?.[0]?.images?.[0];

              return (
                <TouchableOpacity
                  key={order.orderId}
                  style={styles.orderCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: '/components/ordersshipment/OrderDetails',
                      params: { orderId: order.orderId },
                    })
                  }
                >
                  <View style={styles.orderCardInner}>
                    <View style={styles.orderCardLeft}>
                      <View style={styles.orderCardThumbWrap}>
                        {firstImage ? (
                          <Image
                            source={{ uri: firstImage }}
                            style={styles.orderCardThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.orderCardThumbPlaceholder}>
                            <Package size={24} color="#9ca3af" />
                          </View>
                        )}
                      </View>
                      <View style={styles.orderCardBody}>
                        <View style={styles.orderCardTopRow}>
                          <Text style={styles.orderIdText}>{order.orderId}</Text>
                        </View>
                      <Text style={styles.orderDistributorText} numberOfLines={1}>
                        {order.storeName || order.user?.company?.name || 'Distributor'}
                      </Text>
                      <Text style={styles.orderProductsText} numberOfLines={2}>
                        {itemsLabel}
                      </Text>
                      <View style={styles.orderMetaRow}>
                        <Text
                          style={[
                            styles.orderAmountText,
                            { color: getOrderAmountColor(order.paymentStatus) },
                          ]}
                        >
                          {order.totalAmount != null ? `Rp ${Math.round(order.totalAmount).toLocaleString('id-ID')}` : ''}
                        </Text>
                      </View>
                      {dateLabel ? (
                        <View style={styles.orderDateRow}>
                          <Text style={styles.orderDateLabel}>Order Date:</Text>
                          <Text style={styles.orderDateText}>{dateLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    </View>
                    <View style={styles.orderCardRight}>
                      <View style={[styles.orderStatusPill, statusBadgeStyle]}>
                        <Text style={[styles.orderStatusPillText, { color: statusBadgeStyle.color }]}>
                          {order.orderStatus || 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.orderCardChevron}>
                        <ChevronRight size={20} color="#9ca3af" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
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
  orderCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderCardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  orderCardLeft: {
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingVertical: 2,
  },
  orderCardThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginRight: 14,
  },
  orderCardThumb: {
    width: '100%',
    height: '100%',
  },
  orderCardThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCardBody: {
    flex: 1,
    minWidth: 0,
  },
  orderCardChevron: {
    marginLeft: 8,
  },
  orderCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  orderDistributorText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
  orderProductsText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 15,
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmountText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  orderStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orderDateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  orderDateText: {
    fontSize: 12,
    color: '#374151',
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
