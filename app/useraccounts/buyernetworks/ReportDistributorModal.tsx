import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
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
import { AlertCircle, ArrowLeft } from 'lucide-react-native';

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
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for reporting this distributor.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert('Provide Reason', 'Please provide a custom reason for reporting.');
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
            try {
              setIsSubmitting(true);
              // Backend endpoint not wired here yet. This modal matches the Cancel Order UX.
              // If/when an API is available, submit:
              // - distributorId: params.distributorId
              // - reasonCode: selectedReason
              // - reason: reasonText
              Alert.alert(
                'Report Submitted',
                `Thanks for your report${params.distributorName ? ` about ${params.distributorName}` : ''}.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const disabled = !selectedReason || (selectedReason === 'other' && !customReason.trim()) || isSubmitting;

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
              Please select a reason for reporting. Include details if needed so we can review it properly.
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
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <TouchableOpacity
          style={[styles.submitButton, disabled && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={disabled}
        >
          <Text style={[styles.submitButtonText, disabled && styles.submitButtonTextDisabled]}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
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

