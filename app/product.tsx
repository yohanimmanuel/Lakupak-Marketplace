import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductMarketplace from './components/productcatalog/ProductMarketplace';
import BuyNowModal from './components/productcatalog/BuyNowModal';
import { useDataStore } from '../stores/dataStore';

export default function ProductModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { products } = useDataStore();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  
  // Find the product by ID from params
  const product = products.find(p => p.id === params.productId);
  
  if (!product) {
    return null;
  }

  const handleClose = () => {
    router.back();
  };

  const handleAddToCart = (product: any) => {
    // Add to cart functionality
  };

  const handleBuyNow = (product: any) => {
    setShowBuyNowModal(true);
  };

  const handleChatSeller = () => {
    // Chat seller functionality
  };

  const handleShare = () => {
    // Share functionality
  };

  const handleToggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const handleBuyNowConfirm = (product: any, quantity: number) => {
    // Navigate to checkout with product details
    const checkoutParams = {
      productId: product.id,
      quantity: quantity.toString(),
      totalPrice: (product.pricePerPackage * quantity).toString(),
      productName: product.name || 'Unknown Product',
      productImage: product.images?.[0] || '',
      unitPrice: product.unitPrice?.toString() || '0',
      packageType: product.packageType || 'Box',
      piecesPerPackage: product.piecesPerPackage?.toString() || '1',
    };
    
    router.push({
      pathname: '/components/productcatalog/checkout',
      params: checkoutParams,
    });
    
    // Don't close the modal - let it stay open as a bottom sheet
  };

  const handleCloseBuyNowModal = () => {
    setShowBuyNowModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Background overlay for proper modal layering */}
      <View style={styles.backgroundOverlay} />
      
      {/* Product Content */}
      <ProductMarketplace
        product={product}
        onPress={() => {}}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        onChatSeller={handleChatSeller}
        onShare={handleShare}
        onToggleFavorite={handleToggleFavorite}
        onClose={handleClose}
        isFavorite={favorites.has(product.id)}
        type="full"
        showBackButton={true}
        onBackPress={handleClose}
      />

      {/* Buy Now Modal */}
      <BuyNowModal
        visible={showBuyNowModal}
        product={product}
        onClose={handleCloseBuyNowModal}
        onConfirm={handleBuyNowConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
});
