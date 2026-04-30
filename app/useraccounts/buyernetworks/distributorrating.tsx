import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star, MessageSquare, Truck, Package, ThumbsUp } from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';
import { useAuthStore } from '../../../stores/authStore';
import { useTranslation } from 'react-i18next';

interface DistributorRatingParams {
  id?: string;
  name?: string;
  logo?: string;
  description?: string;
  industryType?: string;
  totalOrders?: string;
}

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function DistributorRatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = useAuthStore((s) => s.token);
  const { id, name, logo, description, industryType, totalOrders } = params as DistributorRatingParams;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [overallRating, setOverallRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [productQualityRating, setProductQualityRating] = useState<number>(0);
  const [wouldOrderAgain, setWouldOrderAgain] = useState<'yes' | 'no' | 'maybe' | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';
  const logoUri = normalizeUrl(logo);
  const orderCount = totalOrders ? parseInt(totalOrders, 10) : 0;
  const isValidOrderCount = !isNaN(orderCount) && orderCount >= 0;

  const handleSubmit = async () => {
    if (!id) {
      Alert.alert(t('buyerNetworks.distributorRating.alerts.missingIdTitle'), t('buyerNetworks.distributorRating.alerts.missingIdBody'));
      return;
    }
    if (!overallRating) {
      Alert.alert(t('buyerNetworks.distributorRating.alerts.ratingRequiredTitle'), t('buyerNetworks.distributorRating.alerts.ratingRequiredBody'));
      return;
    }

    if (!token) {
      Alert.alert(t('buyerNetworks.distributorRating.alerts.signInRequiredTitle'), t('buyerNetworks.distributorRating.alerts.signInRequiredBody'));
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        id,
        overallRating,
        communicationRating,
        deliveryRating,
        productQualityRating,
        wouldOrderAgain,
        comment,
      };

      const baseUrl = API_BASE_URL?.replace(/\/$/, '') || '';
      const response = await fetch(`${baseUrl}/api/mobile/reviews/distributor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = (data?.error as string) || `Request failed (${response.status})`;
        throw new Error(message);
      }

      Alert.alert(t('buyerNetworks.distributorRating.alerts.thankYouTitle'), t('buyerNetworks.distributorRating.alerts.submittedBody'), [
        {
          text: t('buyerNetworks.distributorRating.alerts.ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Distributor review submission failed:', error);
      const message = error instanceof Error ? error.message : t('buyerNetworks.distributorRating.alerts.submitFailedBody');
      Alert.alert(t('buyerNetworks.distributorRating.alerts.errorTitle'), message, [{ text: t('buyerNetworks.distributorRating.alerts.ok') }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (v: number) => void) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.8}>
          <Star
            size={28}
            color={star <= value ? '#fbbf24' : '#d1d5db'}
            fill={star <= value ? '#fbbf24' : 'none'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View
              style={{
                backgroundColor: '#ffffff',
                paddingTop: Math.max(insets.top, 44) + 8,
                borderBottomColor: '#e5e7eb',
                borderBottomWidth: 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingBottom: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.distributorRating.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </TouchableOpacity>
                <Text
                  style={{
                    color: '#111827',
                    fontSize: 20,
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'left',
                    marginLeft: 35,
                  }}
                >
                  {t('buyerNetworks.distributorRating.title')}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 40) : 0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentCard}>
          <View style={styles.headerSection}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.distributorLogo} />
            ) : (
              <View style={styles.distributorAvatar}>
                <Text style={styles.distributorInitials}>
                  {name ? name.charAt(0).toUpperCase() : t('buyerNetworks.distributorRating.defaults.initial')}
                </Text>
              </View>
            )}
            <View style={styles.distributorInfo}>
              <Text style={styles.distributorName}>{name || t('buyerNetworks.distributorRating.defaults.name')}</Text>
              {industryType ? (
                <Text style={styles.distributorMeta}>{industryType}</Text>
              ) : null}
              {isValidOrderCount ? (
                <Text style={styles.distributorMeta}>
                  {t('buyerNetworks.distributorRating.meta.ordersWithDistributor', { count: orderCount })}
                </Text>
              ) : null}
              {description ? (
                <Text style={styles.distributorDescription} numberOfLines={2}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('buyerNetworks.distributorRating.sections.overallTitle')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('buyerNetworks.distributorRating.sections.overallSubtitle')}
            </Text>
            {renderStars(overallRating, setOverallRating)}
          </View>

          <View style={styles.ratingRow}>
            <MessageSquare color={iconGray} size={18} />
            <View style={styles.ratingRowContent}>
              <Text style={styles.ratingRowLabel}>{t('buyerNetworks.distributorRating.sections.communication')}</Text>
              <Text style={styles.ratingRowHint}>{t('buyerNetworks.distributorRating.sections.communicationHint')}</Text>
              {renderStars(communicationRating, setCommunicationRating)}
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Truck color={iconGray} size={18} />
            <View style={styles.ratingRowContent}>
              <Text style={styles.ratingRowLabel}>{t('buyerNetworks.distributorRating.sections.deliveryPackaging')}</Text>
              <Text style={styles.ratingRowHint}>{t('buyerNetworks.distributorRating.sections.deliveryPackagingHint')}</Text>
              {renderStars(deliveryRating, setDeliveryRating)}
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Package color={iconGray} size={18} />
            <View style={styles.ratingRowContent}>
              <Text style={styles.ratingRowLabel}>{t('buyerNetworks.distributorRating.sections.productQuality')}</Text>
              <Text style={styles.ratingRowHint}>{t('buyerNetworks.distributorRating.sections.productQualityHint')}</Text>
              {renderStars(productQualityRating, setProductQualityRating)}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ThumbsUp color={iconGray} size={18} />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                {t('buyerNetworks.distributorRating.sections.wouldOrderAgain')}
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('buyerNetworks.distributorRating.sections.wouldOrderAgainSubtitle')}
            </Text>
            <View style={styles.orderAgainRow}>
              {(['yes', 'no', 'maybe'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.orderAgainButton,
                    wouldOrderAgain === opt && styles.orderAgainButtonSelected,
                  ]}
                  onPress={() => setWouldOrderAgain(opt)}
                >
                  <Text
                    style={[
                      styles.orderAgainButtonText,
                      wouldOrderAgain === opt && styles.orderAgainButtonTextSelected,
                    ]}
                  >
                    {opt === 'yes'
                      ? t('buyerNetworks.distributorRating.choices.yes')
                      : opt === 'no'
                        ? t('buyerNetworks.distributorRating.choices.no')
                        : t('buyerNetworks.distributorRating.choices.maybe')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MessageSquare color={iconGray} size={18} />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
                {t('buyerNetworks.distributorRating.comment.label')}
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('buyerNetworks.distributorRating.comment.subtitle')}
            </Text>
            <TextInput
              style={styles.textArea}
              value={comment}
              onChangeText={setComment}
              placeholder={t('buyerNetworks.distributorRating.comment.placeholder')}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

        <View style={[styles.bottomContainer, { paddingBottom: 3 + insets.bottom }]}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!overallRating || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!overallRating || isSubmitting}
          >
            <Text
              style={[
                styles.submitButtonText,
                (!overallRating || isSubmitting) && styles.submitButtonTextDisabled,
              ]}
            >
              {isSubmitting
                ? t('buyerNetworks.distributorRating.submit.submitting')
                : t('buyerNetworks.distributorRating.submit.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  contentCard: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  distributorLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
  },
  distributorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distributorInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a61d7',
  },
  distributorInfo: {
    marginLeft: 14,
    flex: 1,
  },
  distributorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  distributorMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  distributorDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 18,
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  ratingRowContent: {
    flex: 1,
    marginLeft: 12,
  },
  ratingRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  ratingRowHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  orderAgainRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  orderAgainButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderAgainButtonSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#0a61d7',
  },
  orderAgainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  orderAgainButtonTextSelected: {
    color: '#0a61d7',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 120,
    backgroundColor: '#f9fafb',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: -15,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
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

