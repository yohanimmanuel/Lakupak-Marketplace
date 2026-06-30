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
import { ProductGridSkeleton } from '../components/SkeletonLoader';
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
import { useTranslation } from 'react-i18next';

export default function CategoriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshAllData(token || undefined);
    } catch (err) {
      setError(t('tabsCategories.errors.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllData, token, t]);

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
            {t('tabsCategories.exploreByCategory')}
          </Text>
          <TouchableOpacity onPress={handleSeeAllPress}>
            <Text style={[styles.seeAllText, { color: primaryColor }]}>
              {t('tabsCategories.seeAll')}
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
              onPress={() => handleCategoryPress(category.name)}
            />
          ))}
        </ScrollView>
        
      </View>

      {/* New This Week Section */}
      <View style={[styles.section, { backgroundColor: '#f9fafb', marginTop: 15, marginBottom: -10 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {t('tabsCategories.newThisWeek')}
          </Text>
          <TouchableOpacity onPress={handleSeeAllPress}>
            <Text style={[styles.seeAllText, { color: primaryColor }]}>
              {t('tabsCategories.seeAll')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State with Skeleton */}
        {loading && <ProductGridSkeleton />}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>{t('tabsCategories.retry')}</Text>
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
            <Text style={styles.endMessage}>{t('tabsCategories.endMessage')}</Text>
          </View>
        )}

        {/* No Products Message */}
        {!loading && !error && products.length === 0 && (
          <View style={styles.noProductsContainer}>
            <Text style={styles.noProductsText}>{t('tabsCategories.noProducts')}</Text>
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
    paddingHorizontal: 18,
    backgroundColor: '#f9fafb', // Gray background
    gap: 14, // Space between columns - narrower gap
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
