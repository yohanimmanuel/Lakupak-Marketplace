import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Home, Package, ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');

type PaymentSuccessParams = {
  orderId: string;
  totalAmount: string;
  orderStatus: string;
  orderCount?: string;
};

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<PaymentSuccessParams>();
  const primaryBlue = '#0a61d7';
  const { t } = useTranslation();
  
  const orderId = params.orderId || '';
  const orderStatus = params.orderStatus || 'Pending';
  const orderCount = parseInt(params.orderCount || '1');
  const parsedTotal = Number.parseFloat(params.totalAmount || '0');
  const pricingPending = !Number.isFinite(parsedTotal) || parsedTotal <= 0;

  const handleGoHome = () => {
    router.push('/(tabs)/home');
  };

  const handleViewOrders = () => {
    // Navigate to orders page (you can implement this later)
    router.push('/(tabs)/orders');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('paymentSuccessPage.headerTitle')}</Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.checkmarkContainer}>
            <CheckCircle size={80} color="#10b981" />
          </View>
          
          <Text style={styles.successTitle}>{t('paymentSuccessPage.title')}</Text>
          <Text style={styles.successSubtitle}>
            {t('paymentSuccessPage.pricingPending')}
          </Text>
          <Text style={styles.notificationText}>
            {orderCount > 1 
              ? t('paymentSuccessPage.notifiedMultiple', { count: orderCount })
              : t('paymentSuccessPage.notifiedSingle')
            }
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="#0a61d7" />
            <Text style={styles.homeButtonText}>{t('paymentSuccessPage.actions.home')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.ordersButton} onPress={handleViewOrders}>
            <Package size={20} color="#ffffff" />
            <Text style={styles.ordersButtonText}>{t('paymentSuccessPage.actions.myOrders')}</Text>
          </TouchableOpacity>
        </View>

        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>{t('paymentSuccessPage.status.title')}</Text>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, pricingPending ? styles.statusCurrent : styles.statusCompleted]} />
            <Text style={styles.statusText}>
              {pricingPending
                ? t('paymentSuccessPage.status.pricingConfirmation')
                : t('paymentSuccessPage.status.paymentRequired')}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>{t('paymentSuccessPage.status.processing')}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>{t('paymentSuccessPage.status.shipped')}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>{t('paymentSuccessPage.status.delivered')}</Text>
          </View>
        </View>

        {/* Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>{t('paymentSuccessPage.nextSteps.title')}</Text>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>{t('paymentSuccessPage.nextSteps.step1')}</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>{t('paymentSuccessPage.nextSteps.step2')}</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>{t('paymentSuccessPage.nextSteps.step3')}</Text>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>{t('paymentSuccessPage.support.title')}</Text>
          <Text style={styles.supportText}>
            {t('paymentSuccessPage.support.body')}
          </Text>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>{t('paymentSuccessPage.support.cta')}</Text>
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
  statusCurrent: {
    backgroundColor: '#0a61d7',
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
