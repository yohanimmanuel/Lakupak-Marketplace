import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductMarketplace from './components/productcatalog/ProductMarketplace';
import BuyNowModal from './components/productcatalog/BuyNowModal';
import { useDataStore } from '../stores/dataStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { useAuthStore } from '../stores/authStore';
import type { MarketplaceProduct } from '../services/marketplace';
import type { Product } from '../data/sampleProducts';

type ProductType = MarketplaceProduct | { id: string; name: string; sellingPrice?: number; images?: string[]; packageType?: string; piecesPerPackage?: number; };

export default function ProductModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { products, forceRefreshProducts } = useDataStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  const { user } = useAuthStore();
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  
  // Refresh products (and offers) when modal gains focus
  useFocusEffect(
    useCallback(() => {
      forceRefreshProducts();
    }, [forceRefreshProducts])
  );
  
  // Also refresh when productId changes (when navigating between products)
  useEffect(() => {
    if (params.productId) {
      forceRefreshProducts();
    }
  }, [params.productId, forceRefreshProducts]);
  
  // Find the product by ID from params
  const product = products.find(p => p.id === params.productId);
  
  if (!product) {
    return null;
  }

  const handleClose = () => {
    router.back();
  };

  const handleAddToCart = (product: ProductType) => {
    // Add to cart functionality
  };

  const handleBuyNow = (product: ProductType) => {
    setShowBuyNowModal(true);
  };

  const handleChatSeller = () => {
    // Chat seller functionality
  };

  const handleShare = () => {
    // Share functionality
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

  const handleBuyNowConfirm = (product: ProductType, quantity: number) => {
    // Navigate to checkout with product details
    const checkoutParams = {
      productId: product.id,
      quantity: quantity.toString(),
      totalPrice: ((product.sellingPrice || 0) * quantity).toString(),
      productName: product.name || 'Unknown Product',
      productImage: product.images?.[0] || '',
      unitPrice: (product.sellingPrice || 0).toString(),
      originalPrice: ((product as MarketplaceProduct).originalSellingPrice || (product as Product).originalSellingPrice || 0).toString(),
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
        isFavorite={likedProducts.includes(product.id)}
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
