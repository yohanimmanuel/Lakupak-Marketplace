import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View as RNView,
  ScrollView,
  RefreshControl,
  Text as RNText,
  TouchableOpacity,
  Animated,
  TextInput,
  Pressable,
  StatusBar,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../components/Themed';
import { useRouter, Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Store, ShoppingCart, MessageSquareText, Search } from 'lucide-react-native';
import CartBadge from '../components/CartBadge';
import { useTranslation } from 'react-i18next';

// Components
import SaleBanner, { SALE_BANNER_UNIFORM_HEIGHT } from '../components/paymentcheckout/SaleBanner';
import ProductMarketplace from '../components/productcatalog/ProductMarketplace';
import CategoryBadge from '../components/CategoryBadge';

// Hooks
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { useUserActivityStore } from '../../stores/userActivityStore';
import { useCartStore } from '../../stores/cartStore';
import { useHeaderScrollStore } from '../../stores/headerScrollStore';
import { useTabBarScrollCollapse } from '../../hooks/useTabBarScrollCollapse';
import { Product } from '../../data/sampleProducts';
import { marketplaceService, MarketplaceProduct } from '../../services/marketplace';
import { API_BASE_URL } from '../../services/config';
import { decodeToken, authHeaders } from '../../services/graphql';
import { ProductGridSkeleton } from '../components/SkeletonLoader';
import { buildCategoryDirectory } from '../../utils/categoryUtils';
// Removed theme color imports - using explicit colors

