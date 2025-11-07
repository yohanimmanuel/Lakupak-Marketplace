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
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  Gift
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
  const params = useLocalSearchParams<CheckoutParams>();
  
  // Get product cache; read auth user directly from auth store (avoids stale user after logout/login)
  const { products } = useDataStore();
  const authUser = useAuthStore(s => s.user);
  
  // Get auth token
  const token = useAuthStore(s => s.token);
  
  // Get cart data
  const cartStore = useCartStore();
  const selectedCartItems = cartStore.getSelectedItems();
  
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
  
  // Get the actual product data (for single product checkout)
  const product = products.find(p => p.id === productId);
  
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
      const distributorId = resolveDistributorId(item.product as MarketplaceProduct);
      if (!grouped[distributorId]) {
        grouped[distributorId] = [];
      }
      grouped[distributorId].push(item);
    });
    
    return grouped;
  };
  
const distributorGroups = useMemo(
  () => (isCartCheckout ? groupByDistributor(selectedCartItems) : {}),
  [isCartCheckout, selectedCartItems]
);
  

  // State
  const [selectedAddress, setSelectedAddress] = useState('default');
  const [selectedPayment, setSelectedPayment] = useState('credit_card');
  const [selectedShipping, setSelectedShipping] = useState('standard');
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
  const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
  const [pickupDateTime, setPickupDateTime] = useState<Date | null>(null);
  
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
        const product = item.product as MarketplaceProduct;
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

