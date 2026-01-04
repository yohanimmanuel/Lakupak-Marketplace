import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import ProductMarketplace from './ProductMarketplace';

import Colors from '../../../constants/Colors';
import { useColorScheme } from '../useColorScheme';
import { useThemeColor } from '../Themed';
import { sampleProducts, Product } from '../../../data/sampleProducts';

export default function ProductMarketplaceExample() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'tint');

  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const handleProductPress = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('detail');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedProduct(null);
  };

  const handleAddToCart = (product: Product) => {
    // Implement add to cart logic
  };

  const handleBuyNow = (product: Product) => {
    // Implement buy now logic
  };

  const handleChatSeller = () => {
    // Implement chat functionality
  };

  const handleShare = () => {
    // Implement share functionality
  };

  const handleToggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    // Implement load more logic
  };

  if (viewMode === 'detail' && selectedProduct) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToGrid} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: primaryColor }]}>
              ← Back to Products
            </Text>
          </TouchableOpacity>
        </View>
        
        <ProductMarketplace
          product={selectedProduct}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onChatSeller={handleChatSeller}
          onShare={handleShare}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={favorites.includes(selectedProduct.id)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Product Catalog
        </Text>
        <Text style={[styles.headerSubtitle, { color: textColor }]}>
          {sampleProducts.length} products available
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});