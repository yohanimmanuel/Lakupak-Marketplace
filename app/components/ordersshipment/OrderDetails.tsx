import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  Clipboard,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle,
  Truck,
  MapPin,
  Package,
  Clock,
  Copy,
  RotateCcw,
  MessageCircle,
  HelpCircle,
  Star,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  User,
  Phone,
  FileText,
  Gift,
} from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OrderItem {
  id: string;
  name: string;
  image: string;
  images?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
  packageType?: string;
  piecesPerPackage?: number;
  packageQuantity?: number;
  pricePerPackage?: number;
  description?: string;
  productName?: string;
  promotionDetails?: {
    minQuantity: number;
    freeQuantity: number;
  };
  promotionDetailsSnapshot?: string;
  originalPriceSnapshot?: string;
}

interface ShippingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  estimatedDelivery: string;
  actualDelivery?: string;
}

interface DeliveryInfo {
  recipientName: string;
  phone: string;
  address: string;
  deliveryInstructions?: string;
}

interface Order {
  id: string;
  status: 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | 'Received';
  orderDate: string;
  paymentMethod: string;
  invoiceUrl?: string;
  items: OrderItem[];
  shippingInfo: ShippingInfo;
  totalAmount: number;
  orderItems?: OrderItem[];
}

interface OrderDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  order: Order;
  onUpdateOrderStatus?: (orderId: string, status: string) => void;
}

