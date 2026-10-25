import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { User as UserIcon, MapPin, WalletMinimal, Truck, PackageCheck, CheckCircle, ChevronRight, RotateCcw, Gift, Tag, DollarSign, Wallet, Heart, Clock, RotateCw, Users } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { API_BASE_URL } from '../../services/config';
import { decodeToken, authHeaders } from '../../services/graphql';
import { useDataStore } from '../../stores/dataStore';
import { useTranslation } from 'react-i18next';
import { AccountProfileSkeleton } from '../components/SkeletonLoader';
import { useTabBarScrollCollapse } from '../../hooks/useTabBarScrollCollapse';
import { FLOATING_TAB_BAR_CONTENT_INSET } from '../../components/FloatingTabBar';

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
  totalOrders: number;
}

interface Order {
  orderId: string;
  userId: number | null;
  storeName: string;
  orderStatus: string;
  orderDate: string;
  orderItems?: Array<{
    product?: {
      userId?: number;
      name?: string;
    } | null;
  }>;
}

export default function AccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const onTabBarScroll = useTabBarScrollCollapse();
  const primaryBlue = '#0a61d7';
  const iconGray = '#6B7280';
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  const orders = useDataStore(state => state.orders);
  const loadOrdersData = useDataStore(state => state.loadOrdersData);
  const loadUserData = useDataStore(state => state.loadUserData);
  const isUserLoading = useDataStore(state => state.isUserLoading);
  const forceRefreshProducts = useDataStore(state => state.forceRefreshProducts);
  const products = useDataStore(state => state.products);
  const storefrontDistributorId = useDataStore(state => state.storefrontDistributorId);
  const [refreshing, setRefreshing] = useState(false);
  const [storefrontProfile, setStorefrontProfile] = useState<{
    name: string;
    logo?: string;
  } | null>(null);

  const tokenStorefrontId = React.useMemo(() => {
    if (!token) return null;
    return decodeToken(token).distributorId ?? null;
  }, [token]);
  const activeStorefrontId = storefrontDistributorId ?? tokenStorefrontId;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      loadUserData(token);
    }
  }, [token, loadUserData]);

  useEffect(() => {
    if (token && user?.id) {
      // Load orders initially (WebSocket will handle updates)
      loadOrdersData(false);
    }
  }, [token, user?.id, loadOrdersData]);

  // Closed marketplace: load the session storefront profile even when there are no orders.
  useEffect(() => {
    if (!token || !activeStorefrontId) {
      setStorefrontProfile(null);
      return;
    }
    setStorefrontProfile(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(String(activeStorefrontId))}`,
          { headers: authHeaders() },
        );
        if (cancelled) return;
        if (!res.ok) {
          setStorefrontProfile(null);
          return;
        }
        const json = (await res.json()) as {
          companyName?: string | null;
          name?: string | null;
          logo?: string | null;
        };
        if (cancelled) return;
        setStorefrontProfile({
          name: json.companyName?.trim() || json.name?.trim() || t('tabsAccount.networks.distributor'),
          logo: normalizeUrl(json.logo),
        });
      } catch {
        if (!cancelled) setStorefrontProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeStorefrontId, t]);

  const storefrontDistributors: Distributor[] = React.useMemo(() => {
    if (!token || !user?.id || !activeStorefrontId) return [];

    const totalOrders = orders.filter(
      (order) =>
        order.userId === activeStorefrontId &&
        order.isDeleted !== true &&
        !order.deletedAt &&
        order.orderStatus !== 'Deleted' &&
        order.orderStatus !== 'Cancelled',
    ).length;

    const productMatch = products.find((product) => product.userId === activeStorefrontId);
    const companyInfo = productMatch?.seller?.company;
    const nameFromCatalog =
      companyInfo?.name?.trim() ||
      productMatch?.seller?.name?.trim() ||
      null;
    const logoFromCatalog =
      normalizeUrl(companyInfo?.logo) || normalizeUrl(productMatch?.seller?.avatar);

    return [
      {
        id: activeStorefrontId,
        name:
          storefrontProfile?.name ||
          nameFromCatalog ||
          t('tabsAccount.networks.distributor'),
        logo: storefrontProfile?.logo || logoFromCatalog,
        totalOrders,
      },
    ];
  }, [orders, products, token, user?.id, activeStorefrontId, storefrontProfile, t]);

  const isAuthenticated = !!token && !!user;
  const showProfileSkeleton = !!token && isUserLoading && !refreshing;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (token && user?.id) {
        useDataStore.setState({ userLastUpdated: null });
        await Promise.all([
          loadUserData(token),
          loadOrdersData(true),
          forceRefreshProducts(),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [token, user?.id, loadUserData, loadOrdersData, forceRefreshProducts]);

  const renderLoginPrompt = () => (
    <View style={{ backgroundColor: '#ffffff', padding: 26, marginBottom: 10, alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', marginBottom: 16 }}>
        <UserIcon color={primaryBlue} size={28} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 20 }}>
        {t('tabsAccount.loginPrompt.title')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={{ backgroundColor: primaryBlue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{t('tabsAccount.loginPrompt.login')}</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={{ backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: primaryBlue, flex: 1 }}>
            <Text style={{ color: primaryBlue, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{t('tabsAccount.loginPrompt.signup')}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  const renderUserSection = () => {
    if (showProfileSkeleton) {
      return <AccountProfileSkeleton />;
    }
    if (isAuthenticated) {
      return (
        <View style={{ backgroundColor: '#ffffff', padding: 26, marginBottom: 10 }}>
          <Link href="/useraccounts/userprofile/editprofile" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', overflow: 'hidden' }}>
                {user?.image ? (
                  <Image source={{ uri: user.image }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#ffffff", alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: primaryBlue, fontSize: 20, fontWeight: '600' }}>
                      {user?.username?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{user?.username || user?.name || 'User'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <MapPin color="#6B7280" size={16} />
                  <Text style={{ color: '#6B7280', marginLeft: 6 }} numberOfLines={1}>{user?.chosenAddress || '—'}</Text>
                </View>
              </View>
            </Pressable>
          </Link>
        </View>
      );
    } else {
      return renderLoginPrompt();
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET }}
      onScroll={onTabBarScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={primaryBlue}
          colors={[primaryBlue]}
        />
      }
    >
      {/* Section 1: User Section */}
      {renderUserSection()}

      {/* Section 2: My Purchases — horizontal bordered status tabs, full-width view button below */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>{t('tabsAccount.sections.myPurchases')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(
            [
              { href: '/useraccounts/purchases/mypurchases?tab=to-pay', label: t('tabsAccount.purchaseStatus.toPay'), Icon: WalletMinimal },
              { href: '/useraccounts/purchases/mypurchases?tab=to-ship', label: t('tabsAccount.purchaseStatus.toShip'), Icon: Truck },
              { href: '/useraccounts/purchases/mypurchases?tab=to-receive', label: t('tabsAccount.purchaseStatus.toReceive'), Icon: PackageCheck },
              { href: '/useraccounts/purchases/mypurchases?tab=completed', label: t('tabsAccount.purchaseStatus.completed'), Icon: CheckCircle },
            ] as const
          ).map((item) =>
            isAuthenticated ? (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
                >
                  <item.Icon color={iconGray} size={20} />
                  <Text style={{ marginTop: 6, color: '#111827', fontSize: 11, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            ) : (
              <View
                key={item.href}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', opacity: 0.5 }}
              >
                <item.Icon color={iconGray} size={20} />
                <Text style={{ marginTop: 6, color: '#111827', fontSize: 11, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            ),
          )}
        </View>
        {isAuthenticated ? (
          <Link href="/useraccounts/purchases/mypurchases" asChild>
            <Pressable
              style={{ width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>
                {t('tabsAccount.actions.viewPurchaseHistory')}
              </Text>
            </Pressable>
          </Link>
        ) : (
          <View
            style={{ width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 14, opacity: 0.5 }}
          >
            <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>
              {t('tabsAccount.actions.viewPurchaseHistory')}
            </Text>
          </View>
        )}
      </View>

      {/* Section 2.5: Distributor Storefront */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>{t('tabsAccount.sections.distributorStorefront')}</Text>
        {isAuthenticated ? (
          <>
            {storefrontDistributors.length > 0 ? (
              <View style={{ gap: 12 }}>
                {storefrontDistributors.map((distributor) => (
                  <View key={distributor.id} style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => router.push(`/useraccounts/buyernetworks/distributor-detail?id=${distributor.id}`)}
                      style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}
                    >
                      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {distributor.logo ? (
                          <Image source={{ uri: distributor.logo }} style={{ width: 48, height: 48 }} />
                        ) : (
                          <Users color={primaryBlue} size={24} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>
                          {distributor.name}
                        </Text>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>
                          {t('tabsAccount.networks.ordersCount', { count: distributor.totalOrders })}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/useraccounts/buyernetworks/distributor-information?id=${distributor.id}`)}
                      style={{ width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 14 }}
                    >
                      <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }}>
                        {t('tabsAccount.actions.viewDistributorInformation')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ width: '100%', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', opacity: 0.5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                    <Users color={iconGray} size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{t('tabsAccount.networks.noNetworksYet')}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 12 }}>--</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={{ width: '100%', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', opacity: 0.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                <Users color={iconGray} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{t('tabsAccount.networks.distributor')}</Text>
                <Text style={{ color: '#6b7280', fontSize: 12 }}>--</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Section 3: My Wallet — commented out until payment / wallet is implemented; uncomment to restore
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 26 }}>{t('tabsAccount.sections.myWallet')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          {isAuthenticated ? (
            <>
              <Link href="/useraccounts/wallet/bonuses" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <Gift color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.bonuses')}</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$45.00</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/wallet/discounts" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <Tag color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.discounts')}</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$12.50</Text>
                </Pressable>
              </Link>
              <Link href="/useraccounts/wallet/lakupay" asChild>
                <Pressable style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                  <DollarSign color={iconGray} size={24} />
                  <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.lakupay')}</Text>
                  <Text style={{ marginTop: 4, color: primaryBlue, fontSize: 14, fontWeight: '600' }}>$230.75</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <Gift color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.bonuses')}</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <Tag color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.discounts')}</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1, padding: 8 }}>
                <DollarSign color={iconGray} size={24} />
                <Text style={{ marginTop: 8, color: '#111827', fontSize: 12, textAlign: 'center' }}>{t('tabsAccount.wallet.lakupay')}</Text>
                <Text style={{ marginTop: 4, color: '#9CA3AF', fontSize: 14, fontWeight: '600' }}>--</Text>
              </View>
            </>
          )}
        </View>
        {isAuthenticated ? (
          <Link href="/useraccounts/wallet/mywallet" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>{t('tabsAccount.actions.manageWallet')}</Text>
              <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
            </Pressable>
          </Link>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ color: iconGray, fontWeight: '500', marginTop: 14 }}>{t('tabsAccount.actions.manageWallet')}</Text>
            <ChevronRight color={iconGray} size={18} style={{ marginTop: 14 }} />
          </View>
        )}
      </View>
      */}

      {/* Section 4: More Services */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, marginBottom: 10, opacity: isAuthenticated ? 1 : 0.6 }}>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>{t('tabsAccount.sections.moreServices')}</Text>
        
        {isAuthenticated ? (
          <>
            <Link href="/useraccounts/moreservice/favourites" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Heart color="#ef4444" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.favourites')}</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            
            <Link href="/useraccounts/moreservice/recentlyviewed" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Clock color="#f97316" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.recentlyViewed')}</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            
            <Link href="/useraccounts/moreservice/buyagain" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <RotateCw color="#22c55e" size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.buyAgain')}</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>

            {/* Vouchers — hidden until feature is ready
            <Link href="/useraccounts/moreservice/getvouchers" asChild>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ticket color={primaryBlue} size={20} />
                  <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.getVouchers')}</Text>
                </View>
                <ChevronRight color={iconGray} size={18} />
              </Pressable>
            </Link>
            */}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Heart color="#ef4444" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.favourites')}</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Clock color="#f97316" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.recentlyViewed')}</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <RotateCw color="#22c55e" size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.buyAgain')}</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>

            {/* Vouchers — hidden until feature is ready
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ticket color={primaryBlue} size={20} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>{t('tabsAccount.services.getVouchers')}</Text>
              </View>
              <ChevronRight color={iconGray} size={18} />
            </View>
            */}
          </>
        )}
      </View>
    </ScrollView>
  );
}
