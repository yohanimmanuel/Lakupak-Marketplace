import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import ProductMarketplace from '../productcatalog/ProductMarketplace';
import { ProductGridSkeleton } from '../SkeletonLoader';
import { Product } from '../../../data/sampleProducts';
import { useTranslation } from 'react-i18next';

interface SearchResultsProps {
  query: string;
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  didYouMean?: string | null;
  onDidYouMeanPress?: (suggestion: string) => void;
  onProductPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  favorites: string[];
  onRefresh: () => Promise<void>;
  onLoadMore: () => void;
}

export default function SearchResults({
  query,
  products,
  loading,
  refreshing,
  hasMore,
  didYouMean,
  onDidYouMeanPress,
  onProductPress,
  onAddToCart,
  onToggleFavorite,
  favorites,
  onRefresh,
  onLoadMore,
}: SearchResultsProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {/* Product Grid */}
      <ScrollView
        style={styles.productsSection}
        contentContainerStyle={styles.productsScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0a61d7"
            colors={["#0a61d7"]}
          />
        }
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            if (hasMore && !loading) {
              onLoadMore();
            }
          }
        }}
        scrollEventThrottle={400}
      >
        {didYouMean ? (
          <Pressable
            onPress={() => onDidYouMeanPress?.(didYouMean)}
            style={styles.didYouMeanRow}
          >
            <Text style={styles.didYouMeanText}>
              {t('search.results.didYouMeanPrefix')}
              <Text style={styles.didYouMeanLink}>{didYouMean}</Text>
              {t('search.results.didYouMeanSuffix')}
            </Text>
          </Pressable>
        ) : null}

        {loading && products.length === 0 ? (
          <ProductGridSkeleton rowsPerColumn={3} style={styles.skeletonGrid} />
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('search.results.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('search.results.emptySubtitle')}
            </Text>
          </View>
        ) : (
          <View key={query} style={styles.productsContainer}>
            <View style={styles.leftColumn}>
              {products.filter((_, index) => index % 2 === 0).map((product) => (
                <View key={product.id} style={styles.productItem}>
                  <ProductMarketplace
                    product={product}
                    onPress={onProductPress}
                    onAddToCart={onAddToCart}
                    onBuyNow={() => {}}
                    onChatSeller={() => {}}
                    onShare={() => {}}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={favorites.includes(product.id)}
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
                    onPress={onProductPress}
            onAddToCart={onAddToCart}
                    onBuyNow={() => {}}
                    onChatSeller={() => {}}
                    onShare={() => {}}
            onToggleFavorite={onToggleFavorite}
                    isFavorite={favorites.includes(product.id)}
                    type="card"
          />
                </View>
              ))}
      </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  productsSection: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  productsScrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  didYouMeanRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  didYouMeanText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  didYouMeanLink: {
    color: '#0a61d7',
    fontWeight: '700',
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
  skeletonGrid: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

