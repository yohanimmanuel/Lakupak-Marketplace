import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, ImageBackground, Modal, PanResponder, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, MoreVertical, Share2, Star, Flag } from 'lucide-react-native';
import { marketplaceService, type MarketplaceProduct } from '../../../services/marketplace';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';
import { API_BASE_URL } from '../../../services/config';
import { websocketService } from '../../../services/websocket';
import { useAuthStore } from '../../../stores/authStore';
import { followDistributor, isFollowingDistributor, unfollowDistributor } from '../../../services/distributorFollowing';
import { useTranslation } from 'react-i18next';
import { ProductGridSkeleton } from '../../components/SkeletonLoader';

const primaryBlue = '#0a61d7';
const { height: screenHeight } = Dimensions.get('window');

type SortKey = 'popular' | 'latest' | 'top_sales' | 'price';

type ProductWithOptionalDates = MarketplaceProduct & {
  publishedAt?: string | null;
  lastSyncAt?: string | null;
};

type DistributorProfile = {
  id: number;
  name: string;
  logo: string | null;
  bannerImage?: string | null;
  companyName: string | null;
  followersCount?: number;
};

type DistributorReviewsData = {
  distributorId: number;
  totalReviews: number;
  overallRating: number;
};

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

function parseSoldCount(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    // soldCount often comes as string, sometimes "1.2k"
    const s = v.trim().toLowerCase();
    const mult = s.endsWith('k') ? 1000 : s.endsWith('m') ? 1_000_000 : 1;
    const raw = mult === 1 ? s : s.slice(0, -1);
    const n = Number(raw);
    if (Number.isFinite(n)) return n * mult;
  }
  return 0;
}

