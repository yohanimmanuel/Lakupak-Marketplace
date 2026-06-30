import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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
import { useTranslation } from 'react-i18next';
import { getDistributorCompanyName } from '../../utils/orderDistributor';
import { isReorderEligible, resolveReorderNavigationTarget } from '../../utils/reorderFromOrder';
import { showReorderUnavailableAlert } from '../../utils/reorderAlerts';
import { OrdersListSkeleton } from '../components/SkeletonLoader';

const { width: screenWidth } = Dimensions.get('window');

export default function OrdersScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const orders = useDataStore(state => state.orders);
  const products = useDataStore(state => state.products);
  const isOrdersLoading = useDataStore(state => state.isOrdersLoading);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const showOrdersSkeleton =
    refreshing || (isOrdersLoading && orders.length === 0);

  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) return;
    setRefreshing(true);
    try {
      await loadOrdersData(true);
    } finally {
      setRefreshing(false);
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


  const locale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';

  const formatOrderDateTime = (order: MarketplaceOrder) => {
    const src = order.orderDate || order.createdAt || order.updatedAt;
    if (!src) return '';
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${datePart} • ${timePart}`;
  };

  const formatProductSummary = (order: MarketplaceOrder) => {
    const items = order.orderItems ?? [];
    if (items.length === 0) return t('tabsOrders.items.noProducts');
    return items
      .map((item) => {
        const qty = item.packageQuantity && item.packageQuantity > 0 ? item.packageQuantity : 1;
        const name = item.productName?.trim() || t('tabsOrders.items.noProducts');
        return `${qty}x ${name}`;
      })
      .join(', ');
  };

  const getTotalItemCount = (order: MarketplaceOrder) => {
    const items = order.orderItems ?? [];
    if (items.length === 0) return 0;
    const fromQty = items.reduce((sum, item) => sum + (item.packageQuantity ?? 1), 0);
    return fromQty > 0 ? fromQty : items.length;
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
        return '#ef4444';
      case 'returned':
        return '#c2410c';
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
        return { backgroundColor: '#ffedd5', color: '#c2410c' };
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

  const handleReorder = async (order: MarketplaceOrder) => {
    if (reorderingId) return;

    setReorderingId(order.orderId);
    try {
      const { target } = await resolveReorderNavigationTarget({
        order,
        products,
        token: token || undefined,
      });

      if (!target) {
        showReorderUnavailableAlert(t);
        return;
      }

      router.push({
        pathname: '/product',
        params: {
          productId: target.productId,
          openBuyNow: 'true',
          initialQuantity: String(target.quantity),
          variantName: target.variantName,
        },
      });
    } catch {
      showReorderUnavailableAlert(t);
    } finally {
      setReorderingId(null);
    }
  };

  const renderLoginPrompt = () => (
    <View style={styles.loginPromptContainer}>
      <View style={styles.loginPromptIcon}>
        <UserIcon color="#0a61d7" size={28} />
      </View>
      <Text style={styles.loginPromptTitle}>
        {t('tabsOrders.loginPrompt.title')}
      </Text>
      <View style={styles.loginPromptButtons}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>{t('tabsOrders.loginPrompt.login')}</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={styles.signupButton}>
            <Text style={styles.signupButtonText}>{t('tabsOrders.loginPrompt.signup')}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0a61d7"
              colors={['#0a61d7']}
            />
          ) : undefined
        }
      >
        {isAuthenticated ? (
          showOrdersSkeleton ? (
            <OrdersListSkeleton />
          ) : orders.length > 0 ? (
            orders.map((order: MarketplaceOrder) => {
              const dateLabel = formatOrderDateTime(order);
              const statusBadgeStyle = getOrderStatusBadgeStyle(order.orderStatus);
              const firstImage = order.orderItems?.[0]?.images?.[0];
              const distributorName =
                getDistributorCompanyName(order) || t('tabsOrders.distributorFallback');
              const productSummary = formatProductSummary(order);
              const itemCount = getTotalItemCount(order);
              const amountLabel =
                order.totalAmount != null
                  ? `Rp ${Math.round(order.totalAmount).toLocaleString('id-ID')}`
                  : '';
              const summaryLabel = t('tabsOrders.summaryLine', {
                count: itemCount,
                amount: amountLabel,
              });

              const openOrderDetails = () => {
                router.push({
                  pathname: '/components/ordersshipment/OrderDetails',
                  params: { orderId: order.orderId },
                });
              };

              return (
                <View key={order.orderId} style={styles.orderCard}>
                  <View style={styles.orderCardMain}>
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
                      <View style={styles.orderDistributorRow}>
                        <Text style={styles.orderDistributorText} numberOfLines={2}>
                          {distributorName}
                        </Text>
                        <Pressable
                          onPress={openOrderDetails}
                          style={({ pressed }) => [
                            styles.seeDetailsRow,
                            pressed && styles.seeDetailsRowPressed,
                          ]}
                          hitSlop={8}
                        >
                          <Text style={styles.seeDetailsText}>{t('tabsOrders.seeDetails')}</Text>
                          <ChevronRight size={16} color="#111827" />
                        </Pressable>
                      </View>
                      {dateLabel ? (
                        <Text style={styles.orderDateText} numberOfLines={2}>
                          {dateLabel}
                        </Text>
                      ) : null}
                      <Text style={styles.orderProductsText} numberOfLines={3}>
                        {productSummary}
                      </Text>
                      <View style={[styles.orderStatusPill, statusBadgeStyle]}>
                        <Text style={[styles.orderStatusPillText, { color: statusBadgeStyle.color }]}>
                          {order.orderStatus || t('tabsOrders.unknownStatus')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.orderCardFooter}>
                    <Text
                      style={[
                        styles.orderSummaryText,
                        { color: getOrderAmountColor(order.paymentStatus) },
                      ]}
                    >
                      {summaryLabel}
                    </Text>
                    {isReorderEligible(order.orderStatus) ? (
                      <Pressable
                        onPress={() => handleReorder(order)}
                        disabled={reorderingId === order.orderId}
                        style={({ pressed }) => [
                          styles.reorderButton,
                          pressed && styles.reorderButtonPressed,
                          reorderingId === order.orderId && styles.reorderButtonDisabled,
                        ]}
                        hitSlop={6}
                      >
                        {reorderingId === order.orderId ? (
                          <ActivityIndicator size="small" color="#0a61d7" />
                        ) : (
                          <>
                            <RotateCcw size={14} color="#0a61d7" />
                            <Text style={styles.reorderButtonText}>{t('tabsOrders.reorder')}</Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.noOrdersCard}>
              <View style={styles.noOrdersIconContainer}>
                <ShoppingBag size={48} color="#d1d5db" />
              </View>
              <Text style={styles.noOrdersTitle}>{t('tabsOrders.empty.title')}</Text>
              <Text style={styles.noOrdersSubDescription}>{t('tabsOrders.empty.description')}</Text>
              <View style={styles.noOrdersFeatures}>
                <Text style={styles.noOrdersFeatureTitle}>{t('tabsOrders.empty.featuresTitle')}</Text>
                <Text style={styles.noOrdersFeatureItem}>• {t('tabsOrders.empty.features.realtimeStatus')}</Text>
                <Text style={styles.noOrdersFeatureItem}>• {t('tabsOrders.empty.features.shippingNotifications')}</Text>
                <Text style={styles.noOrdersFeatureItem}>• {t('tabsOrders.empty.features.historyTracking')}</Text>
                <Text style={styles.noOrdersFeatureItem}>• {t('tabsOrders.empty.features.importantComms')}</Text>
              </View>
              <Text style={styles.noOrdersCTA}>{t('tabsOrders.empty.cta')}</Text>
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
    minHeight: 280,
    paddingVertical: 64,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
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
  seeDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  seeDetailsRowPressed: {
    opacity: 0.7,
  },
  seeDetailsText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  orderCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderDistributorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
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
    marginTop: 2,
    alignSelf: 'flex-start',
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
  orderDistributorText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  orderProductsText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginTop: 6,
  },
  orderStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  orderStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDateText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  orderSummaryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a61d7',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  reorderButtonPressed: {
    opacity: 0.75,
  },
  reorderButtonDisabled: {
    opacity: 0.6,
  },
  reorderButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a61d7',
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
