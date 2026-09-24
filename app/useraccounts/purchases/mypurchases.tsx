import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquareText, Search, ChevronRight, Star, Package, Truck, CheckCircle, Clock, MapPin, Phone } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { MyPurchasesListSkeleton } from '../../components/SkeletonLoader';
import { formatCurrency } from '../../../utils/currencyUtils';
import { useDataStore } from '../../../stores/dataStore';
import { useTranslation } from 'react-i18next';
import { getDistributorCompanyName } from '../../../utils/orderDistributor';
import { isReorderEligible, resolveReorderNavigationTarget } from '../../../utils/reorderFromOrder';
import { showReorderUnavailableAlert } from '../../../utils/reorderAlerts';

interface OrderItem {
  productId: string;
  productName: string;
  packageQuantity: number;
  packageType: string;
  piecesPerPackage: number;
  pricePerPackage: number;
  subtotal: number;
  images?: string[];
  variant?: string;
  color?: string;
}

interface Order {
  orderId: string;
  buyerId: string;
  orderDate: string;
  orderItems: OrderItem[];
  subtotal: number;
  discounts: number;
  shippingFee: number;
  totalAmount: number;
  totalOrders: number;
  contactPerson: string;
  storeName: string;
  contactPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  deliveryMethod: string;
  orderStatus: 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Received' | 'Cancelled' | 'Returned';
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';
  paymentTerms: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  expectedDelivery?: string;
  trackingNumber?: string;
  seller?: {
    name: string;
    avatar?: string;
    rating: number;
    isOfficial: boolean;
    isPreferred: boolean;
  };
}

