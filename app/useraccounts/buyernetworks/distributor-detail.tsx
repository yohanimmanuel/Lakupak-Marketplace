import React, { useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, Alert, StyleSheet, Pressable, Share, Animated, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Users, MapPin, Phone, Mail, Star, Package, MessageSquare, Store, Calendar, Building2, FileText, Clock, ArrowLeft, MoreVertical, Share2, Flag, HelpCircle } from 'lucide-react-native';
import { useAuthStore } from '../../../stores/authStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import { API_BASE_URL } from '../../../services/config';
import type { MarketplaceProduct } from '../../../services/marketplace';
import { useDataStore, type MarketplaceOrder } from '../../../stores/dataStore';
import { useTranslation } from 'react-i18next';
import { DistributorDetailSkeleton } from '../../components/SkeletonLoader';

// Normalize relative image paths to absolute URLs
const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

interface Distributor {
  id: number;
  name: string;
  logo?: string;
  banner?: string;
  address?: string;
  phone?: string;
  email?: string;
  rating?: number;
  totalOrders: number;
  totalSpent?: number;
  lastOrderDate?: string;
  description?: string;
  industryType?: string;
  yearsInOperation?: string;
  verified?: boolean;
}

interface Order {
  orderId: string;
  date: string;
  total: number;
  status: string;
  items: number;
}

interface OrderResponse {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  totalAmount: number;
  storeName?: string;
  userId?: number | null;
  createdAt?: string;
  orderItems: Array<{ 
    packageQuantity?: number;
    product?: {
      userId?: number;
      name?: string;
    } | null;
  }>;
  user?: {
    id: number;
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    chosenAddress?: string;
    image?: string;
    storeName?: string;
    company?: {
      name?: string;
      logo?: string;
      bannerImage?: string;
      businessAddress?: string;
      businessPhone?: string;
      businessEmail?: string;
      businessDescription?: string;
      industryType?: string;
      yearsInOperation?: string;
    };
  };
}

