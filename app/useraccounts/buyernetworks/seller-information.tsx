import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Star,
  MessageSquare,
  Store,
  FileText,
  Truck,
  Check,
  MapPin,
} from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';

const primaryBlue = '#0a61d7';
const iconGray = '#6B7280';

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

interface DistributorProfile {
  id: number;
  name: string;
  logo: string | null;
  bannerImage: string | null;
  companyName: string | null;
  businessRegistrationNumber: string | null;
  industryType: string | null;
  businessDescription: string | null;
  yearsInOperation: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  shippingPreferences?: string[];
  deliveryTimeSlots?: string[];
  preferredDeliveryDays?: string[];
  pickupAddress?: string | null;
}

interface DistributorReviewItem {
  id: number;
  overallRating: number;
  comment?: string;
  createdAt: string;
  reviewerDisplayName: string;
  reviewerProfileImage?: string;
  wouldOrderAgain?: string;
}

interface DistributorReviewsData {
  distributorId: number;
  totalReviews: number;
  overallRating: number;
  reviews: DistributorReviewItem[];
}

export default function SellerInformationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [profile, setProfile] = useState<DistributorProfile | null>(null);
  const [reviewsData, setReviewsData] = useState<DistributorReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const distributorId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!id || !Number.isFinite(distributorId)) {
      setLoading(false);
      setError('Invalid seller');
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(id)}`),
          fetch(`${API_BASE_URL}/api/mobile/reviews/distributor?distributorId=${encodeURIComponent(id)}`),
        ]);

        if (cancelled) return;

        if (!profileRes.ok) {
          setError('Failed to load seller information');
          setProfile(null);
          return;
        }

        const profileJson = await profileRes.json();
        setProfile(profileJson);

        if (reviewsRes.ok) {
          const reviewsJson = await reviewsRes.json();
          setReviewsData(reviewsJson);
        } else {
          setReviewsData({ distributorId, totalReviews: 0, overallRating: 0, reviews: [] });
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load seller information');
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, distributorId]);

  const renderStars = (rating: number, size: number = 16) => (
    <View style={{ flexDirection: 'row', marginRight: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= rating ? '#fbbf24' : '#d1d5db'}
          fill={star <= rating ? '#fbbf24' : 'none'}
        />
      ))}
    </View>
  );

  const formatReviewDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return 'Recently';
    }
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Same behaviour as distributor-detail: loading and not-found are early returns with no Stack.Screen (layout header shows)
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centeredPadded}>
          <Store color={iconGray} size={48} />
          <Text style={styles.notFoundTitle}>Seller not found</Text>
          <Text style={styles.notFoundText}>{error || 'This seller may not exist.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const logoUri = normalizeUrl(profile.logo);
  const bannerUri = normalizeUrl(profile.bannerImage);
  const displayName = profile.companyName || profile.name || '—';
  const totalReviews = reviewsData?.totalReviews ?? 0;
  const overallRating = reviewsData?.overallRating ?? 0;
  const reviewsList = reviewsData?.reviews ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" accessibilityRole="button">
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', flex: 1, textAlign: 'left', marginLeft: 35 }}>Seller Information</Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Company Information - same UI as Distributor Operations (read-only) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 color={iconGray} size={20} />
            <Text style={styles.sectionTitle}>Company Information</Text>
          </View>

          {/* Logo */}
          <View style={styles.logoBlock}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Banner */}
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Store color={iconGray} size={40} />
            </View>
          )}

          {/* Company Name */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Company Name *</Text>
            <Text style={styles.fieldValue}>{displayName || '—'}</Text>
          </View>

          {/* Business Registration Number */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Business Registration Number</Text>
            <Text style={styles.fieldValue}>{profile.businessRegistrationNumber || '—'}</Text>
          </View>

          {profile.industryType ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Industry</Text>
              <Text style={styles.fieldValue}>{profile.industryType}</Text>
            </View>
          ) : null}
          {profile.businessDescription ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Business Description</Text>
              <Text style={[styles.fieldValue]}>{profile.businessDescription}</Text>
            </View>
          ) : null}
        </View>

        {/* Shipping & Delivery Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Truck color={iconGray} size={20} />
            <Text style={styles.sectionTitle}>Shipping & Delivery Preferences</Text>
          </View>

          {/* Shipping options */}
          <Text style={styles.subsectionLabel}>Shipping options</Text>
          {(() => {
            const shippingOptions: { key: string; label: string; required?: boolean }[] = [
              { key: 'Standard Shipping', label: 'Standard Shipping (Required)', required: true },
              { key: 'Next-day Delivery', label: 'Next-day Delivery' },
              { key: 'Express Shipping', label: 'Express Shipping' },
              { key: 'Scheduled Delivery', label: 'Scheduled Delivery' },
              { key: 'Same-day Delivery', label: 'Same-day Delivery' },
              { key: 'Pickup Available', label: 'Pickup Available' },
            ];
            const prefs = profile.shippingPreferences ?? [];
            return (
              <View style={styles.checkList}>
                {shippingOptions.map(({ key, label, required }) => {
                  const enabled = required || prefs.includes(key);
                  return (
                    <View key={key} style={styles.checkRow}>
                      {enabled ? <Check size={18} color={primaryBlue} strokeWidth={2.5} /> : <View style={styles.checkEmpty} />}
                      <Text style={[styles.checkLabel, !enabled && styles.checkLabelMuted]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {profile.pickupAddress ? (
            <>
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Pickup address</Text>
              <View style={styles.pickupAddressBlock}>
                <MapPin color={iconGray} size={16} style={{ marginTop: 2 }} />
                <Text style={styles.pickupAddressText}>{profile.pickupAddress}</Text>
              </View>
            </>
          ) : null}

          {(profile.deliveryTimeSlots?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Preferred delivery time slots</Text>
              <View style={styles.checkList}>
                {['Morning (8:00 AM - 12:00 PM)', 'Afternoon (12:00 PM - 5:00 PM)', 'Evening (5:00 PM - 8:00 PM)', 'Flexible'].map((label) => {
                  const enabled = (profile.deliveryTimeSlots ?? []).some((s) => s === label || label.startsWith(s));
                  return (
                    <View key={label} style={styles.checkRow}>
                      {enabled ? <Check size={18} color={primaryBlue} strokeWidth={2.5} /> : <View style={styles.checkEmpty} />}
                      <Text style={[styles.checkLabel, !enabled && styles.checkLabelMuted]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {(profile.preferredDeliveryDays?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Preferred delivery days</Text>
              <View style={styles.checkList}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const enabled = (profile.preferredDeliveryDays ?? []).some((d) => d.toLowerCase() === day.toLowerCase());
                  return (
                    <View key={day} style={styles.checkRow}>
                      {enabled ? <Check size={18} color={primaryBlue} strokeWidth={2.5} /> : <View style={styles.checkEmpty} />}
                      <Text style={[styles.checkLabel, !enabled && styles.checkLabelMuted]}>{day}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

        </View>

        {/* Distributor Reviews & Rating */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MessageSquare color={iconGray} size={20} />
            <Text style={styles.sectionTitle}>Reviews & Rating</Text>
          </View>

          {totalReviews > 0 ? (
            <>
              <View style={styles.ratingSummary}>
                <Text style={styles.overallRatingNumber}>{overallRating}</Text>
                {renderStars(Math.round(overallRating), 20)}
                <Text style={styles.totalReviewsText}>{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</Text>
              </View>

              {reviewsList.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      {review.reviewerProfileImage ? (
                        <Image
                          source={{ uri: normalizeUrl(review.reviewerProfileImage) ?? review.reviewerProfileImage }}
                          style={styles.reviewerAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.reviewerInitial}>
                          {review.reviewerDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.reviewMeta}>
                      <View style={styles.reviewMetaRow}>
                        {renderStars(review.overallRating, 14)}
                        <Text style={styles.reviewerName}>{review.reviewerDisplayName}</Text>
                      </View>
                      <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
                      {review.wouldOrderAgain ? (
                        <Text style={styles.wouldOrderAgain}>Would order again: {review.wouldOrderAgain}</Text>
                      ) : null}
                    </View>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment}>"{review.comment}"</Text>
                  ) : null}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.noReviews}>
              <MessageSquare color={iconGray} size={48} />
              <Text style={styles.noReviewsText}>No reviews yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centeredPadded: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  muted: { color: '#6b7280', fontSize: 14 },
  notFoundTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  notFoundText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  header: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#111827', fontSize: 20, fontWeight: '500', flex: 1, textAlign: 'left', marginLeft: 35 },
  section: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  logoBlock: { alignItems: 'center', marginBottom: 16 },
  logoImage: { width: 120, height: 120, borderRadius: 8 },
  logoPlaceholder: { width: 120, height: 120, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  logoPlaceholderText: { fontSize: 36, fontWeight: '600', color: '#6b7280' },
  bannerImage: { width: '100%', height: 160, borderRadius: 8, marginBottom: 16 },
  bannerPlaceholder: { width: '100%', height: 120, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  fieldValue: { fontSize: 16, color: '#111827' },
  subsectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  checkList: { gap: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkEmpty: { width: 18, height: 18, borderRadius: 2, borderWidth: 1.5, borderColor: '#d1d5db' },
  checkLabel: { fontSize: 15, color: '#111827' },
  checkLabelMuted: { color: '#9ca3af' },
  pickupAddressBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  pickupAddressText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  overallRatingNumber: { fontSize: 24, fontWeight: '700', color: '#111827' },
  totalReviewsText: { fontSize: 14, color: '#6b7280' },
  reviewCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  reviewHeader: { flexDirection: 'row', marginBottom: 8 },
  reviewerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reviewerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  reviewerInitial: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  reviewMeta: { flex: 1, marginLeft: 12 },
  reviewMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  reviewerName: { fontSize: 14, color: '#6b7280' },
  reviewDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  wouldOrderAgain: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  reviewComment: { fontSize: 14, color: '#374151', lineHeight: 20, fontStyle: 'italic' },
  noReviews: { alignItems: 'center', paddingVertical: 32 },
  noReviewsText: { fontSize: 16, color: '#6b7280', marginTop: 12 },
});
