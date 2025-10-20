import React, { useState } from 'react';
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
import { AlertCircle } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';

const { width } = Dimensions.get('window');

const CANCELLATION_REASONS = [
  {
    id: 'changed_mind',
    label: 'Changed my mind',
    description: 'I no longer want this item'
  },
  {
    id: 'found_cheaper',
    label: 'Found a better price',
    description: 'Found the same item at a lower price elsewhere'
  },
  {
    id: 'wrong_item',
    label: 'Ordered wrong item',
    description: 'I ordered the wrong product by mistake'
  },
  {
    id: 'delivery_issues',
    label: 'Delivery concerns',
    description: 'Concerned about delivery time or location'
  },
  {
    id: 'payment_issues',
    label: 'Payment problems',
    description: 'Having trouble with payment method'
  },
  {
    id: 'seller_issues',
    label: 'Seller concerns',
    description: 'Issues with the seller or store'
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Please specify your reason below'
  }
];

export default function OrderCancelModal() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCancelOrder = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for cancellation.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert('Provide Reason', 'Please provide a custom reason for cancellation.');
      return;
    }

    Alert.alert(
      'Confirm Cancellation',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              const reasonText = selectedReason === 'other' 
                ? customReason.trim() 
                : CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || 'User requested cancellation';

              const requestBody = {
                cancel: true,
                orderId: orderId,
                userId: user?.id,
                cancelledBy: user?.id?.toString() || 'User',
                reason: reasonText
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
                'Order Cancelled',
                result.message || 'Your order has been successfully cancelled.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back()
                  }
                ]
              );
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to cancel order. Please try again.',
                [{ text: 'OK' }]
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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Warning Message */}
        <View style={styles.warningContainer}>
          <AlertCircle size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Please select a reason for cancelling this order. This action cannot be undone.
          </Text>
        </View>

        {/* Order ID */}
        <View style={styles.orderInfoContainer}>
          <Text style={styles.orderIdLabel}>Order ID</Text>
          <Text style={styles.orderIdValue}>{orderId}</Text>
        </View>

        {/* Cancellation Reasons */}
        <View style={styles.reasonsContainer}>
          <Text style={styles.sectionTitle}>Why are you cancelling this order?</Text>
          
          {CANCELLATION_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonItem,
                selectedReason === reason.id && styles.reasonItemSelected
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View style={styles.reasonContent}>
                <Text style={[
                  styles.reasonLabel,
                  selectedReason === reason.id && styles.reasonLabelSelected
                ]}>
                  {reason.label}
                </Text>
                <Text style={[
                  styles.reasonDescription,
                  selectedReason === reason.id && styles.reasonDescriptionSelected
                ]}>
                  {reason.description}
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                selectedReason === reason.id && styles.radioButtonSelected
              ]}>
                {selectedReason === reason.id && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Reason Input */}
        {selectedReason === 'other' && (
          <View style={styles.customReasonContainer}>
            <Text style={styles.customReasonLabel}>Please specify your reason:</Text>
            <TextInput
              style={styles.customReasonInput}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Enter your reason for cancellation..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomContainer}>
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
            {isLoading ? 'Cancelling...' : 'Cancel Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
