import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useDataStore } from '../../../stores/dataStore';
import { API_BASE_URL } from '../../../services/config';
import { ordersService, type Order as MarketplaceOrder } from '../../../services/orders';
import { websocketService } from '../../../services/websocket';
import { calculateOrderItemPromotion } from '../../../utils/promotionUtils';
import {
  isOrderPricingPending,
  isLinePricingPending,
  lineDisplayAmount,
  moneyAmount,
} from '../../../utils/orderPricingDisplay';
import OrderInvoiceModal from './OrderInvoiceModal';
import { useTranslation } from 'react-i18next';
import { openWhatsApp } from '../../../utils/whatsapp';
import { OrderDetailsSkeleton } from '../SkeletonLoader';
import { useMessagesStore } from '../../../stores/messagesStore';
import { resolveDistributorUserId } from '../../../utils/orderSellerUserId';

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
  businessPhone?: string;
  businessEmail?: string;
  logo?: string;
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
  /** Distributor store name (from order API) */
  storeName?: string;
  subtotal?: number;
  discounts?: number;
  items: OrderItem[];
  shippingInfo: ShippingInfo;
  totalAmount: number;
  total: number;
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
  returnItemsReceivedAt?: string | null;
  returnCollectedAt?: string | null;
  returnRequests?: {
    id?: number;
    status: 'Pending' | 'Accepted' | 'Rejected';
    reason?: string | null;
    reasonDetail?: string | null;
    createdAt?: string;
  }[];
  /** Seller / distributor identifiers from API (order-level fallbacks for distributor detail link) */
  distributorUserId?: number | string | null;
  userId?: number | string | null;
  sellerId?: number | string | null;
  distributorId?: number | string | null;
  sellerUserId?: number | string | null;
}

