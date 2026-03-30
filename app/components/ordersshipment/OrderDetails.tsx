import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Building2,
  ArrowLeft,
} from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { websocketService } from '../../../services/websocket';
import { calculateOrderItemPromotion } from '../../../utils/promotionUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OrderItem {
  id: string;
  productId?: string;
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
  variantName?: string;
  variantNameSnapshot?: string;
  moq?: number;
  promotionDetails?: {
    minQuantity: number;
    freeQuantity: number;
  };
  promotionDetailsSnapshot?: string;
  originalPriceSnapshot?: number;
}

interface ShippingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  method?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

interface DeliveryInfo {
  recipientName: string;
  phone: string;
  address: string;
  deliveryInstructions?: string;
}

interface OrderCompanyInfo {
  name?: string;
  companyName?: string;
  industryType?: string;
  businessAddress?: string;
  pickupAddress?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

interface OrderUserInfo {
  firstName?: string;
  lastName?: string;
  company?: OrderCompanyInfo;
}

interface Order {
  id: string;
  orderId: string;
  status: 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | 'Received' | 'Failed';
  orderStatus: 'Pending' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | 'Received' | 'Failed';
  orderDate: string;
  paymentMethod: string;
  paymentStatus: 'Unpaid' | 'Paid';
  paymentTerms: string;
  invoiceUrl?: string;
  items: OrderItem[];
  shippingInfo: ShippingInfo;
  totalAmount: number;
  total: number;
  shippingFee: number;
  orderItems?: OrderItem[];
  contactPerson: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryNote?: string;
  assignedLogistics?: string;
  trackingNumber?: string;
  updatedAt: string;
  receivedAt?: string | null;
  user?: OrderUserInfo;
  deliveryMethod?: string;
  preferredDeliveryDate?: string;
  preferredDeliveryTime?: string;
  preferredPickupDate?: string;
  preferredPickupTime?: string;
  shippingMethodLabel?: string;
  shippingMethod?: string;
  deliveryOption?: string;
  estimatedDeliveryDate?: string | null;
  estimatedDeliveryMinDays?: number | null;
  estimatedDeliveryMaxDays?: number | null;
  /** Fallback from distributor's shipping option when order has no estimated duration */
  shippingOptionMinDays?: number | null;
  shippingOptionMaxDays?: number | null;
  returnStatus?: 'Accepted' | 'Rejected' | null;
  returnRequests?: {
    id?: number;
    status: 'Pending' | 'Accepted' | 'Rejected';
    reason?: string | null;
    reasonDetail?: string | null;
    createdAt?: string;
  }[];
}

interface OrderDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  order: Order;
  onUpdateOrderStatus?: (orderId: string, status: string) => void;
}

