import React, { useState, useEffect } from 'react';
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
// import MapComponent from './MapComponent';
// import { geocodeAddress, GeocodeResult, getOrderStatusMarkerColor } from '../../../utils/mapboxUtils';

const { width } = Dimensions.get('window');

export default function DeliveryInformation() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const { token } = useAuthStore();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  // const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  // GPS Map functionality commented out for now
  // useEffect(() => {
  //   if (order) {
  //     geocodeDistributorAddress();
  //   }
  // }, [order]);

  // const geocodeDistributorAddress = async () => {
  //   if (!order) return;

  //   // For buyers, show the distributor's location (where the order is coming from)
  //   // Priority: 1. pickupAddress, 2. businessAddress, 3. null
  //   const distributorAddress = 
  //     order.user?.company?.pickupAddress || 
  //     order.user?.company?.businessAddress ||
  //     null;
    
  //   if (!distributorAddress) {
  //     setGeocodeResult(null);
  //     return;
  //   }

  //   setIsGeocoding(true);
  //   try {
  //     const result = await geocodeAddress(distributorAddress);
  //     setGeocodeResult(result);
  //   } catch (error) {
  //     setGeocodeResult(null);
  //   } finally {
  //     setIsGeocoding(false);
  //       }
  // };

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      } else {
        setOrder(null);
      }
    } catch (error) {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading...</Text>
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

  const getDeliveryTimeline = () => {
    const timeline = [];
    const status = order.orderStatus?.toLowerCase();

    // Order placed - always show
    timeline.push({
      id: 'placed',
      date: new Date(order.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      }),
      time: new Date(order.createdAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      status: 'Order is placed',
      isActive: status === 'pending',
      isPassed: !['pending'].includes(status),
    });

    // Seller preparing - show if confirmed or later
    if (['confirmed', 'packed', 'shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'preparing',
        date: new Date(order.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: 'Seller is preparing to ship your parcel',
        isActive: status === 'confirmed',
        isPassed: !['pending', 'confirmed'].includes(status),
      });
    }

    // Picked up - show if packed or later
    if (['packed', 'shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'pickedup',
        date: new Date(order.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: 'Your parcel has been picked up by our logistics partner',
        isActive: status === 'packed',
        isPassed: !['pending', 'confirmed', 'packed'].includes(status),
      });
    }

    // Sorting facility - show if shipped or later
    if (['shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'sorting',
        date: new Date(order.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: 'Your parcel has arrived at sorting facility',
        isActive: status === 'shipped',
        isPassed: !['pending', 'confirmed', 'packed', 'shipped'].includes(status),
      });
    }

    // Out for delivery - show if shipped or later
    if (['shipped', 'delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'outfordelivery',
        date: new Date(order.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: `[${order.assignedLogistics || 'Logistics Partner'}] Your parcel is out for delivery`,
        isActive: status === 'shipped',
        isPassed: !['pending', 'confirmed', 'packed', 'shipped'].includes(status),
      });
    }

    // Delivered - show if delivered or received
    if (['delivered', 'received'].includes(status)) {
      timeline.push({
        id: 'delivered',
        date: new Date(order.updatedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        time: new Date(order.updatedAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        status: 'Your parcel has been delivered',
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
        label: 'Placed',
        completed: ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'shipped',
        label: 'Shipped',
        completed: ['packed', 'shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'outfordelivery',
        label: 'Out for Delivery',
        completed: ['shipped', 'delivered', 'received', 'cancelled', 'returned'].includes(status),
      },
      {
        id: 'delivered',
        label: 'Delivered',
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
              ? `Delivered on ${new Date(order.updatedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}`
              : 'Delivery Progress'
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
        <Text style={styles.timelineTitle}>Delivery Timeline</Text>
        
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
                  {item.isLatest && item.id === 'delivered' && (
                    <TouchableOpacity style={styles.proofButton}>
                      <Text style={styles.proofButtonText}>View Proof of Delivery</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Map GPS Section - Commented out for now */}
        {/* <View style={styles.mapSection}>
          <View style={styles.mapHeader}>
            <MapPin size={20} color="#0a61d7" />
            <Text style={styles.mapTitle}>Distributor Location</Text>
          </View>
          {isGeocoding ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#0a61d7" />
              <Text style={styles.mapPlaceholderText}>Loading map...</Text>
              <Text style={styles.mapPlaceholderSubtext}>Geocoding distributor address</Text>
            </View>
          ) : geocodeResult?.coordinates ? (
            <MapComponent
              markers={[{
                id: order.id?.toString() || order.orderId,
                coordinates: geocodeResult.coordinates,
                label: `${order.orderId} - ${order.orderStatus}`,
                color: getOrderStatusMarkerColor(order.orderStatus),
              }]}
              center={geocodeResult.coordinates}
              zoom={14}
              height={300}
              showControls={true}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <MapPin size={48} color="#9CA3AF" />
              <Text style={styles.mapPlaceholderText}>Map unavailable</Text>
              <Text style={styles.mapPlaceholderSubtext}>
                {(order.user?.company?.pickupAddress || order.user?.company?.businessAddress)
                  ? 'Unable to locate distributor address'
                  : 'Distributor address not available'}
              </Text>
            </View>
          )}
          
          <View style={styles.deliveryInfoContainer}>
            <View style={styles.deliveryInfoRow}>
              <Clock size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Preferred Delivery Time</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.preferredDeliveryTime || 'Not specified'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Truck size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Assigned Logistics</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.assignedLogistics || 'Not assigned'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Package size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Tracking Number</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.trackingNumber || 'Not available'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <MapPin size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Delivery Note</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.deliveryNote || 'No special instructions'}
                </Text>
              </View>
            </View>
          </View>
        </View> */}

        {/* Delivery Information Fields */}
        <View style={styles.mapSection}>
          <View style={styles.deliveryInfoContainer}>
            <View style={styles.deliveryInfoRow}>
              <Clock size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Preferred Delivery Time</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.preferredDeliveryTime || 'Not specified'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Truck size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Assigned Logistics</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.assignedLogistics || 'Not assigned'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <Package size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Tracking Number</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.trackingNumber || 'Not available'}
                </Text>
              </View>
            </View>
            
            <View style={styles.deliveryInfoRow}>
              <MapPin size={16} color="#6B7280" />
              <View style={styles.deliveryInfoContent}>
                <Text style={styles.deliveryInfoLabel}>Delivery Note</Text>
                <Text style={styles.deliveryInfoValue}>
                  {order.deliveryNote || 'No special instructions'}
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
                  Order ID: {order.orderId || 'N/A'}
                </Text>
                <Text style={styles.trackingID}>
                  Delivery Method: {order.deliveryMethod}
                </Text>
              </View>
            </View>
          </View>

          {/* Timeline */}
          {renderTimeline()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
