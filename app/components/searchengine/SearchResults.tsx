import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import ProductMarketplace from '../productcatalog/ProductMarketplace';
import ProductCardSkeleton from './ProductCardSkeleton';
import { Product } from '../../../data/sampleProducts';

interface SearchResultsProps {
  query: string;
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
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
  onProductPress,
  onAddToCart,
  onToggleFavorite,
  favorites,
  onRefresh,
  onLoadMore,
}: SearchResultsProps) {
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
        {loading && products.length === 0 ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
            <View style={styles.skeletonRow}>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </View>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search or filters
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
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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

