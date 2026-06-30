import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Share, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import ProductMarketplace from './components/productcatalog/ProductMarketplace';
import BuyNowModal from './components/productcatalog/BuyNowModal';
import { useDataStore } from '../stores/dataStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { useAuthStore } from '../stores/authStore';
import { useMessagesStore } from '../stores/messagesStore';
import { marketplaceService, type MarketplaceProduct } from '../services/marketplace';
import type { Product } from '../data/sampleProducts';
import { openWhatsApp } from '../utils/whatsapp';
import { useTranslation } from 'react-i18next';
import { ProductDetailSkeleton } from './components/SkeletonLoader';

type ProductType = MarketplaceProduct | { id: string; name: string; sellingPrice?: number; images?: string[]; packageType?: string; piecesPerPackage?: number; };

export default function ProductModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { products, forceRefreshProducts } = useDataStore();
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  const { user, token } = useAuthStore();
  const { t } = useTranslation();
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [fetchedProduct, setFetchedProduct] = useState<MarketplaceProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const hasAutoOpenedBuyNow = useRef(false);

  const productId = typeof params.productId === 'string' ? params.productId : '';
  const shouldOpenBuyNow = params.openBuyNow === 'true';
  const initialQuantity = useMemo(() => {
    const raw = params.initialQuantity;
    const parsed = parseInt(typeof raw === 'string' ? raw : '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [params.initialQuantity]);
  const initialVariantName = typeof params.variantName === 'string' ? params.variantName : undefined;

  useFocusEffect(
    useCallback(() => {
      forceRefreshProducts();
    }, [forceRefreshProducts])
  );

  useEffect(() => {
    if (productId) {
      forceRefreshProducts();
    }
  }, [productId, forceRefreshProducts]);

  const product = useMemo(() => {
    return products.find((p) => p.id === productId) || fetchedProduct;
  }, [products, productId, fetchedProduct]);

  useEffect(() => {
    if (!productId || product) return;

    let cancelled = false;
    setIsLoadingProduct(true);
    marketplaceService
      .getProductById(productId, token || undefined)
      .then((loaded) => {
        if (!cancelled) setFetchedProduct(loaded);
      })
      .catch(() => {
        if (!cancelled) setFetchedProduct(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProduct(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, product, token]);

  useEffect(() => {
    hasAutoOpenedBuyNow.current = false;
  }, [productId]);

  useEffect(() => {
    if (!product || !shouldOpenBuyNow || hasAutoOpenedBuyNow.current) return;
    hasAutoOpenedBuyNow.current = true;
    setShowBuyNowModal(true);
  }, [product, shouldOpenBuyNow]);

  if (!product) {
    return (
      <View style={styles.container}>
        {isLoadingProduct ? (
          <ProductDetailSkeleton />
        ) : (
          <View style={[styles.container, styles.loadingContainer]}>
            <Text style={styles.loadingText}>{t('product.notFound', { defaultValue: 'Product not found' })}</Text>
          </View>
        )}
      </View>
    );
  }

  const handleClose = () => {
    router.back();
  };

  const handleAddToCart = (_product: ProductType) => {
    // Add to cart functionality
  };

  const handleBuyNow = (_product: ProductType) => {
    setShowBuyNowModal(true);
  };

  const handleChatSeller = () => {
    const mp = product as MarketplaceProduct;
    const phone = mp?.seller?.company?.businessPhone;
    const productName = product.name || 'Product';
    const distributorId = typeof mp?.userId === 'number' ? mp.userId : Number.NaN;
    const distributorName = (mp?.seller?.company?.name || mp?.seller?.name || '').trim() || 'Distributor';
    const logoUrl = mp?.seller?.company?.logo ?? null;

    if (Number.isFinite(distributorId)) {
      useMessagesStore.getState().upsertConversation({
        distributorId,
        name: distributorName,
        phone: typeof phone === 'string' ? phone : null,
        logoUrl,
        lastProductId: String(product.id),
        lastProductName: productName,
      });
    }

    openWhatsApp({
      phone: typeof phone === 'string' ? phone : '',
      text: t('messages.whatsapp.productInquiry', { productName }),
      onErrorMessage: t('messages.errors.sellerPhoneUnavailable'),
    });
  };

  const handleShare = async () => {
    try {
      const productName = product.name || 'Product';
      const unitPrice = product.sellingPrice || 0;
      const deepLink = Linking.createURL('/product', {
        queryParams: { productId: product.id },
      });

      const message = unitPrice
        ? t('product.share.withPrice', { productName, price: unitPrice.toLocaleString(), link: deepLink })
        : t('product.share.withoutPrice', { productName, link: deepLink });

      await Share.share({ message });
    } catch {
      // no-op: user cancelled or sharing unavailable
    }
  };

  const handleToggleFavorite = async (targetProductId: string) => {
    if (!user?.id) {
      return;
    }
    const targetProduct = products.find((p) => p.id === targetProductId) || fetchedProduct;
    if (targetProduct) {
      await toggleLikedProduct(targetProductId, targetProduct);
    }
  };

  const handleBuyNowConfirm = (targetProduct: ProductType, quantity: number) => {
    const checkoutParams = {
      productId: targetProduct.id,
      quantity: quantity.toString(),
      totalPrice: ((targetProduct.sellingPrice || 0) * quantity).toString(),
      productName: targetProduct.name || 'Unknown Product',
      productImage: targetProduct.images?.[0] || '',
      unitPrice: (targetProduct.sellingPrice || 0).toString(),
      originalPrice: ((targetProduct as MarketplaceProduct).originalSellingPrice || (targetProduct as Product).originalSellingPrice || 0).toString(),
      packageType: targetProduct.packageType || 'Box',
      piecesPerPackage: targetProduct.piecesPerPackage?.toString() || '1',
    };

    router.push({
      pathname: '/components/productcatalog/checkout',
      params: checkoutParams,
    });
  };

  const handleCloseBuyNowModal = () => {
    setShowBuyNowModal(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundOverlay} />

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

      <BuyNowModal
        visible={showBuyNowModal}
        product={product}
        onClose={handleCloseBuyNowModal}
        onConfirm={handleBuyNowConfirm}
        initialQuantity={shouldOpenBuyNow ? initialQuantity : undefined}
        initialVariantName={shouldOpenBuyNow ? initialVariantName : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
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