export default function OrderDetailsModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { token, user } = useAuthStore();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceived, setIsReceived] = useState(false);
  const [isMarkingReceived, setIsMarkingReceived] = useState(false);
  const [showAllOrderInfo, setShowAllOrderInfo] = useState(false);
  const [productMOQs, setProductMOQs] = useState<Record<string, number | null>>({});

  const fetchOrderDetails = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const orderData: Order = await response.json();
        
        // Map variantNameSnapshot to variantName for each order item
        if (orderData?.orderItems) {
          orderData.orderItems = orderData.orderItems.map((item: OrderItem) => ({
            ...item,
            variantName: item.variantNameSnapshot || item.variantName
          }));
        }
        
        setOrder(orderData);
        setIsReceived(orderData?.orderStatus === 'Received');
        
        // Fetch MOQ data for all products in the order
        if (orderData?.orderItems) {
          await fetchProductMOQs(orderData.orderItems);
        }
      } else {
        setOrder(null);
      }
    } catch (error) {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (params.orderId && typeof params.orderId === 'string') {
      fetchOrderDetails(params.orderId);
    }
  }, [params.orderId, fetchOrderDetails]);

  // Subscribe to WebSocket for real-time order updates
  useEffect(() => {
    const orderId = params.orderId;
    if (!orderId || typeof orderId !== 'string') return;

    const unsubscribe = websocketService.subscribe((message) => {
      // Check if this order was updated
      if (message.type === 'order_updated' && message.orderIds?.includes(orderId)) {
        // Fetch updated order details
        fetchOrderDetails(orderId);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [params.orderId, fetchOrderDetails]);

  const fetchProductMOQs = async (orderItems: OrderItem[]) => {
    try {
      // Extract MOQ from promotion details only - no fallback estimated values
      const moqMap: Record<string, number | null> = {};
      
      orderItems.forEach((item) => {
        if (item.productId) {
          let actualMOQ: number | null = null;
          
          // Only get MOQ from promotion details - if no MOQ stated, everything is orderable
          if (item.promotionDetailsSnapshot) {
            try {
              const promotionDetails = JSON.parse(item.promotionDetailsSnapshot);
              actualMOQ = promotionDetails.moq || null;
            } catch (e) {
              // If parsing fails, no MOQ restriction
              actualMOQ = null;
            }
          }
          
          moqMap[item.productId] = actualMOQ;
        }
      });
      
      setProductMOQs(moqMap);
    } catch (error) {
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
      case 'failed':
        return 'Delivery Failed';
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
      case 'failed':
        return 'Delivery could not be completed';
      case 'pending':
        return 'Your order is being processed';
      default:
        return 'Your order is being processed';
    }
  };

  const handleOrderReceived = async () => {
    if (!order) return;
    setIsMarkingReceived(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/${orderData.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'Received' })
      });
      
      if (response.ok) {
        setIsReceived(true);
        setOrder((prev: Order | null) =>
          prev ? { ...prev, status: 'Received', orderStatus: 'Received' } : null
        );
        Alert.alert('Success', 'Order marked as received successfully!');
      } else {
        Alert.alert('Error', 'Failed to update order status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setIsMarkingReceived(false);
    }
  };

  const handleRateOrder = () => {
    if (!order) return;

    const orderData = order as Order;
    const items = orderData.orderItems ?? orderData.items ?? [];
    const reviewItems = items
      .filter((item: OrderItem) => item.productId)
      .map((item: OrderItem) => ({
      productId: String(item.productId),
      productName: item.productName ?? item.name ?? 'Product',
      image: (item.images && item.images[0]) ? item.images[0] : (item.image ?? ''),
    }));

    router.push({
      pathname: '/components/productcatalog/ProductReview',
      params: {
        orderId: orderData.orderId,
        itemsJson: JSON.stringify(reviewItems),
      },
    });
  };

  const copyOrderId = () => {
    Clipboard.setString(orderData.orderId);
    Alert.alert('Copied', 'Order ID copied to clipboard');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatShippingOptionLabel = (value: string) => {
    if (!value) return '';
    return value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const formatScheduledDateTime = (dateInput?: string, timeInput?: string) => {
    if (!dateInput && !timeInput) {
      return null;
    }

    const dateStr = dateInput?.trim();
    const timeStr = timeInput?.trim();

    const tryFormat = (value: string) => {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      }
      return null;
    };

    if (dateStr && timeStr) {
      const combined = dateStr.includes('T') ? dateStr : `${dateStr}T${timeStr}`;
      const formatted = tryFormat(combined);
      if (formatted) {
        return formatted;
      }
    }

    if (dateStr) {
      const formattedDate = tryFormat(dateStr);
      if (formattedDate) {
        return formattedDate;
      }
    }

    const fallbackParts: string[] = [];
    if (dateStr) {
      fallbackParts.push(dateStr);
    }
    if (timeStr) {
      fallbackParts.push(timeStr);
    }

    return fallbackParts.join(' ');
  };

  const getShippingDetails = () => {
    const shippingInfo = orderData.shippingInfo;
    const fallbackMethodRaw =
      orderData.shippingMethodLabel ||
      orderData.shippingMethod ||
      orderData.deliveryOption ||
      orderData.deliveryMethod ||
      null;
    const method = shippingInfo?.method || fallbackMethodRaw;

    const lowerMethod = method?.toLowerCase() || '';
    const isPickup = lowerMethod.includes('pickup') || lowerMethod.includes('self');
    const isBuyerCourier = lowerMethod.includes('courier') || lowerMethod.includes('buyer-arranged') || lowerMethod.includes('buyer arranged');
    const isSellerDelivery = lowerMethod.includes('seller') || lowerMethod.includes('distributor');

    const preferredDate = shippingInfo?.scheduledDate
      || (isPickup ? orderData.preferredPickupDate : orderData.preferredDeliveryDate)
      || orderData.preferredDeliveryDate
      || orderData.preferredPickupDate
      || null;

    const preferredTime = shippingInfo?.scheduledTime
      || (isPickup ? orderData.preferredPickupTime : orderData.preferredDeliveryTime)
      || orderData.preferredDeliveryTime
      || orderData.preferredPickupTime
      || null;

    const dateTimeText = formatScheduledDateTime(preferredDate || undefined, preferredTime || undefined);

    // Always produce a scheduling status line
    let scheduleStatusText: string;
    if (dateTimeText) {
      if (isPickup) {
        scheduleStatusText = `Pickup scheduled: ${dateTimeText}`;
      } else if (isBuyerCourier) {
        scheduleStatusText = `Courier pickup: ${dateTimeText}`;
      } else {
        scheduleStatusText = `Delivery scheduled: ${dateTimeText}`;
      }
    } else {
      if (isPickup) {
        scheduleStatusText = 'No specific pickup date set';
      } else if (isBuyerCourier) {
        scheduleStatusText = 'No specific date, managed by buyer';
      } else if (isSellerDelivery) {
        scheduleStatusText = 'No specific date, distributor manages the schedule';
      } else {
        scheduleStatusText = 'No specific date set';
      }
    }

    return {
      methodLabel: method ? formatShippingOptionLabel(method) : null,
      scheduleStatusText,
    };
  };

  const calculateProductTotal = () => {
    const items = Array.isArray(orderData.orderItems) ? orderData.orderItems : [];
    return items.reduce((total, item) => {
      let computedTotal: number | null = null;

      if (typeof item.totalPrice === 'number') {
        computedTotal = item.totalPrice;
      } else if (typeof item.totalPrice === 'string') {
        const parsed = parseFloat(item.totalPrice);
        computedTotal = Number.isFinite(parsed) ? parsed : null;
      }

      if (computedTotal === null) {
        const quantity = item.packageQuantity ?? item.quantity ?? 1;
        const price =
          (typeof item.pricePerPackage === 'number' ? item.pricePerPackage : Number(item.pricePerPackage)) ||
          item.unitPrice ||
          0;
        computedTotal = Number.isFinite(price * quantity) ? price * quantity : 0;
      }

      return total + (computedTotal || 0);
    }, 0);
  };


  const renderOrderShippingInfo = () => {
    const latestReturnRequest =
      Array.isArray(orderData.returnRequests) && orderData.returnRequests.length > 0
        ? [...orderData.returnRequests].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })[0]
        : null;

    const returnStatusColors = latestReturnRequest
      ? (() => {
          switch (latestReturnRequest.status) {
            case 'Pending':
              return {
                backgroundColor: '#fef9c3', // soft yellow
                textColor: '#854d0e',
              };
            case 'Accepted':
              return {
                backgroundColor: '#16a34a', // strong green
                textColor: '#ffffff',
              };
            case 'Rejected':
              return {
                backgroundColor: '#b91c1c', // strong red
                textColor: '#ffffff',
              };
            default:
              return {
                backgroundColor: '#f8fafc',
                textColor: '#111827',
              };
          }
        })()
      : null;

    return (
      <View style={styles.section}>
        <View style={styles.productCard}>
          <View style={[styles.sectionTitleContainer, styles.shippingTitleContainer]}>
            <Text style={[styles.sectionTitle, styles.shippingTitle]}>{getStatusText(orderData.orderStatus)}</Text>
          </View>

          {['Received', 'Returned'].includes(orderData.orderStatus) && latestReturnRequest && returnStatusColors && (
            <View
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                backgroundColor: returnStatusColors.backgroundColor,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: returnStatusColors.textColor,
                  fontWeight: '500',
                }}
              >
                {latestReturnRequest.status === 'Pending' &&
                  'You have requested a return. Please wait for distributor confirmation.'}
                {latestReturnRequest.status === 'Accepted' &&
                  'Your return request has been accepted. We are processing your return/refund.'}
                {latestReturnRequest.status === 'Rejected' &&
                  'Your return request was rejected. If you need help, please contact support.'}
              </Text>
            </View>
          )}
        
          {/* Delivery Status Information */}
          <View style={styles.deliveryStatusContainer}>
            {(() => {
            const hideEstimated = ['Delivered', 'Returned', 'Cancelled', 'Failed'].includes(orderData.orderStatus);
            if (hideEstimated) return null;

            // Use order-level duration if distributor set it; otherwise fall back to shipping option duration from company
            const minDays = orderData.estimatedDeliveryMinDays ?? orderData.shippingOptionMinDays;
            const maxDays = orderData.estimatedDeliveryMaxDays ?? orderData.shippingOptionMaxDays;
            const hasRange = minDays != null || maxDays != null;
            const rangeText = hasRange
              ? minDays != null && maxDays != null
                ? `${minDays}–${maxDays} business days`
                : minDays != null
                  ? `${minDays}+ business days`
                  : maxDays != null
                    ? `Up to ${maxDays} business days`
                    : '—'
              : '—';
            const estimatedDateText = orderData.estimatedDeliveryDate
              ? new Date(orderData.estimatedDeliveryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Pending';

              return (
                <View style={styles.estimatedDeliveryBlock}>
                <View style={styles.deliveryEstimatedRangeRow}>
                  <Text style={styles.deliveryEstimatedRangeLabel}>Estimated delivery date: </Text>
                  <Text style={styles.deliveryEstimatedRangeValue}>{estimatedDateText}</Text>
                </View>
                <View style={styles.deliveryEstimatedRangeRow}>
                  <Text style={styles.deliveryEstimatedRangeLabel}>Estimated delivery: </Text>
                  <Text style={styles.deliveryEstimatedRangeValue}>{rangeText}</Text>
                </View>
                </View>
              );
            })()}
            <View style={styles.deliveryStatusRow}>
              <Truck size={16} color="#10b981" />
              <Text style={styles.deliveryStatusText}>
                {getDeliveryStatusDescription(orderData.orderStatus)}
              </Text>
              <TouchableOpacity 
                style={styles.chevronButton}
                onPress={() => router.push({
                  pathname: '/components/ordersshipment/DeliveryInformation',
                  params: { orderId: orderData.orderId }
                })}
              >
                <ChevronRight size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {orderData.updatedAt && (
              <Text style={styles.deliveryDateTimeText}>
                {new Date(orderData.updatedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit', 
                  year: 'numeric'
                })} {new Date(orderData.updatedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </Text>
            )}
          </View>
          
          {orderData.assignedLogistics && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigned Logistics:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.assignedLogistics}
              </Text>
            </View>
          )}
          
          {orderData.contactPerson && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recipient:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.contactPerson}
              </Text>
            </View>
          )}
          
          {orderData.contactPhone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.contactPhone}
              </Text>
            </View>
          )}
          
          {orderData.deliveryAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]} numberOfLines={1} ellipsizeMode="tail">
                {orderData.deliveryAddress}
              </Text>
            </View>
          )}
          
          {orderData.deliveryNote && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Instruction:</Text>
              <Text
                style={[styles.infoValue, styles.infoValueWide]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {orderData.deliveryNote}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderProductInfo = () => {
    // Filter products into discounted and non-discounted groups
    const discountedItems = orderData.orderItems?.filter((item: OrderItem) => 
      item.originalPriceSnapshot && 
      item.originalPriceSnapshot > (item.pricePerPackage || item.unitPrice || 0)
    ) || [];
    
    const nonDiscountedItems = orderData.orderItems?.filter((item: OrderItem) => 
      !item.originalPriceSnapshot || 
      item.originalPriceSnapshot <= (item.pricePerPackage || item.unitPrice || 0)
    ) || [];

    const renderProductItem = (item: OrderItem, index: number) => (
      <View key={item.id || index} style={styles.productRow}>
        <View style={styles.productImageContainer}>
          {item.images && item.images.length > 0 && item.images[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Package size={32} color="#9CA3AF" />
            </View>
          )}
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName || item.name}
          </Text>
          {item.variantName ? (
            <Text style={styles.variantName} numberOfLines={2}>
              {item.variantName}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              {item.originalPriceSnapshot && 
                item.originalPriceSnapshot > (item.pricePerPackage || item.unitPrice) ? (
                <>
                  <Text style={styles.originalPrice}>
                    {formatCurrency(item.originalPriceSnapshot)}
                  </Text>
                  <Text style={styles.discountedPrice}>
                    {formatCurrency(item.pricePerPackage || item.unitPrice)}
                  </Text>
                </>
              ) : (
                <Text style={styles.productPrice}>
                  {formatCurrency(item.pricePerPackage || item.unitPrice)}
                </Text>
              )}
            </View>
            <View style={{alignItems: 'flex-end', flexDirection: 'row', gap: 6}}>
              {(() => {
                // Calculate promotion using standardized function for order items
                const promotionDetails = item.promotionDetails || item.promotionDetailsSnapshot;
                const piecesPerPackage = item.piecesPerPackage || 1;
                const quantity = item.packageQuantity || item.quantity || 1;
                
                // Extract MOQ directly from this item's promotion details (variant-specific)
                let moq: number | null = null;
                if (promotionDetails) {
                  try {
                    const parsed = typeof promotionDetails === 'string' 
                      ? JSON.parse(promotionDetails) 
                      : promotionDetails;
                    moq = parsed.moq || null;
                  } catch (e) {
                    moq = null;
                  }
                }
                
                const promotionGift = calculateOrderItemPromotion(
                  promotionDetails,
                  quantity,
                  piecesPerPackage,
                  moq
                );
                
                if (promotionGift) {
                  return (
                    <View style={styles.promotionGiftBadge}>
                      <Gift size={12} color="#9333EA" />
                      <Text style={styles.promotionGiftText}>
                        +{promotionGift.freeQty} Free pieces
                      </Text>
                    </View>
                  );
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
          
          {orderData.orderItems && orderData.orderItems.length > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Product Total</Text>
              <Text style={styles.summaryValue}>{formatCurrency(calculateProductTotal())}</Text>
            </View>
          ) : null}

          {(() => {
            const { methodLabel, scheduleStatusText } = getShippingDetails();
            return (
              <View style={styles.feeRow}>
                <Text style={styles.feeSectionTitle}>Shipping</Text>
                <View style={styles.feeDetailsWrapper}>
                  <View style={styles.feeMethodRow}>
                    <Text style={styles.shippingMethodLabel} numberOfLines={1}>
                      {methodLabel || 'Method not specified'}
                    </Text>
                    <Text style={[styles.feeValue, { color: '#6B7280', fontSize: 12 }]}>
                      Cost agreed separately
                    </Text>
                  </View>
                  <Text style={styles.shippingMethodSchedule} numberOfLines={2}>
                    {scheduleStatusText}
                  </Text>
                </View>
              </View>
            );
          })()}
          
          <View style={styles.orderTotal}>
            <Text style={styles.orderTotalText}>Order Total: {formatCurrency(orderData.totalAmount || orderData.total || 0)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDistributorInfo = () => {
    const company = orderData.user?.company;

    if (!company) {
      return null;
    }

    const distributorCompanyName = company.name || company.companyName;
    const distributorName = company.companyName;
    const industryType = company.industryType;
    const contactPerson = company.contactPerson;
    const phoneNumber = company.phone;
    const email = company.email;
    const address = company.pickupAddress || company.businessAddress;

    if (!distributorCompanyName && !distributorName && !industryType && !contactPerson && !phoneNumber && !email && !address) {
      return null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.productCard}>
          <View style={styles.sectionTitleContainer}>
            <Building2 size={20} color="#0a61d7" />
            <Text style={styles.sectionTitle}>Distributor Information</Text>
          </View>

          {distributorCompanyName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {distributorCompanyName}
              </Text>
            </View>
          )}

          {distributorName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {distributorName}
              </Text>
            </View>
          )}

          {industryType && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Industry:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {industryType}
              </Text>
            </View>
          )}

          {contactPerson && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {contactPerson}
              </Text>
            </View>
          )}

          {phoneNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {phoneNumber}
              </Text>
            </View>
          )}

          {email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {email}
              </Text>
            </View>
          )}

          {address && (
            <View style={styles.infoRowTopAligned}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={[styles.infoValueMultiline, styles.distributorValueMultiline]}>
                {address}
              </Text>
            </View>
          )}
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
        
        <TouchableOpacity
          style={styles.supportItem}
          onPress={() =>
            router.push({
              pathname: '/components/ordersshipment/ReturnRefundInfo',
              params: { orderId: orderData.orderId },
            })
          }
        >
          <RotateCcw size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Request for Return/Refund</Text>
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
        
        <TouchableOpacity
          style={styles.supportItem}
          onPress={() =>
            router.push({
              pathname: '/components/ordersshipment/OrderHelpCenter',
              params: { orderId: orderData.orderId },
            })
          }
        >
          <HelpCircle size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Help Center</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>

        {orderData.orderStatus === 'Returned' && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>Return/refund status</Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color:
                  orderData.returnStatus === 'Accepted'
                    ? '#16a34a'
                    : orderData.returnStatus === 'Rejected'
                    ? '#dc2626'
                    : '#f59e0b',
              }}
            >
              {orderData.returnStatus || 'Pending review'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderOrderIdInfo = () => {
    const orderInfoItems = [
      {
        key: 'orderId',
        label: 'Order ID:',
        value: orderData.orderId,
        isSpecial: true,
        render: () => (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID:</Text>
            <View style={styles.orderIdContainer}>
              <Text
                style={[styles.infoValue, styles.infoValueMedium]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {orderData.orderId}
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
        value: orderData.paymentTerms,
        condition: orderData.paymentTerms
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
        value: orderData.orderDate ? new Date(orderData.orderDate).toLocaleString() : null,
        condition: orderData.orderDate
      },
      {
        key: 'paymentTime',
        label: 'Payment Time:',
        value: orderData.updatedAt ? new Date(orderData.updatedAt).toLocaleString() : null,
        condition: orderData.paymentStatus === 'Paid' && orderData.updatedAt
      },
      {
        key: 'shipTime',
        label: 'Ship Time:',
        value: orderData.updatedAt ? new Date(orderData.updatedAt).toLocaleString() : null,
        condition: orderData.orderStatus === 'Shipped' && orderData.updatedAt
      },
      {
        key: 'completedTime',
        label: 'Completed Time:',
        value: orderData.updatedAt ? new Date(orderData.updatedAt).toLocaleString() : null,
        condition: orderData.orderStatus === 'Delivered' && orderData.updatedAt
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
              <Text style={[styles.infoValue, styles.infoValueMedium]}>{item.value}</Text>
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
    router.push(`/components/ordersshipment/OrderCancelModal?orderId=${orderData.orderId}`);
  };

  const renderBottomBar = () => {
    // Pending payment - show Pay Order and Cancel Order
    if (orderData.orderStatus === 'Pending' && orderData.paymentStatus === 'Unpaid') {
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

    const handleReturnRefund = () => {
      router.push(`/components/ordersshipment/ReturnRefundModal?orderId=${orderData.orderId}`);
    };

    // Received - show Return/Refund and Rate
    if (isReceived) {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.returnButton} onPress={handleReturnRefund}>
            <Text style={styles.returnButtonText}>Return/Refund</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateButton} onPress={handleRateOrder}>
            <Star size={16} color="#ffffff" />
            <Text style={styles.rateButtonText}>Rate</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Failed - delivery could not be completed; show Contact support
    if (orderData.orderStatus === 'Failed') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.contactSupportButton}
            onPress={() => Alert.alert('Contact Support', 'Support functionality coming soon!')}
          >
            <Text style={styles.contactSupportButtonText}>Contact support</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Delivered (not yet received) - Return/Refund disabled until received; Order Received right; after pressing Order Received, UI shows Rate
    if (orderData.orderStatus === 'Delivered') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.returnButton, styles.disabledButton]}
            disabled
          >
            <Text style={[styles.returnButtonText, styles.disabledButtonText]}>Return/Refund</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.orderReceivedButton, isMarkingReceived && styles.disabledButton]}
            onPress={handleOrderReceived}
            disabled={isMarkingReceived}
          >
            {isMarkingReceived ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.orderReceivedButtonText}>Order Received</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Cancelled - nothing to do; show go back
    if (orderData.orderStatus === 'Cancelled') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackButtonText}>Back to Orders</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Returned - show only Return/Refund and Rate (no Cancel Order or Order Received)
    if (orderData.orderStatus === 'Returned') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.returnButton} onPress={handleReturnRefund}>
            <Text style={styles.returnButtonText}>Return/Refund</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateButton} onPress={handleRateOrder}>
            <Star size={16} color="#ffffff" />
            <Text style={styles.rateButtonText}>Rate</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Before delivery (Pending paid, Confirmed, Packed, Shipped) - show Cancel Order and Order Received (disabled)
    const isOrderReceivedEnabled = false;
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
          <Text style={styles.cancelButtonText}>Cancel Order</Text>
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
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Order not found</Text>
        </View>
      </View>
    );
  }

  // TypeScript assertion that order is not null after the check above
  const orderData = order as Order;

  const primaryBlue = '#0a61d7';
  
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
              <View style={styles.headerContent}>
                <TouchableOpacity 
                  onPress={() => router.back()} 
                  hitSlop={10}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Details</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderOrderShippingInfo()}
        {renderDistributorInfo()}
        {renderProductInfo()}
        {renderOrderIdInfo()}
        {renderSupportCenter()}
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
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 35,
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
  estimatedDeliveryBlock: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  deliveryEstimatedRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  deliveryEstimatedRangeLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 4,
  },
  deliveryEstimatedRangeValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
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
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flexShrink: 0,
    marginRight: 20,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoRowTopAligned: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
    gap: 12,
  },
  infoValueMultiline: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  infoValueSmall: {
    minWidth: 140,
    textAlign: 'right',
  },
  infoValueMedium: {
    minWidth: 180,
    textAlign: 'right',
  },
  infoValueWide: {
    minWidth: 220,
    textAlign: 'right',
  },
  distributorValue: {
    minWidth: 220,
    textAlign: 'right',
  },
  distributorValueMultiline: {
    minWidth: 220,
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
    flex: 1,
    justifyContent: 'flex-end',
    gap: 12,
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
  goBackButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    alignItems: 'center',
  },
  goBackButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
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
  contactSupportButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0a61d7',
    borderRadius: 8,
    alignItems: 'center',
  },
  contactSupportButtonText: {
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
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 12,
  },
  feeSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  feeDetailsWrapper: {
    flexDirection: 'column',
  },
  feeMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  shippingMethodLabel: {
    fontSize: 13,
    color: '#111827',
    flexShrink: 1,
    marginRight: 12,
  },
  shippingMethodSchedule: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
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
    fontWeight: '700',
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
  variantName: {
    fontSize: 13,
    color: '#111827',
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
    fontSize: 12,
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
