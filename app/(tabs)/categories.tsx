import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View as RNView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../components/Themed';

// Components
import ProductMarketplace from '../components/productcatalog/ProductMarketplace';
import CategoryBadge from '../components/CategoryBadge';
// import { SkeletonLoader, ProductSkeleton } from '../components/SkeletonLoader';

// Temporary skeleton component
const ProductSkeleton = () => (
  <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
    <View style={{ width: '100%', height: 120, backgroundColor: '#e5e7eb', borderRadius: 6, marginBottom: 8 }} />
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ height: 16, backgroundColor: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ height: 14, backgroundColor: '#e5e7eb', borderRadius: 4, width: '60%' }} />
    </View>
  </View>
);
import { generateDynamicCategories } from '../../utils/categoryUtils';

// Hooks
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { useUserActivityStore } from '../../stores/userActivityStore';
import { useCartStore } from '../../stores/cartStore';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Product } from '../../data/sampleProducts';
import { marketplaceService, MarketplaceProduct } from '../../services/marketplace';

export default function CategoriesScreen() {
  const router = useRouter();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const isAuthenticated = !!token && !!user;

  // Redirect to welcome if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/useraccounts/welcome');
    }
  }, [isAuthenticated, router]);
  
  const { addItem } = useCartStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  
  // Using explicit colors instead of theme colors
  const backgroundColor = '#ffffff'; // Explicit white
  const textColor = '#111827'; // Explicit black
  const primaryColor = '#0a61d7'; // Explicit blue

  // Scroll tracking for progress bar
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

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

  // State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use cached products only (no mock data fallback)
  const products = cachedProducts;
  const loading = isProductsLoading && cachedProducts.length === 0;

  // Generate dynamic categories from product data
  const dynamicCategories = generateDynamicCategories(products);

  // Handle category scroll
  const handleCategoryScroll = (event: { nativeEvent: { contentOffset: { x: number }; contentSize: { width: number }; layoutMeasurement: { width: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPosition(contentOffset.x);
    setScrollContentWidth(contentSize.width);
    setScrollViewWidth(layoutMeasurement.width);
  };

  const handleProductPress = useCallback((product: Product) => {
    router.push({
      pathname: '/product',
      params: { productId: product.id }
    });
  }, [router]);


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
      {/* Categories Section */}
      <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: 20 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Explore by Category
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: primaryColor }]}>
              See all
            </Text>
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
              onPress={() => {}}
            />
          ))}
        </ScrollView>
        
      </View>

      {/* New This Week Section */}
      <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: -10 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            New This Week
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: primaryColor }]}>
              See all
            </Text>
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
            <TouchableOpacity onPress={() => setError(null)} style={styles.retryButton}>
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
                    onAddToCart={(product, quantity) => addItem(product, quantity)}
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
                    onAddToCart={(product, quantity) => addItem(product, quantity)}
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
    backgroundColor: '#f9fafb', // Gray background
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
    backgroundColor: '#f9fafb', // Gray background
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9fafb', // Gray background
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
    color: '#f9fafb', // Gray background
    fontSize: 16,
    fontWeight: '600',
  },
  noProductsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9fafb', // Gray background
  },
  noProductsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
