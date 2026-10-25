import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Store,
  Truck,
  Check,
  MapPin,
  MoreVertical,
  Share2,
  Flag,
  HelpCircle,
} from 'lucide-react-native';
import { API_BASE_URL } from '../../../services/config';
import { authHeaders } from '../../../services/graphql';
import { useTranslation } from 'react-i18next';
import { SellerInformationSkeleton } from '../../components/SkeletonLoader';

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

export default function DistributorInformationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const id = params.id;

  const [profile, setProfile] = useState<DistributorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;

  const distributorId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!id || !Number.isFinite(distributorId)) {
      setLoading(false);
      setError(t('buyerNetworks.sellerInformation.errors.invalidSeller'));
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profileRes = await fetch(
          `${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(id)}`,
          { headers: authHeaders() },
        );

        if (cancelled) return;

        if (!profileRes.ok) {
          setError(t('buyerNetworks.sellerInformation.errors.failedToLoad'));
          setProfile(null);
          return;
        }

        const profileJson = await profileRes.json();
        setProfile(profileJson);
      } catch {
        if (!cancelled) {
          setError(t('buyerNetworks.sellerInformation.errors.failedToLoad'));
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, distributorId]);

  const openMenu = () => {
    setMenuVisible(true);
    menuOpacity.setValue(0);
    menuScale.setValue(0.95);
    Animated.parallel([
      Animated.timing(menuOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.spring(menuScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(menuScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  };

  const handleShareDistributor = async () => {
    try {
      await Share.share({
        message: t('buyerNetworks.distributorInformation.share.message', {
          name: profile?.companyName || profile?.name || 'Distributor',
        }),
      });
    } catch {
      Alert.alert(
        t('buyerNetworks.distributorInformation.share.title'),
        t('buyerNetworks.distributorInformation.share.failed'),
      );
    }
  };

  const handleReportDistributor = () => {
    if (!Number.isFinite(distributorId)) return;
    router.push({
      pathname: '/useraccounts/buyernetworks/ReportDistributorModal',
      params: {
        distributorId: String(distributorId),
        distributorName: profile?.companyName || profile?.name || 'Distributor',
      },
    });
  };

  const handleNeedHelp = () => {
    Alert.alert(
      t('buyerNetworks.distributorInformation.help.title'),
      t('buyerNetworks.distributorInformation.help.body'),
    );
  };

  // Same behaviour as distributor-detail: loading and not-found are early returns with no Stack.Screen (layout header shows)
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <SellerInformationSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centeredPadded}>
          <Store color={iconGray} size={48} />
          <Text style={styles.notFoundTitle}>{t('buyerNetworks.sellerInformation.states.sellerNotFound')}</Text>
          <Text style={styles.notFoundText}>{error || t('buyerNetworks.sellerInformation.states.sellerMayNotExist')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const logoUri = normalizeUrl(profile.logo);
  const bannerUri = normalizeUrl(profile.bannerImage);
  const displayName = profile.companyName || profile.name || '—';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.sellerInformation.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', flex: 1, textAlign: 'left', marginLeft: 35 }}>
                  {t('buyerNetworks.sellerInformation.title')}
                </Text>
                <Pressable
                  onPress={openMenu}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.sellerInformation.a11y.moreOptions')}
                  accessibilityRole="button"
                >
                  <MoreVertical color={primaryBlue} size={22} />
                </Pressable>
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
            <Text style={styles.sectionTitle}>{t('buyerNetworks.sellerInformation.labels.companyInformation')}</Text>
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
            <Text style={styles.fieldLabel}>{t('buyerNetworks.sellerInformation.labels.companyName')}</Text>
            <Text style={styles.fieldValue}>{displayName || '—'}</Text>
          </View>

          {/* Business Registration Number */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('buyerNetworks.sellerInformation.labels.businessRegistrationNumber')}</Text>
            <Text style={styles.fieldValue}>{profile.businessRegistrationNumber || '—'}</Text>
          </View>

          {profile.industryType ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('buyerNetworks.sellerInformation.labels.industry')}</Text>
              <Text style={styles.fieldValue}>{profile.industryType}</Text>
            </View>
          ) : null}
          {profile.businessDescription ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('buyerNetworks.sellerInformation.labels.businessDescription')}</Text>
              <Text style={[styles.fieldValue]}>{profile.businessDescription}</Text>
            </View>
          ) : null}
        </View>

        {/* Shipping & Delivery Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Truck color={iconGray} size={20} />
            <Text style={styles.sectionTitle}>
              {t('buyerNetworks.sellerInformation.labels.shippingDeliveryPreferences')}
            </Text>
          </View>

          {/* Shipping options */}
          <Text style={styles.subsectionLabel}>{t('buyerNetworks.sellerInformation.labels.shippingOptions')}</Text>
          {(() => {
            const shippingOptions: { key: string; label: string }[] = [
              { key: 'Self Pickup', label: t('buyerNetworks.sellerInformation.shippingOptions.selfPickup') },
              { key: 'Seller/Distributor Delivery', label: t('buyerNetworks.sellerInformation.shippingOptions.sellerDelivery') },
              { key: 'Buyer-arranged Courier', label: t('buyerNetworks.sellerInformation.shippingOptions.buyerCourier') },
            ];
            const prefs = profile.shippingPreferences ?? [];
            return (
              <View style={styles.checkList}>
                {shippingOptions.map(({ key, label }) => {
                  const enabled = prefs.includes(key);
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
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>
                {t('buyerNetworks.sellerInformation.labels.pickupAddress')}
              </Text>
              <View style={styles.pickupAddressBlock}>
                <MapPin color={iconGray} size={16} style={{ marginTop: 2 }} />
                <Text style={styles.pickupAddressText}>{profile.pickupAddress}</Text>
              </View>
            </>
          ) : null}

          {(profile.deliveryTimeSlots?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>
                {t('buyerNetworks.sellerInformation.labels.preferredDeliveryTimeSlots')}
              </Text>
              <View style={styles.checkList}>
                {[
                  { raw: 'Morning (8:00 AM - 12:00 PM)', label: t('buyerNetworks.sellerInformation.deliveryTimeSlots.morning') },
                  { raw: 'Afternoon (12:00 PM - 5:00 PM)', label: t('buyerNetworks.sellerInformation.deliveryTimeSlots.afternoon') },
                  { raw: 'Evening (5:00 PM - 8:00 PM)', label: t('buyerNetworks.sellerInformation.deliveryTimeSlots.evening') },
                  { raw: 'Flexible', label: t('buyerNetworks.sellerInformation.deliveryTimeSlots.flexible') },
                ].map(({ raw, label }) => {
                  const enabled = (profile.deliveryTimeSlots ?? []).some((s) => s === raw || raw.startsWith(s));
                  return (
                    <View key={raw} style={styles.checkRow}>
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
              <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>
                {t('buyerNetworks.sellerInformation.labels.preferredDeliveryDays')}
              </Text>
              <View style={styles.checkList}>
                {[
                  { raw: 'Monday', label: t('buyerNetworks.sellerInformation.days.monday') },
                  { raw: 'Tuesday', label: t('buyerNetworks.sellerInformation.days.tuesday') },
                  { raw: 'Wednesday', label: t('buyerNetworks.sellerInformation.days.wednesday') },
                  { raw: 'Thursday', label: t('buyerNetworks.sellerInformation.days.thursday') },
                  { raw: 'Friday', label: t('buyerNetworks.sellerInformation.days.friday') },
                  { raw: 'Saturday', label: t('buyerNetworks.sellerInformation.days.saturday') },
                  { raw: 'Sunday', label: t('buyerNetworks.sellerInformation.days.sunday') },
                ].map(({ raw, label }) => {
                  const enabled = (profile.preferredDeliveryDays ?? []).some((d) => d.toLowerCase() === raw.toLowerCase());
                  return (
                    <View key={raw} style={styles.checkRow}>
                      {enabled ? <Check size={18} color={primaryBlue} strokeWidth={2.5} /> : <View style={styles.checkEmpty} />}
                      <Text style={[styles.checkLabel, !enabled && styles.checkLabelMuted]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

        </View>
      </ScrollView>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <View style={styles.menuRoot}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={closeMenu}
            accessibilityLabel={t('buyerNetworks.sellerInformation.a11y.closeMenu')}
            accessibilityRole="button"
          />
          <Animated.View
            style={[
              styles.menuSheet,
              {
                top: Math.max(insets.top, 44) + 8 + 44,
                opacity: menuOpacity,
                transform: [{ scale: menuScale }],
              },
            ]}
          >
            <Pressable
              onPress={() => {
                closeMenu();
                void handleShareDistributor();
              }}
              style={styles.menuRow}
            >
              <Share2 size={18} color="#111827" />
              <Text style={styles.menuRowText}>
                {t('buyerNetworks.distributorInformation.menu.share')}
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              onPress={() => {
                closeMenu();
                handleReportDistributor();
              }}
              style={styles.menuRow}
            >
              <Flag size={18} color="#ef4444" />
              <Text style={[styles.menuRowText, styles.menuRowTextDanger]}>
                {t('buyerNetworks.distributorInformation.menu.reportDistributor')}
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              onPress={() => {
                closeMenu();
                handleNeedHelp();
              }}
              style={styles.menuRow}
            >
              <HelpCircle size={18} color="#0a61d7" />
              <Text style={[styles.menuRowText, styles.menuRowTextPrimary]}>
                {t('buyerNetworks.distributorInformation.menu.needHelp')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
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
  moreReviewsBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreReviewsText: { fontSize: 13, fontWeight: '600', color: primaryBlue },
  menuRoot: { flex: 1 },
  menuBackdrop: { flex: 1 },
  menuSheet: {
    position: 'absolute',
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    width: 200,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  menuRowText: { fontSize: 14, color: '#111827' },
  menuRowTextPrimary: { color: '#0a61d7', fontWeight: '600' },
  menuRowTextDanger: { color: '#ef4444', fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 },
});
