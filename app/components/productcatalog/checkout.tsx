import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  CreditCard, 
  Building2, 
  Package,
  CheckCircle,
  Clock,
  Shield,
  ChevronDown,
  ChevronRight,
  Calendar,
  X,
  Gift,
  Banknote,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Product } from '../../../data/sampleProducts';
import { MarketplaceProduct } from '../../../services/marketplace';
import { formatCurrency } from '../../../utils/currencyUtils';
import { calculateProductPromotion } from '../../../utils/promotionUtils';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore, CartItem } from '../../../stores/cartStore';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { NotificationService } from '../../../services/notificationService';
import { pushNotificationService } from '../../../services/pushNotifications';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

type CheckoutParams = {
  productId?: string;
  quantity?: string;
  totalPrice?: string;
  productName?: string;
  productImage?: string;
  unitPrice?: string;
  originalPrice?: string;
  packageType?: string;
  piecesPerPackage?: string;
  variantId?: string;
  variantName?: string;
};

interface DistributorInfo {
  id: string;
  companyName: string;
  industryType: string;
  pickupAddress: string | null;
  businessAddress: string | null;
  contactPerson: string;
  phone: string;
  email?: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<CheckoutParams>();
  const primaryBlue = '#0a61d7';
  
  // Get product cache; read auth user directly from auth store (avoids stale user after logout/login)
  const { products } = useDataStore();
  const authUser = useAuthStore(s => s.user);
  
  // Get auth token
  const token = useAuthStore(s => s.token);

  // Helper: always resolve the freshest product data by id
  const getFreshProductById = (id?: string) => {
    if (!id) return null;
    return products.find(p => p.id === id) || null;
  };
  const getItemProduct = (item: CartItem) => {
    const fresh = getFreshProductById((item?.product as MarketplaceProduct)?.id);
    return (fresh || (item.product as MarketplaceProduct)) as MarketplaceProduct;
  };
  
  // Get cart data
  const cartStore = useCartStore();
  const cartItems = useCartStore(s => s.items as CartItem[]);
  const selectedCartItems = useMemo(
    () => cartItems.filter(item => item.selected),
    [cartItems]
  );
  
  // Parse parameters
  const productId = params.productId || '';
  const quantity = parseInt(params.quantity || '1');
  const totalPrice = parseFloat(params.totalPrice || '0');
  const productName = params.productName || 'Product';
  const productImage = params.productImage || '';
  const unitPrice = parseFloat(params.unitPrice || '0');
  const originalPrice = parseFloat(params.originalPrice || '0');
  const packageType = params.packageType || 'Box';
  const piecesPerPackage = parseInt(params.piecesPerPackage || '1');

  // Determine if this is a cart checkout or single product checkout
  const isCartCheckout = selectedCartItems.length > 0 && !productId;
  
  // Get the actual product data (for single product checkout) - memoized to update when products change
  const product = useMemo(() => products.find(p => p.id === productId), [products, productId]);
  
  // Group cart items by distributor
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

const resolveDistributorId = (product?: MarketplaceProduct): string => {
  if (!product) return 'unknown';

  const company = product.seller?.company;

  if (company?.name) {
    const base = slugify(company.name);
    if (product.userId !== undefined && product.userId !== null) {
      return `company-${base}-${product.userId}`;
    }
    return `company-${base}-${slugify(product.id)}`;
  }

  if (product.userId !== undefined && product.userId !== null) {
    return `user-${product.userId}`;
  }

  if (product.seller?.name) {
    return `seller-${slugify(product.seller.name)}-${slugify(product.id)}`;
  }

  return `product-${slugify(product.id)}`;
};

  const groupByDistributor = (items: typeof selectedCartItems) => {
    const grouped: { [key: string]: typeof selectedCartItems } = {};
    
    items.forEach(item => {
      const distributorId = resolveDistributorId(getItemProduct(item));
      if (!grouped[distributorId]) {
        grouped[distributorId] = [];
      }
      // push a shallow copy with freshest product reference
      grouped[distributorId].push({ ...item, product: getItemProduct(item) });
    });
    
    return grouped;
  };
  
const distributorGroups = useMemo(
  () => (isCartCheckout ? groupByDistributor(selectedCartItems) : {}),
  [isCartCheckout, selectedCartItems, products]
);
  

  // State
  const [selectedAddress, setSelectedAddress] = useState('default');
  const [selectedPayment, setSelectedPayment] = useState<'bank_transfer' | 'cod'>('bank_transfer');
  const [selectedShipping, setSelectedShipping] = useState('');
  // Per-distributor shipping selection for cart checkout
  const [selectedShippingByDistributor, setSelectedShippingByDistributor] = useState<Record<string, string>>({});
  const [activeDistributorId, setActiveDistributorId] = useState<string | null>(null);
  const [scheduledDateTimeByDistributor, setScheduledDateTimeByDistributor] = useState<Record<string, Date | null>>({});
  const [pickupDateTimeByDistributor, setPickupDateTimeByDistributor] = useState<Record<string, Date | null>>({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
  const [pickupDateTime, setPickupDateTime] = useState<Date | null>(null);

  // Confirmed scheduling mode for seller_delivery and buyer_courier (single product)
  const [sellerDeliveryMode, setSellerDeliveryMode] = useState<'buyer_scheduled' | 'distributor_managed' | null>(null);
  const [buyerCourierMode, setBuyerCourierMode] = useState<'buyer_scheduled' | 'self_managed' | null>(null);
  // Per-distributor confirmed scheduling mode for cart checkout
  const [sellerDeliveryModeByDist, setSellerDeliveryModeByDist] = useState<Record<string, 'buyer_scheduled' | 'distributor_managed'>>({});
  const [buyerCourierModeByDist, setBuyerCourierModeByDist] = useState<Record<string, 'buyer_scheduled' | 'self_managed'>>({});
  // Which option opened the schedule modal (context), which step it is on, and which mode is selected on step 1
  const [scheduleModalContext, setScheduleModalContext] = useState<'seller_delivery' | 'buyer_courier' | null>(null);
  const [scheduleModalStep, setScheduleModalStep] = useState<1 | 2>(1);
  const [scheduleStep1Mode, setScheduleStep1Mode] = useState<'buyer_scheduled' | 'managed' | null>(null);

  // Animation states - match BuyNowModal system
  const [deliverySlideAnim] = useState(new Animated.Value(screenHeight));
  const [pickupSlideAnim] = useState(new Animated.Value(screenHeight));
  const [isDeliveryClosing, setIsDeliveryClosing] = useState(false);
  const [isPickupClosing, setIsPickupClosing] = useState(false);
  
  // Get distributor/company information
  const getDistributorInfo = (product: MarketplaceProduct): DistributorInfo => {
    const distributorId = resolveDistributorId(product);
    const company = product?.seller?.company;
    return {
      id: distributorId,
      companyName: company?.name || product?.seller?.name || 'Distributor Company',
      industryType: company?.industryType || 'Not specified',
      pickupAddress: company?.pickupAddress || null,
      businessAddress: company?.businessAddress || null,
      contactPerson: product?.seller?.name || 'Not provided',
      phone: company?.businessPhone || 'Not provided',
      email: company?.businessEmail,
    };
  };

  // Get distributor information for display
  const getDistributorsInfo = () => {
    if (isCartCheckout && selectedCartItems.length > 0) {
      // Cart checkout - get all unique distributors
      const distributors = new Map<string, DistributorInfo>();
      selectedCartItems.forEach((item: CartItem) => {
        const product = getItemProduct(item);
        const info = getDistributorInfo(product);
        if (!distributors.has(info.id)) {
          distributors.set(info.id, info);
        }
      });
      return Array.from(distributors.values());
    } else if (product) {
      // Single product checkout
      return [getDistributorInfo(product as MarketplaceProduct)];
    }
    return [];
  };

const distributorsInfo = useMemo(() => getDistributorsInfo(), [isCartCheckout, selectedCartItems, product, products]);

const distributorsInfoMap = useMemo(() => {
  return distributorsInfo.reduce<Record<string, DistributorInfo>>((acc, info) => {
    acc[info.id] = info;
    return acc;
  }, {});
}, [distributorsInfo]);

const activeDistributorInfo = (isCartCheckout && activeDistributorId)
  ? distributorsInfoMap[activeDistributorId] ?? null
  : distributorsInfo[0] || null;

  // Use real user data for delivery address
  const addresses = [
    {
      id: 'default',
      name: authUser?.name || 'Your Name',
      company: authUser?.storeName || 'Your Company',
      address: authUser?.chosenAddress || 'Your Address',
      city: authUser?.country || 'Your City',
      phone: authUser?.phone || 'Your Phone',
      isDefault: true
    }
  ];

  const paymentMethods: Array<{
    id: 'bank_transfer' | 'cod';
    name: string;
    icon: 'Building2' | 'Banknote';
    description: string;
    isAvailable: boolean;
  }> = [
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: 'Building2',
      description: 'Transfer to the distributor bank account shown below',
      isAvailable: true,
    },
    {
      id: 'cod',
      name: 'Cash on Delivery (COD)',
      icon: 'Banknote',
      description: 'Pay the distributor when you receive the goods',
      isAvailable: true,
    },
  ];

  const paymentTermsForOrder =
    selectedPayment === 'cod' ? 'Cash on Delivery' : 'Bank Transfer';

  // Format min/max for "Estimated delivery: X" line (real data from distributor) – all as business days
  const formatDeliveryDuration = (minDays?: number | null, maxDays?: number | null): string => {
    const min = minDays != null && !Number.isNaN(minDays) ? minDays : null;
    const max = maxDays != null && !Number.isNaN(maxDays) ? maxDays : null;
    if (min != null && max != null) {
      if (min === max) return min === 1 ? '1 business day' : `${min} business days`;
      return `${min}-${max} business days`;
    }
    if (min != null) return `${min}+ business days`;
    if (max != null) return `Up to ${max} business days`;
    return '';
  };

  // Build "X-Y business days" description from real min/max (no double "days")
  const formatBusinessDaysDescription = (minDays?: number | null, maxDays?: number | null): string => {
    const min = minDays != null && !Number.isNaN(minDays) ? minDays : null;
    const max = maxDays != null && !Number.isNaN(maxDays) ? maxDays : null;
    if (min != null && max != null) {
      if (min === max) return min === 1 ? '1 business day' : `${min} business days`;
      return `${min}-${max} business days`;
    }
    if (min != null) return `${min}+ business days`;
    if (max != null) return `Up to ${max} business days`;
    return '';
  };

  // Returns only the shipping options the distributor has enabled via their shippingPreferences.
  // Falls back to all three if no preference data is available (e.g. legacy products).
  const getAvailableShippingOptions = (productData?: MarketplaceProduct) => {
    const shipping = productData?.shipping as {
      selfPickup?: { available?: boolean };
      sellerDelivery?: { available?: boolean; minDays?: number | null; maxDays?: number | null };
      buyerCourier?: { available?: boolean };
    } | undefined;

    // If shipping availability data is missing, show all options as fallback
    const hasAvailabilityData = shipping?.selfPickup != null || shipping?.sellerDelivery != null || shipping?.buyerCourier != null;

    const all = [
      {
        id: 'self_pickup',
        name: 'Self Pickup',
        description: 'Coordinate pickup directly at the seller location',
        estimatedDays: 'Coordinate with seller',
        minDays: null as number | null,
        maxDays: null as number | null,
        available: !hasAvailabilityData || (shipping?.selfPickup?.available ?? true),
      },
      {
        id: 'seller_delivery',
        name: 'Seller/Distributor Delivery',
        description: 'Seller arranges delivery to your address',
        estimatedDays: 'As agreed with seller',
        minDays: (shipping?.sellerDelivery?.minDays ?? null) as number | null,
        maxDays: (shipping?.sellerDelivery?.maxDays ?? null) as number | null,
        available: !hasAvailabilityData || (shipping?.sellerDelivery?.available ?? true),
      },
      {
        id: 'buyer_courier',
        name: 'Buyer-arranged Courier',
        description: 'You book and manage your own courier',
        estimatedDays: 'Per your courier booking',
        minDays: null as number | null,
        maxDays: null as number | null,
        available: !hasAvailabilityData || (shipping?.buyerCourier?.available ?? true),
      },
    ];

    return all.filter(o => o.available);
  };

  const shippingOptions = useMemo(() => getAvailableShippingOptions(product), [product]);

  // Time options for dropdown
  const timeOptions = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
  ];

