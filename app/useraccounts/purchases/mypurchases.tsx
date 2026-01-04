import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquareText, Search, ChevronRight, Star, Package, Truck, CheckCircle, Clock, MapPin, Phone } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { marketplaceService, MarketplaceProduct } from '../../../services/marketplace';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';
import { useCartStore } from '../../../stores/cartStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import { Product } from '@/data/sampleProducts';
import { useDataStore } from '../../../stores/dataStore';

const { width: screenWidth } = Dimensions.get('window');

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
  orderStatus: 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
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
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  
  // Cart store hooks
  const { addItem } = useCartStore();
  
  // Local state for liked products (simplified)
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  
  const primaryBlue = '#0a61d7';
  const inactiveGrey = '#6B7280';
  const orange = '#f97316';
  
  const initialTab = (typeof params.tab === 'string' ? params.tab : 'to-pay') as 'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate';
  const [activeTab, setActiveTab] = useState<'to-pay' | 'to-ship' | 'to-receive' | 'completed' | 'returns' | 'cancelled' | 'to-rate'>(initialTab);
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

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
      const fallbackStoreName = order.storeName || order.user?.company?.name || 'Laku Store';
      return {
        ...(order as unknown as Order),
        orderItems: (order.orderItems || []) as unknown as OrderItem[],
        storeName: fallbackStoreName,
        seller: {
          name: fallbackStoreName,
          avatar: order.user?.company?.logo,
          rating: 4.5,
          isOfficial: true,
          isPreferred: true
        },
        expectedDelivery: order.orderStatus === 'Shipped'
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
          : undefined
      } as Order;
    });

    setOrders(transformedOrders);
  }, [storeOrders, isAuthenticated, authUser?.id]);

  // Get related products from websocket-enabled products store
  const relatedProducts = React.useMemo(() => {
    if (products.length === 0) return [];
    
    // Get order product IDs to exclude (if there are orders)
    const orderProductIds = orders.length > 0
      ? orders.flatMap(order => 
          order.orderItems.map(item => item.productId)
        )
      : [];
    
    // Get categories from order items (if there are orders)
    let category: string | undefined;
    if (orders.length > 0) {
      const categories = [...new Set(
        orders.flatMap(order => 
          order.orderItems
            .map(item => {
              // Try to get category from product if available, otherwise use first word
              const orderProduct = products.find(p => p.id === item.productId);
              return orderProduct?.category || item.productName.split(' ')[0];
            })
            .filter(Boolean)
        )
      )].filter(Boolean);
      category = categories[0];
    }
    
    // Filter products by category (if available) and exclude order products
    let filtered = products.filter(product => !orderProductIds.includes(product.id));
    
    if (category) {
      const categoryFiltered = filtered.filter(product => product.category === category);
      if (categoryFiltered.length > 0) {
        filtered = categoryFiltered;
      }
    }
    
    return filtered.slice(0, 4);
  }, [products, orders]);

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
        filtered = orders.filter(order => order.orderStatus === 'Delivered');
        break;
      case 'returns':
        filtered = orders.filter(order => order.orderStatus === 'Returned');
        break;
      case 'cancelled':
        filtered = orders.filter(order => order.orderStatus === 'Cancelled');
        break;
      case 'to-rate':
        filtered = orders.filter(order => order.orderStatus === 'Delivered');
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
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (order: Order) => {
    if (order.orderStatus === 'Pending') {
      return 'To Pay';
    } else if (order.orderStatus === 'Confirmed' || order.orderStatus === 'Packed') {
      return 'To Ship';
    } else if (order.orderStatus === 'Shipped') {
      return 'To Receive';
    } else if (order.orderStatus === 'Delivered') {
      return 'Completed';
    } else if (order.orderStatus === 'Returned') {
      return 'Return/Refund';
    } else if (order.orderStatus === 'Cancelled') {
      return 'Cancelled';
    }
    return order.orderStatus;
  };

  const getActionButtons = (order: Order) => {
    const buttons = [];
    
    if (order.orderStatus === 'Pending') {
      buttons.push({ text: 'Pay', type: 'primary', action: 'pay' });
    } else if (order.orderStatus === 'Confirmed' || order.orderStatus === 'Packed') {
      buttons.push({ text: 'Contact Seller', type: 'secondary', action: 'contact' });
    } else if (order.orderStatus === 'Shipped') {
      buttons.push({ text: 'Return/Refund', type: 'secondary', action: 'return' });
      buttons.push({ text: 'Order Received', type: 'primary', action: 'received' });
    } else if (order.orderStatus === 'Delivered') {
      buttons.push({ text: 'Return/Refund', type: 'secondary', action: 'return' });
      buttons.push({ text: 'Rate', type: 'primary', action: 'rate' });
    } else if (order.orderStatus === 'Returned') {
      buttons.push({ text: 'View Details', type: 'secondary', action: 'details' });
    }
    
    return buttons;
  };

  const handleAction = (order: Order, action: string) => {
    switch (action) {
      case 'pay':
        // Navigate to payment success for now (placeholder)
        router.push('/payment-success');
        break;
      case 'contact':
        router.push('/messages');
        break;
      case 'return':
        // Navigate to settings for now (placeholder)
        router.push('/settings');
        break;
      case 'received':
        // Update order status to delivered
        updateOrderStatus(order.orderId, 'Delivered');
        break;
      case 'rate':
        // Navigate to product page for now (placeholder)
        router.push('/product');
        break;
      case 'details':
        // Navigate to product page for now (placeholder)
        router.push('/product');
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

  // Handler functions for related products
  const handleAddToCart = (product: Product | MarketplaceProduct, quantity: number = 1) => {
    addItem(product, quantity);
  };

  const handleBuyNow = (product: Product | MarketplaceProduct, quantity: number = 1) => {
    addItem(product, quantity);
    router.push('/cart');
  };

  const handleChatSeller = () => {
    router.push('/messages');
  };

  const handleShare = () => {
    // Share functionality placeholder
  };

  const handleToggleFavorite = (productId: string) => {
    setLikedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
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
      <View key={order.orderId} style={styles.orderCard}>
        {/* Seller Info */}
        <View style={styles.sellerInfo}>
          <View style={styles.sellerLeft}>
            {order.seller?.isPreferred && (
              <View style={styles.preferredBadge}>
                <Text style={styles.preferredText}>Preferred</Text>
              </View>
            )}
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
            {mainItem.variant && (
              <Text style={styles.productVariant}>{mainItem.variant}</Text>
            )}
            <Text style={styles.productQuantity}>x{mainItem.packageQuantity}</Text>
            <View style={styles.priceContainer}>
              {order.discounts > 0 && (
                <Text style={styles.originalPrice}>{formatCurrency(mainItem.pricePerPackage + order.discounts)}</Text>
              )}
              <Text style={styles.currentPrice}>{formatCurrency(mainItem.pricePerPackage)}</Text>
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
                  <Text style={styles.additionalItemPrice}>{formatCurrency(item.pricePerPackage)}</Text>
            </View>
          </View>
        ))}
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.totalText}>
            Total {order.orderItems.length} item{order.orderItems.length > 1 ? 's' : ''}: {formatCurrency(order.totalAmount)}
          </Text>
        </View>

        {/* Expected Delivery */}
        {order.expectedDelivery && (
          <View style={styles.expectedDelivery}>
            <MapPin size={16} color="#10b981" />
            <Text style={styles.expectedDeliveryText}>
              Expected delivery: {order.expectedDelivery}
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
                button.type === 'primary' ? styles.primaryButton : styles.secondaryButton
              ]}
              onPress={() => handleAction(order, button.action)}
            >
              <Text style={[
                styles.actionButtonText,
                button.type === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText
              ]}>
                {button.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Package size={48} color="#d1d5db" />
      <Text style={styles.emptyStateTitle}>No Orders Found</Text>
      <Text style={styles.emptyStateDescription}>
        {activeTab === 'to-pay' && 'You have no pending payments.'}
        {activeTab === 'to-ship' && 'No orders are being prepared for shipment.'}
        {activeTab === 'to-receive' && 'No orders are currently in transit.'}
        {activeTab === 'completed' && 'You have no completed orders yet.'}
        {activeTab === 'returns' && 'You have no return/refund requests.'}
        {activeTab === 'cancelled' && 'You have no cancelled orders.'}
        {activeTab === 'to-rate' && 'No orders are ready for rating.'}
      </Text>
    </View>
  );

  const renderYouMayAlsoLike = () => {
    if (relatedProducts.length === 0) return null;

    return (
      <View style={styles.youMayAlsoLikeSection}>
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.sectionTitle}>You May Also Like</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <View style={styles.relatedProductsGrid}>
          <View style={styles.leftColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 0).map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={() => handleToggleFavorite(product.id)}
                  isFavorite={likedProducts.includes(product.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
          <View style={styles.rightColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 1).map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={() => handleToggleFavorite(product.id)}
                  isFavorite={likedProducts.includes(product.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

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
              <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>My Purchases</Text>
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
                  placeholder="Search orders" 
                  style={{ flex: 1, marginLeft: 8, color: '#111827', paddingVertical: 0 }} 
                  placeholderTextColor={inactiveGrey} 
                />
              </View>
            </View>
            
            {/* Tab Navigation - part of header */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TabItem label="To Pay" value={'to-pay'} />
                <TabItem label="To Ship" value={'to-ship'} />
                <TabItem label="To Receive" value={'to-receive'} />
                <TabItem label="To Rate" value={'to-rate'} />
                <TabItem label="Completed" value={'completed'} />
                <TabItem label="Return/Refund" value={'returns'} />
                <TabItem label="Cancelled" value={'cancelled'} />
              </View>
            </ScrollView>
          </View>
        ),
      }} />

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your orders...</Text>
          </View>
        ) : !isAuthenticated ? (
          <View style={styles.emptyState}>
            <Package size={48} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>Please Login</Text>
            <Text style={styles.emptyStateDescription}>
              You need to be logged in to view your purchase history.
                </Text>
              </View>
        ) : getFilteredOrders().length > 0 ? (
          <View style={styles.ordersContainer}>
            {getFilteredOrders().map(renderOrderCard)}
            </View>
        ) : (
          renderEmptyState()
        )}

        {renderYouMayAlsoLike()}
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
  preferredBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  preferredText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
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
  youMayAlsoLikeSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    marginBottom: 8, // Narrower gap between sections
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 16,
  },
  relatedProductsGrid: {
    flexDirection: 'row',
    gap: 8, // Narrower gap between columns
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  productItem: {
    marginBottom: 4, // Narrower gap between items
  },
});


