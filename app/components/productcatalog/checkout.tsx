import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
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
  ChevronRight
} from 'lucide-react-native';
import { Product } from '../../../data/sampleProducts';
import { MarketplaceProduct } from '../../../services/marketplace';
import { formatCurrency } from '../../../utils/currencyUtils';
import { useDataStore } from '../../../stores/dataStore';

const { width: screenWidth } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

type CheckoutParams = {
  productId?: string;
  quantity?: string;
  totalPrice?: string;
  productName?: string;
  productImage?: string;
  unitPrice?: string;
  packageType?: string;
  piecesPerPackage?: string;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CheckoutParams>();
  
  // Get user data from store
  const { user: cachedUser, products } = useDataStore();
  
  // Parse parameters
  const productId = params.productId || '';
  const quantity = parseInt(params.quantity || '1');
  const totalPrice = parseFloat(params.totalPrice || '0');
  const productName = params.productName || 'Product';
  const productImage = params.productImage || '';
  const unitPrice = parseFloat(params.unitPrice || '0');
  const packageType = params.packageType || 'Box';
  const piecesPerPackage = parseInt(params.piecesPerPackage || '1');

  // Get the actual product data
  const product = products.find(p => p.id === productId);

  // State
  const [selectedAddress, setSelectedAddress] = useState('default');
  const [selectedPayment, setSelectedPayment] = useState('credit_card');
  const [selectedShipping, setSelectedShipping] = useState('standard');
  
  // Get distributor/company information from the product's seller company data
  const distributorInfo = {
    companyName: product?.seller?.company?.name || product?.seller?.name || 'Distributor Company',
    industryType: product?.seller?.company?.industryType || 'Not specified',
    contactPerson: product?.seller?.name || 'Not provided',
    phone: product?.seller?.company?.businessPhone || 'Not provided'
  };

  // Use real user data for delivery address
  const addresses = [
    {
      id: 'default',
      name: cachedUser?.name || 'Your Name',
      company: cachedUser?.storeName || 'Your Company',
      address: cachedUser?.chosenAddress || 'Your Address',
      city: cachedUser?.country || 'Your City',
      phone: cachedUser?.phone || 'Your Phone',
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

  const shippingOptions = [
    {
      id: 'standard',
      name: 'Standard Delivery',
      description: '3-5 business days',
      price: 150000, // Rp 150.000 from configuration
      estimatedDays: '3-5'
    },
    {
      id: 'express',
      name: 'Express Delivery',
      description: '1-2 business days',
      price: 200000, // Higher price for express
      estimatedDays: '1-2'
    },
    {
      id: 'same_day',
      name: 'Same Day Delivery',
      description: 'Same day delivery (Jakarta only)',
      price: 300000, // Premium price for same day
      estimatedDays: 'Same day'
    }
  ];

  // Calculations
  const selectedShippingOption = shippingOptions.find(s => s.id === selectedShipping) || shippingOptions[0];
  const subtotal = totalPrice;
  const shippingCost = selectedShippingOption.price;
  const total = subtotal + shippingCost;

  const handlePlaceOrder = () => {
    Alert.alert(
      'Order Confirmation',
      `Are you sure you want to place this order for ${formatCurrency(total)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Place Order', 
          style: 'default',
          onPress: () => {
            // TODO: Implement order placement
            Alert.alert('Success', 'Your order has been placed successfully!');
            router.back();
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }} // Add space for sticky bottom bar
        showsVerticalScrollIndicator={false}
      >
        {/* Business Information */}
        <View style={[styles.section]}>
          <View style={styles.businessCard}>
            <View style={styles.sectionTitleContainer}>
              <Building2 size={20} color="#0a61d7" />
              <Text style={styles.sectionTitle}>Business Information</Text>
            </View>
            <Text style={styles.businessName}>{distributorInfo.companyName}</Text>
            <Text style={styles.businessType}>Industry: {distributorInfo.industryType}</Text>
            <Text style={styles.businessDetails}>Contact: {distributorInfo.contactPerson}</Text>
            <Text style={styles.businessDetails}>Phone: {distributorInfo.phone}</Text>
          </View>
        </View>

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
                  <Text style={styles.productPrice}>
                    {formatCurrency(unitPrice)} per piece
                  </Text>
                  <Text style={styles.quantityBadge}>x{quantity}</Text>
                </View>
              </View>
            </View>
            
            {/* Shipping Options */}
            <View style={styles.shippingSection}>
              <View style={styles.shippingTitleContainer}>
                <Truck size={20} color="#0a61d7" />
                <Text style={styles.shippingTitle}>Shipping Method</Text>
              </View>
              {shippingOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.shippingOption,
                    selectedShipping === option.id && styles.shippingOptionSelected
                  ]}
                  onPress={() => setSelectedShipping(option.id)}
                >
                  <View style={styles.shippingInfo}>
                    <Text style={styles.shippingName}>{option.name}</Text>
                    <Text style={styles.shippingDescription}>{option.description}</Text>
                    <View style={styles.shippingTime}>
                      <Clock size={14} color="#6B7280" />
                      <Text style={styles.shippingTimeText}>
                        Estimated delivery: {option.estimatedDays} days
                      </Text>
                    </View>
                  </View>
                  <View style={styles.shippingPrice}>
                    <Text style={styles.shippingPriceText}>
                      {formatCurrency(option.price)}
                    </Text>
                    {selectedShipping === option.id && (
                      <CheckCircle size={20} color="#0a61d7" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

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
              <Text style={styles.summaryLabel}>Shipping ({selectedShippingOption.name})</Text>
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
          <Text style={styles.bottomTotalValue}>{formatCurrency(totalPrice)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeOrderText}>Place Order</Text>
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
});
