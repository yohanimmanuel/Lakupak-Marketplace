import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Home, Package } from 'lucide-react-native';
import { formatCurrency } from '../utils/currencyUtils';

const { width: screenWidth } = Dimensions.get('window');

type PaymentSuccessParams = {
  orderId: string;
  totalAmount: string;
  orderStatus: string;
  orderCount?: string;
};

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<PaymentSuccessParams>();
  
  const orderId = params.orderId || '';
  const totalAmount = parseFloat(params.totalAmount || '0');
  const orderStatus = params.orderStatus || 'Pending';
  const orderCount = parseInt(params.orderCount || '1');

  const handleGoHome = () => {
    router.push('/(tabs)/home');
  };

  const handleViewOrders = () => {
    // Navigate to orders page (you can implement this later)
    router.push('/(tabs)/home');
  };

  return (
    <View style={styles.container}>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.checkmarkContainer}>
            <CheckCircle size={80} color="#10b981" />
          </View>
          
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            You paid {formatCurrency(totalAmount)}
          </Text>
          <Text style={styles.notificationText}>
            {orderCount > 1 
              ? `We have created ${orderCount} separate orders and notified the sellers to ship out your orders.`
              : 'We have notified the seller to ship out your order.'
            }
          </Text>
          
          {/* Order ID */}
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderIdLabel}>
              {orderCount > 1 ? 'Primary Order ID:' : 'Order ID:'}
            </Text>
            <Text style={styles.orderIdValue}>{orderId}</Text>
            {orderCount > 1 && (
              <Text style={styles.orderCountText}>
                + {orderCount - 1} more order{orderCount - 1 > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="#0a61d7" />
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.ordersButton} onPress={handleViewOrders}>
            <Package size={20} color="#ffffff" />
            <Text style={styles.ordersButtonText}>My Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>Order Status</Text>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusCompleted]} />
            <Text style={styles.statusText}>Payment Confirmed</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>Processing Order</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>Shipped</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>Delivered</Text>
          </View>
        </View>

        {/* Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Seller will prepare your order</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>You'll receive shipping notification</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Track your package delivery</Text>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Need Help?</Text>
          <Text style={styles.supportText}>
            If you have any questions about your order, please contact our support team.
          </Text>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  checkmarkContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0a61d7',
    marginBottom: 12,
    textAlign: 'center',
  },
  notificationText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  orderIdContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderIdLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderCountText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 10,
    marginTop: -30,
    gap: 12,
  },
  homeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a61d7',
  },
  ordersButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a61d7',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  ordersButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusCompleted: {
    backgroundColor: '#10b981',
  },
  statusPending: {
    backgroundColor: '#e5e7eb',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
  },
  nextStepsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0a61d7',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  stepText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  supportCard: {
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  supportButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
