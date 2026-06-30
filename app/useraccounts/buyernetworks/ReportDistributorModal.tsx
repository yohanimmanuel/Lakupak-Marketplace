import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowLeft, ImagePlus, X } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../services/config';
import { pickMultipleImages } from '../../../services/imagePicker';
import { useTranslation } from 'react-i18next';
import { ShimmerIcon } from '../../components/SkeletonLoader';

const { width } = Dimensions.get('window');

const REPORT_REASON_IDS = ['fraud', 'poor_service', 'quality', 'policy', 'other'] as const;
type ReportReasonId = (typeof REPORT_REASON_IDS)[number];

const primaryBlue = '#0a61d7';

export default function ReportDistributorModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ distributorId?: string; distributorName?: string }>();
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const maxPhotos = 5;

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleAddPhotos = async () => {
    const currentCount = imageUrls.length;
    if (currentCount >= maxPhotos) return;
    const remaining = maxPhotos - currentCount;
    try {
      setUploadingPhotos(true);
      const urls = await pickMultipleImages({
        folder: 'distributor_reports',
        selectionLimit: remaining,
      });
      if (urls && urls.length > 0) {
        setImageUrls((prev) => [...prev, ...urls].slice(0, maxPhotos));
      }
    } catch {
      Alert.alert(
        t('buyerNetworks.reportDistributor.alerts.uploadFailedTitle'),
        t('buyerNetworks.reportDistributor.alerts.uploadFailedBody')
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
      Alert.alert(t('buyerNetworks.reportDistributor.alerts.pleaseWaitTitle'), t('buyerNetworks.reportDistributor.alerts.pleaseWaitBody'));
      return;
    }
    if (!selectedReason) {
      Alert.alert(t('buyerNetworks.reportDistributor.alerts.selectReasonTitle'), t('buyerNetworks.reportDistributor.alerts.selectReasonBody'));
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert(t('buyerNetworks.reportDistributor.alerts.provideReasonTitle'), t('buyerNetworks.reportDistributor.alerts.provideReasonBody'));
      return;
    }

    if (imageUrls.length === 0) {
      Alert.alert(t('buyerNetworks.reportDistributor.alerts.photosRequiredTitle'), t('buyerNetworks.reportDistributor.alerts.photosRequiredBody'));
      return;
    }

    const reasonText =
      selectedReason === 'other'
        ? customReason.trim()
        : t(`buyerNetworks.reportDistributor.reasons.${selectedReason}.label`) || 'User submitted a report';

    Alert.alert(
      t('buyerNetworks.reportDistributor.alerts.confirmTitle'),
      t('buyerNetworks.reportDistributor.alerts.confirmBody'),
      [
        { text: t('buyerNetworks.reportDistributor.alerts.no'), style: 'cancel' },
        {
          text: t('buyerNetworks.reportDistributor.alerts.yesSubmit'),
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              Alert.alert(t('buyerNetworks.reportDistributor.alerts.signInRequiredTitle'), t('buyerNetworks.reportDistributor.alerts.signInRequiredBody'));
              return;
            }
            const distributorId = params.distributorId ? parseInt(String(params.distributorId), 10) : NaN;
            if (!Number.isFinite(distributorId) || distributorId < 1) {
              Alert.alert(t('buyerNetworks.reportDistributor.alerts.invalidDistributorTitle'), t('buyerNetworks.reportDistributor.alerts.invalidDistributorBody'));
              return;
            }
            try {
              setIsSubmitting(true);
              const reasonDetail =
                selectedReason === 'other' ? customReason.trim() : undefined;
              const res = await fetch(`${API_BASE_URL}/api/mobile/reports/distributor`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  distributorId,
                  reasonCode: selectedReason,
                  reasonText,
                  reasonDetail: reasonDetail || undefined,
                  imageUrls,
                }),
              });
              const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
              if (!res.ok) {
                throw new Error(data?.error || `Failed to submit report (${res.status})`);
              }
              Alert.alert(
                t('buyerNetworks.reportDistributor.alerts.submittedTitle'),
                t('buyerNetworks.reportDistributor.alerts.submittedBody'),
                [{ text: t('buyerNetworks.reportDistributor.alerts.ok'), onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                t('buyerNetworks.reportDistributor.alerts.errorTitle'),
                t('buyerNetworks.reportDistributor.alerts.submitFailedBody')
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const disabled =
    !selectedReason ||
    (selectedReason === 'other' && !customReason.trim()) ||
    imageUrls.length === 0 ||
    isSubmitting ||
    uploadingPhotos;

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
                  accessibilityLabel={t('buyerNetworks.reportDistributor.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('buyerNetworks.reportDistributor.title')}</Text>
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
          <View style={styles.warningContainer}>
            <AlertCircle size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              {t('buyerNetworks.reportDistributor.warning')}
            </Text>
          </View>

          {(params.distributorName || params.distributorId) ? (
            <View style={styles.orderInfoContainer}>
              <Text style={styles.orderIdLabel}>{t('buyerNetworks.reportDistributor.distributorLabel')}</Text>
              <Text style={styles.orderIdValue}>
                {params.distributorName ? params.distributorName : `#${String(params.distributorId)}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.reasonsContainer}>
            <Text style={styles.sectionTitle}>{t('buyerNetworks.reportDistributor.whyTitle')}</Text>

            {REPORT_REASON_IDS.map((reasonId) => (
              <TouchableOpacity
                key={reasonId}
                style={[styles.reasonItem, selectedReason === reasonId && styles.reasonItemSelected]}
                onPress={() => setSelectedReason(reasonId)}
              >
                <View style={styles.reasonContent}>
                  <Text style={[styles.reasonLabel, selectedReason === reasonId && styles.reasonLabelSelected]}>
                    {t(`buyerNetworks.reportDistributor.reasons.${reasonId}.label`)}
                  </Text>
                  <Text
                    style={[
                      styles.reasonDescription,
                      selectedReason === reasonId && styles.reasonDescriptionSelected,
                    ]}
                  >
                    {t(`buyerNetworks.reportDistributor.reasons.${reasonId}.description`)}
                  </Text>
                </View>
                <View style={[styles.radioButton, selectedReason === reasonId && styles.radioButtonSelected]}>
                  {selectedReason === reasonId && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedReason === 'other' && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>{t('buyerNetworks.reportDistributor.customReasonLabel')}</Text>
              <TextInput
                style={styles.customReasonInput}
                value={customReason}
                onChangeText={setCustomReason}
                placeholder={t('buyerNetworks.reportDistributor.customReasonPlaceholder')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={scrollToInput}
              />
            </View>
          )}

          <View style={styles.photosSection}>
            <Text style={styles.inputLabel}>{t('buyerNetworks.reportDistributor.photosLabel', { max: maxPhotos })}</Text>
            <Text style={styles.photosHint}>
              {t('buyerNetworks.reportDistributor.photosHint')}
            </Text>
            <View style={styles.photoRow}>
              {imageUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityLabel={t('buyerNetworks.reportDistributor.a11y.removePhoto')}
                    accessibilityRole="button"
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUrls.length < maxPhotos && (
                <TouchableOpacity
                  style={styles.photoAdd}
                  onPress={handleAddPhotos}
                  disabled={uploadingPhotos}
                  accessibilityLabel={t('buyerNetworks.reportDistributor.a11y.addPhotos')}
                  accessibilityRole="button"
                >
                  {uploadingPhotos ? (
                    <ShimmerIcon size={24} />
                  ) : (
                    <ImagePlus size={24} color="#6b7280" />
                  )}
                  <Text style={styles.photoAddText}>
                    {imageUrls.length > 0
                      ? t('buyerNetworks.reportDistributor.addMore')
                      : t('buyerNetworks.reportDistributor.addPhotos')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <TouchableOpacity
          style={[styles.submitButton, disabled && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={disabled}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.submitButtonText, disabled && styles.submitButtonTextDisabled]}>
              {t('buyerNetworks.reportDistributor.submit')}
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
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
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: width - 32,
    alignSelf: 'center',
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