// Header constants — blue promo band under search (Foodpanda-style)
const HEADER_VISUAL_HEIGHT = 280;
const MIN_HEADER_HEIGHT = 99; // Sticky search slot
const SHEET_START = HEADER_VISUAL_HEIGHT - 12; // White sheet overlaps the blue slightly
const SHEET_SPACER = SHEET_START - MIN_HEADER_HEIGHT;
const COLLAPSE = 55; // Store row + search travel; list itself scrolls 1:1

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // Using explicit colors instead of theme colors
  const backgroundColor = '#ffffff'; // Explicit white
  const textColor = '#111827'; // Explicit black
  const primaryColor = '#0a61d7'; // Explicit blue

  // Auth state
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const isAuthenticated = !!token && !!user;
  const [storefrontName, setStorefrontName] = useState<string | null>(null);

  // Redirect to welcome if not authenticated - use useEffect to avoid render-time navigation
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/useraccounts/welcome');
    }
  }, [isAuthenticated, router]);

  // Data state from cache
  const { width: windowWidth } = useWindowDimensions();

  const { 
    products: cachedProducts, 
    user: cachedUser,
    homeOffers,
    isProductsLoading,
    isUserLoading,
    loadProductsData,
    loadHomeOffers,
    refreshAllData,
    forceRefreshProducts,
    storefrontDistributorId,
  } = useDataStore();

  // User activity store
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  const { addItem } = useCartStore();
  
  // Header scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const { setScrollY } = useHeaderScrollStore();
  const onTabBarScroll = useTabBarScrollCollapse();
  const scrollViewRef = useRef<ScrollView>(null);

  // Set scrollY in store synchronously before first render to prevent flickering
  useLayoutEffect(() => {
    setScrollY(scrollY);
    scrollY.setValue(0);
  }, [setScrollY, scrollY]);

  // Header scroll interpolations — short collapse only. The list is not counter-translated
  // (that opposing transform was twitching the product grid).
  const headerContentTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE],
    outputRange: [0, -COLLAPSE],
    extrapolate: 'clamp',
  });

  const addressOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const promoOpacity = scrollY.interpolate({
    inputRange: [0, SHEET_SPACER * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const promoTranslateY = scrollY.interpolate({
    inputRange: [0, SHEET_SPACER * 0.55],
    outputRange: [0, -40],
    extrapolate: 'clamp',
  });

  const searchBarTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE],
    outputRange: [0, -55],
    extrapolate: 'clamp',
  });

  const tokenStorefrontId = React.useMemo(() => {
    if (!token) return null;
    return decodeToken(token).distributorId ?? null;
  }, [token]);
  const activeStorefrontId = storefrontDistributorId ?? tokenStorefrontId;

  useEffect(() => {
    if (!token || !activeStorefrontId) {
      setStorefrontName(null);
      return;
    }
    setStorefrontName(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/mobile/distributor/${encodeURIComponent(String(activeStorefrontId))}`,
          { headers: authHeaders() },
        );
        if (cancelled || !res.ok) {
          if (!cancelled) setStorefrontName(null);
          return;
        }
        const json = (await res.json()) as {
          companyName?: string | null;
          name?: string | null;
        };
        if (cancelled) return;
        setStorefrontName(json.companyName?.trim() || json.name?.trim() || null);
      } catch {
        if (!cancelled) setStorefrontName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeStorefrontId]);

  // Scroll tracking for progress bar
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offerCarouselIndex, setOfferCarouselIndex] = useState(0);

  const offerSlideWidth = Math.max(280, windowWidth - 32);
  const offerSlideStep = offerSlideWidth + 12;

  // Use cached products only (no mock data fallback)
  const products = cachedProducts;
  // Show loading only if products are loading AND we have no cached products yet
  const loading = isProductsLoading && cachedProducts.length === 0;

  // Full taxonomy — not limited to categories that currently have published products
  const dynamicCategories = buildCategoryDirectory(products);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshAllData(token || undefined);
    } catch (err) {
      setError(t('tabsHome.errors.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllData, token, t]);

  // Handle category scroll
  const handleCategoryScroll = (event: { nativeEvent: { contentOffset: { x: number }; contentSize: { width: number }; layoutMeasurement: { width: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPosition(contentOffset.x);
    setScrollContentWidth(contentSize.width);
    setScrollViewWidth(layoutMeasurement.width);
  };

  const handleLoadMore = useCallback(async () => {
    // Load more products
  }, []);

  const handleProductPress = useCallback((product: Product) => {
    // Navigate to product modal
    router.push({
      pathname: '/product',
      params: { productId: product.id }
    });
  }, [router]);

  const handleAddToCart = useCallback((product: Product) => {
    // Add to cart
  }, []);

  const handleBuyNow = useCallback((product: Product, quantity?: number) => {
    if (quantity && quantity > 0) {
      router.push({
        pathname: '/product',
        params: {
          productId: product.id,
          openBuyNow: 'true',
          initialQuantity: String(quantity),
        },
      });
      return;
    }
    router.push({
      pathname: '/product',
      params: { productId: product.id, openBuyNow: 'true' },
    });
  }, [router]);

  const handleToggleFavorite = useCallback(async (productId: string) => {
    if (!user?.id) {
      return;
    }
    const key = String(productId);
    const product = products.find((p) => String(p.id) === key);
    if (product) {
      await toggleLikedProduct(key, product as MarketplaceProduct);
    }
  }, [user?.id, products, toggleLikedProduct]);

  const handleOfferBannerPress = useCallback(
    (offerId: number) => {
      router.push(`/offers/${offerId}`);
    },
    [router]
  );

  const onOfferCarouselScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      if (homeOffers.length <= 1) return;
      const i = Math.round(x / offerSlideStep);
      setOfferCarouselIndex(Math.max(0, Math.min(i, homeOffers.length - 1)));
    },
    [homeOffers.length, offerSlideStep]
  );

  const handleCategoryPress = useCallback((categoryName: string) => {
    // Navigate to search page with category filter to show filtered results
    router.push({
      pathname: '/search',
      params: { category: categoryName }
    });
  }, [router]);

  const handleSpecialOffersSeeAll = useCallback(() => {
    router.push('/offers/' as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleSeeAllPress = useCallback(() => {
    router.push('/search');
  }, [router]);

  // Revalidate products when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      forceRefreshProducts();
      if (token) void loadHomeOffers(token);
      // Reset scroll position when screen gains focus (returning to home)
      // First scroll to top, then reset the animated value
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
      // Delay the animated value reset slightly to ensure ScrollView has scrolled
      requestAnimationFrame(() => {
        scrollY.setValue(0);
        // Re-sync the scrollY in store to trigger listener re-attachment
        setScrollY(scrollY);
      });
    }, [forceRefreshProducts, loadHomeOffers, token, scrollY, setScrollY])
  );

  // Early return after all hooks to prevent rendering unauthenticated content
  if (!isAuthenticated) {
    return null;
  }

  return (
    <RNView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} translucent={false} />
      
      {/* Blue only behind the header and the sheet’s top curve, not the rest of the page */}
      <RNView 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_VISUAL_HEIGHT + 28,
          zIndex: 0,
          backgroundColor: primaryColor,
        }}
      >
        {/* Address row - fades and translates up */}
        <Animated.View style={{ 
          position: 'absolute',
          top: 50,
          left: 16,
          right: 16,
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          opacity: addressOpacity,
          transform: [{ translateY: headerContentTranslateY }]
        }}>
          <RNView style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <Store color="#ffffff" size={24} />
            <RNView style={{ marginLeft: 10, flex: 1 }}>
              <RNText style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                {user?.storeName || t('tabsHome.storeFallback')}
              </RNText>
              <RNText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} numberOfLines={1}>
                {user?.chosenAddress || t('tabsHome.addressFallback')}
              </RNText>
            </RNView>
          </RNView>
          <RNView style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Link href="/messages" asChild>
              <Pressable style={{ paddingHorizontal: 10, marginBottom: 6 }}>
                <MessageSquareText color="#ffffff" size={22} />
              </Pressable>
            </Link>
            <Link href="/cart" asChild>
              <Pressable style={{ paddingHorizontal: 10, marginLeft: 6, marginRight: -4, marginBottom: 6 }}>
                <RNView style={{ position: 'relative' }}>
                  <ShoppingCart color="#ffffff" size={22} />
                  <CartBadge size={16} color="#ffffff" backgroundColor="#EF4444" />
                </RNView>
              </Pressable>
            </Link>
          </RNView>
        </Animated.View>

        {/* Promo copy, centered in the blue gap between search and the sheet */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 148,
            left: 16,
            right: 16,
            height: SHEET_START - 148 - 8,
            justifyContent: 'center',
            opacity: promoOpacity,
            transform: [{ translateY: promoTranslateY }],
          }}
          pointerEvents="none"
        >
          <RNText
            style={{
              color: 'rgba(255,255,255,0.88)',
              fontSize: 14,
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {t('tabsHome.greeting', {
              name: (user?.name || user?.storeName || '').trim().split(/\s+/)[0] || t('tabsHome.storeFallback'),
            })}
          </RNText>
          <RNText
            style={{
              marginTop: 8,
              color: '#ffffff',
              fontSize: 20,
              fontWeight: '700',
              lineHeight: 27,
              letterSpacing: -0.15,
            }}
            numberOfLines={3}
          >
            {storefrontName
              ? t('tabsHome.heroTitleWithDistributor', { distributor: storefrontName })
              : t('tabsHome.heroTitle')}
          </RNText>
        </Animated.View>
      </RNView>

      {/* Scroll content - IN FRONT of header (zIndex: 1) */}
      <Animated.ScrollView 
        ref={scrollViewRef}
        style={{ 
          flex: 1, 
          zIndex: 1, 
          marginTop: MIN_HEADER_HEIGHT, 
          backgroundColor: 'transparent',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
        }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: onTabBarScroll }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
            progressViewOffset={HEADER_VISUAL_HEIGHT - MIN_HEADER_HEIGHT - 50}
          />
        }
      >
        {/* Transparent spacer lets the blue tagline show; the sheet then scrolls over it 1:1 */}
        <View style={{ height: SHEET_SPACER, backgroundColor: 'transparent' }} />
        <View style={{ flexGrow: 1, backgroundColor: '#f9fafb', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 72, overflow: 'hidden' }}>
          {/* Special Offers — horizontal carousel of all published offers */}
          {homeOffers.length > 0 ? (
            <View style={{ backgroundColor: '#f9fafb', paddingTop: 5 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('tabsHome.specialOffers')}</Text>
                <TouchableOpacity onPress={handleSpecialOffersSeeAll}>
                  <Text style={styles.seeAllText}>{t('tabsHome.seeAll')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={homeOffers.length > 1 ? offerSlideStep : undefined}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
                onMomentumScrollEnd={onOfferCarouselScrollEnd}
              >
                {homeOffers.map((offer, idx) => (
                  <RNView
                    key={offer.id}
                    style={{
                      width: offerSlideWidth,
                      marginRight: idx < homeOffers.length - 1 ? 12 : 0,
                    }}
                  >
                    <SaleBanner
                      title={offer.title}
                      subtitle={offer.subtitle}
                      discountText={offer.discountText || t('tabsHome.offerFallback')}
                      endDate={offer.endDateText}
                      onPress={() => handleOfferBannerPress(offer.id)}
                      backgroundColor={offer.backgroundColor || primaryColor}
                      textColor={offer.textColor || '#FFFFFF'}
                      bannerImageUrl={offer.bannerImageUrl}
                      customBannerImageUrl={offer.customBannerImageUrl}
                      rightIconName={offer.rightIconKey}
                      discountIconName={offer.discountIconKey}
                      embeddedInCarousel
                      fixedHeight={SALE_BANNER_UNIFORM_HEIGHT}
                    />
                  </RNView>
                ))}
              </ScrollView>
              {homeOffers.length > 1 ? (
                <RNView
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 10,
                    marginBottom: 6,
                  }}
                >
                  {homeOffers.map((_, i) => (
                    <RNView
                      key={`dot-${i}`}
                      style={{
                        width: i === offerCarouselIndex ? 8 : 6,
                        height: i === offerCarouselIndex ? 8 : 6,
                        borderRadius: 99,
                        backgroundColor: i === offerCarouselIndex ? primaryColor : '#d1d5db',
                      }}
                    />
                  ))}
                </RNView>
              ) : null}
            </View>
          ) : null}
        
          {/* Categories Section */}
          <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: 10 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('tabsHome.categories')}</Text>
              <TouchableOpacity onPress={handleSeeAllPress}>
                <Text style={styles.seeAllText}>{t('tabsHome.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
              onScroll={handleCategoryScroll}
              scrollEventThrottle={16}
            >
              {dynamicCategories.map((category, index) => (
                <CategoryBadge
                  key={index}
                  name={category.name}
                  icon={category.icon}
                  onPress={() => handleCategoryPress(category.name)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Featured Products Section */}
          <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: -10 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('tabsHome.featuredProducts')}</Text>
              <TouchableOpacity onPress={handleSeeAllPress}>
                <Text style={styles.seeAllText}>{t('tabsHome.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Loading State with Skeleton */}
            {loading && <ProductGridSkeleton />}

            {/* Error State */}
            {error && !loading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>{t('tabsHome.retry')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Product List */}
            {!loading && !error && (
              <View style={styles.productsContainer}>
                <View style={styles.leftColumn}>
                  {products.filter((_, index) => index % 2 === 0).map((product) => (
                    <View key={product.id} style={styles.productItem}>
                      <ProductMarketplace
                        product={product}
                        onPress={handleProductPress}
                        onAddToCart={handleAddToCart}
                        onBuyNow={handleBuyNow}
                        onChatSeller={() => {}}
                        onShare={() => {}}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={likedProducts.includes(product.id)}
                        type="card"
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.rightColumn}>
                  {products.filter((_, index) => index % 2 === 1).map((product) => (
                    <View key={product.id} style={styles.productItem}>
                      <ProductMarketplace
                        product={product}
                        onPress={handleProductPress}
                        onAddToCart={handleAddToCart}
                        onBuyNow={handleBuyNow}
                        onChatSeller={() => {}}
                        onShare={() => {}}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={likedProducts.includes(product.id)}
                        type="card"
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {/* End of Products Message */}
            {!loading && !error && products.length > 0 && (
              <View style={{...styles.endMessageContainer}}>
                <Text style={styles.endMessage}>{t('tabsHome.endMessage')}</Text>
              </View>
            )}

            {/* No Products Message */}
            {!loading && !error && products.length === 0 && (
              <View style={styles.noProductsContainer}>
                <Text style={styles.noProductsText}>{t('tabsHome.noProducts')}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Above the scroll view so the bar stays tappable; the viewport still starts at the sticky slot */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 100,
          left: 16,
          right: 16,
          zIndex: 2,
          transform: [{ translateY: searchBarTranslateY }],
        }}
      >
        <Pressable onPress={() => router.push('/search')}>
          <RNView style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: 22,
            paddingHorizontal: 12,
            height: 40,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}>
            <Search color="#6B7280" size={20} />
            <Text style={{ flex: 1, marginLeft: 8, color: '#6B7280', paddingVertical: 0 }}>
              {t('tabsHome.searchPlaceholder')}
            </Text>
          </RNView>
        </Pressable>
      </Animated.View>
    </RNView>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 20,
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#f9fafb',
  },
  sectionHeader: {
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a61d7',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    color: '#111827',
  },
  categoryCount: {
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 2,
  },
  productsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    backgroundColor: '#f9fafb',
    gap: 14,
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  rightColumn: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  productItem: {
    marginBottom: 4,
    backgroundColor: '#f9fafb',
  },
  endMessageContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 30,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    marginTop: -4,
    marginBottom: 0,
  },
  endMessage: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0a61d7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noProductsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  noProductsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