export default function OrderDetailsModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuthStore();
  
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceived, setIsReceived] = useState(false);
  const [showAllOrderInfo, setShowAllOrderInfo] = useState(false);

  useEffect(() => {
    if (params.orderId) {
      fetchOrderDetails(params.orderId as string);
    }
  }, [params.orderId]);

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const orderData = await response.json();
        setOrder(orderData);
        setIsReceived(orderData?.orderStatus === 'Delivered' || orderData?.orderStatus === 'Received');
      } else {
        setOrder(null);
      }
    } catch (error) {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'Your Order is Delivered';
      case 'received':
        return 'Your Order is Completed';
      case 'shipped':
        return 'Your Order is Shipped';
      case 'confirmed':
        return 'Your Order is Confirmed';
      case 'packed':
        return 'Your Order is Packed';
      case 'cancelled':
        return 'Your Order is Cancelled';
      case 'returned':
        return 'Your Order is Returned';
      default:
        return 'Your Order is Pending';
    }
  };

  const getDeliveryStatusDescription = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'Your parcel has been delivered';
      case 'received':
        return 'Your order is completed and received';
      case 'shipped':
        return 'Your parcel is on the way to you';
      case 'confirmed':
        return 'Your order is being prepared for shipment';
      case 'packed':
        return 'Your order is packed and ready to ship';
      case 'cancelled':
        return 'Your order has been cancelled';
      case 'returned':
        return 'Your order is being returned';
      case 'pending':
        return 'Your order is being processed';
      default:
        return 'Your order is being processed';
    }
  };

  const handleOrderReceived = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/${order.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'Received' })
      });
      
      if (response.ok) {
        setIsReceived(true);
        setOrder((prev: Order) => ({ ...prev, status: 'Received' }));
        Alert.alert('Success', 'Order marked as received successfully!');
      } else {
        Alert.alert('Error', 'Failed to update order status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleRateOrder = () => {
    Alert.alert('Rate Order', 'Rating functionality coming soon!');
  };

  const copyOrderId = () => {
    Clipboard.setString(order.orderId);
    Alert.alert('Copied', 'Order ID copied to clipboard');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };


  const renderOrderShippingInfo = () => (
    <View style={styles.section}>
      <View style={styles.productCard}>
        <View style={[styles.sectionTitleContainer, styles.shippingTitleContainer]}>
          <Text style={[styles.sectionTitle, styles.shippingTitle]}>{getStatusText(order.orderStatus)}</Text>
        </View>
        
        {/* Delivery Status Information */}
        <View style={styles.deliveryStatusContainer}>
          {order.assignedLogistics && (
            <Text style={styles.deliveryMethodText}>
              {order.assignedLogistics}: {order.trackingNumber || 'N/A'}
            </Text>
          )}
          
          <View style={styles.deliveryStatusRow}>
            <Truck size={16} color="#10b981" />
            <Text style={styles.deliveryStatusText}>
              {getDeliveryStatusDescription(order.orderStatus)}
            </Text>
            <TouchableOpacity 
              style={styles.chevronButton}
              onPress={() => router.push({
                pathname: '/components/ordersshipment/DeliveryInformation',
                params: { orderId: order.orderId }
              })}
            >
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {order.updatedAt && (
            <Text style={styles.deliveryDateTimeText}>
              {new Date(order.updatedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
              })} {new Date(order.updatedAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </Text>
          )}
        </View>
        
        {order.assignedLogistics && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Carrier:</Text>
            <Text style={styles.infoValue}>{order.assignedLogistics}</Text>
          </View>
        )}
        
        {order.trackingNumber && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tracking Number:</Text>
            <Text style={styles.infoValue}>{order.trackingNumber}</Text>
          </View>
        )}
        
        {order.contactPerson && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Recipient:</Text>
            <Text style={styles.infoValue}>{order.contactPerson}</Text>
          </View>
        )}
        
        {order.contactPhone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{order.contactPhone}</Text>
          </View>
        )}
        
        {order.deliveryAddress && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{order.deliveryAddress}</Text>
          </View>
        )}
        
        {order.deliveryNote && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Delivery Instruction:</Text>
            <Text style={styles.infoValue}>{order.deliveryNote}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderProductInfo = () => {
    // Filter products into discounted and non-discounted groups
    const discountedItems = order.orderItems?.filter((item: OrderItem) => 
      item.originalPriceSnapshot && 
      parseFloat(item.originalPriceSnapshot) > (item.pricePerPackage || item.unitPrice || 0)
    ) || [];
    
    const nonDiscountedItems = order.orderItems?.filter((item: OrderItem) => 
      !item.originalPriceSnapshot || 
      parseFloat(item.originalPriceSnapshot) <= (item.pricePerPackage || item.unitPrice || 0)
    ) || [];

    const renderProductItem = (item: OrderItem, index: number) => (
      <View key={item.id || index} style={styles.productRow}>
        <View style={styles.productImageContainer}>
          {item.images?.[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Package size={32} color="#9CA3AF" />
            </View>
          )}
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          <Text style={styles.productSpecs}>
            {item.piecesPerPackage} pieces
          </Text>
          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              {item.originalPriceSnapshot && 
                parseFloat(item.originalPriceSnapshot) > (item.pricePerPackage || item.unitPrice) ? (
                <>
                  <Text style={styles.originalPrice}>
                    {formatCurrency(parseFloat(item.originalPriceSnapshot))} per {item.packageType}
                  </Text>
                  <Text style={styles.discountedPrice}>
                    {formatCurrency(item.pricePerPackage || item.unitPrice)} per {item.packageType}
                  </Text>
                </>
              ) : (
                <Text style={styles.productPrice}>
                  {formatCurrency(item.pricePerPackage || item.unitPrice)} per {item.packageType}
                </Text>
              )}
            </View>
            <View style={{alignItems: 'flex-end', flexDirection: 'row', gap: 6}}>
              {(() => {
                // Try both promotionDetails and promotionDetailsSnapshot
                const promotionDetails = item.promotionDetails || item.promotionDetailsSnapshot;
                
                // Parse promotionDetailsSnapshot if it's a string
                let parsedPromotionDetails: { minQuantity: number; freeQuantity: number } | null = null;
                if (typeof promotionDetails === 'string') {
                  try {
                    parsedPromotionDetails = JSON.parse(promotionDetails);
                  } catch (e) {
                    // Failed to parse, continue without promotion details
                  }
                } else if (promotionDetails && typeof promotionDetails === 'object') {
                  parsedPromotionDetails = promotionDetails;
                }
                
                if (parsedPromotionDetails) {
                  const minQty = parsedPromotionDetails.minQuantity || 1;
                  const freeQty = parsedPromotionDetails.freeQuantity || 0;
                  const qualifyingSets = Math.floor((item.packageQuantity || item.quantity || 1) / minQty);
                  const totalFreeItems = qualifyingSets * freeQty;
                  
                  if (totalFreeItems > 0) {
                    return (
                      <View style={styles.promotionGiftBadge}>
                        <Gift size={12} color="#9333EA" />
                        <Text style={styles.promotionGiftText}>
                          +{totalFreeItems} Free
                        </Text>
                      </View>
                    );
                  }
                }
                return null;
              })()}
              <Text style={styles.quantityBadge}>x{item.packageQuantity || item.quantity || 1}</Text>
            </View>
          </View>
        </View>
      </View>
    );

    return (
      <View style={styles.section}>
        <View style={styles.productCard}>
          <View style={styles.sectionTitleContainer}>
            <Package size={20} color="#0a61d7" />
            <Text style={styles.sectionTitle}>Product Information</Text>
          </View>
          
          {/* Discounted Products Section */}
          {discountedItems.length > 0 && (
            <>
              {discountedItems.map(renderProductItem)}
            </>
          )}
          
          {/* Non-Discounted Products Section */}
          {nonDiscountedItems.length > 0 && (
            <>
              {nonDiscountedItems.map(renderProductItem)}
            </>
          )}
          
          {order.shippingFee !== undefined && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Shipping Fee:</Text>
              <Text style={styles.feeValue}>
                {formatCurrency(order.shippingFee)}
              </Text>
            </View>
          )}
          
          <View style={styles.orderTotal}>
            <Text style={styles.orderTotalText}>Order Total: {formatCurrency(order.totalAmount || order.total || 0)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSupportCenter = () => (
    <View style={styles.section}>
      <View style={styles.productCard}>
        <View style={styles.sectionTitleContainer}>
          <HelpCircle size={20} color="#0a61d7" />
          <Text style={styles.sectionTitle}>Support Center</Text>
        </View>
        
        <TouchableOpacity style={styles.supportItem}>
          <RotateCcw size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Request for Return/Refund</Text>
            <Text style={styles.supportSubtitle}>You can request return/refund until 11 Oct</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <View style={styles.supportDivider} />
        
        <TouchableOpacity style={styles.supportItem}>
          <MessageCircle size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Contact Seller</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <View style={styles.supportDivider} />
        
        <TouchableOpacity style={styles.supportItem}>
          <HelpCircle size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Help Center</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOrderIdInfo = () => {
    const orderInfoItems = [
      {
        key: 'orderId',
        label: 'Order ID:',
        value: order.orderId,
        isSpecial: true,
        render: () => (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID:</Text>
            <View style={styles.orderIdContainer}>
              <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
                {order.orderId}
              </Text>
              <TouchableOpacity onPress={copyOrderId} style={styles.copyButton}>
                <Copy size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
        )
      },
      {
        key: 'paymentTerms',
        label: 'Paid by:',
        value: order.paymentTerms,
        condition: order.paymentTerms
      },
      {
        key: 'invoice',
        label: 'Invoice:',
        value: 'View',
        isSpecial: true,
        render: () => (
          <TouchableOpacity style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invoice:</Text>
            <Text style={styles.infoValue}>View</Text>
            <ChevronRight size={14} color="#6b7280" />
          </TouchableOpacity>
        )
      },
      {
        key: 'orderTime',
        label: 'Order Time:',
        value: order.orderDate ? new Date(order.orderDate).toLocaleString() : null,
        condition: order.orderDate
      },
      {
        key: 'paymentTime',
        label: 'Payment Time:',
        value: order.updatedAt ? new Date(order.updatedAt).toLocaleString() : null,
        condition: order.paymentStatus === 'Paid' && order.updatedAt
      },
      {
        key: 'shipTime',
        label: 'Ship Time:',
        value: order.updatedAt ? new Date(order.updatedAt).toLocaleString() : null,
        condition: order.orderStatus === 'Shipped' && order.updatedAt
      },
      {
        key: 'completedTime',
        label: 'Completed Time:',
        value: order.updatedAt ? new Date(order.updatedAt).toLocaleString() : null,
        condition: order.orderStatus === 'Delivered' && order.updatedAt
      }
    ];

    const visibleItems = orderInfoItems.filter(item => item.condition !== false);
    const itemsToShow = showAllOrderInfo ? visibleItems : visibleItems.slice(0, 2);
    const hasMoreItems = visibleItems.length > 2;

    return (
      <View style={styles.section}>
        <View style={styles.productCard}>
          <View style={styles.sectionTitleContainer}>
            <FileText size={20} color="#0a61d7" />
            <Text style={styles.sectionTitle}>Order ID Information</Text>
          </View>
          
          {itemsToShow.map((item, index) => {
            if (item.isSpecial && item.render) {
              return <View key={item.key}>{item.render()}</View>;
            }
            
            return (
              <View key={item.key} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            );
          })}
          
          {hasMoreItems && (
            <TouchableOpacity 
              style={styles.viewMoreButton}
              onPress={() => setShowAllOrderInfo(!showAllOrderInfo)}
            >
              <Text style={styles.viewMoreText}>
                {showAllOrderInfo ? 'View Less' : 'View More'}
              </Text>
              {showAllOrderInfo ? (
                <ChevronUp size={16} color="#6b7280" />
              ) : (
                <ChevronDown size={16} color="#6b7280" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handlePayOrder = () => {
    Alert.alert('Pay Order', 'Payment functionality coming soon!');
  };

  const handleCancelOrder = () => {
    router.push(`/components/ordersshipment/OrderCancelModal?orderId=${order.orderId}`);
  };

  const renderBottomBar = () => {
    // Pending payment - show Pay Order and Cancel Order
    if (order.orderStatus === 'Pending' && order.paymentStatus === 'Unpaid') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={handlePayOrder}>
            <Text style={styles.payButtonText}>Pay Order</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Received - show Return/Refund and Rate
    if (isReceived) {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.returnButton}>
            <Text style={styles.returnButtonText}>Return/Refund</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateButton} onPress={handleRateOrder}>
            <Star size={16} color="#ffffff" />
            <Text style={styles.rateButtonText}>Rate</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // All other statuses - show Return/Refund and Order Received (disabled unless delivered)
    const isOrderReceivedEnabled = order.orderStatus === 'Delivered';
    
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.returnButton}>
          <Text style={styles.returnButtonText}>Return/Refund</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.orderReceivedButton, 
            !isOrderReceivedEnabled && styles.disabledButton
          ]} 
          onPress={isOrderReceivedEnabled ? handleOrderReceived : undefined}
          disabled={!isOrderReceivedEnabled}
        >
          <Text style={[
            styles.orderReceivedButtonText,
            !isOrderReceivedEnabled && styles.disabledButtonText
          ]}>
            Order Received
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderOrderShippingInfo()}
        {renderProductInfo()}
        {renderSupportCenter()}
        {renderOrderIdInfo()}
      </ScrollView>
      
      {renderBottomBar()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  orderStatusBanner: {
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  shippingTitleContainer: {
    backgroundColor: '#0a61d7',
    borderRadius: 8,
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  shippingTitle: {
    color: '#ffffff',
  },
  deliveryStatusContainer: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  deliveryMethodText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deliveryStatusText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  chevronButton: {
    padding: 4,
    marginLeft: 8,
  },
  deliveryDateTimeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  shippingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shippingText: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  deliveryTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryDetails: {
    marginLeft: 8,
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  address: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    marginBottom: 12,
  },
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionsContent: {
    marginLeft: 8,
    flex: 1,
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  instructionsText: {
    fontSize: 14,
    color: '#111827',
  },
  itemCardMargin: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  itemSpecs: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  itemTotalPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#6B7280',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  supportContent: {
    flex: 1,
    marginLeft: 12,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  supportDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  orderIdText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  copyText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceText: {
    fontSize: 14,
    color: '#0a61d7',
    marginRight: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  returnButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  orderReceivedButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0a61d7',
    borderRadius: 8,
    alignItems: 'center',
  },
  orderReceivedButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#ffffff',
    opacity: 0.7,
  },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    gap: 8,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ef4444',
  },
  payButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0a61d7',
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 4,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  orderTotal: {
    marginTop: 0,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  orderTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 16,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  productSpecs: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#0a61d7',
    fontWeight: '500',
    marginBottom: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityBadge: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  freeText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 16,
  },
  promotionGiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },
  promotionGiftText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9333EA',
  },
  priceContainer: {
    flex: 1,
  },
  originalPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  discountedPrice: {
    fontSize: 14,
    color: '#0a61d7',
    fontWeight: '600',
  },
  discountSectionHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  discountSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  discountSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
});
