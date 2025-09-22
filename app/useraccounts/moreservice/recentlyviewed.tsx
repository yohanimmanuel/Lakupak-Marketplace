import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useUserActivityStore } from '../../../stores/userActivityStore';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore } from '../../../stores/cartStore';
import { useAuthStore } from '../../../stores/authStore';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';
import { MarketplaceProduct } from '../../../services/marketplace';

const { width: screenWidth } = Dimensions.get('window');

export default function RecentlyViewedModal() {
  const router = useRouter();
  const { products } = useDataStore();
  const { getViewedProducts, toggleLikedProduct, loadUserActivities, refreshUserActivities } = useUserActivityStore();
  const storeLikedProducts = useUserActivityStore(state => state.likedProducts);
  const storeViewedProducts = useUserActivityStore(state => state.viewedProducts);
  const { addItem } = useCartStore();
  const { user } = useAuthStore();
  
  const [viewedProducts, setViewedProducts] = useState<MarketplaceProduct[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<MarketplaceProduct[]>([]);

  // Load user activities when component mounts
  useEffect(() => {
    if (user?.id) {
      loadUserActivities(user.id);
    }
  }, [user?.id, loadUserActivities]);

  // Refresh data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        refreshUserActivities();
      }
    }, [user?.id, refreshUserActivities])
  );

  // Update products immediately when store changes
  useEffect(() => {
    const viewed = getViewedProducts(products);
    setViewedProducts(viewed);
    
    // Load all products for "You may also like" section
    const viewedProductIds = viewed.map((p: MarketplaceProduct) => p.id);
    const related = products
      .filter(p => !viewedProductIds.includes(p.id))
      .slice(0, 4);
    
    setRelatedProducts(related);
  }, [products, getViewedProducts, storeViewedProducts]);

  const handleAddToCart = (product: any, quantity: number = 1) => {
    addItem(product, quantity);
  };

  const handleBuyNow = (product: any, quantity?: number) => {
    addItem(product, quantity || 1, 'Default');
  };

  const handleChatSeller = () => {
    // TODO: Implement chat seller functionality
  };

  const handleShare = () => {
    // TODO: Implement share functionality
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!user?.id) {
      return;
    }
    const product = products.find(p => p.id === productId);
    if (product) {
      await toggleLikedProduct(productId, product);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Eye size={60} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>No Recently Viewed Items</Text>
      <Text style={styles.emptySubtitle}>
        Start browsing products to see them here!
      </Text>
    </View>
  );

  const renderYouMayAlsoLike = () => {
    if (relatedProducts.length === 0) return null;

    return (
      <View style={styles.youMayAlsoLikeSection}>
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.sectionTitle}>You May Also Like</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <View style={styles.relatedProductsGrid}>
          <View style={styles.leftColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 0).map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={storeLikedProducts.includes(product.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
          <View style={styles.rightColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 1).map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={storeLikedProducts.includes(product.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        presentation: 'modal',
        title: 'Recently Viewed',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#111827' },
        headerTintColor: '#0a61d7',
      }} />
      
      <ScrollView style={styles.scrollView}>

        {viewedProducts.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.productsGrid}>
            <View style={styles.leftColumn}>
              {viewedProducts.filter((_, index) => index % 2 === 0).map((product) => (
                <View key={product.id} style={styles.productItem}>
                  <ProductMarketplace
                    product={product}
                    onPress={() => {
                      router.push({
                        pathname: '/product',
                        params: { productId: product.id }
                      });
                    }}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onChatSeller={handleChatSeller}
                    onShare={handleShare}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={storeLikedProducts.includes(product.id)}
                    type="card"
                  />
                </View>
              ))}
            </View>
            <View style={styles.rightColumn}>
              {viewedProducts.filter((_, index) => index % 2 === 1).map((product) => (
                <View key={product.id} style={styles.productItem}>
                  <ProductMarketplace
                    product={product}
                    onPress={() => {
                      router.push({
                        pathname: '/product',
                        params: { productId: product.id }
                      });
                    }}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onChatSeller={handleChatSeller}
                    onShare={handleShare}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={storeLikedProducts.includes(product.id)}
                    type="card"
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {renderYouMayAlsoLike()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    marginTop: 16,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#374151',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  productItem: {
    marginBottom: 8,
  },
  youMayAlsoLikeSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 16,
  },
  relatedProductsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
});
