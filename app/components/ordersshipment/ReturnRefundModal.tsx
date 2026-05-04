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
import { useTranslation } from 'react-i18next';

const RETURN_REASON_IDS = [
  'wrong_item',
  'defective',
  'not_as_described',
  'changed_mind',
  'late_delivery',
  'other',
] as const;

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
  const { t } = useTranslation();

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
    } catch {
      Alert.alert(
        t('ordersFlow.returnRefund.alerts.uploadFailedTitle'),
        t('ordersFlow.returnRefund.alerts.uploadFailedBody')
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
      Alert.alert(t('ordersFlow.returnRefund.alerts.pleaseWaitTitle'), t('ordersFlow.returnRefund.alerts.pleaseWaitBody'));
      return;
    }
    if (!selectedReason) {
      Alert.alert(t('ordersFlow.returnRefund.alerts.selectReasonTitle'), t('ordersFlow.returnRefund.alerts.selectReasonBody'));
      return;
    }
    if (selectedReason === 'other' && !reasonDetail.trim()) {
      Alert.alert(t('ordersFlow.returnRefund.alerts.provideDetailsTitle'), t('ordersFlow.returnRefund.alerts.provideDetailsBody'));
      return;
    }
    if (!token) {
      Alert.alert(t('ordersFlow.common.errors.sessionExpiredTitle'), t('ordersFlow.common.errors.sessionExpiredBody'));
      return;
    }
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      Alert.alert(t('ordersFlow.common.errors.errorTitle'), t('ordersFlow.returnRefund.alerts.missingOrderIdBody'));
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
        t('ordersFlow.returnRefund.alerts.submittedTitle'),
        t('ordersFlow.returnRefund.alerts.submittedBody'),
        [{ text: t('ordersFlow.common.buttons.ok'), onPress: () => router.back() }]
      );
    } catch {
      Alert.alert(
        t('ordersFlow.common.errors.errorTitle'),
        t('ordersFlow.returnRefund.alerts.failedBody'),
        [{ text: t('ordersFlow.common.buttons.ok') }]
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
                  accessibilityLabel={t('ordersFlow.common.a11y.goBack')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ordersFlow.returnRefund.title')}</Text>
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
              {t('ordersFlow.returnRefund.warning')}
            </Text>
          </View>

          <View style={styles.orderInfoContainer}>
            <Text style={styles.orderIdLabel}>{t('ordersFlow.returnRefund.orderId')}</Text>
            <Text style={styles.orderIdValue}>{orderId}</Text>
          </View>

          <View style={styles.reasonsContainer}>
            <Text style={styles.sectionTitle}>{t('ordersFlow.returnRefund.whyTitle')}</Text>
            {RETURN_REASON_IDS.map((reasonId) => (
              <TouchableOpacity
                key={reasonId}
                style={[styles.reasonItem, selectedReason === reasonId && styles.reasonItemSelected]}
                onPress={() => setSelectedReason(reasonId)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedReason === reasonId }}
                accessibilityLabel={`${t(`ordersFlow.returnRefund.reasons.${reasonId}.label`)}: ${t(`ordersFlow.returnRefund.reasons.${reasonId}.description`)}`}
              >
                <View style={styles.reasonContent}>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reasonId && styles.reasonLabelSelected,
                    ]}
                  >
                    {t(`ordersFlow.returnRefund.reasons.${reasonId}.label`)}
                  </Text>
                  <Text
                    style={[
                      styles.reasonDescription,
                      selectedReason === reasonId && styles.reasonDescriptionSelected,
                    ]}
                  >
                    {t(`ordersFlow.returnRefund.reasons.${reasonId}.description`)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedReason === reasonId && styles.radioButtonSelected,
                  ]}
                >
                  {selectedReason === reasonId && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedReason === 'other' && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>{t('ordersFlow.returnRefund.detailsLabel')}</Text>
              <TextInput
                style={styles.customReasonInput}
                value={reasonDetail}
                onChangeText={setReasonDetail}
                placeholder={t('ordersFlow.returnRefund.detailsPlaceholder')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={scrollToInput}
              />
            </View>
          )}

          <View style={styles.photosSection}>
            <Text style={styles.inputLabel}>{t('ordersFlow.returnRefund.photosLabel', { max: 5 })}</Text>
            <Text style={styles.photosHint}>
              {t('ordersFlow.returnRefund.photosHint')}
            </Text>
            <View style={styles.photoRow}>
              {imageUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityLabel={t('ordersFlow.returnRefund.a11y.removePhoto')}
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
                  accessibilityLabel={t('ordersFlow.returnRefund.a11y.addPhotos')}
                  accessibilityRole="button"
                >
                  {uploadingPhotos ? (
                    <ActivityIndicator size="small" color={primaryBlue} />
                  ) : (
                    <ImagePlus size={24} color="#6b7280" />
                  )}
                  <Text style={styles.photoAddText}>
                    {imageUrls.length > 0 ? t('ordersFlow.returnRefund.addMore') : t('ordersFlow.returnRefund.addPhotos')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.policyBlock}>
            <Text style={styles.policyText}>
              {t('ordersFlow.returnRefund.policyText')}
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
              {isLoading ? t('ordersFlow.returnRefund.submitting') : t('ordersFlow.returnRefund.submit')}
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