  // Helper functions for date/time formatting
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':');
    const combined = new Date(date);
    combined.setHours(parseInt(hours), parseInt(minutes));
    return combined.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const toTimeValue = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Refresh products on checkout page mount - follows industry best practices:
  // This "stale-while-revalidate" approach balances performance and data freshness
  useEffect(() => {
    const dataState = useDataStore.getState();
    // Only refresh if not currently loading to avoid duplicate requests
    if (!dataState.isProductsLoading) {
      // loadProductsData(false) respects cache: returns cached if < 1 min old, fetches if stale
      // This is the standard pattern used by major e-commerce platforms
      dataState.loadProductsData(false);
    }
  }, []); // Run once on mount only

  const initializeModalDateTime = (existingDate?: Date | null) => {
    if (existingDate) {
      const dateInstance = new Date(existingDate);
      setSelectedDate(dateInstance);
      setSelectedTime(toTimeValue(dateInstance));
    } else {
      const defaultDate = new Date();
      setSelectedDate(defaultDate);
      setSelectedTime('09:00');
    }
  };

  // Handle shipping option selection — always set active state immediately, open relevant modal
  const handleShippingSelection = (optionId: string) => {
    setSelectedShipping(optionId);
    if (optionId === 'self_pickup') {
      initializeModalDateTime(pickupDateTime);
      setActiveDistributorId(distributorsInfo[0]?.id || null);
      setShowPickupModal(true);
    } else if (optionId === 'seller_delivery') {
      setScheduleModalContext('seller_delivery');
      setScheduleModalStep(1);
      setScheduleStep1Mode(null);
      initializeModalDateTime(scheduledDateTime);
      setActiveDistributorId(distributorsInfo[0]?.id || null);
      setShowScheduleModal(true);
    } else if (optionId === 'buyer_courier') {
      setScheduleModalContext('buyer_courier');
      setScheduleModalStep(1);
      setScheduleStep1Mode(null);
      initializeModalDateTime(scheduledDateTime);
      setActiveDistributorId(distributorsInfo[0]?.id || null);
      setShowScheduleModal(true);
    }
  };

  // Handle per-distributor shipping selection — always set active state immediately, open relevant modal
  const handleDistributorShippingSelection = (distributorId: string, optionId: string) => {
    setSelectedShippingByDistributor(prev => ({ ...prev, [distributorId]: optionId }));
    if (optionId === 'self_pickup') {
      initializeModalDateTime(pickupDateTimeByDistributor[distributorId]);
      setActiveDistributorId(distributorId);
      setShowPickupModal(true);
    } else if (optionId === 'seller_delivery') {
      setScheduleModalContext('seller_delivery');
      setScheduleModalStep(1);
      setScheduleStep1Mode(null);
      initializeModalDateTime(scheduledDateTimeByDistributor[distributorId]);
      setActiveDistributorId(distributorId);
      setShowScheduleModal(true);
    } else if (optionId === 'buyer_courier') {
      setScheduleModalContext('buyer_courier');
      setScheduleModalStep(1);
      setScheduleStep1Mode(null);
      initializeModalDateTime(scheduledDateTimeByDistributor[distributorId]);
      setActiveDistributorId(distributorId);
      setShowScheduleModal(true);
    }
  };

  // Handle date/time selection
  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowTimeDropdown(false);
  };

  // Close dropdown when clicking outside
  const handleCloseDropdown = () => {
    setShowTimeDropdown(false);
  };

  // Step 1 → "managed" chosen: confirm immediately, no date needed
  const confirmManagedSchedule = () => {
    if (isCartCheckout && activeDistributorId) {
      setScheduledDateTimeByDistributor(prev => ({ ...prev, [activeDistributorId]: null }));
      if (scheduleModalContext === 'seller_delivery') {
        setSellerDeliveryModeByDist(prev => ({ ...prev, [activeDistributorId]: 'distributor_managed' }));
      } else {
        setBuyerCourierModeByDist(prev => ({ ...prev, [activeDistributorId]: 'self_managed' }));
      }
    } else {
      setScheduledDateTime(null);
      if (scheduleModalContext === 'seller_delivery') {
        setSellerDeliveryMode('distributor_managed');
      } else {
        setBuyerCourierMode('self_managed');
      }
    }
    setShowScheduleModal(false);
    setShowTimeDropdown(false);
    setScheduleModalStep(1);
    setScheduleStep1Mode(null);
    setActiveDistributorId(null);
  };

  // Step 2 → date/time confirmed
  const confirmScheduledDelivery = () => {
    const [hours, minutes] = selectedTime.split(':');
    const dt = new Date(selectedDate);
    dt.setHours(parseInt(hours), parseInt(minutes));
    if (isCartCheckout && activeDistributorId) {
      setScheduledDateTimeByDistributor(prev => ({ ...prev, [activeDistributorId]: dt }));
      if (scheduleModalContext === 'seller_delivery') {
        setSellerDeliveryModeByDist(prev => ({ ...prev, [activeDistributorId]: 'buyer_scheduled' }));
      } else {
        setBuyerCourierModeByDist(prev => ({ ...prev, [activeDistributorId]: 'buyer_scheduled' }));
      }
    } else {
      setScheduledDateTime(dt);
      if (scheduleModalContext === 'seller_delivery') {
        setSellerDeliveryMode('buyer_scheduled');
      } else {
        setBuyerCourierMode('buyer_scheduled');
      }
    }
    setShowScheduleModal(false);
    setShowTimeDropdown(false);
    setScheduleModalStep(1);
    setScheduleStep1Mode(null);
    setActiveDistributorId(null);
  };

  // Confirm pickup — selectedShipping already set to 'self_pickup' when option was tapped
  const confirmPickup = () => {
    const [hours, minutes] = selectedTime.split(':');
    const combinedDateTime = new Date(selectedDate);
    combinedDateTime.setHours(parseInt(hours), parseInt(minutes));
    if (isCartCheckout && activeDistributorId) {
      setPickupDateTimeByDistributor(prev => ({
        ...prev,
        [activeDistributorId]: combinedDateTime,
      }));
    } else {
      setPickupDateTime(combinedDateTime);
    }
    setShowPickupModal(false);
    setShowTimeDropdown(false);
    setActiveDistributorId(null);
  };

  // Handle delivery modal close with animation - match BuyNowModal system
  const handleDeliveryClose = () => {
    if (isDeliveryClosing) return; // Prevent multiple close calls
    
    setIsDeliveryClosing(true);
    Animated.timing(deliverySlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsDeliveryClosing(false);
      setShowScheduleModal(false);
      setShowTimeDropdown(false);
      setScheduleModalStep(1);
      setScheduleStep1Mode(null);
      setActiveDistributorId(null);
    });
  };

  // Handle pickup modal close with animation - match BuyNowModal system
  const handlePickupClose = () => {
    if (isPickupClosing) return; // Prevent multiple close calls
    
    setIsPickupClosing(true);
    Animated.timing(pickupSlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsPickupClosing(false);
      setShowPickupModal(false);
      setShowTimeDropdown(false);
      setActiveDistributorId(null);
    });
  };

  // Default shipping option is always pre-set to 'seller_delivery'

  // Default shipping option is blank — user must choose

  // Handle delivery modal slide animation - match BuyNowModal system
  useEffect(() => {
    if (showScheduleModal) {
      setIsDeliveryClosing(false);
      deliverySlideAnim.setValue(screenHeight);
      Animated.timing(deliverySlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showScheduleModal, deliverySlideAnim]);

  // Handle pickup modal slide animation - match BuyNowModal system
  useEffect(() => {
    if (showPickupModal) {
      setIsPickupClosing(false);
      pickupSlideAnim.setValue(screenHeight);
      Animated.timing(pickupSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showPickupModal, pickupSlideAnim]);

  // Calculations
  const calculateSubtotal = () => {
    if (isCartCheckout) {
      return selectedCartItems.reduce((total, item) => {
        // Get variant-specific pricing - use new variantOptions structure first
        const marketplaceProduct = getItemProduct(item) as MarketplaceProduct & { variantOptions?: Array<{
          id: number;
          sellingPrice: number;
          attributes: Record<string, string>;
        }> };
        let unitPrice = 0;
        let piecesPerPackage = 1;
        
        // Try new variantOptions structure first
        if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
          // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
          const variantAttributes: Record<string, string> = {};
          if (item.variant && item.variant !== 'Default') {
            item.variant.split(', ').forEach(part => {
              const [key, ...valueParts] = part.split(': ');
              if (key && valueParts.length > 0) {
                variantAttributes[key.trim()] = valueParts.join(': ').trim();
              }
            });
          }
          
          // Find matching variantOption by attributes
          const matchingOption = marketplaceProduct.variantOptions.find(option => {
            if (!option.attributes) return false;
            return Object.entries(variantAttributes).every(([key, value]) => {
              return option.attributes?.[key] === value;
            });
          });
          
          if (matchingOption) {
            unitPrice = typeof matchingOption.sellingPrice === 'string' 
              ? parseFloat(matchingOption.sellingPrice) 
              : matchingOption.sellingPrice || 0;
          } else if (marketplaceProduct.variantOptions.length > 0) {
            // Fallback to first variantOption
            const firstOption = marketplaceProduct.variantOptions[0];
            unitPrice = typeof firstOption.sellingPrice === 'string' 
              ? parseFloat(firstOption.sellingPrice) 
              : firstOption.sellingPrice || 0;
          }
        } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
          // Legacy: Find the selected variant
          const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
          unitPrice = selectedVariant.sellingPrice || 0;
        } else {
          // Fallback to product-level pricing
          unitPrice = marketplaceProduct.sellingPrice || 0;
        }
        
        // Get piecesPerPackage from product level (piece-based system)
        piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
        
        return total + (unitPrice * item.quantity * piecesPerPackage);
      }, 0);
    }
    return totalPrice;
  };
  
  const subtotal = calculateSubtotal();
  const total = subtotal;

  // Validate that all shipping requirements are met before allowing order placement
  const isOrderReady = useMemo(() => {
    if (isCartCheckout) {
      const groups = Object.entries(groupByDistributor(selectedCartItems));
      if (groups.length === 0) return false;
      return groups.every(([distributorId]) => {
        const chosen = selectedShippingByDistributor[distributorId] || '';
        if (!chosen) return false;
        // seller_delivery and buyer_courier require a scheduling preference
        if (chosen === 'seller_delivery') return !!sellerDeliveryModeByDist[distributorId];
        if (chosen === 'buyer_courier') return !!buyerCourierModeByDist[distributorId];
        return true; // self_pickup is always ready once selected
      });
    } else {
      if (!selectedShipping) return false;
      if (selectedShipping === 'seller_delivery') return !!sellerDeliveryMode;
        if (selectedShipping === 'buyer_courier') return !!buyerCourierMode;
      return true; // self_pickup
    }
  }, [isCartCheckout, selectedShipping, selectedShippingByDistributor, sellerDeliveryMode, buyerCourierMode, sellerDeliveryModeByDist, buyerCourierModeByDist, selectedCartItems]);

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    try {
      // Show loading state
    Alert.alert(
      'Order Confirmation',
      `Are you sure you want to place this order for ${formatCurrency(total)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Place Order', 
          style: 'default',
            onPress: async () => {
              if (isPlacingOrder) return;
              setIsPlacingOrder(true);
              try {
                // Generate required fields using marketplace user data
    const buyerId = `LKB-${authUser?.id?.toString().padStart(8, '0') || Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
                const orderDate = new Date().toISOString();
    const customerEmail = authUser?.email || `${addresses[0].phone.replace(/[^0-9]/g, '')}@laku.com`;
                
                let createdOrders = [];
                
                if (isCartCheckout) {
                  // Cart checkout - create separate orders for each distributor
                  const distributorGroups = groupByDistributor(selectedCartItems);
                  
                  for (const [distributorId, items] of Object.entries(distributorGroups)) {
                    // Generate unique order ID for each distributor
                    const orderId = `LKO-${Date.now()}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
                    
                    // Calculate totals for this distributor's items
                    const distributorSubtotal = items.reduce((total, item) => {
                      // Get variant-specific pricing - use new variantOptions structure first
                      const marketplaceProduct = getItemProduct(item) as MarketplaceProduct & { variantOptions?: Array<{
                        id: number;
                        sellingPrice: number;
                        attributes: Record<string, string>;
                      }> };
                      let unitPrice = 0;
                      let piecesPerPackage = 1;
                      
                      // Try new variantOptions structure first
                      if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
                        // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
                        const variantAttributes: Record<string, string> = {};
                        if (item.variant && item.variant !== 'Default') {
                          item.variant.split(', ').forEach(part => {
                            const [key, ...valueParts] = part.split(': ');
                            if (key && valueParts.length > 0) {
                              variantAttributes[key.trim()] = valueParts.join(': ').trim();
                            }
                          });
                        }
                        
                        // Find matching variantOption by attributes
                        const matchingOption = marketplaceProduct.variantOptions.find(option => {
                          if (!option.attributes) return false;
                          return Object.entries(variantAttributes).every(([key, value]) => {
                            return option.attributes?.[key] === value;
                          });
                        });
                        
                        if (matchingOption) {
                          unitPrice = typeof matchingOption.sellingPrice === 'string' 
                            ? parseFloat(matchingOption.sellingPrice) 
                            : matchingOption.sellingPrice || 0;
                        } else if (marketplaceProduct.variantOptions.length > 0) {
                          // Fallback to first variantOption
                          const firstOption = marketplaceProduct.variantOptions[0];
                          unitPrice = typeof firstOption.sellingPrice === 'string' 
                            ? parseFloat(firstOption.sellingPrice) 
                            : firstOption.sellingPrice || 0;
                        }
                      } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
                        // Legacy: Find the selected variant
                        const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
                        unitPrice = selectedVariant.sellingPrice || 0;
                      } else {
                        // Fallback to product-level pricing
                        unitPrice = (item.product as { price?: number }).price || item.product.sellingPrice || 0;
                      }
                      
                      // Get piecesPerPackage from product level (piece-based system)
                      piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                      
                      return total + (unitPrice * item.quantity * piecesPerPackage);
                    }, 0);
                    const firstProduct = getItemProduct(items[0]);
                    const shippingOptions = getAvailableShippingOptions(firstProduct);
                    const selectedId = selectedShippingByDistributor[distributorId] || '';
                    const selectedOption = shippingOptions.find(s => s.id === selectedId);
                    const distributorTotal = distributorSubtotal;
                    
                    const toISODate = (dateValue: Date | null | undefined) => dateValue ? dateValue.toISOString() : null;
                    const toTimeComponent = (dateValue: Date | null | undefined) => {
                      if (!dateValue) return null;
                      const hours = String(dateValue.getHours()).padStart(2, '0');
                      const minutes = String(dateValue.getMinutes()).padStart(2, '0');
                      return `${hours}:${minutes}`;
                    };

                    const orderData = {
                      orderId: orderId,
                      buyerId: buyerId,
                      orderDate: orderDate,
                      distributorUserId: (firstProduct as MarketplaceProduct)?.userId,
                      orderItems: items.map(item => {
                        // Get variant-specific data - use new variantOptions structure first
                      const marketplaceProduct = getItemProduct(item) as MarketplaceProduct & { variantOptions?: Array<{
                          id: number;
                          sellingPrice: number;
                          attributes: Record<string, string>;
                        }> };
                        let unitPrice = 0;
                        let variantOptionId: number | undefined;
                        
                        // Try new variantOptions structure first
                        if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
                          // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
                          const variantAttributes: Record<string, string> = {};
                          if (item.variant && item.variant !== 'Default') {
                            item.variant.split(', ').forEach(part => {
                              const [key, ...valueParts] = part.split(': ');
                              if (key && valueParts.length > 0) {
                                variantAttributes[key.trim()] = valueParts.join(': ').trim();
                              }
                            });
                          }
                          
                          // Find matching variantOption by attributes
                          const matchingOption = marketplaceProduct.variantOptions.find(option => {
                            if (!option.attributes) return false;
                            
                            // Check if all variant attributes match, handling key spacing issues (e.g., 'Color ' vs 'Color')
                            const allMatch = Object.entries(variantAttributes).every(([selectedKey, selectedValue]) => {
                              // Try exact match first
                              if (option.attributes?.[selectedKey] === selectedValue) return true;
                              
                              // Try trimmed key match (handles 'Color' vs 'Color ' issues from database)
                              const trimmedSelectedKey = selectedKey.trim();
                              const matchingKey = Object.keys(option.attributes).find(k => k.trim() === trimmedSelectedKey);
                              if (matchingKey && option.attributes[matchingKey] === selectedValue) return true;
                              
                              return false;
                            });
                            
                            // Verify same number of keys for exact match
                            const attributeKeys = Object.keys(option.attributes).map(k => k.trim());
                            const selectedKeys = Object.keys(variantAttributes).map(k => k.trim());
                            const sameKeyCount = attributeKeys.length === selectedKeys.length;
                            
                            return allMatch && sameKeyCount;
                          });
                          
                          if (matchingOption) {
                            unitPrice = typeof matchingOption.sellingPrice === 'string' 
                              ? parseFloat(matchingOption.sellingPrice) 
                              : matchingOption.sellingPrice || 0;
                            variantOptionId = matchingOption.id;
                          } else if (marketplaceProduct.variantOptions.length > 0) {
                            // Fallback to first variantOption
                            const firstOption = marketplaceProduct.variantOptions[0];
                            unitPrice = typeof firstOption.sellingPrice === 'string' 
                              ? parseFloat(firstOption.sellingPrice) 
                              : firstOption.sellingPrice || 0;
                            variantOptionId = firstOption.id;
                          }
                        } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
                          // Legacy: Find the selected variant
                          const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
                          unitPrice = selectedVariant.sellingPrice || 0;
                          variantOptionId = selectedVariant.id;
                        } else {
                          // Fallback to product-level pricing
                          unitPrice = (item.product as { price?: number }).price || item.product.sellingPrice || 0;
                        }
                        
                        // Get package info from product level (piece-based system)
                        const packageType = marketplaceProduct.packageType || 'Box';
                        const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                        
                        return {
                          productId: item.product.id,
                          productName: item.product.name,
                          packageQuantity: item.quantity,
                          packageType: packageType,
                          variantId: variantOptionId,
                          variantName: item.variant,
                          piecesPerPackage: piecesPerPackage,
                          pricePerPackage: unitPrice * piecesPerPackage,
                          subtotal: unitPrice * item.quantity * piecesPerPackage
                        };
                      }),
                      subtotal: distributorSubtotal,
                      discounts: 0,
                      shippingFee: 0,
                      totalAmount: distributorTotal,
                      totalOrders: items.reduce((sum, item) => {
                        const marketplaceProduct = getItemProduct(item) as MarketplaceProduct;
                        const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                        return sum + (item.quantity * piecesPerPackage);
                      }, 0),
                      contactPerson: authUser?.name || addresses[0].name,
                      storeName: authUser?.storeName || addresses[0].company,
                      contactPhone: authUser?.phone || addresses[0].phone,
                      customerEmail: customerEmail,
                      deliveryAddress: addresses[0].address,
                      deliveryMethod: selectedId === 'self_pickup' ? 'Self Pickup'
                        : selectedId === 'seller_delivery' ? 'Seller/Distributor Delivery'
                        : 'Buyer-arranged Courier',
                      deliveryOption: selectedId,
                      preferredDeliveryDate: (selectedId === 'seller_delivery' || selectedId === 'buyer_courier') && scheduledDateTimeByDistributor[distributorId]
                        ? toISODate(scheduledDateTimeByDistributor[distributorId])
                        : null,
                      preferredDeliveryTime: (selectedId === 'seller_delivery' || selectedId === 'buyer_courier') && scheduledDateTimeByDistributor[distributorId]
                        ? toTimeComponent(scheduledDateTimeByDistributor[distributorId])
                        : null,
                      preferredPickupDate: selectedId === 'self_pickup' && pickupDateTimeByDistributor[distributorId]
                        ? toISODate(pickupDateTimeByDistributor[distributorId])
                        : null,
                      preferredPickupTime: selectedId === 'self_pickup' && pickupDateTimeByDistributor[distributorId]
                        ? toTimeComponent(pickupDateTimeByDistributor[distributorId])
                        : null,
                      shippingMethodLabel: selectedOption?.name,
                      shippingMethod: selectedOption?.name,
                      estimatedDeliveryMinDays: null,
                      estimatedDeliveryMaxDays: null,
                      orderStatus: 'Pending',
                      paymentStatus: 'Unpaid',
                      paymentTerms: paymentTermsForOrder,
                      userId: authUser?.id || null
                    };
                    
                    const response = await fetch(`${API_BASE_URL}/api/mobile/orders`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                      body: JSON.stringify(orderData)
                    });

                    if (!response.ok) {
                      const errorText = await response.text();
                      throw new Error(`Failed to create order for ${distributorId}: ${response.status} - ${errorText}`);
                    }

                    const createdOrder = await response.json();
                    createdOrders.push(createdOrder);
                  }
                  
                  // Clear cart after all orders are created
                  await cartStore.clearCart();
                } else {
                  // Single product checkout
                  const orderId = `LKO-${Date.now()}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
                  
                  const toISODate = (dateValue: Date | null | undefined) => dateValue ? dateValue.toISOString() : null;
                  const toTimeComponent = (dateValue: Date | null | undefined) => {
                    if (!dateValue) return null;
                    const hours = String(dateValue.getHours()).padStart(2, '0');
                    const minutes = String(dateValue.getMinutes()).padStart(2, '0');
                    return `${hours}:${minutes}`;
                  };

                  const selectedOption =
                    shippingOptions.find(option => option.id === selectedShipping);

                  const orderData = {
                    orderId: orderId,
                    buyerId: buyerId,
                    orderDate: orderDate,
                    distributorUserId: (product as MarketplaceProduct)?.userId,
                    orderItems: [{
                      productId: productId,
                      productName: product?.name || 'Product',
                      packageQuantity: quantity,
                      packageType: packageType,
                      piecesPerPackage: piecesPerPackage,
                      pricePerPackage: unitPrice * piecesPerPackage,
                      subtotal: totalPrice,
                      variantId: params.variantId && params.variantId !== '' ? parseInt(params.variantId) : undefined,
                      variantName: params.variantName || 'Default'
                    }],
                    subtotal: totalPrice,
                    discounts: 0,
                    shippingFee: 0,
                    totalAmount: totalPrice,
                    totalOrders: quantity * piecesPerPackage,
                    contactPerson: authUser?.name || addresses[0].name,
                    storeName: authUser?.storeName || addresses[0].company,
                    contactPhone: authUser?.phone || addresses[0].phone,
                    customerEmail: customerEmail,
                    deliveryAddress: addresses[0].address,
                    deliveryMethod: selectedShipping === 'self_pickup' ? 'Self Pickup'
                      : selectedShipping === 'seller_delivery' ? 'Seller/Distributor Delivery'
                      : 'Buyer-arranged Courier',
                    deliveryOption: selectedShipping,
                    preferredDeliveryDate: (selectedShipping === 'seller_delivery' || selectedShipping === 'buyer_courier') && scheduledDateTime
                      ? toISODate(scheduledDateTime)
                      : null,
                    preferredDeliveryTime: (selectedShipping === 'seller_delivery' || selectedShipping === 'buyer_courier') && scheduledDateTime
                      ? toTimeComponent(scheduledDateTime)
                      : null,
                    preferredPickupDate: selectedShipping === 'self_pickup' && pickupDateTime
                      ? toISODate(pickupDateTime)
                      : null,
                    preferredPickupTime: selectedShipping === 'self_pickup' && pickupDateTime
                      ? toTimeComponent(pickupDateTime)
                      : null,
                    shippingMethodLabel: selectedOption?.name,
                    shippingMethod: selectedOption?.name,
                    estimatedDeliveryMinDays: null,
                    estimatedDeliveryMaxDays: null,
                    orderStatus: 'Pending',
                    paymentStatus: 'Unpaid',
                    paymentTerms: paymentTermsForOrder,
                    userId: authUser?.id || null
                  };
                  
                  const response = await fetch(`${API_BASE_URL}/api/mobile/orders`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(orderData)
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to create order: ${response.status} - ${errorText}`);
                  }

                  const createdOrder = await response.json();
                  createdOrders.push(createdOrder);
                }

                // Collect product images from cart items or single product
                    const productImages = isCartCheckout 
                  ? selectedCartItems.map((item: CartItem) => getItemProduct(item)?.images?.[0]).filter(Boolean)
                  : productImage ? [productImage] : [];
                
                // Create immediate notification for successful order
                if (createdOrders.length > 0) {
                  const firstOrder = createdOrders[0];
                  // API returns { order, orders }; orderId can be on root, order.orderId, or orders[0].orderId
                  const o = firstOrder?.order ?? firstOrder?.orders?.[0] ?? firstOrder;
                  const orderId = (firstOrder?.orderId ?? o?.orderId ?? firstOrder?.order_id) || 'Unknown';
                  const orderStatus = firstOrder?.orderStatus ?? o?.orderStatus ?? firstOrder?.order_status ?? o?.order_status ?? 'Pending';
                  
                  // In-app list (AsyncStorage)
                  await NotificationService.createOrderNotifications(
                    orderId, 
                    createdOrders.length, 
                    productImages, 
                    authUser?.id || null,
                    orderStatus,
                    undefined
                  );

                  // System notification (tray) so buyer sees "Order Placed" on their phone
                  try {
                    await pushNotificationService.showOrderNotification(
                      orderId,
                      'Pending',
                      'Order Placed',
                      createdOrders.length > 1
                        ? `Your ${createdOrders.length} orders have been placed and are awaiting confirmation.`
                        : `Your order #${orderId} has been placed and is awaiting confirmation.`
                    );
                  } catch (_) { /* best-effort */ }

                  // Navigate to payment success page with the first order's details
                  router.push({
                    pathname: '/payment-success',
                    params: {
                      orderId,
                      totalAmount: total.toString(),
                      orderStatus,
                      orderCount: createdOrders.length.toString()
                    }
                  });
                }

              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to place order. Please try again.';
                Alert.alert('Error', errorMessage);
              } finally {
                setIsPlacingOrder(false);
              }
          }
        }
      ]
    );
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>Checkout</Text>
              </View>
            </View>
          ),
        }}
      />
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }} // Add space for sticky bottom bar
        showsVerticalScrollIndicator={false}
      >
        {/* Business Information - Always show distributor info */}
        {distributorsInfo.length > 0 && (
          <View style={[styles.section]}>
            <View style={styles.businessCard}>
              <View style={styles.sectionTitleContainer}>
                <Building2 size={20} color="#0a61d7" />
                <Text style={styles.sectionTitle}>Business Information</Text>
              </View>
              
              {/* Show first distributor + "and more" if multiple */}
              <Text style={styles.businessName}>
                {distributorsInfo[0].companyName}
                {distributorsInfo.length > 1 && ` and ${distributorsInfo.length - 1} more`}
              </Text>
              
              <Text style={styles.businessType}>Industry: {distributorsInfo[0].industryType}</Text>
              <Text style={styles.businessDetails}>Contact: {distributorsInfo[0].contactPerson}</Text>
              {/* Show additional distributors if more than one */}
              {distributorsInfo.length > 1 && (
                <View style={styles.additionalDistributors}>
                  <Text style={styles.additionalDistributorsTitle}>Other Distributors:</Text>
                  {distributorsInfo.slice(1).map((dist, index) => (
                    <Text key={index} style={styles.additionalDistributorItem}>
                      • {dist.companyName} - {dist.industryType}
                    </Text>
                  ))}
                </View>
              )}

              {selectedPayment === 'cod' && (
                <>
                  <View style={styles.businessDivider} />
                  <Text style={styles.bankSectionTitle}>Payment</Text>
                  <Text style={styles.bankMissing}>
                    You selected Cash on Delivery. Arrange payment directly with the distributor when you receive the goods.
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.addressCard}>
            <View style={styles.sectionTitleContainer}>
              <MapPin size={20} color="#0a61d7" />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <TouchableOpacity>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.addressName}>{addresses[0].name}</Text>
            <Text style={styles.addressCompany}>{addresses[0].company}</Text>
            <Text style={styles.addressText}>{addresses[0].address}</Text>
            <Text style={styles.addressPhone}>{addresses[0].phone}</Text>
            <View style={styles.defaultBadge}>
              <CheckCircle size={16} color="#10b981" />
              <Text style={styles.defaultText}>Default Address</Text>
            </View>
          </View>
        </View>

        {/* Order Details & Shipping Method */}
        {isCartCheckout ? (
          // Cart checkout - show separate sections for each distributor
          Object.entries(distributorGroups).map(([distributorId, items]) => {
            const firstProduct = items[0].product as MarketplaceProduct;
            const distributorInfo = getDistributorInfo(firstProduct);
            const shippingOptions = getAvailableShippingOptions(firstProduct);
            
            return (
              <View key={distributorId} style={[styles.section, styles.distributorSection]}>
                <View style={styles.productCard}>
                  <View style={styles.sectionTitleContainer}>
                    <Package size={20} color="#0a61d7" />
                    <Text style={styles.sectionTitle}>Products from {distributorInfo.companyName}</Text>
                  </View>
                  
                  {/* Products from this distributor */}
                  {items.map((item, index) => (
                    <View key={item.id} style={[styles.productRow, index > 0 && styles.productRowSpacing]}>
                      <View style={styles.productImageContainer}>
                        {item.product.images?.[0] ? (
                          <Image source={{ uri: item.product.images[0] }} style={styles.productImage} />
                        ) : (
                          <View style={styles.imagePlaceholder}>
                            <Package size={32} color="#9CA3AF" />
                          </View>
                        )}
                      </View>
                      <View style={styles.productDetails}>
                        <View style={styles.productNameRow}>
                        <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text>
                          {(() => {
                            const marketplaceProduct = item.product as MarketplaceProduct;
                            const offerBadge = marketplaceProduct.offerBadge;
                            const hasActiveOffer = marketplaceProduct.hasActiveOffer;
                            const discount = marketplaceProduct.discount || 0;
                            const originalPrice = marketplaceProduct.originalSellingPrice || 0;
                            const currentPrice = marketplaceProduct.sellingPrice || 0;
                            
                            // Calculate discount display based on type
                            let discountDisplay = 'Discount';
                            if (marketplaceProduct.discountType === 'fixed' && marketplaceProduct.discountValue) {
                              // Show fixed discount amount with currency
                              discountDisplay = `${formatCurrency(marketplaceProduct.discountValue)} OFF`;
                            } else {
                              // Calculate percentage discount if we have both prices
                              let discountPercentage = 0;
                              if (originalPrice > 0 && currentPrice > 0 && currentPrice < originalPrice) {
                                discountPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
                              }
                              if (discountPercentage > 0) {
                                discountDisplay = `${discountPercentage}% OFF`;
                              }
                            }
                            
                            // Only show DISCOUNT badge (not Promotion badge)
                            if (offerBadge && hasActiveOffer) {
                              if (offerBadge === 'Discount' || offerBadge === 'All Offers') {
                                return (
                                  <View style={styles.discountBadge}>
                                    <Text style={styles.discountBadgeText}>
                                      {discountDisplay}
                                    </Text>
                                  </View>
                                );
                              }
                            } else if (discount > 0) {
                              return (
                                <View style={styles.discountBadge}>
                                  <Text style={styles.discountBadgeText}>
                                    -{discount}%
                                  </Text>
                                </View>
                              );
                            }
                            return null;
                          })()}
                        </View>
                        {item.variant && item.variant !== 'Default' ? (
                          <Text style={styles.variantName} numberOfLines={2}>
                            {item.variant}
                          </Text>
                        ) : null}
                        <Text style={styles.productSpecs}>
                          {(() => {
                            // Get package info from product level (piece-based system)
                            const marketplaceProduct = item.product as MarketplaceProduct;
                            const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                            const packageType = marketplaceProduct.packageType || 'Box';
                            
                            return `${piecesPerPackage} pieces per ${packageType}`;
                          })()}
                        </Text>
                        <View style={styles.priceRow}>
                          <View style={styles.priceContainer}>
                            {(() => {
                              // Get variant-specific pricing - use new variantOptions structure first
                              const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
                                id: number;
                                sellingPrice: number;
                                originalSellingPrice?: number | string;
                                attributes: Record<string, string>;
                              }> };
                              let unitPrice = 0;
                              let originalPrice = 0;
                              
                              // Try new variantOptions structure first
                              if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
                                // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
                                const variantAttributes: Record<string, string> = {};
                                if (item.variant && item.variant !== 'Default') {
                                  item.variant.split(', ').forEach(part => {
                                    const [key, ...valueParts] = part.split(': ');
                                    if (key && valueParts.length > 0) {
                                      variantAttributes[key.trim()] = valueParts.join(': ').trim();
                                    }
                                  });
                                }
                                
                                // Find matching variantOption by attributes
                                const matchingOption = marketplaceProduct.variantOptions.find(option => {
                                  if (!option.attributes) return false;
                                  return Object.entries(variantAttributes).every(([key, value]) => {
                                    return option.attributes?.[key] === value;
                                  });
                                });
                                
                                if (matchingOption) {
                                  unitPrice = typeof matchingOption.sellingPrice === 'string' 
                                    ? parseFloat(matchingOption.sellingPrice) 
                                    : matchingOption.sellingPrice || 0;
                                  
                                  const origPrice = matchingOption.originalSellingPrice;
                                  originalPrice = origPrice 
                                    ? (typeof origPrice === 'string' ? parseFloat(origPrice) : origPrice)
                                    : 0;
                                } else if (marketplaceProduct.variantOptions.length > 0) {
                                  // Fallback to first variantOption
                                  const firstOption = marketplaceProduct.variantOptions[0];
                                  unitPrice = typeof firstOption.sellingPrice === 'string' 
                                    ? parseFloat(firstOption.sellingPrice) 
                                    : firstOption.sellingPrice || 0;
                                  
                                  const origPrice = firstOption.originalSellingPrice;
                                  originalPrice = origPrice 
                                    ? (typeof origPrice === 'string' ? parseFloat(origPrice) : origPrice)
                                    : 0;
                                }
                              } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
                                // Legacy: Find the selected variant
                                const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
                                unitPrice = selectedVariant.sellingPrice || 0;
                                originalPrice = selectedVariant.originalSellingPrice || 0;
                              } else {
                                // Fallback to product-level pricing
                                unitPrice = marketplaceProduct.sellingPrice || (item.product as { price?: number }).price || 0;
                                originalPrice = marketplaceProduct.originalSellingPrice || 0;
                              }
                              
                              // Show discount if original price is higher than current price
                              if (originalPrice > 0 && originalPrice > unitPrice) {
                                return (
                                  <>
                                    <Text style={styles.originalPrice}>
                                      {formatCurrency(originalPrice)} per piece
                                    </Text>
                                    <Text style={styles.discountedPrice}>
                                      {formatCurrency(unitPrice)} per piece
                                    </Text>
                                  </>
                                );
                              } else {
                                return (
                                  <Text style={styles.productPrice}>
                                    {formatCurrency(unitPrice)} per piece
                                  </Text>
                                );
                              }
                            })()}
                          </View>
                          <View style={{alignItems: 'flex-end', flexDirection: 'row', gap: 6}}>
                            {(() => {
                              // Calculate promotion using MOQ-aware logic (matches BuyNowModal)
                              const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
                                id: number;
                                moq?: number;
                                attributes: Record<string, string>;
                              }> };
                              
                              if (!marketplaceProduct.promotionDetails) return null;
                              
                              const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                              const totalPieces = item.quantity * piecesPerPackage;
                              
                              // Get MOQ from selected variantOption
                              let moq: number | null = null;
                              if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
                                // Parse variantName string to match attributes
                                const variantAttributes: Record<string, string> = {};
                                if (item.variant && item.variant !== 'Default') {
                                  item.variant.split(', ').forEach(part => {
                                    const [key, ...valueParts] = part.split(': ');
                                    if (key && valueParts.length > 0) {
                                      variantAttributes[key.trim()] = valueParts.join(': ').trim();
                                    }
                                  });
                                }
                                
                                const matchingOption = marketplaceProduct.variantOptions.find(option => {
                                  if (!option.attributes) return false;
                                  
                                  // Check if all variant attributes match, handling key spacing issues (e.g., 'Color ' vs 'Color')
                                  return Object.entries(variantAttributes).every(([selectedKey, selectedValue]) => {
                                    // Try exact match first
                                    if (option.attributes?.[selectedKey] === selectedValue) return true;
                                    
                                    // Try trimmed key match (handles 'Color' vs 'Color ' issues from database)
                                    const trimmedSelectedKey = selectedKey.trim();
                                    const matchingKey = Object.keys(option.attributes).find(k => k.trim() === trimmedSelectedKey);
                                    if (matchingKey && option.attributes[matchingKey] === selectedValue) return true;
                                    
                                    return false;
                                  }) && Object.keys(variantAttributes).length === Object.keys(option.attributes || {}).length;
                                });
                                
                                if (matchingOption?.moq) {
                                  moq = matchingOption.moq;
                                }
                              }
                              
                              // Calculate promotion using BuyNowModal logic
                              const minQty = marketplaceProduct.promotionDetails.minQuantity || 1;
                              const freeQty = marketplaceProduct.promotionDetails.freeQuantity || 0;
                              
                              let totalFreeItems = 0;
                              if (!moq) {
                                // No MOQ: calculate from total quantity
                                const completeSets = Math.floor(totalPieces / minQty);
                                totalFreeItems = completeSets * freeQty;
                              } else if (totalPieces >= moq) {
                                // MOQ exists and met: calculate from quantity above MOQ
                                const quantityAboveMOQ = totalPieces - moq;
                                const completeSets = Math.floor(quantityAboveMOQ / minQty);
                                totalFreeItems = completeSets * freeQty;
                              }
                              
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
                              return null;
                            })()}
                            <Text style={styles.quantityBadge}>x{item.quantity}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                  
                  {/* Shipping Options for this distributor */}
                  <View style={styles.shippingSection}>
                    <View style={styles.shippingTitleContainer}>
                      <Truck size={20} color="#0a61d7" />
                      <Text style={styles.shippingTitle}>Shipping Option</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>
                      Shipping cost is agreed between buyer and distributor — not charged at checkout.
                    </Text>
                    {shippingOptions.map((option) => {
                      const selectedOptForDist = selectedShippingByDistributor[distributorId] || '';
                      const pickupDateForDist = pickupDateTimeByDistributor[distributorId] || null;
                      const scheduledDateForDist = scheduledDateTimeByDistributor[distributorId] || null;
                      const sellerModeForDist = sellerDeliveryModeByDist[distributorId] || null;
                      const courierModeForDist = buyerCourierModeByDist[distributorId] || null;

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.shippingOption, selectedOptForDist === option.id && styles.shippingOptionSelected]}
                          onPress={() => handleDistributorShippingSelection(distributorId, option.id)}
                        >
                          <View style={styles.shippingInfo}>
                            <Text style={[styles.shippingName, selectedOptForDist === option.id && { color: '#0a61d7' }]}>{option.name}</Text>
                            <Text style={styles.shippingDescription}>{option.description}</Text>
                            {option.id === 'self_pickup' && (
                              <View style={styles.shippingTime}>
                                <Clock size={14} color="#6B7280" />
                                <Text style={styles.shippingTimeText}>
                                  {selectedOptForDist === 'self_pickup' && pickupDateForDist
                                    ? `Pickup: ${pickupDateForDist.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                    : 'Tap to schedule pickup date & time'}
                                </Text>
                              </View>
                            )}
                            {option.id === 'seller_delivery' && selectedOptForDist === 'seller_delivery' && (
                              <View style={styles.shippingTime}>
                                <Clock size={14} color="#6B7280" />
                                <Text style={styles.shippingTimeText}>
                                  {sellerModeForDist === 'buyer_scheduled' && scheduledDateForDist
                                    ? `Scheduled: ${scheduledDateForDist.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                    : sellerModeForDist === 'distributor_managed'
                                    ? 'Distributor manages the schedule'
                                    : 'Tap to set scheduling preference'}
                                </Text>
                              </View>
                            )}
                            {option.id === 'buyer_courier' && selectedOptForDist === 'buyer_courier' && (
                              <View style={styles.shippingTime}>
                                <Clock size={14} color="#6B7280" />
                                <Text style={styles.shippingTimeText}>
                                  {courierModeForDist === 'buyer_scheduled' && scheduledDateForDist
                                    ? `Courier: ${scheduledDateForDist.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                    : courierModeForDist === 'self_managed'
                                    ? "I'll manage my own courier"
                                    : 'Tap to set scheduling preference'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.shippingPrice}>
                            {selectedOptForDist === option.id && <CheckCircle size={20} color="#0a61d7" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          // Single product checkout
          <View style={styles.section}>
            <View style={styles.productCard}>
              <View style={styles.sectionTitleContainer}>
                <Package size={20} color="#0a61d7" />
                <Text style={styles.sectionTitle}>Order Details & Shipping</Text>
              </View>
              
              {/* Product Row - Shopee Style */}
              <View style={styles.productRow}>
                <View style={styles.productImageContainer}>
                  {productImage ? (
                    <Image source={{ uri: productImage }} style={styles.productImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Package size={32} color="#9CA3AF" />
                    </View>
                  )}
                </View>
                <View style={styles.productDetails}>
                  <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
                  {params.variantName && params.variantName !== 'Default' ? (
                    <Text style={styles.variantName} numberOfLines={2}>
                      {params.variantName}
                    </Text>
                  ) : null}
                  <Text style={styles.productSpecs}>
                    {piecesPerPackage} pieces per {packageType}
                  </Text>
                  <View style={styles.priceRow}>
                    <View style={styles.priceContainer}>
                      {(() => {
                        // Use actual product data if available, otherwise fallback to URL parameters
                        if (product) {
                          const actualProduct = product as MarketplaceProduct;
                          
                          return actualProduct.originalSellingPrice > 0 && 
                                 actualProduct.originalSellingPrice > actualProduct.sellingPrice ? (
                            <>
                              <Text style={styles.originalPrice}>
                                {formatCurrency(actualProduct.originalSellingPrice)} per piece
                              </Text>
                              <Text style={styles.discountedPrice}>
                                {formatCurrency(actualProduct.sellingPrice)} per piece
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.productPrice}>
                              {formatCurrency(actualProduct.sellingPrice)} per piece
                            </Text>
                          );
                        } else {
                          // Fallback to URL parameters if product is not found
                          const originalPriceValue = parseFloat(originalPrice.toString());
                          const unitPriceValue = parseFloat(unitPrice.toString());
                          
                          return originalPriceValue > 0 && originalPriceValue > unitPriceValue ? (
                            <>
                              <Text style={styles.originalPrice}>
                                {formatCurrency(originalPriceValue)} per piece
                              </Text>
                              <Text style={styles.discountedPrice}>
                                {formatCurrency(unitPriceValue)} per piece
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.productPrice}>
                              {formatCurrency(unitPriceValue)} per piece
                            </Text>
                          );
                        }
                      })()}
                    </View>
                    <View style={{alignItems: 'flex-end', flexDirection: 'row', gap: 6}}>
                      {(() => {
                        // Calculate promotion using standardized function
                        const variantName = params.variantName || null;
                        const promotionGift = calculateProductPromotion(
                          product,
                          quantity,
                          variantName
                        );
                        
                        if (promotionGift) {
                          return (
                            <View style={styles.promotionGiftBadge}>
                              <Gift size={12} color="#9333EA" />
                              <Text style={styles.promotionGiftText}>
                                +{promotionGift.freeQty} Free
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                      <Text style={styles.quantityBadge}>x{quantity}</Text>
                    </View>
                  </View>
                </View>
              </View>
              
              {/* Shipping Options */}
              <View style={styles.shippingSection}>
                <View style={styles.shippingTitleContainer}>
                  <Truck size={20} color="#0a61d7" />
                  <Text style={styles.shippingTitle}>Shipping Option</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  Shipping cost is agreed between buyer and distributor, not charged at checkout.
                </Text>
                {shippingOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.shippingOption, selectedShipping === option.id && styles.shippingOptionSelected]}
                    onPress={() => handleShippingSelection(option.id)}
                  >
                    <View style={styles.shippingInfo}>
                      <Text style={[styles.shippingName, selectedShipping === option.id && { color: '#0a61d7' }]}>{option.name}</Text>
                      <Text style={styles.shippingDescription}>{option.description}</Text>
                      {option.id === 'self_pickup' && (
                        <View style={styles.shippingTime}>
                          <Clock size={14} color="#6B7280" />
                          <Text style={styles.shippingTimeText}>
                            {selectedShipping === 'self_pickup' && pickupDateTime
                              ? `Pickup: ${pickupDateTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                              : 'Tap to schedule pickup date & time'}
                          </Text>
                        </View>
                      )}
                      {option.id === 'seller_delivery' && selectedShipping === 'seller_delivery' && (
                        <View style={styles.shippingTime}>
                          <Clock size={14} color="#6B7280" />
                          <Text style={styles.shippingTimeText}>
                            {sellerDeliveryMode === 'buyer_scheduled' && scheduledDateTime
                              ? `Scheduled: ${scheduledDateTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                              : sellerDeliveryMode === 'distributor_managed'
                              ? 'Distributor manages the schedule'
                              : 'Tap to set scheduling preference'}
                          </Text>
                        </View>
                      )}
                      {option.id === 'buyer_courier' && selectedShipping === 'buyer_courier' && (
                        <View style={styles.shippingTime}>
                          <Clock size={14} color="#6B7280" />
                          <Text style={styles.shippingTimeText}>
                            {buyerCourierMode === 'buyer_scheduled' && scheduledDateTime
                              ? `Courier: ${scheduledDateTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                              : buyerCourierMode === 'self_managed'
                              ? "I'll manage my own courier"
                              : 'Tap to set scheduling preference'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.shippingPrice}>
                      {selectedShipping === option.id && <CheckCircle size={20} color="#0a61d7" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.paymentCard}>
            <View style={styles.sectionTitleContainer}>
              <CreditCard size={20} color="#0a61d7" />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentOption,
                selectedPayment === method.id && styles.paymentOptionSelected
              ]}
              onPress={() => setSelectedPayment(method.id)}
            >
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>{method.name}</Text>
                <Text style={styles.paymentDescription}>{method.description}</Text>
              </View>
              {selectedPayment === method.id && (
                <CheckCircle size={20} color="#0a61d7" />
              )}
            </TouchableOpacity>
          ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.summaryCard}>
            <View style={styles.sectionTitleContainer}>
              <Package size={20} color="#111827" />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#6B7280', fontSize: 11 }]}>
                Shipping cost is agreed between buyer and distributor (not included here)
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Payment</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            By placing this order, you agree to our Terms of Service and Privacy Policy.
            This is a B2B transaction subject to business terms and conditions.
          </Text>
        </View>
      </ScrollView>
      
      {/* Bottom Action Bar - Sticky */}
      <View style={styles.bottomBar}>
        <View style={styles.totalSection}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>{formatCurrency(total)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            (!isOrderReady || isPlacingOrder) && { backgroundColor: '#9CA3AF' }
          ]}
          onPress={handlePlaceOrder}
          disabled={!isOrderReady || isPlacingOrder}
        >
          <Text style={styles.placeOrderText}>{isPlacingOrder ? 'Placing...' : 'Place Order'}</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule Modal — Step 1: choose mode / Step 2: pick date & time */}
      <Modal
        visible={showScheduleModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleDeliveryClose}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleDeliveryClose}
        >
          <Animated.View
            style={[styles.modalContent, { transform: [{ translateY: deliverySlideAnim }] }]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>

              {/* ── STEP 1: Mode selection ── */}
              {scheduleModalStep === 1 && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {scheduleModalContext === 'seller_delivery' ? 'Seller Delivery' : 'Courier Schedule'}
                    </Text>
                    <TouchableOpacity onPress={handleDeliveryClose}>
                      <X size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalBody}>
                    <Text style={styles.modalSubtitle}>How would you like to handle the schedule?</Text>

                    <TouchableOpacity
                      style={[styles.scheduleModeOption, scheduleStep1Mode === 'buyer_scheduled' && styles.scheduleModeOptionSelected]}
                      onPress={() => setScheduleStep1Mode('buyer_scheduled')}
                    >
                      <Calendar size={20} color={scheduleStep1Mode === 'buyer_scheduled' ? '#0a61d7' : '#6B7280'} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.scheduleModeText, scheduleStep1Mode === 'buyer_scheduled' && { color: '#0a61d7' }]}>
                          {scheduleModalContext === 'seller_delivery' ? 'I will schedule the delivery' : 'Schedule courier pickup'}
                        </Text>
                        <Text style={styles.scheduleModeDetail}>Pick a preferred date & time</Text>
                      </View>
                      {scheduleStep1Mode === 'buyer_scheduled' ? <CheckCircle size={18} color="#0a61d7" /> : <ChevronRight size={18} color="#9CA3AF" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.scheduleModeOption, scheduleStep1Mode === 'managed' && styles.scheduleModeOptionSelected]}
                      onPress={() => setScheduleStep1Mode('managed')}
                    >
                      <Building2 size={20} color={scheduleStep1Mode === 'managed' ? '#0a61d7' : '#6B7280'} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.scheduleModeText, scheduleStep1Mode === 'managed' && { color: '#0a61d7' }]}>
                          {scheduleModalContext === 'seller_delivery' ? 'Distributor manages the schedule' : "I'll self-manage the courier"}
                        </Text>
                        <Text style={styles.scheduleModeDetail}>
                          {scheduleModalContext === 'seller_delivery'
                            ? 'No specific date, distributor will contact you'
                            : 'No specific date, you will arrange independently'}
                        </Text>
                      </View>
                      {scheduleStep1Mode === 'managed' ? <CheckCircle size={18} color="#0a61d7" /> : <ChevronRight size={18} color="#9CA3AF" />}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleDeliveryClose}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmButton, !scheduleStep1Mode && { opacity: 0.4 }]}
                      disabled={!scheduleStep1Mode}
                      onPress={() => {
                        if (scheduleStep1Mode === 'buyer_scheduled') {
                          initializeModalDateTime(null);
                          setScheduleModalStep(2);
                        } else {
                          confirmManagedSchedule();
                        }
                      }}
                    >
                      <Text style={styles.confirmButtonText}>
                        {scheduleStep1Mode === 'buyer_scheduled' ? 'Next' : 'Confirm'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── STEP 2: Date & time picker ── */}
              {scheduleModalStep === 2 && (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      onPress={() => { setShowTimeDropdown(false); setScheduleModalStep(1); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <ArrowLeft size={20} color="#374151" />
                      <Text style={[styles.modalTitle, { fontSize: 17 }]}>
                        {scheduleModalContext === 'seller_delivery' ? 'Set Delivery Time' : 'Set Courier Time'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeliveryClose}>
                      <X size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalBody}>
                    <Text style={styles.modalSubtitle}>Choose your preferred date and time</Text>

                    <View style={styles.dateTimeSection}>
                      <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Calendar size={20} color="#0a61d7" />
                        <View style={styles.dateTimeInfo}>
                          <Text style={styles.dateTimeLabel}>
                            {scheduleModalContext === 'seller_delivery' ? 'Delivery Date' : 'Courier Date'}
                          </Text>
                          <Text style={styles.dateTimeValue}>{formatDate(selectedDate)}</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimeDropdown(!showTimeDropdown)}
                      >
                        <Clock size={20} color="#0a61d7" />
                        <View style={styles.dateTimeInfo}>
                          <Text style={styles.dateTimeLabel}>
                            {scheduleModalContext === 'seller_delivery' ? 'Delivery Time' : 'Courier Time'}
                          </Text>
                          <Text style={styles.dateTimeValue}>{formatTime(selectedTime)}</Text>
                        </View>
                        <ChevronDown size={20} color="#6B7280" />
                      </TouchableOpacity>

                      {showTimeDropdown && (
                        <>
                          <TouchableOpacity
                            style={styles.dropdownOverlay}
                            onPress={handleCloseDropdown}
                            activeOpacity={1}
                          />
                          <View style={styles.timeDropdown}>
                            <View style={styles.timeDropdownHeader}>
                              <Text style={styles.timeDropdownHeaderText}>Select Time</Text>
                            </View>
                            <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                              {timeOptions.map((time) => (
                                <TouchableOpacity
                                  key={time}
                                  style={[styles.timeOption, selectedTime === time && styles.timeOptionSelected]}
                                  onPress={() => handleTimeSelect(time)}
                                >
                                  <Text style={[styles.timeOptionText, selectedTime === time && styles.timeOptionTextSelected]}>
                                    {formatTime(time)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleDeliveryClose}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={confirmScheduledDelivery}>
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Pickup Modal */}
      <Modal
        visible={showPickupModal}
        transparent={true}
        animationType="none"
        onRequestClose={handlePickupClose}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handlePickupClose}
        >
          <Animated.View 
            style={[
              styles.pickupModalContent,
              {
                transform: [{ translateY: pickupSlideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ flex: 1 }}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Pickup</Text>
              <TouchableOpacity onPress={handlePickupClose}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Choose your preferred pickup date and time</Text>
              
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupAddressLabel}>Pickup Location:</Text>
                <Text style={styles.pickupAddress} numberOfLines={1} ellipsizeMode="tail">
                  {activeDistributorInfo?.companyName || 'Distributor Company'}
                </Text>
                <Text style={styles.pickupAddressDetail} numberOfLines={2} ellipsizeMode="tail">
                  {activeDistributorInfo?.pickupAddress || activeDistributorInfo?.businessAddress || 'Address not available'}
                </Text>
              </View>
              
              <View style={styles.dateTimeSection}>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={20} color="#0a61d7" />
                  <View style={styles.dateTimeInfo}>
                    <Text style={styles.dateTimeLabel}>Pickup Date</Text>
                    <Text style={styles.dateTimeValue}>{formatDate(selectedDate)}</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimeDropdown(!showTimeDropdown)}
                >
                  <Clock size={20} color="#0a61d7" />
                  <View style={styles.dateTimeInfo}>
                    <Text style={styles.dateTimeLabel}>Pickup Time</Text>
                    <Text style={styles.dateTimeValue}>{formatTime(selectedTime)}</Text>
                  </View>
                  <ChevronDown size={20} color="#6B7280" />
                </TouchableOpacity>
                
                {showTimeDropdown && (
                  <>
                    <TouchableOpacity 
                      style={styles.dropdownOverlay}
                      onPress={handleCloseDropdown}
                      activeOpacity={1}
                    />
                    <View style={styles.timeDropdown}>
                      <View style={styles.timeDropdownHeader}>
                        <Text style={styles.timeDropdownHeaderText}>Select Time</Text>
                      </View>
                      <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                        {timeOptions.map((time) => (
                          <TouchableOpacity
                            key={time}
                            style={[
                              styles.timeOption,
                              selectedTime === time && styles.timeOptionSelected
                            ]}
                            onPress={() => handleTimeSelect(time)}
                          >
                            <Text style={[
                              styles.timeOptionText,
                              selectedTime === time && styles.timeOptionTextSelected
                            ]}>
                              {formatTime(time)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
              
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handlePickupClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmPickup}
              >
                <Text style={styles.confirmButtonText}>Confirm Pickup</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
          style={styles.picker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  distributorSection: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  editText: {
    fontSize: 14,
    color: '#0a61d7',
    fontWeight: '500',
  },
  businessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  additionalDistributors: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  additionalDistributorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  additionalDistributorItem: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  businessDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  businessDivider: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bankSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  bankMissing: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  addressCompany: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  addressPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  defaultText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    marginLeft: 4,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  shippingSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  shippingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shippingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
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
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flexShrink: 1,
  },
  discountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: 'bold',
  },
  variantName: {
    fontSize: 12,
    color: '#6B7280',
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
  },
  productRowSpacing: {
    marginTop: 5,
    paddingTop: 5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  shippingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  shippingOptionSelected: {
    backgroundColor: '#F0F7FF',
  },
  scheduleModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  scheduleModeOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  scheduleModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  scheduleModeDetail: {
    fontSize: 12,
    color: '#6B7280',
  },
  shippingInfo: {
    flex: 1,
  },
  shippingName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  shippingDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  shippingTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shippingTimeText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  shippingPrice: {
    alignItems: 'flex-end',
  },
  shippingPriceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#0a61d7',
    backgroundColor: '#F0F7FF',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  totalRow: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginBottom: -5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a61d7',
  },
  termsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'left',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 18, // Add extra padding for safe area
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  totalSection: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  bottomTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeOrderButton: {
    backgroundColor: '#0a61d7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginLeft: 16,
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  freeText: {
    color: '#10b981',
    fontWeight: '600',
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
  noShippingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
  },
  noShippingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
    marginBottom: 4,
  },
  noShippingSubtext: {
    fontSize: 12,
    color: '#A16207',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: 380,
    maxHeight: '90%',
  },
  // Pickup modal needs more height due to pickup address info
  pickupModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: 520,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  pickupInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
  },
  pickupAddressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  pickupAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  pickupAddressDetail: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  pickupAddressNote: {
    fontSize: 12,
    color: '#F59E0B',
    fontStyle: 'italic',
    marginTop: 8,
  },
  dateTimeSection: {
    marginBottom: 24,
    position: 'relative',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 60,
  },
  dateTimeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 16,
    color: '#111827',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#0a61d7',
    borderRadius: 12,
    paddingVertical: 16,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  picker: {
    height: 200,
    width: '100%',
  },
  // Time dropdown styles
  timeDropdown: {
    position: 'absolute',
    bottom: 15,
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 300,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  timeDropdownHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  timeDropdownHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  timeScrollView: {
    maxHeight: 260,
  },
  timeOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeOptionSelected: {
    backgroundColor: '#F0F7FF',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: '#0a61d7',
    fontWeight: '600',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});
