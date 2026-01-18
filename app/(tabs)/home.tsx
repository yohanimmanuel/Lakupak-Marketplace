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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../components/Themed';
import { useRouter, Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Store, ShoppingCart, MessageSquareText, Search } from 'lucide-react-native';
import CartBadge from '../components/CartBadge';

// Components
import SaleBanner from '../components/paymentcheckout/SaleBanner';
import ProductMarketplace from '../components/productcatalog/ProductMarketplace';
import CategoryBadge from '../components/CategoryBadge';

// Hooks
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { useUserActivityStore } from '../../stores/userActivityStore';
import { useCartStore } from '../../stores/cartStore';
import { useHeaderScrollStore } from '../../stores/headerScrollStore';
import { Product } from '../../data/sampleProducts';
import { marketplaceService, MarketplaceProduct } from '../../services/marketplace';
// import { SkeletonLoader, ProductSkeleton, UserInfoSkeleton } from '../components/SkeletonLoader';

// Temporary skeleton components
const ProductSkeleton = () => (
  <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
    <View style={{ width: '100%', height: 120, backgroundColor: '#e5e7eb', borderRadius: 6, marginBottom: 8 }} />
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ height: 16, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ height: 14, backgroundColor: '#e5e7eb', borderRadius: 4, width: '60%' }} />
    </View>
  </View>
);

