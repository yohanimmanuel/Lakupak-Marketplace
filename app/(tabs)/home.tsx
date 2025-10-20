import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View as RNView,
  ScrollView,
  RefreshControl,
  Text as RNText,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

// Components
import MyWallet from '../components/paymentcheckout/MyWallet';
import SaleBanner from '../components/paymentcheckout/SaleBanner';
import ProductMarketplace from '../components/productcatalog/ProductMarketplace';

// Hooks
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { useUserActivityStore } from '../../stores/userActivityStore';
import { useCartStore } from '../../stores/cartStore';
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

  const handleWalletItemPress = useCallback((type: string) => {
    // Handle wallet item press
  }, []);

  // Revalidate products when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      forceRefreshProducts();
    }, [forceRefreshProducts])
  );

  // Light background refresh while this screen is visible
  useEffect(() => {
    const intervalId = setInterval(() => {
      forceRefreshProducts();
    }, 120000); // 2 minutes
    return () => clearInterval(intervalId);
  }, [forceRefreshProducts]);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={primaryColor}
          colors={[primaryColor]}
        />
      }
    >

        <View style={{ backgroundColor: '#f9fafb' }}>
          {/* My Wallet Section */}
          <MyWallet
            isAuthenticated={isAuthenticated}
            lakupayBalance={230.75}
            bonusesAmount={45.00}
            discountsAmount={12.50}
            onPressManage={() => handleWalletItemPress('manage')}
          />
        </View>

        {/* Categories Section */}
        <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: 20 }]}>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
            onScroll={handleCategoryScroll}
            scrollEventThrottle={16}
          >
            {dynamicCategories.map((category, index) => (
              <TouchableOpacity key={index} style={styles.categoryItem}>
                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                  <Ionicons name={category.icon as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap} size={24} color={category.color} />
                </View>
                <Text style={[styles.categoryName, { color: '#111827' }]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
        </View>

        {/* Sale Banner */}
        <SaleBanner
          title="🎉 MEGA SALE 2025"
          subtitle="Up to 90% OFF Everything!"
          discountText="Flash Sale"
          endDate="Ends in 2 days"
          onPress={handleSaleBannerPress}
          backgroundColor="#0a61d7"
        />

        {/* Featured Products Section */}
        <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: -10 }]}>
          
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

          {/* Product List - Fixed to avoid VirtualizedLists nesting */}
          {!loading && !error && (
            <View style={styles.productsContainer}>
              <View style={styles.leftColumn}>
                {products.slice(0, 6).filter((_, index) => index % 2 === 0).map((product) => (
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
                {products.slice(0, 6).filter((_, index) => index % 2 === 1).map((product) => (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: '#ffffff', // Explicit white background
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff', // Explicit white background
    paddingBottom: 20,
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#ffffff', // Explicit white background
    flexGrow: 1,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#f9fafb', // Gray background
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827', // Explicit black
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a61d7', // Explicit blue
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
    color: '#111827', // Explicit black
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
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb', // Gray background
    gap: 8, // Space between columns - narrower gap
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#f9fafb', // Gray background
  },
  rightColumn: {
    flex: 1,
    backgroundColor: '#f9fafb', // Gray background
  },
  productItem: {
    marginBottom: 4, // Space between items in each column - narrower gap
    backgroundColor: '#f9fafb', // Gray background
  },
  endMessageContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb', // Gray background
    marginBottom: 0, // Explicitly remove bottom margin
    paddingBottom: 0, // Explicitly remove bottom padding
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
    backgroundColor: '#ffffff',
  },
  noProductsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
