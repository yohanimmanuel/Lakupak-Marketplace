import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag, ArrowLeft } from 'lucide-react-native';
import { useUserActivityStore } from '../../../stores/userActivityStore';
import { useDataStore } from '../../../stores/dataStore';
import { useCartStore } from '../../../stores/cartStore';
import { useAuthStore } from '../../../stores/authStore';
import ProductMarketplace from '../../components/productcatalog/ProductMarketplace';
import { MarketplaceProduct } from '../../../services/marketplace';
import { Product } from '../../../data/sampleProducts';
import { useTranslation } from 'react-i18next';
import { ProductGridSkeleton } from '../../components/SkeletonLoader';

const { width: screenWidth } = Dimensions.get('window');

export default function BuyAgainModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { products, orders, loadOrdersData } = useDataStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const storeLikedProducts = useUserActivityStore(state => state.likedProducts);
  const { addItem } = useCartStore();
  const { user, token } = useAuthStore();
  
  const [orderedProducts, setOrderedProducts] = useState<MarketplaceProduct[]>([]);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (!user?.id || !token) {
      setIsResolving(false);
      return;
    }
    let cancelled = false;
    setIsResolving(true);
    (async () => {
      try {
        await loadOrdersData(false);
      } finally {
        if (!cancelled) {
          requestAnimationFrame(() => setIsResolving(false));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, token, loadOrdersData]);

  const showSkeleton = !!user?.id && isResolving;

  // Extract ordered products from orders after initial resolve
  useEffect(() => {
    if (isResolving) return;

    if (orders.length > 0 && products.length > 0) {
      // Get unique product IDs from orders
      const orderProductIds = orders.flatMap(order => 
        (order.orderItems || []).map(item => item.productId).filter(Boolean) as string[]
      );
      const uniqueOrderProductIds = Array.from(new Set(orderProductIds));
      
      // Match with products from store
      const matchedProducts = uniqueOrderProductIds
        .map(productId => products.find(p => p.id === productId))
        .filter((product): product is MarketplaceProduct => product !== undefined);
      
      setOrderedProducts(matchedProducts);
    } else {
      setOrderedProducts([]);
    }
  }, [isResolving, orders, products]);

  // Get related products from websocket-enabled products store
  const relatedProducts = React.useMemo(() => {
    if (products.length === 0) return [];
    
    const orderedProductIds = orderedProducts.map((p: MarketplaceProduct) => p.id);
    return products
      .filter(p => !orderedProductIds.includes(p.id))
      .slice(0, 4);
  }, [products, orderedProducts]);

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
      <ShoppingBag size={60} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>{t('moreService.buyAgain.emptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('moreService.buyAgain.emptyBody')}
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
                <Pressable 
                  onPress={() => router.back()} 
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('moreService.common.a11y.back')}
                >
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('moreService.buyAgain.title')}</Text>
              </View>
            </View>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView}>

        {showSkeleton ? (
          <ProductGridSkeleton />
        ) : orderedProducts.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.productsGrid}>
            <View style={styles.leftColumn}>
              {orderedProducts.filter((_, index) => index % 2 === 0).map((product) => (
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
              {orderedProducts.filter((_, index) => index % 2 === 1).map((product) => (
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
