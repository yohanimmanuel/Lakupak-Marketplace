import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle,
  Truck,
  Package,
  Clock,
  MapPin,
  ArrowLeft,
  Check,
} from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { websocketService } from '../../../services/websocket';
import { useDataStore, MarketplaceOrder } from '../../../stores/dataStore';
import MapComponent from './MapComponent';
import { geocodeAddress, type GeocodeResult } from '../../../services/geocode';
import { getOrderStatusMarkerColor } from '../../../utils/mapboxUtils';
import ProductImageModal from '../productcatalog/ProductImageModal';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface DeliveryOrderItem {
  productId?: string | null;
  productName?: string;
  images?: string[];
  packageQuantity?: number;
  packageType?: string;
  piecesPerPackage?: number;
  pricePerPackage?: number;
  subtotal?: number;
}

interface DeliveryOrderUser {
  id?: number;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  chosenAddress?: string;
  storeName?: string;
  company?: {
    name?: string;
    logo?: string;
    bannerImage?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    businessDescription?: string;
    industryType?: string;
    pickupAddress?: string;
  };
}

interface DeliveryOrder {
  id?: number;
  orderId: string;
  orderStatus: string;
  paymentStatus?: string;
  deliveryMethod?: string;
  deliveryOption?: string | null;
  contactPerson?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  preferredDeliveryTime?: string;
  preferredDeliveryDate?: string;
  assignedLogistics?: string;
  trackingNumber?: string;
  deliveryNote?: string;
  pod?: string | null;
  orderDate?: string;
  createdAt: string;
  updatedAt: string;
  orderItems?: DeliveryOrderItem[];
  user?: DeliveryOrderUser;
  returnStatus?: string | null;
}

