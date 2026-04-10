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

const { width } = Dimensions.get('window');

const REPORT_REASONS = [
  {
    id: 'fraud',
    label: 'Suspicious or fraudulent activity',
    description: 'Fake listings, misleading claims, or scams',
  },
  {
    id: 'poor_service',
    label: 'Poor service',
    description: 'Unresponsive, rude, or unhelpful communication',
  },
  {
    id: 'quality',
    label: 'Product quality concerns',
    description: 'Repeated quality issues or inaccurate descriptions',
  },
  {
    id: 'policy',
    label: 'Policy violation',
    description: 'Behavior that violates marketplace rules',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Please specify your reason below',
  },
] as const;

const primaryBlue = '#0a61d7';

export default function ReportDistributorModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ distributorId?: string; distributorName?: string }>();
  const token = useAuthStore((s) => s.token);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        folder: 'distributor_reports',
        selectionLimit: remaining,
      });
      if (urls && urls.length > 0) {
        setImageUrls((prev) => [...prev, ...urls].slice(0, 5));
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
      Alert.alert('Please wait', 'Photos are still uploading. Try again in a moment.');
      return;
    }
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for reporting this distributor.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert('Provide Reason', 'Please provide a custom reason for reporting.');
      return;
    }

    if (imageUrls.length === 0) {
      Alert.alert('Photos required', 'Please add at least one photo as proof (up to 5).');
      return;
    }

    const reasonText =
      selectedReason === 'other'
        ? customReason.trim()
        : REPORT_REASONS.find((r) => r.id === selectedReason)?.label || 'User submitted a report';

    Alert.alert(
      'Confirm Report',
      'Do you want to submit this report? Our team will review it.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Submit',
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              Alert.alert('Sign in required', 'Please sign in to submit a report.');
              return;
            }
            const distributorId = params.distributorId ? parseInt(String(params.distributorId), 10) : NaN;
            if (!Number.isFinite(distributorId) || distributorId < 1) {
              Alert.alert('Error', 'Invalid distributor.');
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
                'Report Submitted',
                data.message ||
                  `Thanks for your report${params.distributorName ? ` about ${params.distributorName}` : ''}.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'Failed to submit report. Please try again.'
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
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Report Distributor</Text>
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
              Please select a reason and add at least one photo as proof (up to 5). Our team will review your report.
            </Text>
          </View>

          {(params.distributorName || params.distributorId) ? (
            <View style={styles.orderInfoContainer}>
              <Text style={styles.orderIdLabel}>Distributor</Text>
              <Text style={styles.orderIdValue}>
                {params.distributorName ? params.distributorName : `#${String(params.distributorId)}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.reasonsContainer}>
            <Text style={styles.sectionTitle}>Why are you reporting this distributor?</Text>

            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonItem, selectedReason === reason.id && styles.reasonItemSelected]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <View style={styles.reasonContent}>
                  <Text style={[styles.reasonLabel, selectedReason === reason.id && styles.reasonLabelSelected]}>
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
                <View style={[styles.radioButton, selectedReason === reason.id && styles.radioButtonSelected]}>
                  {selectedReason === reason.id && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedReason === 'other' && (
            <View style={styles.customReasonContainer}>
              <Text style={styles.customReasonLabel}>Please specify your reason:</Text>
              <TextInput
                style={styles.customReasonInput}
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Enter your reason..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={scrollToInput}
              />
            </View>
          )}

          <View style={styles.photosSection}>
            <Text style={styles.inputLabel}>Photos (required, max 5)</Text>
            <Text style={styles.photosHint}>
              Add at least one image: screenshots, chats, or product photos help us investigate.
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
              Submit Report
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