function getLatestTimestamp(p: ProductWithOptionalDates): number {
  const candidates = [p.publishedAt, p.lastSyncAt].filter((x): x is string => typeof x === 'string' && x.length > 0);
  for (const c of candidates) {
    const t = Date.parse(c);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export default function DistributorInformationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const token = useAuthStore((s) => s.token);
  const { t } = useTranslation();

  const distributorId = useMemo(() => {
    const raw = params.id ? String(params.id) : '';
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }, [params.id]);

  const distributorNameFromParams = useMemo(
    () => (params.name ? String(params.name) : t('buyerNetworks.distributorInformation.fallbackDistributor')),
    [params.name, t]
  );

  const [sortKey, setSortKey] = useState<SortKey>('popular');
  const [priceDir, setPriceDir] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<ProductWithOptionalDates[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [profile, setProfile] = useState<DistributorProfile | null>(null);
  const [reviews, setReviews] = useState<DistributorReviewsData | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySlideAnim] = useState(new Animated.Value(screenHeight));
  const [categoryClosing, setCategoryClosing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!Number.isFinite(distributorId)) return;
    setLoading(true);
    setError(null);

    try {
      const idStr = String(distributorId);
      const [profileRes, reviewsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(idStr)}`),
        fetch(`${API_BASE_URL}/api/mobile/reviews/distributor?distributorId=${encodeURIComponent(idStr)}`),
      ]);

      if (profileRes.ok) {
        const p = (await profileRes.json()) as DistributorProfile;
        setProfile(p);
      } else {
        setProfile(null);
      }

      if (reviewsRes.ok) {
        const r = (await reviewsRes.json()) as DistributorReviewsData;
        setReviews(r);
      } else {
        setReviews(null);
      }

      // We don't have a dedicated "sellerId" filter in the current mobile query.
      // Fetch a reasonable window and filter by product.userId (distributor owner id).
      const limit = 50;
      const maxPages = 6; // up to 300 products scanned
      const matches: ProductWithOptionalDates[] = [];

      for (let page = 1; page <= maxPages; page += 1) {
        const res = await marketplaceService.getProducts({ page, limit });
        const filtered = (res.products as ProductWithOptionalDates[]).filter((p) => p.userId === distributorId);
        matches.push(...filtered);
        // Stop early once we have enough to render a useful page.
        if (matches.length >= 80) break;
        if (page >= (res.pagination?.totalPages ?? page)) break;
      }

      setAllProducts(matches);

      if (token) {
        try {
          const state = await isFollowingDistributor(token, distributorId);
          setIsFollowing(state);
        } catch {
          // non-blocking
        }
      }
    } catch {
      setAllProducts([]);
      setError(t('buyerNetworks.distributorInformation.errors.loadProductsFailed'));
    } finally {
      setLoading(false);
    }
  }, [distributorId, token]);

  useEffect(() => {
    if (!Number.isFinite(distributorId)) {
      setLoading(false);
      setError(t('buyerNetworks.distributorInformation.errors.invalidDistributor'));
      return;
    }
    void fetchData();
  }, [distributorId, fetchData]);

  // Real-time updates (like homepage): refresh when products/offers/prices change via WebSocket
  useEffect(() => {
    const unsubscribe = websocketService.subscribe((message) => {
      if (message.type === 'product_updated' || message.type === 'offer_updated' || message.type === 'prices_updated') {
        void fetchData();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      const c = (p.productCategory || p.category || '').trim();
      if (c) set.add(c);
    }
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allProducts]);

  const visibleProducts = useMemo(() => {
    const base = selectedCategory === 'all'
      ? allProducts
      : allProducts.filter((p) => (p.productCategory || p.category || '').trim() === selectedCategory);

    const sorted = [...base];

    if (sortKey === 'popular') {
      sorted.sort((a, b) => {
        const scoreA = safeNum(a.rating) * 10 + safeNum(a.reviewCount) + parseSoldCount(a.soldCount) * 0.01;
        const scoreB = safeNum(b.rating) * 10 + safeNum(b.reviewCount) + parseSoldCount(b.soldCount) * 0.01;
        return scoreB - scoreA;
      });
    } else if (sortKey === 'latest') {
      sorted.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
    } else if (sortKey === 'top_sales') {
      sorted.sort((a, b) => parseSoldCount(b.soldCount) - parseSoldCount(a.soldCount));
    } else if (sortKey === 'price') {
      sorted.sort((a, b) => {
        const diff = safeNum(a.sellingPrice) - safeNum(b.sellingPrice);
        return priceDir === 'asc' ? diff : -diff;
      });
    }

    return sorted;
  }, [allProducts, priceDir, selectedCategory, sortKey]);

  const onPressPrice = () => {
    if (sortKey !== 'price') {
      setSortKey('price');
      setPriceDir('asc');
      return;
    }
    setPriceDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const storeRating = useMemo(() => {
    const r = reviews?.overallRating;
    return safeNum(r);
  }, [reviews?.overallRating]);

  const storeTotalRatings = useMemo(() => safeNum(reviews?.totalReviews), [reviews?.totalReviews]);

  const storeFollowersLabel = useMemo(() => {
    const n = safeNum(profile?.followersCount);
    if (n <= 0) return '';
    return t('buyerNetworks.distributorInformation.followers', { count: n });
  }, [profile?.followersCount]);

  const canViewSellerInfo = Number.isFinite(distributorId);
  const noop = useCallback(() => {}, []);

  const displayName = (profile?.companyName || profile?.name || distributorNameFromParams || 'Distributor').trim();
  const logoUri = normalizeUrl(profile?.logo);
  const bannerUri = normalizeUrl(profile?.bannerImage ?? null);

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
      await Share.share({ message: t('buyerNetworks.distributorInformation.share.message', { name: displayName }) });
    } catch {
      Alert.alert(
        t('buyerNetworks.distributorInformation.share.title'),
        t('buyerNetworks.distributorInformation.share.failed')
      );
    }
  };

  const handleReportDistributor = () => {
    if (!Number.isFinite(distributorId)) return;
    router.push({
      pathname: '/useraccounts/buyernetworks/ReportDistributorModal',
      params: { distributorId: String(distributorId), distributorName: displayName },
    });
  };

  const handleNeedHelp = () => {
    Alert.alert(
      t('buyerNetworks.distributorInformation.help.title'),
      t('buyerNetworks.distributorInformation.help.body')
    );
  };

  const openCategoryPicker = () => {
    setCategoryPickerOpen(true);
    setCategoryClosing(false);
    categorySlideAnim.setValue(screenHeight);
    Animated.timing(categorySlideAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  };

  const closeCategoryPicker = () => {
    if (categoryClosing) return;
    setCategoryClosing(true);
    Animated.timing(categorySlideAnim, { toValue: screenHeight, duration: 240, useNativeDriver: true }).start(() => {
      setCategoryClosing(false);
      setCategoryPickerOpen(false);
    });
  };

  const categoryPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
        },
        onPanResponderGrant: () => {
          categorySlideAnim.setOffset((categorySlideAnim as Animated.Value & { _value: number })._value);
          categorySlideAnim.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) categorySlideAnim.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          categorySlideAnim.flattenOffset();
          if (gestureState.dy > 120 || gestureState.vy > 0.55) closeCategoryPicker();
          else Animated.timing(categorySlideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        },
      }),
    [categorySlideAnim, closeCategoryPicker]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.distributorInformation.a11y.back')}
                  accessibilityRole="button"
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', flex: 1, textAlign: 'left', marginLeft: 35 }} numberOfLines={1}>
                  {t('buyerNetworks.distributorInformation.title')}
                </Text>
                <Pressable
                  onPress={openMenu}
                  hitSlop={10}
                  accessibilityLabel={t('buyerNetworks.distributorInformation.a11y.moreOptions')}
                  accessibilityRole="button"
                >
                  <MoreVertical color={primaryBlue} size={22} />
                </Pressable>
              </View>
            </View>
          ),
        }}
      />

      {/* Top section (store header) */}
      <ImageBackground
        source={bannerUri ? { uri: bannerUri } : undefined}
        style={styles.bannerBg}
        imageStyle={styles.bannerBgImage}
      >
        <View style={styles.bannerOverlay} />
        <View style={styles.storeHeaderOnBanner}>
          <View style={styles.storeHeaderLeft}>
            <View style={styles.storeAvatar}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.storeAvatarImg} />
              ) : (
                <View style={styles.storeAvatarPlaceholder}>
                  <Text style={styles.storeAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.storeHeaderTextCol}>
              <Text style={styles.storeNameOnBanner}>
                {displayName}
              </Text>
              <View style={styles.storeMetaRow}>
                <Star size={14} color="#fbbf24" fill="#fbbf24" />
                <Text style={styles.storeMetaTextOnBanner}>
                  {storeRating.toFixed(1)}
                  {storeTotalRatings ? ` (${storeTotalRatings})` : ''}
                </Text>
                {storeFollowersLabel ? <Text style={styles.storeFollowersTextOnBanner}> · {storeFollowersLabel}</Text> : null}
              </View>
            </View>
          </View>

          <View style={styles.storeHeaderRight}>
            <Pressable
              onPress={async () => {
                if (!Number.isFinite(distributorId) || !token || followBusy) return;
                const next = !isFollowing;
                setFollowBusy(true);
                setIsFollowing(next); // optimistic
                try {
                  if (next) await followDistributor(token, distributorId);
                  else await unfollowDistributor(token, distributorId);
                } catch {
                  setIsFollowing(!next);
                } finally {
                  setFollowBusy(false);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isFollowing
                  ? t('buyerNetworks.distributorInformation.follow.unfollowA11y')
                  : t('buyerNetworks.distributorInformation.follow.followA11y')
              }
              style={[styles.followBtn, isFollowing && styles.followBtnActive, followBusy && { opacity: 0.7 }]}
              disabled={followBusy || !token}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing
                  ? t('buyerNetworks.distributorInformation.follow.following')
                  : t('buyerNetworks.distributorInformation.follow.follow')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!canViewSellerInfo) return;
                router.push({
                  pathname: '/useraccounts/buyernetworks/seller-information',
                  params: { id: String(distributorId) },
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('buyerNetworks.distributorInformation.view.a11y')}
              style={[styles.viewBtn, !canViewSellerInfo && styles.viewBtnDisabled]}
              disabled={!canViewSellerInfo}
            >
              <Text style={[styles.viewBtnText, !canViewSellerInfo && styles.viewBtnTextDisabled]}>
                {t('buyerNetworks.distributorInformation.view.label')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>

      <>
        {/* Filter tabs (fixed row; underline for active). No dedicated loading UI for this page. */}
        <View style={styles.filterTabsRow}>
          <Pressable onPress={() => setSortKey('popular')} style={styles.filterTabBtn} accessibilityRole="button">
            <Text style={[styles.filterTabText, sortKey === 'popular' && styles.filterTabTextActive]}>
              {t('buyerNetworks.distributorInformation.sort.popular')}
            </Text>
            {sortKey === 'popular' ? <View style={styles.filterUnderlineFull} /> : null}
          </Pressable>
          <Pressable onPress={() => setSortKey('latest')} style={styles.filterTabBtn} accessibilityRole="button">
            <Text style={[styles.filterTabText, sortKey === 'latest' && styles.filterTabTextActive]}>
              {t('buyerNetworks.distributorInformation.sort.latest')}
            </Text>
            {sortKey === 'latest' ? <View style={styles.filterUnderlineFull} /> : null}
          </Pressable>
          <Pressable onPress={() => setSortKey('top_sales')} style={styles.filterTabBtn} accessibilityRole="button">
            <Text style={[styles.filterTabText, sortKey === 'top_sales' && styles.filterTabTextActive]}>
              {t('buyerNetworks.distributorInformation.sort.topSales')}
            </Text>
            {sortKey === 'top_sales' ? <View style={styles.filterUnderlineFull} /> : null}
          </Pressable>
          <Pressable onPress={onPressPrice} style={styles.filterTabBtn} accessibilityRole="button">
            <View style={styles.filterTabInline}>
              <Text style={[styles.filterTabText, sortKey === 'price' && styles.filterTabTextActive]}>
                {t('buyerNetworks.distributorInformation.sort.price')}
              </Text>
              {sortKey === 'price' ? (
                priceDir === 'asc' ? (
                  <ChevronUp size={14} color={primaryBlue} />
                ) : (
                  <ChevronDown size={14} color={primaryBlue} />
                )
              ) : (
                <ChevronDown size={14} color="#9ca3af" />
              )}
            </View>
            {sortKey === 'price' ? <View style={styles.filterUnderlineFull} /> : null}
          </Pressable>
          <Pressable
            onPress={openCategoryPicker}
            style={styles.filterTabBtn}
            accessibilityRole="button"
            accessibilityLabel={t('buyerNetworks.distributorInformation.a11y.chooseCategory')}
          >
            <View style={styles.filterTabInline}>
              <Text style={[styles.filterTabText, selectedCategory !== 'all' && styles.filterTabTextActive]} numberOfLines={1}>
                {selectedCategory === 'all' ? t('buyerNetworks.distributorInformation.category.label') : selectedCategory}
              </Text>
              <ChevronDown size={14} color={selectedCategory !== 'all' ? primaryBlue : '#6b7280'} />
            </View>
            {selectedCategory !== 'all' ? <View style={styles.filterUnderlineFull} /> : null}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorTitle}>{t('buyerNetworks.distributorInformation.errors.unableToLoadUpdates')}</Text>
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable onPress={() => void fetchData()} style={styles.inlineRetryBtn} accessibilityRole="button">
              <Text style={styles.inlineRetryText}>{t('buyerNetworks.distributorInformation.errors.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ProductGridSkeleton rowsPerColumn={4} style={{ paddingBottom: 8 }} />
          ) : visibleProducts.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.muted}>{t('buyerNetworks.distributorInformation.empty.noProducts')}</Text>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              <View style={styles.productsCol}>
                {visibleProducts
                  .filter((_, idx) => idx % 2 === 0)
                  .map((p) => (
                    <View key={p.id} style={styles.productItemWrap}>
                      <ProductMarketplace
                        product={p}
                        type="card"
                        onPress={() => {
                          router.push({ pathname: '/product', params: { productId: p.id } });
                        }}
                        onAddToCart={noop}
                        onBuyNow={noop}
                        onChatSeller={noop}
                        onShare={noop}
                        onToggleFavorite={noop as unknown as (productId: string) => void}
                        isFavorite={false}
                      />
                    </View>
                  ))}
              </View>
              <View style={styles.productsCol}>
                {visibleProducts
                  .filter((_, idx) => idx % 2 === 1)
                  .map((p) => (
                    <View key={p.id} style={styles.productItemWrap}>
                      <ProductMarketplace
                        product={p}
                        type="card"
                        onPress={() => {
                          router.push({ pathname: '/product', params: { productId: p.id } });
                        }}
                        onAddToCart={noop}
                        onBuyNow={noop}
                        onChatSeller={noop}
                        onShare={noop}
                        onToggleFavorite={noop as unknown as (productId: string) => void}
                        isFavorite={false}
                      />
                    </View>
                  ))}
              </View>
            </View>
          )}
        </ScrollView>
      </>

      {/* Category picker */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="none"
        onRequestClose={closeCategoryPicker}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.35)" barStyle="light-content" />
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={closeCategoryPicker}
            accessibilityRole="button"
            accessibilityLabel={t('buyerNetworks.distributorInformation.a11y.closeCategoryPicker')}
          />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: categorySlideAnim }] }]} {...categoryPanResponder.panHandlers}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('buyerNetworks.distributorInformation.category.sheetTitle')}</Text>
            </View>
            <View style={styles.sheetDivider} />
            <ScrollView style={{ maxHeight: Math.min(420, screenHeight * 0.55) }} showsVerticalScrollIndicator={false}>
              {categories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setSelectedCategory(c);
                    closeCategoryPicker();
                  }}
                  style={styles.sheetRow}
                  accessibilityRole="button"
                >
                  <Text style={[styles.sheetRowText, selectedCategory === c && styles.sheetRowTextActive]}>
                    {c === 'all' ? t('buyerNetworks.distributorInformation.category.all') : c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* 3-dot menu */}
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu} statusBarTranslucent>
        <View style={styles.menuRoot}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={closeMenu}
            accessibilityLabel={t('buyerNetworks.distributorInformation.a11y.closeMenu')}
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
              <Text style={styles.menuRowText}>{t('buyerNetworks.distributorInformation.menu.share')}</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  viewBtnDisabled: { borderColor: '#ffffff', backgroundColor: 'transparent', opacity: 0.55 },
  viewBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  viewBtnTextDisabled: { color: '#9ca3af' },

  bannerBg: { width: '100%', minHeight: 110, justifyContent: 'center' },
  bannerBgImage: { resizeMode: 'cover' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  storeHeaderOnBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  storeHeaderLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeHeaderTextCol: { flex: 1, minWidth: 0 },
  storeNameOnBanner: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  storeMetaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeMetaTextOnBanner: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  storeFollowersTextOnBanner: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  storeAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  storeAvatarImg: { width: 44, height: 44 },
  storeAvatarPlaceholder: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  storeAvatarText: { fontSize: 18, fontWeight: '800', color: '#6b7280' },
  storeHeaderRight: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  followBtnActive: { backgroundColor: 'transparent', borderColor: '#ffffff' },
  followBtnText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  followBtnTextActive: { color: '#ffffff' },

  body: { flex: 1, backgroundColor: '#F5F5F5' },
  muted: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  inlineError: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    padding: 12,
  },
  inlineErrorTitle: { fontSize: 12, fontWeight: '800', color: '#991b1b' },
  inlineErrorText: { marginTop: 4, fontSize: 12, color: '#7f1d1d' },
  inlineRetryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },
  inlineRetryText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  // Filter tabs: follow mypurchases TabItem style (normal weight)
  filterTabText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterTabTextActive: { color: primaryBlue },
  filterUnderlineFull: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: primaryBlue },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 15,
  },
  filterTabBtn: { paddingVertical: 12, paddingHorizontal: 5, position: 'relative', alignItems: 'center' },
  filterTabInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  emptyBlock: { padding: 20, alignItems: 'center' },

  // Match homepage product list spacing (HomeScreen styles.productsContainer/productItem)
  productsGrid: { flexDirection: 'row', paddingHorizontal: 18, gap: 14, alignItems: 'flex-start' },
  productsCol: { flex: 1 },
  productItemWrap: { width: '100%', marginBottom: 4 },

  sheetRoot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  sheetDivider: { height: 2, backgroundColor: '#f3f4f6', marginBottom: 6, marginHorizontal: -14 },
  sheetRow: { paddingVertical: 12 },
  sheetRowText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  sheetRowTextActive: { color: primaryBlue },

  menuRoot: {
    flex: 1,
  },
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
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  menuRowText: { fontSize: 14, color: '#111827' },
  menuRowTextPrimary: { color: '#0a61d7', fontWeight: '600' },
  menuRowTextDanger: { color: '#ef4444', fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 2 },
});

