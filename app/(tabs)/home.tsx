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
import { Text, View } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Components
import MyWallet from '../../components/paymentcheckout/MyWallet';
import SaleBanner from '../../components/paymentcheckout/SaleBanner';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';

// Hooks
import { useAuthStore } from '../../stores/authStore';
import { sampleProducts, Product } from '../../data/sampleProducts';
import { marketplaceService, MarketplaceProduct } from '../../services/marketplace';
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
  

  // Scroll tracking for progress bar
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await marketplaceService.getProducts({ limit: 20 });
      setProducts(response.products);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products');
      // Fallback to sample data if API fails
      setProducts(sampleProducts as MarketplaceProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load products on mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  // Handle category scroll
  const handleCategoryScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPosition(contentOffset.x);
    setScrollContentWidth(contentSize.width);
    setScrollViewWidth(layoutMeasurement.width);
  };

  const handleLoadMore = useCallback(async () => {
    // Load more products
  }, []);

  const handleProductPress = useCallback((product: Product) => {
    // ProductMarketplace will handle its own modal
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    // Add to cart
  }, []);

  const handleToggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleSaleBannerPress = useCallback(() => {
    // Handle sale banner press
  }, []);

  const handleWalletItemPress = useCallback((type: string) => {
    // Handle wallet item press
  }, []);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#ffffff' }}
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

        <View style={{ backgroundColor: '#ffffff' }}>
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
        <View style={[styles.section, { backgroundColor: '#ffffff', marginTop: 15, marginBottom: 20 }]}>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
            onScroll={handleCategoryScroll}
            scrollEventThrottle={16}
          >
            {[
              { name: 'Electronics', icon: 'phone-portrait-outline', color: '#3B82F6' },
              { name: 'Fashion', icon: 'shirt-outline', color: '#EF4444' },
              { name: 'Home & Garden', icon: 'home-outline', color: '#10B981' },
              { name: 'Sports', icon: 'fitness-outline', color: '#F59E0B' },
              { name: 'Beauty', icon: 'flower-outline', color: '#8B5CF6' },
              { name: 'Books', icon: 'book-outline', color: '#6B7280' },
            ].map((category, index) => (
              <TouchableOpacity key={index} style={styles.categoryItem}>
                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                  <Ionicons name={category.icon as any} size={24} color={category.color} />
                </View>
                <Text style={[styles.categoryName, { color: '#111827' }]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Progress Bar */}
          <View style={[styles.progressBarContainer, { marginTop: 20 }]}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressPill,
                  {
                    left: scrollContentWidth > scrollViewWidth 
                      ? Math.min((scrollPosition / (scrollContentWidth - scrollViewWidth)) * (60 - 15), 60 - 15)
                      : 0
                  }
                ]} 
              />
            </View>
          </View>
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
        <View style={[styles.section, { backgroundColor: '#ffffff', marginTop: 15, marginBottom: -10 }]}>
          
          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          )}

          {/* Error State */}
          {error && !loading && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchProducts} style={styles.retryButton}>
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
                      onBuyNow={() => {}}
                      onChatSeller={() => {}}
                      onShare={() => {}}
                      onToggleFavorite={handleToggleFavorite}
                      isFavorite={favorites.includes(product.id)}
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
                      onBuyNow={() => {}}
                      onChatSeller={() => {}}
                      onShare={() => {}}
                      onToggleFavorite={handleToggleFavorite}
                      isFavorite={favorites.includes(product.id)}
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
    backgroundColor: '#ffffff', // Explicit white background
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
  progressBarContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff', // White background
  },
  progressBar: {
    width: 60,
    height: 3,
    backgroundColor: '#9CA3AF', // Gray color
    borderRadius: 2,
    position: 'relative',
  },
  progressPill: {
    position: 'absolute',
    top: -6,
    width: 15,
    height: 15,
    backgroundColor: '#0a61d7', // Blue pill
    borderRadius: 7.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  productsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff', // Explicit white background
    gap: 16, // Space between columns
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#ffffff', // Explicit white background
  },
  rightColumn: {
    flex: 1,
    backgroundColor: '#ffffff', // Explicit white background
  },
  productItem: {
    marginBottom: 8, // Space between items in each column
    backgroundColor: '#ffffff', // Explicit white background
  },
  endMessageContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff', // Explicit white background
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