export default function DeliveryInformation() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const { token } = useAuthStore();
  const orders = useDataStore(state => state.orders);
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (order) {
      geocodeDistributorAddress();
    }
  }, [order]);

  const geocodeDistributorAddress = async () => {
    if (!order) return;

    // For buyers, show the distributor's location (where the order is coming from)
    // Priority: 1. pickupAddress, 2. businessAddress, 3. null
    const distributorAddress = 
      order.user?.company?.pickupAddress || 
      order.user?.company?.businessAddress ||
      null;
    
    if (!distributorAddress) {
      setGeocodeResult(null);
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(distributorAddress, token);
      setGeocodeResult(result);
    } catch (error) {
      setGeocodeResult(null);
    } finally {
      setIsGeocoding(false);
        }
  };

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId || typeof orderId !== 'string') return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: DeliveryOrder = await response.json();
        setOrder(data);
      } else {
        setOrder(null);
      }
    } catch (error) {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, token]);

  // Silently fetch updated order details without showing loading state
  const updateOrderSilently = useCallback(async () => {
    if (!orderId || typeof orderId !== 'string' || !order) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: DeliveryOrder = await response.json();
        // Update order state without showing loading
        setOrder(data);
      }
    } catch (error) {
      // Silently fail - keep existing order data
    }
  }, [orderId, token, order]);

  // Subscribe to WebSocket for real-time order updates
  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return;

    const unsubscribe = websocketService.subscribe((message) => {
      // Check if this order was updated
      if (message.type === 'order_updated' && message.orderIds?.includes(orderId)) {
        // Find updated order in dataStore and update display immediately
        const updatedOrder = orders.find(o => o.orderId === orderId);
        if (updatedOrder && order) {
          // Update order state immediately with available data from dataStore
          setOrder(prevOrder => {
            if (!prevOrder) return prevOrder;
            return {
              ...prevOrder,
              orderStatus: updatedOrder.orderStatus,
              paymentStatus: updatedOrder.paymentStatus,
              updatedAt: updatedOrder.updatedAt || prevOrder.updatedAt,
            };
          });
          
          // Silently fetch full order details in background to get delivery fulfillment fields
          updateOrderSilently();
        } else if (order) {
          // If order not in dataStore but we have local order, silently fetch updates
          updateOrderSilently();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [orderId, orders, order, updateOrderSilently]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('ordersFlow.deliveryInfo.loading')}</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('ordersFlow.deliveryInfo.notFound')}</Text>
        </View>
      </View>
    );
  }

  const getDeliveryTimeline = () => {
    const timeline = [];
    const status = order.orderStatus?.toLowerCase();

    // Order placed - always show
    timeline.push({
      id: 'placed',
      date: new Date(order.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      }),
      time: new Date(order.createdAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      status: t('ordersFlow.deliveryInfo.timeline.statuses.placed'),
      isActive: status === 'pending',
      isPassed: !['pending'].includes(status),
    });

    // Seller preparing - show if confirmed or later
    if (['confirmed', 'packed', 'shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'preparing',
        date: new Date(order.updatedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: t('ordersFlow.deliveryInfo.timeline.statuses.preparing'),
        isActive: status === 'confirmed',
        isPassed: !['pending', 'confirmed'].includes(status),
      });
    }

    // Picked up - show if packed or later
    if (['packed', 'shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'pickedup',
        date: new Date(order.updatedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: t('ordersFlow.deliveryInfo.timeline.statuses.pickedUp'),
        isActive: status === 'packed',
        isPassed: !['pending', 'confirmed', 'packed'].includes(status),
      });
    }

    // Sorting facility - show if shipped or later
    if (['shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'sorting',
        date: new Date(order.updatedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: t('ordersFlow.deliveryInfo.timeline.statuses.sorting'),
        isActive: status === 'shipped',
        isPassed: !['pending', 'confirmed', 'packed', 'shipped'].includes(status),
      });
    }

    // Out for delivery - show if shipped or later
    if (['shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'outfordelivery',
        date: new Date(order.updatedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: t('ordersFlow.deliveryInfo.timeline.statuses.outForDelivery', {
          logistics: order.assignedLogistics || 'Logistics Partner',
        }),
        isActive: status === 'shipped',
        isPassed: !['pending', 'confirmed', 'packed', 'shipped'].includes(status),
      });
    }

    // Delivered - show if delivered or received
    if (['delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'delivered',
        date: new Date(order.updatedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: t('ordersFlow.deliveryInfo.timeline.statuses.delivered'),
        isActive: status === 'delivered' || status === 'received',
        isPassed: false,
        isLatest: true,
      });
    }

    return timeline.reverse(); // Show most recent first
  };

  const getProgressSteps = () => {
    const status = order.orderStatus?.toLowerCase();
    return [
      {
        id: 'placed',
        label: t('ordersFlow.deliveryInfo.progress.steps.placed'),
        completed: ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'shipped',
        label: t('ordersFlow.deliveryInfo.progress.steps.shipped'),
        completed: ['packed', 'shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'outfordelivery',
        label: t('ordersFlow.deliveryInfo.progress.steps.outForDelivery'),
        completed: ['shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'delivered',
        label: t('ordersFlow.deliveryInfo.progress.steps.delivered'),
        completed: ['delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
    ];
  };

  const renderProgressBar = () => {
    const steps = getProgressSteps();

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {order.orderStatus === 'Delivered' || order.orderStatus === 'Received' 
              ? t('ordersFlow.deliveryInfo.progress.deliveredOn', {
                  date: new Date(order.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                })
              : t('ordersFlow.deliveryInfo.progress.deliveryProgress')
            }
          </Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressLine}>
            {steps.map((step, index) => (
              <View key={step.id} style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  step.completed && styles.progressDotCompleted
                ]}>
                  {step.completed && (
                    <Check size={10} color="#ffffff" />
                  )}
                </View>
                <Text style={[
                  styles.progressLabel,
                  step.completed && styles.progressLabelCompleted
                ]}>
                  {step.label}
                </Text>
                {index < steps.length - 1 && (
                  <View style={[
                    styles.progressConnectingLine,
                    steps[index + 1].completed && styles.progressConnectingLineCompleted,
                    step.completed && styles.progressConnectingLineFromLarge
                  ]} />
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderTimeline = () => {
    const timeline = getDeliveryTimeline();

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineTitle}>{t('ordersFlow.deliveryInfo.timeline.title')}</Text>
        
        {timeline.map((item, index) => (
          <View key={item.id} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={styles.timelineDateContainer}>
                <Text style={styles.timelineDate}>{item.date}</Text>
                <Text style={styles.timelineTime}>{item.time}</Text>
              </View>
              {index < timeline.length - 1 && (
                <View style={styles.timelineLine} />
              )}
            </View>
            
            <View style={styles.timelineRight}>
              <View style={styles.timelineContent}>
                <View style={styles.timelineDotContainer}>
                  <View style={[
                    styles.timelineDot,
                    item.isActive && styles.timelineDotActive,
                    item.isPassed && styles.timelineDotPassed
                  ]} />
                  {index < timeline.length - 1 && (
                    <View style={styles.timelineVerticalLine} />
                  )}
                </View>
                <View style={styles.timelineTextContainer}>
                  <Text style={[
                    styles.timelineStatus,
                    item.isActive && styles.timelineStatusActive,
                    item.isPassed && styles.timelineStatusPassed
                  ]}>
                    {item.status}
                  </Text>
                  {item.isLatest && item.id === 'delivered' && order?.pod && (
                    <TouchableOpacity 
                      style={styles.proofButton}
                      onPress={() => setShowPodModal(true)}
                    >
                      <Text style={styles.proofButtonText}>{t('ordersFlow.deliveryInfo.timeline.viewPod')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

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
                  accessibilityLabel={t('ordersFlow.common.a11y.goBack')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ordersFlow.deliveryInfo.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Map GPS Section - Map display commented out */}
        <View style={styles.mapSection}>
          {/* <View style={styles.mapHeader}>
            <MapPin size={20} color="#0a61d7" />
            <Text style={styles.mapTitle}>{t('ordersFlow.deliveryInfo.map.title')}</Text>
          </View>
          {isGeocoding ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#0a61d7" />
              <Text style={styles.mapPlaceholderText}>{t('ordersFlow.deliveryInfo.map.loading')}</Text>
              <Text style={styles.mapPlaceholderSubtext}>{t('ordersFlow.deliveryInfo.map.geocoding')}</Text>
            </View>
          ) : geocodeResult?.coordinates ? (
            <MapComponent
              markers={[{
                id: order.id?.toString() || order.orderId,
                coordinates: geocodeResult.coordinates,
              }]}
              center={geocodeResult.coordinates}
              zoom={14}
              height={300}
              showRecenter
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <MapPin size={48} color="#9CA3AF" />
              <Text style={styles.mapPlaceholderText}>{t('ordersFlow.deliveryInfo.map.unavailable')}</Text>
              <Text style={styles.mapPlaceholderSubtext}>
                {(order.user?.company?.pickupAddress || order.user?.company?.businessAddress)
                  ? t('ordersFlow.deliveryInfo.map.unableToLocate')
                  : t('ordersFlow.deliveryInfo.map.addressNotAvailable')}
              </Text>
            </View>
          )} */}
          
          <View style={styles.deliveryInfoContainer}>
            <View style={styles.deliveryInfoRow}>
              <Clock size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>{t('ordersFlow.deliveryInfo.details.preferredDeliveryTime')}</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.preferredDeliveryTime || t('ordersFlow.deliveryInfo.details.notSpecified')}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Truck size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>{t('ordersFlow.deliveryInfo.details.assignedLogistics')}</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.assignedLogistics || t('ordersFlow.deliveryInfo.details.notAssigned')}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Package size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>{t('ordersFlow.deliveryInfo.details.trackingNumber')}</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.trackingNumber || t('ordersFlow.deliveryInfo.details.notAvailable')}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <MapPin size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>{t('ordersFlow.deliveryInfo.details.deliveryNote')}</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.deliveryNote || t('ordersFlow.deliveryInfo.details.noInstructions')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Combined Order Summary and Timeline */}
        <View style={styles.combinedContainer}>
          {/* Order Summary */}
          <View style={styles.orderSummary}>
            <View style={styles.orderSummaryLeft}>
              <View style={styles.productImageContainer}>
                {order.orderItems?.[0]?.images?.[0] ? (
                  <Image 
                    source={{ uri: order.orderItems[0].images[0] }} 
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Package size={24} color="#6B7280" />
                  </View>
                )}
              </View>
              <View style={styles.orderSummaryInfo}>
                <Text style={styles.orderId}>
                  {t('ordersFlow.deliveryInfo.summary.orderId')}: {order.orderId || t('ordersFlow.deliveryInfo.summary.na')}
                </Text>
                <Text style={styles.trackingID}>
                  {t('ordersFlow.deliveryInfo.summary.deliveryMethod')}: {order.deliveryMethod}
                </Text>
                {order.orderStatus === 'Returned' && (
                  <Text style={styles.trackingID}>
                    {t('ordersFlow.deliveryInfo.summary.returnRefundStatus')}:{' '}
                    <Text
                      style={{
                        fontWeight: '600',
                        color:
                          order.returnStatus === 'Accepted'
                            ? '#16a34a'
                            : order.returnStatus === 'Rejected'
                            ? '#dc2626'
                            : '#f59e0b',
                      }}
                    >
                      {order.returnStatus || t('ordersFlow.deliveryInfo.summary.pendingReview')}
                    </Text>
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Timeline */}
          {renderTimeline()}
        </View>
      </ScrollView>

      {/* Proof of Delivery Modal */}
      {order?.pod && (
        <ProductImageModal
          visible={showPodModal}
          images={[order.pod]}
          onClose={() => setShowPodModal(false)}
          initialIndex={0}
        />
      )}
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
  content: {
    flex: 1,
  },
  progressContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    paddingVertical: 16,
  },
  progressHeader: {
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressBarContainer: {
    position: 'relative',
  },
  progressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotCompleted: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0a61d7',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  progressLabelCompleted: {
    color: '#0a61d7',
    fontWeight: '500',
  },
  progressConnectingLine: {
    position: 'absolute',
    top: 3,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
  },
  progressConnectingLineCompleted: {
    backgroundColor: '#0a61d7',
  },
  progressConnectingLineFromLarge: {
    top: 7,
  },
  combinedContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 8,
    marginTop: -8,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  orderSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderSummaryInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    color: '#000000',
    fontWeight: 'bold',
  },
  trackingID: {
    fontSize: 12,
    color: '#111827'
  },
  timelineContainer: {
    padding: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDateContainer: {
    alignItems: 'center',
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  timelineTime: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 4,
    top: 8,
    width: 1,
    height: 60,
    backgroundColor: '#E5E7EB',
  },
  timelineRight: {
    flex: 1,
    paddingTop: 4,
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDotContainer: {
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  timelineDotActive: {
    backgroundColor: '#0a61d7',
  },
  timelineDotPassed: {
    backgroundColor: '#9CA3AF',
  },
  timelineTextContainer: {
    flex: 1,
    marginTop: -6,
    justifyContent: 'center',
  },
  timelineStatus: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  timelineStatusActive: {
    color: '#0a61d7',
    fontWeight: '500',
  },
  timelineStatusPassed: {
    color: '#9CA3AF',
  },
  proofButton: {
    marginTop: 8,
  },
  proofButtonText: {
    fontSize: 12,
    color: '#0a61d7',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Map GPS Section Styles
  mapSection: {
    marginTop: -8,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  mapPlaceholder: {
    height: 300,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Delivery Information Styles
  deliveryInfoContainer: {
    gap: 16,
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  deliveryInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  deliveryInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  deliveryInfoValue: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 22,
  },
});