/** GraphQL order lists expose distributor info on `seller`, not `user.company`. */
function mapSellerIntoOrder(orderData: { seller?: MarketplaceOrder['seller'] }): Order {
  const current = orderData as unknown as Order;
  const company = current.user?.company;
  const hasCompany = Boolean(
    company &&
      (company.name ||
        company.companyName ||
        company.industryType ||
        company.businessPhone ||
        company.businessEmail ||
        company.businessAddress ||
        company.pickupAddress ||
        company.logo),
  );
  const seller = orderData.seller;
  if (!seller || hasCompany) return current;

  return {
    ...current,
    user: {
      ...current.user,
      company: {
        name: seller.companyName || seller.name || undefined,
        companyName: seller.companyName || undefined,
        businessAddress: seller.companyAddress || undefined,
        businessPhone: seller.companyPhone || undefined,
        businessEmail: seller.companyEmail || undefined,
        logo: seller.logo || undefined,
      },
    },
  };
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
  const { t } = useTranslation();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceived, setIsReceived] = useState(false);
  const [isMarkingReceived, setIsMarkingReceived] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [showAllOrderInfo, setShowAllOrderInfo] = useState(false);
  const [productMOQs, setProductMOQs] = useState<Record<string, number | null>>({});
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const fetchGeneration = useRef(0);
  const storedOrders = useDataStore((state) => state.orders);

  const applyOrder = useCallback((fetched: { seller?: MarketplaceOrder['seller'] }) => {
    fetchGeneration.current += 1;
    const orderData = mapSellerIntoOrder(fetched);
    if (orderData.orderItems) {
      orderData.orderItems = orderData.orderItems.map((item: OrderItem) => ({
        ...item,
        variantName: item.variantNameSnapshot || item.variantName,
      }));
    }
    setOrder(orderData);
    setIsReceived(orderData.orderStatus === 'Received');
    setIsLoading(false);
    if (orderData.orderItems) {
      void fetchProductMOQs(orderData.orderItems);
    }
  }, []);

  const fetchOrderDetails = useCallback(async (orderId: string) => {
    const generation = ++fetchGeneration.current;
    try {
      // Buyer-scoped mobile API only — Dashboard /api/orders syncs catalog into Pending POs.
      const userId = user?.id;
      if (!userId) {
        if (generation === fetchGeneration.current) setOrder(null);
        return;
      }
      const fetched = await ordersService.getOrderById(
        orderId,
        userId,
        token || undefined,
      );
      if (generation !== fetchGeneration.current) return;

      if (fetched) {
        applyOrder(fetched);
      } else {
        setOrder(null);
      }
    } catch (error) {
      if (generation === fetchGeneration.current) setOrder(null);
    } finally {
      if (generation === fetchGeneration.current) setIsLoading(false);
    }
  }, [token, user?.id, applyOrder]);

  useEffect(() => {
    if (params.orderId && typeof params.orderId === 'string') {
      fetchOrderDetails(params.orderId);
    }
  }, [params.orderId, fetchOrderDetails]);

  // Detect if this order already has a review (so CTA becomes "Edit review")
  useEffect(() => {
    let cancelled = false;
    const loadExistingReviews = async () => {
      const orderId = params.orderId;
      if (!token || !orderId || typeof orderId !== 'string' || !orderId.trim()) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/mobile/reviews/order?orderId=${encodeURIComponent(orderId.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const json = (await res.json().catch(() => null)) as
          | {
              productReviews?: Array<{ productId: string }>;
              deliveryReview?: { deliveryRating?: number | null; deliveryComment?: string | null } | null;
            }
          | null;
        if (!res.ok || !json) return;
        if (cancelled) return;
        const hasProduct = Array.isArray(json.productReviews) && json.productReviews.length > 0;
        const hasDelivery =
          !!json.deliveryReview &&
          ((typeof json.deliveryReview.deliveryRating === 'number' && json.deliveryReview.deliveryRating > 0) ||
            (typeof json.deliveryReview.deliveryComment === 'string' && json.deliveryReview.deliveryComment.trim().length > 0));
        setHasExistingReview(hasProduct || hasDelivery);
      } catch {
        // best-effort
      }
    };

    void loadExistingReviews();
    return () => {
      cancelled = true;
    };
  }, [token, params.orderId]);

  // Same socket as the orders tab: pricing send, status, and the refreshed order list.
  useEffect(() => {
    const orderId = params.orderId;
    if (!orderId || typeof orderId !== 'string') return;
    if (token) websocketService.connect(token);

    const unsubscribe = websocketService.subscribe((message) => {
      if (message.type === 'order_updated' && message.orderIds?.includes(orderId)) {
        void fetchOrderDetails(orderId);
        return;
      }
      if (message.type !== 'notification' || message.notification?.type !== 'order') return;
      const data = message.notification.data;
      const notifiedOrderId = typeof data?.orderId === 'string' ? data.orderId : '';
      if (notifiedOrderId !== orderId) return;
      void fetchOrderDetails(orderId);
    });

    return () => {
      unsubscribe();
    };
  }, [params.orderId, fetchOrderDetails, token]);

  useEffect(() => {
    const orderId = params.orderId;
    if (!orderId || typeof orderId !== 'string') return;
    const match = storedOrders.find((row) => row.orderId === orderId);
    if (!match) return;
    applyOrder(match as { seller?: MarketplaceOrder['seller']; orderItems?: OrderItem[] });
  }, [storedOrders, params.orderId, applyOrder]);

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
        return t('ordersFlow.orderDetails.statusText.delivered');
      case 'received':
        return t('ordersFlow.orderDetails.statusText.received');
      case 'shipped':
        return t('ordersFlow.orderDetails.statusText.shipped');
      case 'confirmed':
        return t('ordersFlow.orderDetails.statusText.confirmed');
      case 'packed':
        return t('ordersFlow.orderDetails.statusText.packed');
      case 'cancelled':
        return t('ordersFlow.orderDetails.statusText.cancelled');
      case 'returned':
        return t('ordersFlow.orderDetails.statusText.returned');
      case 'failed':
        return t('ordersFlow.orderDetails.statusText.failed');
      default:
        return t('ordersFlow.orderDetails.statusText.pending');
    }
  };

  const getDeliveryStatusDescription = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return t('ordersFlow.orderDetails.statusDescriptions.delivered');
      case 'received':
        return t('ordersFlow.orderDetails.statusDescriptions.received');
      case 'shipped':
        return t('ordersFlow.orderDetails.statusDescriptions.shipped');
      case 'confirmed':
        return t('ordersFlow.orderDetails.statusDescriptions.confirmed');
      case 'packed':
        return t('ordersFlow.orderDetails.statusDescriptions.packed');
      case 'cancelled':
        return t('ordersFlow.orderDetails.statusDescriptions.cancelled');
      case 'returned':
        return t('ordersFlow.orderDetails.statusDescriptions.returned');
      case 'failed':
        return t('ordersFlow.orderDetails.statusDescriptions.failed');
      case 'pending':
        return t('ordersFlow.orderDetails.statusDescriptions.processing');
      default:
        return t('ordersFlow.orderDetails.statusDescriptions.processing');
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
        Alert.alert(t('ordersFlow.orderDetails.alerts.successTitle'), t('ordersFlow.orderDetails.alerts.receivedBody'));
      } else {
        Alert.alert(t('ordersFlow.common.errors.errorTitle'), t('ordersFlow.orderDetails.alerts.updateFailedBody'));
      }
    } catch (error) {
      Alert.alert(t('ordersFlow.common.errors.errorTitle'), t('ordersFlow.orderDetails.alerts.updateFailedBody'));
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
    Alert.alert(t('ordersFlow.orderDetails.alerts.copiedTitle'), t('ordersFlow.orderDetails.alerts.copiedBody'));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const pendingPriceLabel = t('ordersFlow.orderDetails.pendingPrice');
  const formatOrderMoney = (amount: number | null | undefined) =>
    moneyAmount(amount) > 0 ? formatCurrency(moneyAmount(amount)) : pendingPriceLabel;

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
        scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.pickupScheduled', { dateTime: dateTimeText });
      } else if (isBuyerCourier) {
        scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.courierPickup', { dateTime: dateTimeText });
      } else {
        scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.deliveryScheduled', { dateTime: dateTimeText });
      }
    } else {
      if (isPickup) {
          scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.noPickupDate');
      } else if (isBuyerCourier) {
          scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.noSpecificBuyer');
      } else if (isSellerDelivery) {
          scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.noSpecificDistributor');
      } else {
          scheduleStatusText = t('ordersFlow.orderDetails.shippingSchedule.noSpecific');
      }
    }

    return {
      methodLabel: method ? formatShippingOptionLabel(method) : null,
      scheduleStatusText,
    };
  };

  const calculateProductTotal = () => {
    const items = Array.isArray(orderData.orderItems) ? orderData.orderItems : [];
    return items.reduce((total, item) => total + lineDisplayAmount(item), 0);
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
                  t('ordersFlow.orderDetails.returnRequest.pending')}
                {latestReturnRequest.status === 'Accepted' &&
                  (orderData.returnItemsReceivedAt
                    ? t('ordersFlow.orderDetails.returnRequest.acceptedReceived')
                    : t('ordersFlow.orderDetails.returnRequest.accepted'))}
                {latestReturnRequest.status === 'Rejected' &&
                  t('ordersFlow.orderDetails.returnRequest.rejected')}
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
                ? t('ordersFlow.orderDetails.estimatedDelivery.rangeBusinessDays', { min: minDays, max: maxDays })
                : minDays != null
                  ? t('ordersFlow.orderDetails.estimatedDelivery.minPlusBusinessDays', { min: minDays })
                  : maxDays != null
                    ? t('ordersFlow.orderDetails.estimatedDelivery.upToBusinessDays', { max: maxDays })
                    : t('ordersFlow.orderDetails.estimatedDelivery.unknown')
              : t('ordersFlow.orderDetails.estimatedDelivery.unknown');
            const estimatedDateText = orderData.estimatedDeliveryDate
              ? new Date(orderData.estimatedDeliveryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
              : t('ordersFlow.orderDetails.estimatedDelivery.pending');

              return (
                <View style={styles.estimatedDeliveryBlock}>
                <View style={styles.deliveryEstimatedRangeRow}>
                  <Text style={styles.deliveryEstimatedRangeLabel}>{t('ordersFlow.orderDetails.estimatedDelivery.dateLabel')} </Text>
                  <Text style={styles.deliveryEstimatedRangeValue}>{estimatedDateText}</Text>
                </View>
                <View style={styles.deliveryEstimatedRangeRow}>
                  <Text style={styles.deliveryEstimatedRangeLabel}>{t('ordersFlow.orderDetails.estimatedDelivery.rangeLabel')} </Text>
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
                {new Date(orderData.updatedAt).toLocaleDateString('id-ID', {
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
              <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.fields.assignedLogistics')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.assignedLogistics}
              </Text>
            </View>
          )}
          
          {orderData.contactPerson && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.fields.recipient')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.contactPerson}
              </Text>
            </View>
          )}
          
          {orderData.contactPhone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.fields.phone')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueMedium]}>
                {orderData.contactPhone}
              </Text>
            </View>
          )}
          
          {orderData.deliveryAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.fields.address')}:</Text>
              <Text style={[styles.infoValue, styles.infoValueWide]} numberOfLines={1} ellipsizeMode="tail">
                {orderData.deliveryAddress}
              </Text>
            </View>
          )}
          
          {orderData.deliveryNote && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.fields.deliveryInstruction')}:</Text>
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
    const pricingPending = isOrderPricingPending(orderData);
    const items = orderData.orderItems ?? [];

    // Filter products into discounted and non-discounted groups (only when priced)
    const discountedItems = pricingPending
      ? []
      : items.filter(
          (item: OrderItem) =>
            item.originalPriceSnapshot &&
            moneyAmount(item.originalPriceSnapshot) >
              moneyAmount(item.pricePerPackage || item.unitPrice),
        );

    const nonDiscountedItems = pricingPending
      ? items
      : items.filter(
          (item: OrderItem) =>
            !item.originalPriceSnapshot ||
            moneyAmount(item.originalPriceSnapshot) <=
              moneyAmount(item.pricePerPackage || item.unitPrice),
        );

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
              {pricingPending || isLinePricingPending(item) ? (
                <Text style={styles.productPrice}>{pendingPriceLabel}</Text>
              ) : item.originalPriceSnapshot &&
                moneyAmount(item.originalPriceSnapshot) >
                  moneyAmount(item.pricePerPackage || item.unitPrice) ? (
                <>
                  <Text style={styles.originalPrice}>
                    {formatCurrency(moneyAmount(item.originalPriceSnapshot))}
                  </Text>
                  <Text style={styles.discountedPrice}>
                    {formatOrderMoney(lineDisplayAmount(item))}
                  </Text>
                </>
              ) : (
                <Text style={styles.productPrice}>
                  {formatOrderMoney(lineDisplayAmount(item))}
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
                        +{t('ordersFlow.orderDetails.product.freePieces', { count: promotionGift.freeQty })}
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
            <Text style={styles.sectionTitle}>{t('ordersFlow.orderDetails.sections2.productInformation')}</Text>
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
              <Text style={styles.summaryLabel}>{t('ordersFlow.orderDetails.sections2.productTotal')}</Text>
              <Text style={styles.summaryValue}>
                {isOrderPricingPending(orderData)
                  ? pendingPriceLabel
                  : formatOrderMoney(calculateProductTotal())}
              </Text>
            </View>
          ) : null}

          {(() => {
            const { methodLabel, scheduleStatusText } = getShippingDetails();
            return (
              <View style={styles.feeRow}>
                <Text style={styles.feeSectionTitle}>{t('ordersFlow.orderDetails.sections2.shipping')}</Text>
                <View style={styles.feeDetailsWrapper}>
                  <View style={styles.feeMethodRow}>
                    <Text style={styles.shippingMethodLabel} numberOfLines={1}>
                      {methodLabel || t('ordersFlow.orderDetails.payment.methodNotSpecified')}
                    </Text>
                    <Text style={[styles.feeValue, { color: '#6B7280', fontSize: 12 }]}>
                      {t('ordersFlow.orderDetails.misc.costAgreedSeparately')}
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
            <Text style={styles.orderTotalText}>
              {t('ordersFlow.orderDetails.totals.orderTotal', {
                amount: isOrderPricingPending(orderData)
                  ? pendingPriceLabel
                  : formatOrderMoney(orderData.totalAmount || orderData.total || 0),
              })}
            </Text>
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
    const industryType = company.industryType;
    const phoneNumber = company.businessPhone;
    const email = company.businessEmail;
    const address = company.pickupAddress || company.businessAddress;

    if (!distributorCompanyName && !industryType && !phoneNumber && !email && !address) {
      return null;
    }

    const distributorId: string | null = (() => {
      const sellerUserId = resolveDistributorUserId(orderData);
      return sellerUserId != null ? String(sellerUserId) : null;
    })();

    return (
      <View style={styles.section}>
        <View style={styles.productCard}>
          <View style={styles.sectionTitleContainer}>
            <Building2 size={20} color="#0a61d7" />
              <Text style={styles.sectionTitle}>{t('ordersFlow.orderDetails.sections.distributorInfo')}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!distributorId) {
                    Alert.alert(t('ordersFlow.orderDetails.alerts.unavailableTitle'), t('ordersFlow.orderDetails.alerts.unavailableDistributorBody'));
                  return;
                }
                router.push({
                  pathname: '/useraccounts/buyernetworks/distributor-detail',
                  params: { id: distributorId },
                });
              }}
              accessibilityRole="button"
                accessibilityLabel={t('ordersFlow.orderDetails.distributor.viewDistributorDetailsA11y')}
              style={[
                styles.viewDistributorButton,
                !distributorId && styles.viewDistributorButtonDisabled,
              ]}
              disabled={!distributorId}
            >
              <Text style={[styles.viewDistributorButtonText, !distributorId && styles.viewDistributorButtonTextDisabled]}>
                  {t('ordersFlow.orderDetails.distributor.view')}
              </Text>
            </TouchableOpacity>
          </View>

          {distributorCompanyName && (
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.distributor.labels.company')}:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {distributorCompanyName}
              </Text>
            </View>
          )}

          {industryType && (
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.distributor.labels.industry')}:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {industryType}
              </Text>
            </View>
          )}

          {phoneNumber && (
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.distributor.labels.phone')}:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {phoneNumber}
              </Text>
            </View>
          )}

          {email && (
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.distributor.labels.email')}:</Text>
              <Text style={[styles.infoValue, styles.distributorValue]}>
                {email}
              </Text>
            </View>
          )}

          {address && (
            <View style={styles.infoRowTopAligned}>
                <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.distributor.labels.address')}:</Text>
              <Text style={[styles.infoValueMultiline, styles.distributorValueMultiline]}>
                {address}
              </Text>
            </View>
          )}

        </View>
      </View>
    );
  };

  const handleContactSeller = () => {
    const company = orderData.user?.company;
    const phone = typeof company?.businessPhone === 'string' ? company.businessPhone : '';
    const distributorIdRaw = resolveDistributorUserId(orderData);
    const distributorId = distributorIdRaw != null ? Number(distributorIdRaw) : Number.NaN;
    const distributorName =
      (company?.name || company?.companyName || '').trim() || 'Distributor';
    const logoUrl = company?.logo ?? null;
    const firstItem = orderData.orderItems?.[0];

    if (Number.isFinite(distributorId)) {
      useMessagesStore.getState().upsertConversation({
        distributorId,
        name: distributorName,
        phone: phone || null,
        logoUrl,
        lastProductId: firstItem?.productId ? String(firstItem.productId) : null,
        lastProductName: firstItem?.productName ?? firstItem?.name ?? null,
      });
    }

    openWhatsApp({
      phone,
      text: t('messages.whatsapp.orderUpdate', { orderId: orderData.orderId }),
      onErrorMessage: t('messages.errors.sellerPhoneUnavailableForOrder', {
        orderId: orderData.orderId,
      }),
    });
  };

  const renderSupportCenter = () => (
    <View style={styles.section}>
      <View style={styles.productCard}>
        <View style={styles.sectionTitleContainer}>
          <HelpCircle size={20} color="#0a61d7" />
          <Text style={styles.sectionTitle}>{t('ordersFlow.orderDetails.sections.supportCenter')}</Text>
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
            <Text style={styles.supportTitle}>{t('ordersFlow.orderDetails.support.requestReturnRefund')}</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <View style={styles.supportDivider} />
        
        <TouchableOpacity style={styles.supportItem} onPress={handleContactSeller}>
          <MessageCircle size={20} color="#6b7280" />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>{t('ordersFlow.orderDetails.support.contactSeller')}</Text>
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
            <Text style={styles.supportTitle}>{t('ordersFlow.orderDetails.support.helpCenter')}</Text>
          </View>
          <ChevronRight size={16} color="#6b7280" />
        </TouchableOpacity>

        {orderData.orderStatus === 'Returned' && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>{t('ordersFlow.orderDetails.support.returnRefundStatusLabel')}</Text>
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
              {orderData.returnStatus || t('ordersFlow.orderDetails.support.pendingReview')}
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
        label: `${t('ordersFlow.orderDetails.info.orderId')}:`,
        value: orderData.orderId,
        isSpecial: true,
        render: () => (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.info.orderId')}:</Text>
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
        label: `${t('ordersFlow.orderDetails.info.paidBy')}:`,
        value: orderData.paymentTerms,
        condition: orderData.paymentTerms
      },
      {
        key: 'invoice',
        label: `${t('ordersFlow.orderDetails.info.invoice')}:`,
        value: 'View',
        isSpecial: true,
        render: () => (
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setInvoiceModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('ordersFlow.orderDetails.info.viewInvoiceA11y')}
          >
            <Text style={styles.infoLabel}>{t('ordersFlow.orderDetails.info.invoice')}:</Text>
            <View style={styles.invoiceRowRight}>
              <Text style={styles.invoiceLinkText}>{t('ordersFlow.orderDetails.info.viewDownload')}</Text>
              <ChevronRight size={16} color="#0a61d7" />
            </View>
          </TouchableOpacity>
        ),
      },
      {
        key: 'orderTime',
        label: `${t('ordersFlow.orderDetails.info.orderTime')}:`,
        value: orderData.orderDate ? new Date(orderData.orderDate).toLocaleString() : null,
        condition: orderData.orderDate
      },
      {
        key: 'paymentTime',
        label: `${t('ordersFlow.orderDetails.info.paymentTime')}:`,
        value: orderData.updatedAt ? new Date(orderData.updatedAt).toLocaleString() : null,
        condition: orderData.paymentStatus === 'Paid' && orderData.updatedAt
      },
      {
        key: 'shipTime',
        label: `${t('ordersFlow.orderDetails.info.shipTime')}:`,
        value: orderData.updatedAt ? new Date(orderData.updatedAt).toLocaleString() : null,
        condition: orderData.orderStatus === 'Shipped' && orderData.updatedAt
      },
      {
        key: 'completedTime',
        label: `${t('ordersFlow.orderDetails.info.completedTime')}:`,
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
            <Text style={styles.sectionTitle}>{t('ordersFlow.orderDetails.orderIdInfo.title')}</Text>
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
                {showAllOrderInfo ? t('ordersFlow.orderDetails.orderIdInfo.viewLess') : t('ordersFlow.orderDetails.orderIdInfo.viewMore')}
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
    router.push(`/components/ordersshipment/PayOrder?orderId=${encodeURIComponent(orderData.orderId)}`);
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
            <Text style={styles.cancelButtonText}>{t('ordersFlow.orderDetails.actions.cancelOrder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={handlePayOrder}>
            <Text style={styles.payButtonText}>{t('ordersFlow.orderDetails.actions.payOrder')}</Text>
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
            <Text style={styles.returnButtonText}>{t('ordersFlow.orderDetails.actions.returnRefund')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateButton} onPress={handleRateOrder}>
            <Star size={16} color="#ffffff" />
            <Text style={styles.rateButtonText}>
              {hasExistingReview ? t('ordersFlow.orderDetails.actions.editReview') : t('ordersFlow.orderDetails.actions.rate')}
            </Text>
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
            onPress={() => Alert.alert(t('ordersFlow.orderDetails.alerts.contactSupportTitle'), t('ordersFlow.orderDetails.alerts.contactSupportBody'))}
          >
            <Text style={styles.contactSupportButtonText}>{t('ordersFlow.orderDetails.actions.contactSupport')}</Text>
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
            <Text style={[styles.returnButtonText, styles.disabledButtonText]}>{t('ordersFlow.orderDetails.actions.returnRefund')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.orderReceivedButton, isMarkingReceived && styles.disabledButton]}
            onPress={handleOrderReceived}
            disabled={isMarkingReceived}
          >
            {isMarkingReceived ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.orderReceivedButtonText}>{t('ordersFlow.orderDetails.actions.orderReceived')}</Text>
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
            <Text style={styles.goBackButtonText}>{t('ordersFlow.orderDetails.actions.backToOrders')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Returned - show only Return/Refund and Rate (no Cancel Order or Order Received)
    if (orderData.orderStatus === 'Returned') {
      return (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.returnButton} onPress={handleReturnRefund}>
            <Text style={styles.returnButtonText}>{t('ordersFlow.orderDetails.actions.returnRefund')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rateButton} onPress={handleRateOrder}>
            <Star size={16} color="#ffffff" />
            <Text style={styles.rateButtonText}>
              {hasExistingReview ? t('ordersFlow.orderDetails.actions.editReview') : t('ordersFlow.orderDetails.actions.rate')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Before delivery (Pending paid, Confirmed, Packed, Shipped) - show Cancel Order and Order Received (disabled)
    const isOrderReceivedEnabled = false;
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
          <Text style={styles.cancelButtonText}>{t('ordersFlow.orderDetails.actions.cancelOrder')}</Text>
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
            {t('ordersFlow.orderDetails.actions.orderReceived')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const primaryBlue = '#0a61d7';

  const orderDetailsHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 44) + 8 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('ordersFlow.common.a11y.goBack')}
          accessibilityRole="button"
        >
          <ArrowLeft color={primaryBlue} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ordersFlow.orderDetails.title')}</Text>
      </View>
    </View>
  );

  const orderDetailsScreenOptions = {
    presentation: 'modal' as const,
    header: orderDetailsHeader,
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={orderDetailsScreenOptions} />
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <OrderDetailsSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={orderDetailsScreenOptions} />
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('ordersFlow.orderDetails.notFound')}</Text>
        </View>
      </View>
    );
  }

  // TypeScript assertion that order is not null after the check above
  const orderData = order as Order;

  return (
    <View style={styles.container}>
      <Stack.Screen options={orderDetailsScreenOptions} />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderOrderShippingInfo()}
        {renderDistributorInfo()}
        {renderProductInfo()}
        {renderOrderIdInfo()}
        {renderSupportCenter()}
      </ScrollView>

      <OrderInvoiceModal
        visible={invoiceModalVisible}
        onClose={() => setInvoiceModalVisible(false)}
        order={orderData}
      />
      
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
  viewDistributorButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  viewDistributorButtonDisabled: {
    opacity: 0.5,
  },
  viewDistributorButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a61d7',
  },
  viewDistributorButtonTextDisabled: {
    color: '#6B7280',
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
  invoiceRowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  invoiceLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a61d7',
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