export default function DistributorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user: authUser } = useAuthStore();
  const storeOrders = useDataStore(state => state.orders);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const products = useDataStore(state => state.products);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const loadRequestIdRef = useRef(0);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.toLowerCase().startsWith('id') ? 'id-ID' : 'en-US';

  useEffect(() => {
    if (authUser?.id && token) {
      // Load orders initially (WebSocket will handle updates)
      loadOrdersData(false);
    }
  }, [authUser?.id, token, loadOrdersData]);

  useEffect(() => {
    if (id && authUser?.id && token) {
      loadDistributorData(parseInt(id), storeOrders);
    } else {
      // Wait for auth hydration to avoid flashing the not-found state.
      if (!id) setIsLoading(false);
    }
  }, [id, authUser?.id, token, storeOrders, products]);

  const loadDistributorData = async (distributorId: number, sourceOrders: MarketplaceOrder[]) => {
    if (!authUser?.id || !token) {
      setIsLoading(false);
      return;
    }

    const requestId = ++loadRequestIdRef.current;

    try {
      setIsLoading(true);
      const distributorOrders = sourceOrders.filter((order) => {
        const orderDistributorId = order.userId ?? (order.orderItems && order.orderItems.length > 0 ? order.orderItems[0]?.product?.userId ?? null : null);
        return orderDistributorId === distributorId;
      }) as OrderResponse[];

      // Prefer catalog seller info, then order user, then the distributor profile API.
      // Zero orders is valid for a closed storefront membership.
      const storeProducts = useDataStore.getState().products;
      const match = storeProducts.find((product) => product?.userId === distributorId);
      let sellerCompany = match?.seller?.company;

      const distributorUser = distributorOrders[0]?.user;
      const nameFallback = distributorUser?.company?.name || distributorUser?.name || distributorUser?.username;

      if (!sellerCompany && distributorUser?.company && distributorUser.company.name) {
        sellerCompany = {
          name: distributorUser.company.name,
          businessAddress: distributorUser.company.businessAddress,
          businessPhone: distributorUser.company.businessPhone,
          businessEmail: distributorUser.company.businessEmail,
          businessDescription: distributorUser.company.businessDescription,
          industryType: distributorUser.company.industryType,
          yearsInOperation: distributorUser.company.yearsInOperation,
          logo: distributorUser.company.logo,
          bannerImage: distributorUser.company.bannerImage,
        };
      }

      let profileFallback: {
        companyName?: string | null;
        name?: string | null;
        logo?: string | null;
        bannerImage?: string | null;
        businessAddress?: string | null;
        businessPhone?: string | null;
        businessEmail?: string | null;
        businessDescription?: string | null;
        industryType?: string | null;
        yearsInOperation?: string | null;
      } | null = null;

      if (!sellerCompany?.name && !nameFallback) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(String(distributorId))}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (requestId !== loadRequestIdRef.current) return;
          if (res.ok) {
            profileFallback = await res.json();
          }
        } catch {
          profileFallback = null;
        }
      }

      if (requestId !== loadRequestIdRef.current) return;

      if (!sellerCompany?.name && !nameFallback && !profileFallback?.companyName && !profileFallback?.name) {
        setDistributor(null);
        setOrders([]);
        return;
      }

      const totalSpent = distributorOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      let lastOrderDate: string | undefined = undefined;
      if (distributorOrders.length > 0 && distributorOrders[0].orderDate) {
        const parsedDate = new Date(distributorOrders[0].orderDate);
        if (!isNaN(parsedDate.getTime())) {
          lastOrderDate = distributorOrders[0].orderDate;
        }
      }

      const displayName =
        sellerCompany?.name ||
        nameFallback ||
        profileFallback?.companyName?.trim() ||
        profileFallback?.name?.trim() ||
        `Distributor #${distributorId}`;

      const distributorData: Distributor = {
        id: distributorId,
        name: displayName,
        logo:
          normalizeUrl(sellerCompany?.logo) ||
          normalizeUrl(distributorUser?.company?.logo) ||
          normalizeUrl(distributorUser?.image) ||
          normalizeUrl(profileFallback?.logo),
        banner:
          normalizeUrl(sellerCompany?.bannerImage) ||
          normalizeUrl(distributorUser?.company?.bannerImage) ||
          normalizeUrl(profileFallback?.bannerImage),
        address:
          sellerCompany?.businessAddress ||
          distributorUser?.company?.businessAddress ||
          distributorUser?.chosenAddress ||
          profileFallback?.businessAddress ||
          undefined,
        phone:
          sellerCompany?.businessPhone ||
          distributorUser?.company?.businessPhone ||
          distributorUser?.phone ||
          profileFallback?.businessPhone ||
          undefined,
        email:
          sellerCompany?.businessEmail ||
          distributorUser?.company?.businessEmail ||
          distributorUser?.email ||
          profileFallback?.businessEmail ||
          undefined,
        rating: 4.5,
        totalOrders: distributorOrders.length,
        totalSpent,
        lastOrderDate,
        description:
          sellerCompany?.businessDescription ||
          distributorUser?.company?.businessDescription ||
          profileFallback?.businessDescription ||
          undefined,
        industryType:
          sellerCompany?.industryType ||
          distributorUser?.company?.industryType ||
          profileFallback?.industryType ||
          undefined,
        yearsInOperation:
          sellerCompany?.yearsInOperation ||
          distributorUser?.company?.yearsInOperation ||
          profileFallback?.yearsInOperation ||
          undefined,
        verified: !!(
          sellerCompany?.name ||
          distributorUser?.company?.name ||
          profileFallback?.companyName ||
          profileFallback?.name
        ),
      };

      if (requestId !== loadRequestIdRef.current) return;

      setDistributor(distributorData);

      const transformedOrders: Order[] = distributorOrders
        .map(order => {
          let orderDate = order.orderDate;
          if (orderDate) {
            const parsedDate = new Date(orderDate);
            if (isNaN(parsedDate.getTime())) {
              orderDate = order.createdAt || new Date().toISOString();
            }
          } else {
            orderDate = order.createdAt || new Date().toISOString();
          }

          return {
            orderId: order.orderId,
            date: orderDate,
            total: order.totalAmount || 0,
            status: order.orderStatus,
            items: order.orderItems?.reduce((sum, item) => sum + (item.packageQuantity || 1), 0) || 0
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);

      if (requestId !== loadRequestIdRef.current) return;

      setOrders(transformedOrders);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      setDistributor(null);
      setOrders([]);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleContact = () => {
    Alert.alert(
      t('buyerNetworks.distributorDetail.alerts.contactTitle'),
      t('buyerNetworks.distributorDetail.alerts.contactBody', {
        phone: distributor?.phone ?? '—',
        email: distributor?.email ?? '—',
      })
    );
  };

  const handleViewStore = () => {
    Alert.alert(t('buyerNetworks.distributorDetail.alerts.viewStoreTitle'), t('buyerNetworks.distributorDetail.alerts.viewStoreBody'));
  };

  const handleShareDistributor = async () => {
    if (!distributor) return;
    try {
      const message = t('buyerNetworks.distributorDetail.share.message', { name: distributor.name });
      await Share.share({ message });
    } catch (e) {
      Alert.alert(
        t('buyerNetworks.distributorDetail.share.errorTitle'),
        t('buyerNetworks.distributorDetail.share.errorBody')
      );
    }
  };

  const handleReportDistributor = () => {
    if (!distributor) return;
    router.push({
      pathname: '/useraccounts/buyernetworks/ReportDistributorModal',
      params: {
        distributorId: String(distributor.id),
        distributorName: distributor.name,
      },
    });
  };

  const handleNeedHelp = () => {
    router.push('/useraccounts/consent/helpcenter');
  };

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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <DistributorDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!distributor) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centeredPadded}>
          <Users color={iconGray} size={48} />
          <Text style={styles.notFoundTitle}>{t('buyerNetworks.distributorDetail.notFoundTitle')}</Text>
          <Text style={styles.notFoundText}>{t('buyerNetworks.distributorDetail.notFoundBody')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
        }}
      />
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.distributorDetail.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', flex: 1, textAlign: 'left', marginLeft: 35 }}>
                  {t('buyerNetworks.distributorDetail.title')}
                </Text>
                <Pressable
                  onPress={openMenu}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.distributorDetail.a11y.moreOptions')}
                  accessibilityRole="button"
                >
                  <MoreVertical color={primaryBlue} size={22} />
                </Pressable>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {distributor.banner ? (
          <Image source={{ uri: distributor.banner }} style={styles.banner} />
        ) : (
          <View style={styles.bannerPlaceholder}>
            <Store color={iconGray} size={48} />
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              {distributor.logo ? (
                <Image source={{ uri: distributor.logo }} style={styles.avatarImg} />
              ) : (
                <Users color={primaryBlue} size={32} />
              )}
            </View>
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <Text style={styles.titleText}>{distributor.name}</Text>
                {distributor.verified && (
                  <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                )}
              </View>
              {distributor.rating && (
                <View style={styles.ratingRow}>
                  <Star color="#fbbf24" size={16} fill="#fbbf24" />
                  <Text style={styles.ratingVal}>{distributor.rating}</Text>
                  <Text style={styles.ratingCount}>{t('buyerNetworks.distributorDetail.ratingOrders', { count: distributor.totalOrders })}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.contactSection}>
            {distributor.description ? (
              <View style={styles.contactRow}>
                <FileText color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.description}</Text>
              </View>
            ) : null}
            {distributor.yearsInOperation ? (
              <View style={styles.contactRow}>
                <Clock color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.yearsInOperation}</Text>
              </View>
            ) : null}
            {distributor.industryType ? (
              <View style={styles.contactRow}>
                <Building2 color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.industryType}</Text>
              </View>
            ) : null}
            {distributor.address ? (
              <View style={styles.contactRow}>
                <MapPin color={iconGray} size={18} style={styles.contactIcon} />
                <Text style={styles.contactText}>{distributor.address}</Text>
              </View>
            ) : null}
            {distributor.phone ? (
              <View style={styles.contactRow}>
                <Phone color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.phone}</Text>
              </View>
            ) : null}
            {distributor.email ? (
              <View style={styles.contactRow}>
                <Mail color={iconGray} size={18} />
                <Text style={styles.contactText}>{distributor.email}</Text>
              </View>
            ) : null}

          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('buyerNetworks.distributorDetail.historyTitle')}</Text>
          {orders.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Package color={iconGray} size={48} />
              <Text style={styles.historyEmptyText}>{t('buyerNetworks.distributorDetail.historyEmpty')}</Text>
            </View>
          ) : (
            orders.map((order) => (
              <View key={order.orderId} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderId}>{order.orderId}</Text>
                    <View style={styles.orderDateRow}>
                      <Calendar color={iconGray} size={14} />
                      <Text style={styles.orderDateText}>
                        {(() => {
                          const date = new Date(order.date);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString(locale);
                          }
                          return t('buyerNetworks.distributorDetail.invalidDate');
                        })()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>
                      {Number(order.total) > 0
                        ? formatCurrency(order.total)
                        : t('tabsOrders.pendingPrice')}
                    </Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderItems}>
                  {t('buyerNetworks.distributorDetail.items', { count: order.items })}
                </Text>
              </View>
            ))
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
            accessibilityLabel={t('buyerNetworks.distributorDetail.a11y.closeMenu')}
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
                handleShareDistributor();
              }}
              style={styles.menuRow}
            >
              <Share2 size={18} color="#111827" />
              <Text style={styles.menuRowText}>{t('buyerNetworks.distributorDetail.menu.share')}</Text>
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
              <Text style={[styles.menuRowText, styles.menuRowTextDanger]}>{t('buyerNetworks.distributorDetail.menu.report')}</Text>
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
              <Text style={[styles.menuRowText, styles.menuRowTextPrimary]}>{t('buyerNetworks.distributorDetail.needHelp.menu')}</Text>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centeredPadded: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  muted: { color: '#6b7280' },
  notFoundTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  notFoundText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  banner: { width: '100%', height: 200 },
  bannerPlaceholder: { width: '100%', height: 200, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  infoCard: { padding: 20, backgroundColor: '#ffffff' },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  titleCol: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  titleText: { fontSize: 20, fontWeight: '700', color: '#111827', marginRight: 8 },
  verifiedBadge: { backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { color: '#ffffff', fontWeight: '600', fontSize: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingVal: { fontSize: 14, color: '#6b7280', marginLeft: 4 },
  ratingCount: { fontSize: 14, color: '#9ca3af', marginLeft: 4 },
  contactSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  contactIcon: { marginTop: 2 },
  contactText: { fontSize: 14, color: '#6b7280', marginLeft: 12, flex: 1 },
  historySection: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  historyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  historyEmpty: { alignItems: 'center', paddingVertical: 40 },
  historyEmptyText: { fontSize: 14, color: '#6b7280', marginTop: 12 },
  orderCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#111827' },
  orderDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  orderDateText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  orderRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#111827' },
  orderStatus: { fontSize: 12, color: '#10b981', marginTop: 4 },
  orderItems: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  reviewButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  menuRoot: {
    flex: 1,
  },
  menuBackdrop: {
    flex: 1,
  },
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
  menuRowText: {
    fontSize: 14,
    color: '#111827',
  },
  menuRowTextPrimary: {
    color: '#0a61d7',
    fontWeight: '600',
  },
  menuRowTextDanger: {
    color: '#ef4444',
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 2,
  },
});