export default function MyPurchasesModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  
  const primaryBlue = '#0a61d7';
  const inactiveGrey = '#6B7280';
  const orange = '#f97316';
  
  const initialTab = (typeof params.tab === 'string' ? params.tab : 'to-pay') as 'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate';
  const [activeTab, setActiveTab] = useState<'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate'>(initialTab);
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderHasReview, setOrderHasReview] = useState<Record<string, boolean>>({});
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);

  const isAuthenticated = !!token && !!authUser;
  const storeOrders = useDataStore(state => state.orders);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const isOrdersLoading = useDataStore(state => state.isOrdersLoading);
  const products = useDataStore(state => state.products);
  const isLoading = isOrdersLoading;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setOrders([]);
      return;
    }

    // Load orders initially (WebSocket will handle updates)
    loadOrdersData(false);
  }, [isAuthenticated, authUser?.id, loadOrdersData]);

  useEffect(() => {
    if (!isAuthenticated || !authUser?.id) {
      setOrders([]);
      return;
    }

    const transformedOrders = storeOrders.map((order) => {
      const distributorCompanyName =
        getDistributorCompanyName(order) || t('myPurchases.fallbackStore');
      return {
        ...(order as unknown as Order),
        orderItems: (order.orderItems || []) as unknown as OrderItem[],
        storeName: distributorCompanyName,
        seller: {
          name: distributorCompanyName,
          avatar: order.user?.company?.logo,
          rating: 4.5,
          isOfficial: true,
          isPreferred: true
        },
        expectedDelivery: order.orderStatus === 'Shipped'
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
          : undefined
      } as Order;
    });

    setOrders(transformedOrders);
    // Orders refreshed via websocket/load → reset cached review flags to avoid stale "Edit review"
    setOrderHasReview({});
  }, [storeOrders, isAuthenticated, authUser?.id]);

  // Best-effort: cache whether each order already has an existing review (for "Edit review" label).
  useEffect(() => {
    let cancelled = false;
    const loadFlags = async () => {
      if (!token || !isAuthenticated) return;
      const candidateOrderIds = Array.from(
        new Set(
          orders
            .filter((o) => o.orderStatus === 'Delivered' || o.orderStatus === 'Received')
            .map((o) => o.orderId)
            .filter(Boolean),
        ),
      );
      const toFetch = candidateOrderIds.filter((id) => orderHasReview[id] === undefined).slice(0, 25);
      if (toFetch.length === 0) return;

      try {
        const results = await Promise.all(
          toFetch.map(async (orderId) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/api/mobile/reviews/order?orderId=${encodeURIComponent(orderId)}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const json = (await res.json().catch(() => null)) as
                | {
                    productReviews?: unknown[];
                    deliveryReview?: { deliveryRating?: number | null; deliveryComment?: string | null } | null;
                  }
                | null;
              if (!res.ok || !json) return { orderId, has: false };
              const hasProduct = Array.isArray(json.productReviews) && json.productReviews.length > 0;
              const hasDelivery =
                !!json.deliveryReview &&
                ((typeof json.deliveryReview.deliveryRating === 'number' && json.deliveryReview.deliveryRating > 0) ||
                  (typeof json.deliveryReview.deliveryComment === 'string' && json.deliveryReview.deliveryComment.trim().length > 0));
              return { orderId, has: hasProduct || hasDelivery };
            } catch {
              return { orderId, has: false };
            }
          }),
        );

        if (cancelled) return;
        setOrderHasReview((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.orderId] = r.has;
          return next;
        });
      } catch {
        // ignore
      }
    };

    void loadFlags();
    return () => {
      cancelled = true;
    };
  }, [orders, token, isAuthenticated, orderHasReview]);

  const getFilteredOrders = () => {
    let filtered = orders;
    
    // Filter by tab
    switch (activeTab) {
      case 'to-pay':
        filtered = orders.filter(order => order.orderStatus === 'Pending');
        break;
      case 'to-ship':
        filtered = orders.filter(order => ['Confirmed', 'Packed'].includes(order.orderStatus));
        break;
      case 'to-receive':
        filtered = orders.filter(order => order.orderStatus === 'Shipped');
        break;
      case 'completed':
        filtered = orders.filter(order => ['Delivered', 'Received'].includes(order.orderStatus));
        break;
      case 'returns':
        filtered = orders.filter(order => order.orderStatus === 'Returned');
        break;
      case 'cancelled':
        filtered = orders.filter(order => order.orderStatus === 'Cancelled');
        break;
      case 'to-rate':
        filtered = orders.filter(order => ['Delivered', 'Received'].includes(order.orderStatus));
        break;
    }
    
    // Filter by search query
    if (query.trim()) {
      filtered = filtered.filter(order => 
        order.orderId.toLowerCase().includes(query.toLowerCase()) ||
        order.orderItems.some(item => 
          item.productName.toLowerCase().includes(query.toLowerCase())
        )
      );
    }
    
    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered':
        return '#10b981';
      case 'Shipped':
        return '#0a61d7';
      case 'Confirmed':
      case 'Packed':
        return '#10b981';
      case 'Pending':
        return '#f59e0b';
      case 'Cancelled':
        return '#ef4444';
      case 'Returned':
        return '#c2410c';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (order: Order) => {
    if (order.orderStatus === 'Pending') {
      return t('myPurchases.statusPills.toPay');
    } else if (order.orderStatus === 'Confirmed' || order.orderStatus === 'Packed') {
      return t('myPurchases.statusPills.toShip');
    } else if (order.orderStatus === 'Shipped') {
      return t('myPurchases.statusPills.toReceive');
    } else if (order.orderStatus === 'Delivered') {
      return t('myPurchases.statusPills.completed');
    } else if (order.orderStatus === 'Returned') {
      return t('myPurchases.statusPills.returns');
    } else if (order.orderStatus === 'Cancelled') {
      return t('myPurchases.statusPills.cancelled');
    }
    return order.orderStatus;
  };

  const getActionButtons = (order: Order) => {
    const buttons = [];
    
    if (order.orderStatus === 'Pending') {
      buttons.push({ text: t('myPurchases.actions.pay'), type: 'primary', action: 'pay' });
    } else if (order.orderStatus === 'Confirmed' || order.orderStatus === 'Packed') {
      buttons.push({ text: t('ordersFlow.orderDetails.support.contactSeller'), type: 'secondary', action: 'contact' });
    } else if (order.orderStatus === 'Shipped') {
      buttons.push({ text: t('myPurchases.actions.returnRefund'), type: 'secondary', action: 'return' });
      buttons.push({ text: t('ordersFlow.orderDetails.actions.orderReceived'), type: 'primary', action: 'received' });
    } else if (order.orderStatus === 'Delivered' || order.orderStatus === 'Received') {
      if (isReorderEligible(order.orderStatus)) {
        buttons.push({ text: t('myPurchases.actions.reorder'), type: 'secondary', action: 'reorder' });
      }
      buttons.push({ text: t('myPurchases.actions.returnRefund'), type: 'secondary', action: 'return' });
      buttons.push({
        text: orderHasReview[order.orderId] ? t('ordersFlow.orderDetails.actions.editReview') : t('tabsAccount.purchaseStatus.toRate'),
        type: 'primary',
        action: 'rate',
      });
    } else if (order.orderStatus === 'Returned') {
      buttons.push({ text: t('ordersFlow.orderDetails.orderIdInfo.viewMore'), type: 'secondary', action: 'details' });
    }
    
    return buttons;
  };

  const handleReorder = async (order: Order) => {
    if (reorderingOrderId) return;

    setReorderingOrderId(order.orderId);
    try {
      const { target } = await resolveReorderNavigationTarget({
        order: {
          orderStatus: order.orderStatus,
          orderItems: order.orderItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            packageQuantity: item.packageQuantity,
            variantName: item.variant,
          })),
        },
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
      setReorderingOrderId(null);
    }
  };

  const handleAction = (order: Order, action: string) => {
    switch (action) {
      case 'reorder':
        handleReorder(order);
        break;
      case 'pay':
        router.push(`/components/ordersshipment/PayOrder?orderId=${encodeURIComponent(order.orderId)}`);
        break;
      case 'contact':
        router.push('/messages');
        break;
      case 'return':
        router.push(`/components/ordersshipment/ReturnRefundModal?orderId=${encodeURIComponent(order.orderId)}`);
        break;
      case 'received':
        updateOrderStatus(order.orderId, 'Received');
        break;
      case 'rate':
        {
          const reviewItems = (order.orderItems ?? [])
            .filter((it) => it.productId)
            .map((it) => ({
              productId: String(it.productId),
              productName: it.productName ?? 'Product',
              image: (it.images && it.images[0]) ? it.images[0] : '',
            }));
          router.push({
            pathname: '/components/productcatalog/ProductReview',
            params: { orderId: order.orderId, itemsJson: JSON.stringify(reviewItems) },
          });
        }
        break;
      case 'details':
        router.push({
          pathname: '/components/ordersshipment/OrderDetails',
          params: { orderId: order.orderId },
        });
        break;
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
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
        // WebSocket will handle the update automatically
        // Optionally trigger a refresh if needed
        loadOrdersData(false);
      }
    } catch (error) {
      // Handle error
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const TabItem = ({ label, value }: { label: string; value: typeof activeTab }) => {
    const isActive = activeTab === value;
          return (
      <Pressable onPress={() => setActiveTab(value)} style={{ paddingVertical: 12, paddingHorizontal: 16, position: 'relative' }}>
        <Text style={{ color: isActive ? primaryBlue : inactiveGrey, fontWeight: isActive ? '600' as const : '500', fontSize: 14 }}>{label}</Text>
        {isActive && <View style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: primaryBlue }} />}
            </Pressable>
          );
  };

  const renderOrderCard = (order: Order) => {
    const isExpanded = expandedOrders.has(order.orderId);
    const statusText = getStatusText(order);
    const statusColor = getStatusColor(order.orderStatus);
    const actionButtons = getActionButtons(order);
    const mainItem = order.orderItems[0];

    return (
      <Pressable
        key={order.orderId}
        style={styles.orderCard}
        onPress={() =>
          router.push({
            pathname: '/components/ordersshipment/OrderDetails',
            params: { orderId: order.orderId },
          })
        }
      >
        {/* Seller Info */}
        <View style={styles.sellerInfo}>
          <View style={styles.sellerLeft}>
            <Text style={styles.sellerName}>{order.seller?.name}</Text>
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
            <Image 
            source={{ uri: mainItem.images?.[0] || 'https://via.placeholder.com/80x80' }} 
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={2}>
              {mainItem.productName}
              </Text>
            {(mainItem.variant || mainItem.color || mainItem.packageType || mainItem.piecesPerPackage) ? (
              <Text style={styles.productVariant} numberOfLines={2}>
                {[
                  mainItem.variant,
                  mainItem.color ? `Color: ${mainItem.color}` : undefined,
                  mainItem.packageType && mainItem.piecesPerPackage
                    ? `${mainItem.packageType} · ${mainItem.piecesPerPackage} pcs`
                    : mainItem.packageType
                      ? mainItem.packageType
                      : mainItem.piecesPerPackage
                        ? `${mainItem.piecesPerPackage} pcs`
                        : undefined,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            ) : null}
            <Text style={styles.productQuantity}>x{mainItem.packageQuantity}</Text>
            <View style={styles.priceContainer}>
              {!(Number(mainItem.pricePerPackage) > 0) ? (
                <Text style={styles.currentPrice}>{t('tabsOrders.pendingPrice')}</Text>
              ) : (
                <>
                  {order.discounts > 0 && (
                    <Text style={styles.originalPrice}>{formatCurrency(mainItem.pricePerPackage + order.discounts)}</Text>
                  )}
                  <Text style={styles.currentPrice}>{formatCurrency(mainItem.pricePerPackage)}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* View More / Less */}
        {order.orderItems.length > 1 && (
          <TouchableOpacity 
            style={styles.viewMoreContainer}
            onPress={() => toggleOrderExpansion(order.orderId)}
          >
            <Text style={styles.viewMoreText}>
              {isExpanded ? 'View Less' : 'View More'}
                    </Text>
            <ChevronRight 
              size={16} 
              color="#6b7280" 
              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        )}

        {/* Additional Items */}
        {isExpanded && order.orderItems.length > 1 && (
          <View style={styles.additionalItems}>
            {order.orderItems.slice(1).map((item, index) => (
              <View key={index} style={styles.additionalItem}>
                <Image 
                  source={{ uri: item.images?.[0] || 'https://via.placeholder.com/60x60' }} 
                  style={styles.additionalItemImage}
                  resizeMode="cover"
                />
                <View style={styles.additionalItemDetails}>
                  <Text style={styles.additionalItemName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.additionalItemQuantity}>x{item.packageQuantity}</Text>
                  <Text style={styles.additionalItemPrice}>
                    {Number(item.pricePerPackage) > 0
                      ? formatCurrency(item.pricePerPackage)
                      : t('tabsOrders.pendingPrice')}
                  </Text>
            </View>
          </View>
        ))}
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.totalText}>
            {t('myPurchases.summary.totalItems', {
              count: order.orderItems.length,
              amount:
                Number(order.totalAmount) > 0
                  ? formatCurrency(order.totalAmount)
                  : t('tabsOrders.pendingPrice'),
            })}
          </Text>
        </View>

        {/* Expected Delivery */}
        {order.expectedDelivery && (
          <View style={styles.expectedDelivery}>
            <MapPin size={16} color="#10b981" />
            <Text style={styles.expectedDeliveryText}>
              {t('myPurchases.meta.expectedDelivery', { date: order.expectedDelivery })}
            </Text>
            <ChevronRight size={16} color="#10b981" />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {actionButtons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                button.action === 'rate' ? styles.ratePrimaryButton : button.type === 'primary' ? styles.primaryButton : styles.secondaryButton
              ]}
              onPress={(e) => {
                e?.stopPropagation?.();
                handleAction(order, button.action);
              }}
              disabled={button.action === 'reorder' && reorderingOrderId === order.orderId}
            >
              {button.action === 'rate' ? (
                <>
                  <Star size={16} color="#ffffff" />
                  <Text style={[styles.actionButtonText, styles.primaryButtonText]}>{button.text}</Text>
                </>
              ) : (
                <Text style={[
                  styles.actionButtonText,
                  button.type === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText
                ]}>
                  {button.text}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Package size={48} color="#d1d5db" />
      <Text style={styles.emptyStateTitle}>{t('myPurchases.empty.noneTitle')}</Text>
      <Text style={styles.emptyStateDescription}>
        {activeTab === 'to-pay' && t('myPurchases.empty.noneBodyToPay')}
        {activeTab === 'to-ship' && t('myPurchases.empty.toShip')}
        {activeTab === 'to-receive' && t('myPurchases.empty.toReceive')}
        {activeTab === 'completed' && t('myPurchases.empty.completed')}
        {activeTab === 'returns' && t('myPurchases.empty.returns')}
        {activeTab === 'cancelled' && t('myPurchases.empty.cancelled')}
        {activeTab === 'to-rate' && t('myPurchases.empty.toRate')}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <Stack.Screen options={{
        presentation: 'modal',
        header: () => (
          <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
            {/* Standard header row - back, title, message */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ArrowLeft color={primaryBlue} size={24} />
              </Pressable>
              <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('myPurchases.title')}</Text>
              <Pressable onPress={() => router.push('/messages')} hitSlop={10}>
                <MessageSquareText color={primaryBlue} size={22} />
              </Pressable>
            </View>
            
            {/* Search Bar - part of header */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Search color={inactiveGrey} size={20} />
                <TextInput 
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('myPurchases.searchPlaceholder')} 
                  style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }} 
                  placeholderTextColor={inactiveGrey} 
                />
              </View>
            </View>
            
            {/* Tab Navigation - part of header */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TabItem label={t('myPurchases.tabs.toPay')} value={'to-pay'} />
                <TabItem label={t('myPurchases.tabs.toShip')} value={'to-ship'} />
                <TabItem label={t('myPurchases.tabs.toReceive')} value={'to-receive'} />
                <TabItem label={t('myPurchases.tabs.toRate')} value={'to-rate'} />
                <TabItem label={t('myPurchases.tabs.completed')} value={'completed'} />
                <TabItem label={t('myPurchases.tabs.returns')} value={'returns'} />
                <TabItem label={t('myPurchases.tabs.cancelled')} value={'cancelled'} />
              </View>
            </ScrollView>
          </View>
        ),
      }} />

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('myPurchases.loading')}
            accessibilityLiveRegion="polite"
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <MyPurchasesListSkeleton />
            </View>
          </View>
        ) : !isAuthenticated ? (
          <View style={styles.emptyState}>
            <Package size={48} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>{t('myPurchases.loginTitle')}</Text>
            <Text style={styles.emptyStateDescription}>
              {t('myPurchases.loginBody')}
                </Text>
              </View>
        ) : getFilteredOrders().length > 0 ? (
          <View style={styles.ordersContainer}>
            {getFilteredOrders().map(renderOrderCard)}
            </View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    padding: 16,
  },
  sellerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  productInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  productVariant: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  viewMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  viewMoreText: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  additionalItems: {
    marginBottom: 12,
  },
  additionalItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  additionalItemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  additionalItemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  additionalItemName: {
    fontSize: 12,
    color: '#111827',
    marginBottom: 2,
  },
  additionalItemQuantity: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  additionalItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  orderSummary: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    marginBottom: 12,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  expectedDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  expectedDeliveryText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 6,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#f97316',
  },
  ratePrimaryButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButtonText: {
    color: '#111827',
  },
  ordersContainer: {
    paddingVertical: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});


