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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowLeft, ImagePlus, X } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { pickMultipleImages } from '../../../services/imagePicker';

const RETURN_REASONS = [
  { id: 'wrong_item', label: 'Wrong item received', description: 'I received a different product than ordered' },
  { id: 'defective', label: 'Defective or damaged', description: 'Item arrived damaged or not working' },
  { id: 'not_as_described', label: 'Not as described', description: 'Product does not match the listing' },
  { id: 'changed_mind', label: 'Changed my mind', description: 'I no longer want this item' },
  { id: 'late_delivery', label: 'Late delivery', description: 'Delivery was significantly delayed' },
  { id: 'other', label: 'Other reason', description: 'Please specify below' },
];

const primaryBlue = '#0a61d7';

export default function ReturnRefundModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { token } = useAuthStore();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleAddPhotos = async () => {
    const currentCount = imageUrls.length;
    if (currentCount >= 5) return;
    const remaining = 5 - currentCount;
    try {
      setUploadingPhotos(true);
      const urls = await pickMultipleImages({
        folder: 'reviews',
        selectionLimit: remaining,
      });
      if (urls && urls.length > 0) {
        setImageUrls((prev) => {
          const combined = [...prev, ...urls];
          return combined.slice(0, 5);
        });
      }
    } catch (error) {
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload images. Please try again.'
      );
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (uploadingPhotos) {
      Alert.alert('Please wait', 'We are still uploading your photos. You can submit once it finishes.');
      return;
    }
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for your return or refund.');
      return;
    }
    if (selectedReason === 'other' && !reasonDetail.trim()) {
      Alert.alert('Provide Details', 'Please provide details for your reason.');
      return;
    }
    if (!token) {
      Alert.alert('Session expired', 'Please sign in again.');
      return;
    }
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      Alert.alert('Error', 'Order ID is missing.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/mobile/orders/return-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: orderId.trim(),
          reason: selectedReason,
          reasonDetail: reasonDetail.trim() || undefined,
          imageUrls,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      Alert.alert(
        'Request Submitted',
        data.message || 'Your return/refund request has been submitted. We will process it and contact you if needed.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to submit request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = !!selectedReason && (selectedReason !== 'other' || !!reasonDetail.trim()) && !uploadingPhotos && !isLoading;

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
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Return / Refund</Text>
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
          contentContainerStyle={{ paddingBottom: 15 }}
        >
          <View style={styles.warningContainer}>
            <AlertCircle size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              Select a reason for your return or refund. Refunds are typically processed within 5–7 business days after we receive and inspect the item.
            </Text>
          </View>

          <View style={styles.orderInfoContainer}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <Text style={styles.orderIdValue}>{orderId}</Text>
          </View>

          <View style={styles.reasonsContainer}>
            <Text style={styles.sectionTitle}>Why do you want to return or get a refund?</Text>
            {RETURN_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonItem, selectedReason === reason.id && styles.reasonItemSelected]}
                onPress={() => setSelectedReason(reason.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedReason === reason.id }}
                accessibilityLabel={`${reason.label}: ${reason.description}`}
              >
                <View style={styles.reasonContent}>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.id && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  <Text
                    style={[
                      styles.reasonDescription,
                      selectedReason === reason.id && styles.reasonDescriptionSelected,
                    ]}
                  >
                    {reason.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedReason === reason.id && styles.radioButtonSelected,
                  ]}
                >
                  {selectedReason === reason.id && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedReason === 'other' && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>Please specify:</Text>
              <TextInput
                style={styles.customReasonInput}
                value={reasonDetail}
                onChangeText={setReasonDetail}
                placeholder="Enter your reason..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={scrollToInput}
              />
            </View>
          )}

          <View style={styles.photosSection}>
            <Text style={styles.inputLabel}>Photos (optional, max 5)</Text>
            <Text style={styles.photosHint}>
              Recommended for damaged, defective, not as described, or other reasons.
            </Text>
            <View style={styles.photoRow}>
              {imageUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityLabel="Remove photo"
                    accessibilityRole="button"
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUrls.length < 5 && (
                <TouchableOpacity
                  style={styles.photoAdd}
                  onPress={handleAddPhotos}
                  disabled={uploadingPhotos}
                  accessibilityLabel="Add photos"
                  accessibilityRole="button"
                >
                  {uploadingPhotos ? (
                    <ActivityIndicator size="small" color={primaryBlue} />
                  ) : (
                    <ImagePlus size={24} color="#6b7280" />
                  )}
                  <Text style={styles.photoAddText}>
                    Add {imageUrls.length > 0 ? 'more' : 'photos'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.policyBlock}>
            <Text style={styles.policyText}>
              We will review your request and may email you with return instructions or next steps. Refunds are issued to your original payment method.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              Submit request
            </Text>
          )}
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
    color: primaryBlue,
  },
  reasonDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  reasonDescriptionSelected: {
    color: primaryBlue,
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
    borderColor: primaryBlue,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: primaryBlue,
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
  },
  policyBlock: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  policyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  photosSection: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  photosHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: primaryBlue,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
