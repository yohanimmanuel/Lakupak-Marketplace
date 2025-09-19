import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Text,
} from 'react-native';
import ProductMarketplace from './ProductMarketplace';
import { Product } from '../../../data/sampleProducts';
// Removed theme color imports - using explicit colors

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 2;
const cardWidth = (screenWidth - 48) / numColumns; // 2 columns with padding

interface ProductGridProps {
  products: Product[];
  onProductPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  favorites?: string[];
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => void;
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  emptyMessage?: string;
}

export default function ProductGrid({
  products,
  onProductPress,
  onAddToCart,
  onToggleFavorite,
  favorites = [],
  onRefresh,
  onLoadMore,
  loading = false,
  refreshing = false,
  hasMore = true,
  emptyMessage = "No products found",
}: ProductGridProps) {
  // Using explicit colors instead of theme colors
  const backgroundColor = '#ffffff'; // White
  const textColor = '#111827'; // Black
  const primaryColor = '#0a61d7'; // Blue

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMore = useCallback(async () => {
    if (onLoadMore && hasMore && !isLoadingMore && !loading) {
      setIsLoadingMore(true);
      try {
        await onLoadMore();
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [onLoadMore, hasMore, isLoadingMore, loading]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const renderItem = ({ item, index }: { item: Product; index: number }) => {
    const isFavorite = favorites.includes(item.id);
    
    return (
      <View style={[
        styles.itemContainer,
        { width: cardWidth },
        index % 2 === 0 ? styles.leftItem : styles.rightItem
      ]}>
        <ProductMarketplace
          product={item}
          onPress={onProductPress}
          onAddToCart={onAddToCart}
          onBuyNow={() => {}}
          onChatSeller={() => {}}
          onShare={() => {}}
          onToggleFavorite={onToggleFavorite}
          isFavorite={isFavorite}
          type="card"
        />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: textColor }]}>
        {emptyMessage}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore || products.length === 0) return null;
    
    return (
      <View style={styles.footerContainer}>
        {isLoadingMore && (
          <Text style={[styles.loadingText, { color: textColor }]}>
            Loading more products...
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          ) : undefined
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        getItemLayout={(data, index) => ({
          length: 200, // Approximate item height
          offset: 200 * Math.floor(index / 2),
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    justifyContent: 'space-between',
  },
  itemContainer: {
    marginBottom: 16,
  },
  leftItem: {
    marginRight: 8,
  },
  rightItem: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
});