const distributorsInfo = useMemo(() => getDistributorsInfo(), [isCartCheckout, selectedCartItems, product]);

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

  const paymentMethods = [
    {
      id: 'credit_card',
      name: 'Credit Card',
      icon: 'CreditCard',
      description: 'Visa, Mastercard, American Express',
      isAvailable: true
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: 'Building2',
      description: 'BCA, Mandiri, BNI, BRI',
      isAvailable: true
    },
    {
      id: 'virtual_account',
      name: 'Virtual Account',
      icon: 'Shield',
      description: 'Secure payment via virtual account',
      isAvailable: true
    }
  ];

  // Get available shipping options from distributor's preferences
  const getAvailableShippingOptions = (productData?: MarketplaceProduct) => {
    const targetProduct = productData || product;
    if (!targetProduct?.shipping) {
      // Fallback: Always provide standard delivery if no shipping data
      return [{
        id: 'standard',
        name: 'Standard Delivery',
        description: '3-5 business days',
        price: 0,
        estimatedDays: '3-5',
        free: false
      }];
    }
    
    const options = [];
    
    // Standard Delivery - Always available as default
    options.push({
      id: 'standard',
      name: 'Standard Delivery',
      description: '3-5 business days',
      price: targetProduct.shipping.standard?.price, // Default to 15,000 IDR if not specified
      estimatedDays: '3-5',
      free: targetProduct.shipping.standard?.free // Default to not free if not specified
    });
    
    // Express Shipping
    if (targetProduct.shipping.express?.available) {
      options.push({
        id: 'express',
        name: 'Express Shipping',
        description: '1-2 business days',
        price: targetProduct.shipping.express.price,
        estimatedDays: '1-2',
        free: targetProduct.shipping.express.free
      });
    }
    
    // Same-day Delivery
    if (targetProduct.shipping.sameDay?.available) {
      options.push({
        id: 'same_day',
        name: 'Same-day Delivery',
        description: 'Same day delivery',
        price: targetProduct.shipping.sameDay.price,
        estimatedDays: 'Same day',
        free: targetProduct.shipping.sameDay.free
      });
    }
    
    // Next-day Delivery
    if (targetProduct.shipping.nextDay?.available) {
      options.push({
        id: 'next_day',
        name: 'Next-day Delivery',
        description: 'Next business day delivery',
        price: targetProduct.shipping.nextDay.price,
        estimatedDays: '1 day',
        free: targetProduct.shipping.nextDay.free
      });
    }
    
    // Scheduled Delivery
    if (targetProduct.shipping.scheduled?.available) {
      options.push({
        id: 'scheduled',
        name: 'Scheduled Delivery',
        description: 'Schedule your preferred delivery time',
        price: targetProduct.shipping.scheduled.price,
        estimatedDays: 'As scheduled',
        free: targetProduct.shipping.scheduled.free
      });
    }
    
    // Pickup Available
    if (targetProduct.shipping.pickup?.available) {
      options.push({
        id: 'pickup',
        name: 'Pickup Available',
        description: 'Pick up at distributor warehouse',
        price: 0, // Always free for pickup
        estimatedDays: 'Immediate',
        free: true
      });
    }
    
    return options;
  };

  const shippingOptions = getAvailableShippingOptions(product);

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

  // Handle shipping option selection
  const handleShippingSelection = (optionId: string) => {
    if (optionId === 'scheduled') {
      initializeModalDateTime(scheduledDateTime);
      setActiveDistributorId(distributorsInfo[0]?.id || null);
      setShowScheduleModal(true);
    } else if (optionId === 'pickup') {
      initializeModalDateTime(pickupDateTime);
      setActiveDistributorId(distributorsInfo[0]?.id || null);
      setShowPickupModal(true);
    } else {
      setSelectedShipping(optionId);
    }
  };

  // Handle per-distributor shipping selection
  const handleDistributorShippingSelection = (distributorId: string, optionId: string) => {
    if (optionId === 'scheduled') {
      initializeModalDateTime(scheduledDateTimeByDistributor[distributorId]);
      setActiveDistributorId(distributorId);
      setShowScheduleModal(true);
      return;
    }

    if (optionId === 'pickup') {
      initializeModalDateTime(pickupDateTimeByDistributor[distributorId]);
      setActiveDistributorId(distributorId);
      setShowPickupModal(true);
      return;
    }

    setSelectedShippingByDistributor(prev => ({ ...prev, [distributorId]: optionId }));
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

  // Confirm scheduled delivery
  const confirmScheduledDelivery = () => {
    const [hours, minutes] = selectedTime.split(':');
    const combinedDateTime = new Date(selectedDate);
    combinedDateTime.setHours(parseInt(hours), parseInt(minutes));
    if (isCartCheckout && activeDistributorId) {
      setScheduledDateTimeByDistributor(prev => ({
        ...prev,
        [activeDistributorId]: combinedDateTime,
      }));
      setSelectedShippingByDistributor(prev => ({
        ...prev,
        [activeDistributorId]: 'scheduled',
      }));
    } else {
      setScheduledDateTime(combinedDateTime);
      setSelectedShipping('scheduled');
    }
    setShowScheduleModal(false);
    setShowTimeDropdown(false);
    setActiveDistributorId(null);
  };

  // Confirm pickup
  const confirmPickup = () => {
    const [hours, minutes] = selectedTime.split(':');
    const combinedDateTime = new Date(selectedDate);
    combinedDateTime.setHours(parseInt(hours), parseInt(minutes));
    if (isCartCheckout && activeDistributorId) {
      setPickupDateTimeByDistributor(prev => ({
        ...prev,
        [activeDistributorId]: combinedDateTime,
      }));
      setSelectedShippingByDistributor(prev => ({
        ...prev,
        [activeDistributorId]: 'pickup',
      }));
    } else {
      setPickupDateTime(combinedDateTime);
      setSelectedShipping('pickup');
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

  // Set default shipping option when component loads
  useEffect(() => {
    if (shippingOptions.length > 0 && !selectedShipping) {
      // Standard shipping is always available, so use it as default
      setSelectedShipping('standard');
    }
  }, [shippingOptions, selectedShipping]);

useEffect(() => {
  if (!isCartCheckout) return;

  setSelectedShippingByDistributor((prev) => {
    const next = { ...prev };
    let hasChange = false;

    Object.entries(distributorGroups).forEach(([distributorId, items]) => {
      if (next[distributorId] || items.length === 0) {
        return;
      }

      const firstProduct = items[0].product as MarketplaceProduct;
      const options = getAvailableShippingOptions(firstProduct);
      if (options.length > 0) {
        next[distributorId] = options[0].id;
        hasChange = true;
      }
    });

    return hasChange ? next : prev;
  });
}, [isCartCheckout, distributorGroups]);

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
        const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
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
    }
    return totalPrice;
  };
  
  const calculateShippingCost = () => {
    if (isCartCheckout) {
      // For cart checkout, we need to calculate shipping for each distributor group
      let totalShipping = 0;
      Object.entries(distributorGroups).forEach(([distributorId, group]) => {
        if (group.length > 0) {
          const firstProduct = group[0].product as MarketplaceProduct;
          const shippingOptions = getAvailableShippingOptions(firstProduct);
          const selectedId = selectedShippingByDistributor[distributorId] || shippingOptions[0]?.id;
          const selectedOption = shippingOptions.find(s => s.id === selectedId) || shippingOptions[0];
          if (selectedOption) {
            totalShipping += selectedOption.price;
          }
        }
      });
      return totalShipping;
    }
    
    const selectedShippingOption = shippingOptions.find(s => s.id === selectedShipping) || shippingOptions[0];
    return selectedShippingOption ? selectedShippingOption.price : 0;
  };
  
  const subtotal = calculateSubtotal();
  const shippingCost = calculateShippingCost();
  const total = subtotal + shippingCost;

  const handlePlaceOrder = async () => {
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
              try {
                // Generate required fields using marketplace user data
    const buyerId = `LKB-${authUser?.id?.toString().padStart(8, '0') || Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
                const orderDate = new Date().toISOString();
    const customerEmail = authUser?.email || `${addresses[0].phone.replace(/[^0-9]/g, '')}@lakulaku.com`;
                
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
                      const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
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
                    const firstProduct = items[0].product as MarketplaceProduct;
                    const shippingOptions = getAvailableShippingOptions(firstProduct);
                    const selectedId = selectedShippingByDistributor[distributorId] || shippingOptions[0]?.id;
                    const selectedOption = shippingOptions.find(s => s.id === selectedId) || shippingOptions[0];
                    const distributorShippingCost = selectedOption ? selectedOption.price : 0;
                    const distributorTotal = distributorSubtotal + distributorShippingCost;
                    
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
                        const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
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
                            return Object.entries(variantAttributes).every(([key, value]) => {
                              return option.attributes?.[key] === value;
                            });
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
                      shippingFee: distributorShippingCost,
                      totalAmount: distributorTotal,
                      totalOrders: items.reduce((sum, item) => {
                        // Get piecesPerPackage from product level (piece-based system)
                        const marketplaceProduct = item.product as MarketplaceProduct;
                        const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                        
                        return sum + (item.quantity * piecesPerPackage);
                      }, 0),
                      contactPerson: authUser?.name || addresses[0].name,
                      storeName: authUser?.storeName || addresses[0].company,
                      contactPhone: authUser?.phone || addresses[0].phone,
                      customerEmail: customerEmail,
                      deliveryAddress: addresses[0].address,
                      deliveryMethod: (selectedId === 'pickup') ? 'Pickup' : 'Distributor Fleet',
                      deliveryOption: selectedId,
                      preferredDeliveryDate: selectedId === 'scheduled' && scheduledDateTimeByDistributor[distributorId]
                        ? toISODate(scheduledDateTimeByDistributor[distributorId])
                        : null,
                      preferredDeliveryTime: selectedId === 'scheduled' && scheduledDateTimeByDistributor[distributorId]
                        ? toTimeComponent(scheduledDateTimeByDistributor[distributorId])
                        : null,
                      preferredPickupDate: selectedId === 'pickup' && pickupDateTimeByDistributor[distributorId]
                        ? toISODate(pickupDateTimeByDistributor[distributorId])
                        : null,
                      preferredPickupTime: selectedId === 'pickup' && pickupDateTimeByDistributor[distributorId]
                        ? toTimeComponent(pickupDateTimeByDistributor[distributorId])
                        : null,
                      shippingMethodLabel: selectedOption?.name,
                      shippingMethod: selectedOption?.name,
                      orderStatus: 'Pending',
                      paymentStatus: 'Unpaid',
                      paymentTerms: 'Cash on Delivery',
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
                      variantId: params.variantId ? parseInt(params.variantId) : undefined,
                      variantName: params.variantName
                    }],
                    subtotal: totalPrice,
                    discounts: 0,
                    shippingFee: shippingCost,
                    totalAmount: total,
                    totalOrders: quantity * piecesPerPackage,
                    contactPerson: authUser?.name || addresses[0].name,
                    storeName: authUser?.storeName || addresses[0].company,
                    contactPhone: authUser?.phone || addresses[0].phone,
                    customerEmail: customerEmail,
                    deliveryAddress: addresses[0].address,
                    deliveryMethod: selectedShipping === 'pickup' ? 'Pickup' : 'Distributor Fleet',
                    deliveryOption: selectedShipping,
                    preferredDeliveryDate: selectedShipping === 'scheduled' && scheduledDateTime
                      ? toISODate(scheduledDateTime)
                      : null,
                    preferredDeliveryTime: selectedShipping === 'scheduled' && scheduledDateTime
                      ? toTimeComponent(scheduledDateTime)
                      : null,
                    preferredPickupDate: selectedShipping === 'pickup' && pickupDateTime
                      ? toISODate(pickupDateTime)
                      : null,
                    preferredPickupTime: selectedShipping === 'pickup' && pickupDateTime
                      ? toTimeComponent(pickupDateTime)
                      : null,
                    shippingMethodLabel: shippingOptions.find(option => option.id === selectedShipping)?.name,
                    shippingMethod: shippingOptions.find(option => option.id === selectedShipping)?.name,
                    orderStatus: 'Pending',
                    paymentStatus: 'Unpaid',
                    paymentTerms: 'Cash on Delivery',
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
                  ? selectedCartItems.map((item: CartItem) => item.product.images?.[0]).filter(Boolean)
                  : productImage ? [productImage] : [];
                
                // Create immediate notification for successful order
                if (createdOrders.length > 0) {
                  const firstOrder = createdOrders[0];
                  
                  // Ensure we have valid order data
                  const orderId = firstOrder.orderId || firstOrder.order_id || 'Unknown';
                  const orderStatus = firstOrder.orderStatus || firstOrder.order_status || 'Pending';
                  
                  // Create immediate notification
                  await NotificationService.createOrderNotifications(
                    orderId, 
                    createdOrders.length, 
                    productImages, 
                    authUser?.id || null,
                    orderStatus,
                    undefined
                  );
                }

                // Navigate to payment success page with the first order's details
                const firstOrder = createdOrders[0];
                router.push({
                  pathname: '/payment-success',
                  params: {
                    orderId: firstOrder.orderId,
                    totalAmount: total.toString(),
                    orderStatus: firstOrder.orderStatus,
                    orderCount: createdOrders.length.toString()
                  }
                });

              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to place order. Please try again.';
                Alert.alert('Error', errorMessage);
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
                        <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text>
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
                                  return Object.entries(variantAttributes).every(([key, value]) => {
                                    return option.attributes?.[key] === value;
                                  });
                                });
                                
                                if (matchingOption?.moq) {
                                  moq = matchingOption.moq;
                                } else if (marketplaceProduct.variantOptions.length > 0 && marketplaceProduct.variantOptions[0]?.moq) {
                                  moq = marketplaceProduct.variantOptions[0].moq;
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
                      <Text style={styles.shippingTitle}>Shipping Method</Text>
                    </View>
                    {shippingOptions.length > 0 ? (
                      shippingOptions.map((option) => {
                        const selectedOptionForDistributor = selectedShippingByDistributor[distributorId] || shippingOptions[0]?.id;
                        const pickupDateForDistributor = pickupDateTimeByDistributor[distributorId] || null;
                        const scheduledDateForDistributor = scheduledDateTimeByDistributor[distributorId] || null;

                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.shippingOption,
                              selectedOptionForDistributor === option.id && styles.shippingOptionSelected
                            ]}
                            onPress={() => handleDistributorShippingSelection(distributorId, option.id)}
                          >
                            <View style={styles.shippingInfo}>
                              <Text style={styles.shippingName}>{option.name}</Text>
                              <Text style={styles.shippingDescription}>{option.description}</Text>
                              <View style={styles.shippingTime}>
                                <Clock size={14} color="#6B7280" />
                                <Text style={styles.shippingTimeText}>
                                  {option.id === 'pickup' 
                                    ? (selectedOptionForDistributor === 'pickup' && pickupDateForDistributor
                                      ? `Pickup scheduled: ${pickupDateForDistributor.toLocaleString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true
                                        })}`
                                      : 'Available for pickup')
                                    : option.id === 'scheduled'
                                    ? (selectedOptionForDistributor === 'scheduled' && scheduledDateForDistributor
                                      ? `Delivery scheduled: ${scheduledDateForDistributor.toLocaleString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true
                                        })}`
                                      : 'Schedule your preferred delivery time')
                                    : `Estimated delivery: ${option.estimatedDays}`
                                  }
                                </Text>
                              </View>
                            </View>
                            <View style={styles.shippingPrice}>
                              <Text style={[
                                styles.shippingPriceText,
                                option.free && styles.freeText
                              ]}>
                                {option.free ? 'FREE' : formatCurrency(option.price)}
                              </Text>
                              {selectedOptionForDistributor === option.id && (
                                <CheckCircle size={20} color="#0a61d7" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={styles.noShippingCard}>
                        <Text style={styles.noShippingText}>
                          No shipping options available for this distributor.
                        </Text>
                        <Text style={styles.noShippingSubtext}>
                          Please contact the distributor directly for delivery arrangements.
                        </Text>
                      </View>
                    )}
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
                  <Text style={styles.shippingTitle}>Shipping Method</Text>
                </View>
                {shippingOptions.length > 0 ? (
                  shippingOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.shippingOption,
                        selectedShipping === option.id && styles.shippingOptionSelected
                      ]}
                      onPress={() => handleShippingSelection(option.id)}
                    >
                      <View style={styles.shippingInfo}>
                        <Text style={styles.shippingName}>{option.name}</Text>
                        <Text style={styles.shippingDescription}>{option.description}</Text>
                        <View style={styles.shippingTime}>
                          <Clock size={14} color="#6B7280" />
                          <Text style={styles.shippingTimeText}>
                            {option.id === 'pickup' 
                              ? (selectedShipping === 'pickup' && pickupDateTime ? `Pickup scheduled: ${pickupDateTime.toLocaleString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}` : 'Available for pickup')
                              : option.id === 'scheduled'
                              ? (selectedShipping === 'scheduled' && scheduledDateTime ? `Delivery scheduled: ${scheduledDateTime.toLocaleString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}` : 'Schedule your preferred delivery time')
                              : `Estimated delivery: ${option.estimatedDays}`
                            }
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shippingPrice}>
                        <Text style={[
                          styles.shippingPriceText,
                          option.free && styles.freeText
                        ]}>
                          {option.free ? 'FREE' : formatCurrency(option.price)}
                        </Text>
                        {selectedShipping === option.id && (
                          <CheckCircle size={20} color="#0a61d7" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noShippingCard}>
                    <Text style={styles.noShippingText}>
                      No shipping options available for this distributor.
                    </Text>
                    <Text style={styles.noShippingSubtext}>
                      Please contact the distributor directly for delivery arrangements.
                    </Text>
                  </View>
                )}
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
              <Text style={styles.summaryLabel}>
                {isCartCheckout 
                  ? `Shipping (${Object.keys(distributorGroups).length} distributor${Object.keys(distributorGroups).length > 1 ? 's' : ''})`
                  : `Shipping (${shippingOptions.find(s => s.id === selectedShipping)?.name || 'Standard'})`
                }
              </Text>
              <Text style={styles.summaryValue}>{formatCurrency(shippingCost)}</Text>
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
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeOrderText}>Place Order</Text>
        </TouchableOpacity>
      </View>

      {/* Scheduled Delivery Modal */}
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
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: deliverySlideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ flex: 1 }}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Delivery</Text>
              <TouchableOpacity onPress={handleDeliveryClose}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Choose your preferred delivery date and time</Text>
              
              <View style={styles.dateTimeSection}>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={20} color="#0a61d7" />
                  <View style={styles.dateTimeInfo}>
                    <Text style={styles.dateTimeLabel}>Delivery Date</Text>
                    <Text style={styles.dateTimeValue}>{formatDate(selectedDate)}</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimeDropdown(!showTimeDropdown)}
                >
                  <Clock size={20} color="#0a61d7" />
                  <View style={styles.dateTimeInfo}>
                    <Text style={styles.dateTimeLabel}>Delivery Time</Text>
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
                onPress={handleDeliveryClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmScheduledDelivery}
              >
                <Text style={styles.confirmButtonText}>Confirm Delivery</Text>
              </TouchableOpacity>
            </View>
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
    borderColor: '#0a61d7',
    backgroundColor: '#F0F7FF',
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
