import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

const CANCELLATION_REASON_IDS = [
  'changed_mind',
  'found_cheaper',
  'wrong_item',
  'delivery_issues',
  'payment_issues',
  'seller_issues',
  'other',
] as const;

const primaryBlue = '#0a61d7';

export default function OrderCancelModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useTranslation();

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleCancelOrder = async () => {
    if (!selectedReason) {
      Alert.alert(t('ordersFlow.cancel.alerts.selectReasonTitle'), t('ordersFlow.cancel.alerts.selectReasonBody'));
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert(t('ordersFlow.cancel.alerts.provideReasonTitle'), t('ordersFlow.cancel.alerts.provideReasonBody'));
      return;
    }

    Alert.alert(
      t('ordersFlow.cancel.alerts.confirmTitle'),
      t('ordersFlow.cancel.alerts.confirmBody'),
      [
        {
          text: t('ordersFlow.cancel.alerts.no'),
          style: 'cancel',
        },
        {
          text: t('ordersFlow.cancel.alerts.yesCancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              const reasonText = selectedReason === 'other'
                ? customReason.trim()
                : t(`ordersFlow.cancel.reasons.${selectedReason}.label`, { defaultValue: t('ordersFlow.cancel.reasons.other.label') });

              const requestBody = {
                cancel: true,
                orderId: orderId,
                userId: user?.id,
                cancelledBy: user?.id?.toString() || 'User',
                reason: reasonText,
                reasonCode: selectedReason,
                reasonDetail: selectedReason === 'other' ? customReason.trim() || undefined : undefined
              };
              
              
              
              const response = await fetch(`${API_BASE_URL}/api/orders`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
              });

              

              if (!response.ok) {
                let errorData;
                try {
                  const errorText = await response.text();
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.error || `Failed to cancel order (${response.status})`);
              }

              const result = await response.json();
              
              // Show success message and navigate back
              Alert.alert(
                t('ordersFlow.cancel.alerts.successTitle'),
                t('ordersFlow.cancel.alerts.successBody'),
                [
                  {
                    text: t('ordersFlow.common.buttons.ok'),
                    onPress: () => router.back()
                  }
                ]
              );
            } catch (error) {
              Alert.alert(
                t('ordersFlow.common.errors.errorTitle'),
                error instanceof Error ? error.message : t('ordersFlow.cancel.alerts.failedBody'),
                [{ text: t('ordersFlow.common.buttons.ok') }]
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
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
                <Text style={styles.headerTitle}>{t('ordersFlow.cancel.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <KeyboardAvoidingView
        style={styles.scrollWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 30 }}
        >
        {/* Warning Message */}
        <View style={styles.warningContainer}>
          <AlertCircle size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            {t('ordersFlow.cancel.alerts.confirmBody')}
          </Text>
        </View>

        {/* Order ID */}
        <View style={styles.orderInfoContainer}>
          <Text style={styles.orderIdLabel}>{t('ordersFlow.returnRefund.orderId')}</Text>
          <Text style={styles.orderIdValue}>{orderId}</Text>
        </View>

        {/* Cancellation Reasons */}
        <View style={styles.reasonsContainer}>
          <Text style={styles.sectionTitle}>{t('ordersFlow.cancel.reasonsTitle')}</Text>
          
          {CANCELLATION_REASON_IDS.map((reasonId) => (
            <TouchableOpacity
              key={reasonId}
              style={[
                styles.reasonItem,
                selectedReason === reasonId && styles.reasonItemSelected
              ]}
              onPress={() => setSelectedReason(reasonId)}
            >
              <View style={styles.reasonContent}>
                <Text style={[
                  styles.reasonLabel,
                  selectedReason === reasonId && styles.reasonLabelSelected
                ]}>
                  {t(`ordersFlow.cancel.reasons.${reasonId}.label`)}
                </Text>
                <Text style={[
                  styles.reasonDescription,
                  selectedReason === reasonId && styles.reasonDescriptionSelected
                ]}>
                  {t(`ordersFlow.cancel.reasons.${reasonId}.description`)}
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                selectedReason === reasonId && styles.radioButtonSelected
              ]}>
                {selectedReason === reasonId && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Reason Input */}
        {selectedReason === 'other' && (
          <View style={styles.customReasonContainer}>
            <Text style={styles.customReasonLabel}>{t('ordersFlow.cancel.customReasonLabel')}</Text>
            <TextInput
              style={styles.customReasonInput}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder={t('ordersFlow.cancel.customReasonPlaceholder')}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={scrollToInput}
            />
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar: absolute, outside KeyboardAvoidingView so layout resets cleanly when keyboard closes */}
      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <TouchableOpacity
          style={[
            styles.cancelOrderButton,
            (!selectedReason || (selectedReason === 'other' && !customReason.trim())) && styles.cancelOrderButtonDisabled
          ]}
          onPress={handleCancelOrder}
          disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim()) || isLoading}
        >
          <Text style={[
            styles.cancelOrderButtonText,
            (!selectedReason || (selectedReason === 'other' && !customReason.trim())) && styles.cancelOrderButtonTextDisabled
          ]}>
            {isLoading ? t('ordersFlow.cancel.submitting') : t('ordersFlow.cancel.submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollWrapper: {
    flex: 1,
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
    paddingHorizontal: 8,
    marginBottom: 80,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    lineHeight: 20,
  },
  orderInfoContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderIdLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reasonsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    paddingBottom: 12,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  reasonItemSelected: {
    backgroundColor: '#eff6ff',
  },
  reasonContent: {
    flex: 1,
    marginRight: 12,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  reasonLabelSelected: {
    color: '#0a61d7',
  },
  reasonDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  reasonDescriptionSelected: {
    color: '#0a61d7',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#0a61d7',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0a61d7',
  },
  customReasonContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
    minHeight: 100,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelOrderButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOrderButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  cancelOrderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelOrderButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