const UserInfoSkeleton = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 8 }}>
    <View style={{ width: 40, height: 40, backgroundColor: '#e5e7eb', borderRadius: 20, marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <View style={{ height: 16, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 4, width: '70%' }} />
      <View style={{ height: 12, backgroundColor: '#e5e7eb', borderRadius: 4, width: '50%' }} />
    </View>
  </View>
);
import { generateDynamicCategories } from '../../utils/categoryUtils';
// Removed theme color imports - using explicit colors

// Header constants
const HEADER_VISUAL_HEIGHT = 220; // Visual height of the blue header (taller for rounded corners)
const MAX_HEADER_HEIGHT = 154; // Content area initial position
const MIN_HEADER_HEIGHT = 99; // Search bar area with proper top padding
const SCROLL_DISTANCE = MAX_HEADER_HEIGHT - MIN_HEADER_HEIGHT; // 55

export default function HomeScreen() {
  const router = useRouter();
  // Using explicit colors instead of theme colors
  const backgroundColor = '#ffffff'; // Explicit white
  const textColor = '#111827'; // Explicit black
  const primaryColor = '#0a61d7'; // Explicit blue

  // Auth state
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const isAuthenticated = !!token && !!user;

  // Redirect to welcome if not authenticated - use useEffect to avoid render-time navigation
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/useraccounts/welcome');
    }
  }, [isAuthenticated, router]);

  // Data state from cache
  const { 
    products: cachedProducts, 
    user: cachedUser,
    isProductsLoading,
    isUserLoading,
    loadProductsData,
    refreshAllData,
    forceRefreshProducts,
  } = useDataStore();

  // User activity store
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  const { addItem } = useCartStore();
  
  // Header scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const { setScrollY } = useHeaderScrollStore();
  const scrollViewRef = useRef<any>(null);

  // Set scrollY in store synchronously before first render to prevent flickering
  useLayoutEffect(() => {
    setScrollY(scrollY);
    scrollY.setValue(0);
  }, [setScrollY, scrollY]);

  // Header scroll interpolations
  const headerContentTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, -SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  const addressOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Search bar moves up from top:105 to top:50 (translateY: 0 to -55)
  const searchBarTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, -55],
    extrapolate: 'clamp',
  });

  // Content area background starts lower (full header visible), moves up as you scroll
  const contentTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [SCROLL_DISTANCE, 0],
    extrapolate: 'clamp',
  });

  // Content elements stay in place until header is collapsed, then scroll normally
  // This counters the internal scroll for the first SCROLL_DISTANCE pixels
  const contentElementsTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  // Scroll tracking for progress bar
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use cached products only (no mock data fallback)
  const products = cachedProducts;
  // Show loading only if products are loading AND we have no cached products yet
  const loading = isProductsLoading && cachedProducts.length === 0;

  // Generate dynamic categories from product data
  const dynamicCategories = generateDynamicCategories(products);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshAllData(token || undefined);
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllData, token]);

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
    if (quantity) {
      // Handle buy now with quantity
      // TODO: Implement buy now logic
    } else {
      // Handle buy now without quantity (full view)
      // TODO: Implement buy now logic
    }
  }, []);

  const handleToggleFavorite = useCallback(async (productId: string) => {
    if (!user?.id) {
      return;
    }
    const product = products.find(p => p.id === productId);
    if (product) {
      await toggleLikedProduct(productId, product);
    }
  }, [user?.id, products, toggleLikedProduct]);

  const handleSaleBannerPress = useCallback(() => {
    // Handle sale banner press
  }, []);

  const handleCategoryPress = useCallback((categoryName: string) => {
    // Navigate to search page with category filter to show filtered results
    router.push({
      pathname: '/search',
      params: { category: categoryName }
    });
  }, [router]);

  const handleSeeAllPress = useCallback(() => {
    // Navigate to search page without query to show initial state
    router.push('/search');
  }, [router]);

  // Revalidate products when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      forceRefreshProducts();
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
    }, [forceRefreshProducts, scrollY, setScrollY])
  );

  // Light background refresh while this screen is visible
  useEffect(() => {
    const intervalId = setInterval(() => {
      forceRefreshProducts();
    }, 120000); // 2 minutes
    return () => clearInterval(intervalId);
  }, [forceRefreshProducts]);

  // Early return after all hooks to prevent rendering unauthenticated content
  if (!isAuthenticated) {
    return null;
  }

  return (
    <RNView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} translucent={false} />
      
      {/* Header - rendered BEHIND content (zIndex: 0) */}
      <RNView 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_VISUAL_HEIGHT,
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
                {user?.storeName || 'My Store'}
              </RNText>
              <RNText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} numberOfLines={1}>
                {user?.chosenAddress || 'Set your address'}
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
        {/* Search bar - stays fixed, moves up slightly to stick at top */}
        <Animated.View style={{ 
          position: 'absolute',
          top: 100,
          left: 16,
          right: 16,
          transform: [{ translateY: searchBarTranslateY }]
        }}>
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
                Search for products...
              </Text>
            </RNView>
          </Pressable>
        </Animated.View>
      </RNView>

      {/* Scroll content - IN FRONT of header (zIndex: 1) */}
      <Animated.ScrollView 
        ref={scrollViewRef}
        style={{ 
          flex: 1, 
          zIndex: 1, 
          marginTop: MIN_HEADER_HEIGHT, 
          backgroundColor: '#f9fafb', 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24,
          transform: [{ translateY: contentTranslateY }]
        }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
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
        {/* Content area - background scrolls immediately */}
        <View style={{ backgroundColor: '#f9fafb' }}>
          {/* Content elements - stay in place until header is collapsed */}
          <Animated.View style={{ transform: [{ translateY: contentElementsTranslateY }] }}>
          {/* Special Offers Section */}
          <View style={{ backgroundColor: '#f9fafb', paddingTop: 5 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Special Offers</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <SaleBanner
              title="🎉 MEGA SALE 2025"
              subtitle="Up to 90% OFF Everything!"
              discountText="Flash Sale"
              endDate="Ends in 2 days"
              onPress={handleSaleBannerPress}
              backgroundColor="#0a61d7"
            />
          </View>
        
          {/* Categories Section */}
          <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: 10 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <TouchableOpacity onPress={handleSeeAllPress}>
                <Text style={styles.seeAllText}>See All</Text>
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
              <Text style={styles.sectionTitle}>Featured Products</Text>
              <TouchableOpacity onPress={handleSeeAllPress}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            {/* Loading State with Skeleton */}
            {loading && (
              <View style={styles.productsContainer}>
                <View style={styles.leftColumn}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.productItem}>
                      <ProductSkeleton />
                    </View>
                  ))}
                </View>
                <View style={styles.rightColumn}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.productItem}>
                      <ProductSkeleton />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Error State */}
            {error && !loading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
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
                <Text style={styles.endMessage}>Products displays reached the end.</Text>
              </View>
            )}

            {/* No Products Message */}
            {!loading && !error && products.length === 0 && (
              <View style={styles.noProductsContainer}>
                <Text style={styles.noProductsText}>No products available</Text>
              </View>
            )}
          </View>
          </Animated.View>
        </View>
      </Animated.ScrollView>
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
    gap: 16,
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
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    marginBottom: 15,
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
