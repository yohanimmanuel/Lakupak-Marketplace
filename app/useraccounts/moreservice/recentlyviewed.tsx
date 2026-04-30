import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, ArrowLeft } from 'lucide-react-native';
import { useUserActivityStore } from '../../../stores/userActivityStore';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore } from '../../../stores/cartStore';
import { useAuthStore } from '../../../stores/authStore';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';
import { MarketplaceProduct } from '../../../services/marketplace';
import { Product } from '../../../data/sampleProducts';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');

export default function RecentlyViewedModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { products } = useDataStore();
  const { getViewedProducts, toggleLikedProduct, loadUserActivities, refreshUserActivities } = useUserActivityStore();
  const storeLikedProducts = useUserActivityStore(state => state.likedProducts);
  const storeViewedProducts = useUserActivityStore(state => state.viewedProducts);
  const { addItem } = useCartStore();
  const { user } = useAuthStore();
  
  const [viewedProducts, setViewedProducts] = useState<MarketplaceProduct[]>([]);

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
  }, [products, getViewedProducts, storeViewedProducts]);

  // Get related products from websocket-enabled products store
  const relatedProducts = React.useMemo(() => {
    const viewedProductIds = viewedProducts.map((p: MarketplaceProduct) => p.id);
    return products
      .filter(p => !viewedProductIds.includes(p.id))
      .slice(0, 4);
  }, [products, viewedProducts]);

  const handleAddToCart = (product: Product | MarketplaceProduct, quantity: number = 1) => {
    addItem(product, quantity);
  };

  const handleBuyNow = (product: Product | MarketplaceProduct, quantity?: number) => {
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
      <Text style={styles.emptyTitle}>{t('moreService.recentlyViewed.emptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('moreService.recentlyViewed.emptyBody')}
      </Text>
    </View>
  );

  const renderYouMayAlsoLike = () => {
    if (relatedProducts.length === 0) return null;

    return (
      <View style={styles.youMayAlsoLikeSection}>
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.sectionTitle}>{t('moreService.common.youMayAlsoLike')}</Text>
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

  const primaryBlue = '#0a61d7';
  
  return (
    <View style={[styles.container, { backgroundColor: '#f9fafb' }]}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 8, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('moreService.recentlyViewed.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      
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
    paddingTop: 14,
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
    gap: 8, // Narrower gap between columns
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  productItem: {
    marginBottom: 4, // Narrower gap between items
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
    gap: 8, // Narrower gap between columns
  },
});
