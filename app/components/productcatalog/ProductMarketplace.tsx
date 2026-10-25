import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Heart, ImageIcon, Share2, X, ArrowLeft, ShoppingCart, Gift, Star, Truck, MapPin } from 'lucide-react-native';
import { Product } from '../../../data/sampleProducts';
import { MarketplaceProduct } from '../../../services/marketplace';
import BuyNowModal from './BuyNowModal';
import CartBadge from '../CartBadge';
import { formatCurrency } from '../../../utils/currencyUtils';
import { marketplaceService } from '../../../services/marketplace';
import ProductImageModal from './ProductImageModal';
import { useUserActivityStore } from '../../../stores/userActivityStore';
import { useAuthStore } from '../../../stores/authStore';
import { useDataStore } from '../../../stores/dataStore';
import { API_BASE_URL } from '../../../services/config';
import { useTranslation } from 'react-i18next';
import { translateProductType } from '../../../utils/translateProductType';
// Removed theme color imports - using explicit colors

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48) / 2; // 2 columns with padding

// Normalize relative image paths to absolute URLs
const normalizeUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

type ProductType = Product | MarketplaceProduct;

// Enriched product interface that includes all possible properties
interface EnrichedProduct extends Product {
  price?: number; // Alternative field name
  originalPrice?: number; // Alternative field name
}

interface ProductMarketplaceProps {
  product: ProductType;
  onAddToCart: (product: ProductType, quantity?: number) => void;
  onBuyNow: (product: ProductType, quantity?: number) => void;
  onChatSeller: () => void;
  onShare: () => void;
  onToggleFavorite: (productId: string) => void;
  onClose?: () => void;
  isFavorite?: boolean;
  type?: 'card' | 'full';
  onPress?: (product: ProductType) => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export default function ProductMarketplace({
  product,
  onAddToCart,
  onBuyNow,
  onChatSeller,
  onShare,
  onToggleFavorite,
  onClose,
  isFavorite = false,
  type = 'full',
  onPress,
  showBackButton = false,
  onBackPress,
}: ProductMarketplaceProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const addViewedProduct = useUserActivityStore(state => state.addViewedProduct);
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  const { user } = useAuthStore();
  const products = useDataStore(state => state.products);
  
  // Using explicit colors instead of theme colors
  const primaryColor = '#0a61d7'; // Blue
  const backgroundColor = '#ffffff'; // White
  const textColor = '#111827'; // Black

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const trackedViewProductIdRef = useRef<string | null>(null);

  // Safe value getters to prevent undefined/null errors
  const safeGetString = (value: unknown, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  };

  const safeGetNumber = (value: unknown, fallback: number = 0): number => {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };


  const safeGetArray = (value: unknown, fallback: unknown[] = []): unknown[] => {
    if (!Array.isArray(value)) return fallback;
    return value;
  };

  // Helper function to calculate price range from variant options
  const getPriceRange = (): { min: number; max: number; hasRange: boolean } => {
    if ('variantOptions' in product && product.variantOptions && Array.isArray(product.variantOptions)) {
      // If offer is not active, use original prices instead of discounted prices
      const hasActiveOffer = product.hasActiveOffer === true;
      const prices = product.variantOptions
        .map((vo: { sellingPrice: string | number; originalSellingPrice?: string | number | null }) => {
          // When offer is not active, prefer originalSellingPrice if available
          if (!hasActiveOffer && vo.originalSellingPrice && vo.originalSellingPrice !== '') {
            const price = typeof vo.originalSellingPrice === 'string' ? parseFloat(vo.originalSellingPrice) : vo.originalSellingPrice;
            return isNaN(price) ? 0 : price;
          }
          const price = typeof vo.sellingPrice === 'string' ? parseFloat(vo.sellingPrice) : vo.sellingPrice;
          return isNaN(price) ? 0 : price;
        })
        .filter(p => p > 0);
      
      if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return { min, max, hasRange: min !== max };
      }
    }
    return { min: 0, max: 0, hasRange: false };
  };

  // Helper function to calculate original price range from variant options
  const getOriginalPriceRange = (): { min: number; max: number; hasRange: boolean } => {
    if ('variantOptions' in product && product.variantOptions && Array.isArray(product.variantOptions)) {
      const originalPrices = product.variantOptions
        .map((vo: { originalSellingPrice?: string | number | null }) => {
          if (!vo.originalSellingPrice || vo.originalSellingPrice === '') return 0;
          const price = typeof vo.originalSellingPrice === 'string' ? parseFloat(vo.originalSellingPrice) : vo.originalSellingPrice;
          return isNaN(price) ? 0 : price;
        })
        .filter(p => p > 0);
      
      if (originalPrices.length > 0) {
        const min = Math.min(...originalPrices);
        const max = Math.max(...originalPrices);
        return { min, max, hasRange: min !== max };
      }
    }
    return { min: 0, max: 0, hasRange: false };
  };

  // Helper functions for price fields with fallbacks
  const getSellingPrice = (): number => {
    const priceRange = getPriceRange();
    if (priceRange.min > 0) {
      return priceRange.min; // Return minimum price for single value display
    }
    
    // If offer is not active, prefer originalSellingPrice if available
    const hasActiveOffer = product.hasActiveOffer === true;
    if (!hasActiveOffer) {
      const originalPrice = getOriginalSellingPrice();
      if (originalPrice > 0) {
        return originalPrice;
      }
    }
    
    const sp = product.sellingPrice;
    const p = (product as EnrichedProduct).price;
    if (sp !== undefined && sp !== null) return safeGetNumber(sp);
    if (p !== undefined && p !== null) return safeGetNumber(p);
    return 0;
  };

  const getOriginalSellingPrice = (): number => {
    // First check variantOptions for original price range
    const originalPriceRange = getOriginalPriceRange();
    if (originalPriceRange.min > 0) {
      return originalPriceRange.min; // Return minimum for single value display
    }
    
    // originalPrice from the API is purchase/cost, not a compare-at price.
    const osp = product.originalSellingPrice;
    if (osp !== undefined && osp !== null) return safeGetNumber(osp);
    return 0;
  };

  // Format original price display (single price or range)
  const formatOriginalPriceDisplay = (): string => {
    const originalPriceRange = getOriginalPriceRange();
    if (originalPriceRange.min > 0) {
      if (originalPriceRange.hasRange) {
        return `${formatCurrency(originalPriceRange.min)} – ${formatCurrency(originalPriceRange.max)}`;
      }
      return formatCurrency(originalPriceRange.min);
    }
    
    // Fallback to single price
    const originalPrice = getOriginalSellingPrice();
    return originalPrice > 0 ? formatCurrency(originalPrice) : '';
  };
  
  // Format price display (single price or range)
  const formatPriceDisplay = (): string => {
    const priceRange = getPriceRange();
    if (priceRange.hasRange) {
      return `${formatCurrency(priceRange.min)} – ${formatCurrency(priceRange.max)}`;
    }
    return formatCurrency(getSellingPrice());
  };

  // Catalog base price for browse surfaces. Offers never change it: client rates
  // only reach the buyer on their PO.
  const formatBasePriceDisplay = (): string => {
    const variantPrices =
      'variantOptions' in product && Array.isArray(product.variantOptions)
        ? product.variantOptions
            .map((vo: { sellingPrice: string | number }) =>
              typeof vo.sellingPrice === 'string' ? parseFloat(vo.sellingPrice) : Number(vo.sellingPrice),
            )
            .filter((price) => Number.isFinite(price) && price > 0)
        : [];
    if (variantPrices.length > 0) {
      const min = Math.min(...variantPrices);
      const max = Math.max(...variantPrices);
      return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
    }
    const selling = safeGetNumber(product.sellingPrice);
    const base = selling > 0 ? selling : safeGetNumber((product as EnrichedProduct).price);
    return base > 0 ? formatCurrency(base) : '';
  };

  const getOfferBadge = (): string | undefined => {
    const badge = product.offerBadge;
    return badge;
  };

  const getHasActiveOffer = (): boolean => {
    const hasOffer = product.hasActiveOffer;
    return hasOffer === true;
  };

  // Card view state
  const [showModal, setShowModal] = useState(false);

  // Get current image for display
  const images = safeGetArray(product.images) as string[];
  const currentImage = images.length > 0 
    ? safeGetString(images[currentImageIndex] || images[0])
    : null;

  // Track product page view once per detail open (not on card tap — that would double-count with navigation).
  const originalPriceForTracking = getOriginalSellingPrice();
  useEffect(() => {
    if (type !== 'full' || !user?.id) return;
    const productId = safeGetString(product.id);
    if (!productId || trackedViewProductIdRef.current === productId) return;
    if (originalPriceForTracking <= 0 && getSellingPrice() <= 0) return; // wait for pricing data to load

    trackedViewProductIdRef.current = productId;
    addViewedProduct(productId, product as MarketplaceProduct);
  }, [product.id, type, user?.id, originalPriceForTracking]);

  // Get related products from the same category using websocket-enabled products from dataStore
  const relatedProducts = React.useMemo(() => {
    const category = safeGetString(product.category);
    if (!category) return [];
    
    const productId = safeGetString(product.id);
    const filtered = products
      .filter(p => p.category === category && p.id !== productId)
      .slice(0, 4);
    
    return filtered;
  }, [products, product.category, product.id]);

  // Handle scroll for image carousel
  const handleImageScroll = (event: { nativeEvent: { contentOffset: { x: number }; layoutMeasurement: { width: number } } }) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const index = Math.round(contentOffset.x / layoutMeasurement.width);
    if (index !== currentImageIndex && index >= 0 && index < images.length) {
      setCurrentImageIndex(index);
    }
  };

  // Use the imported formatCurrency utility


  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return '#059c2d';
      case 'Low Stock':
        return '#F59E0B';
      case 'Out of Stock':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Card view functions
  const nextImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress(product);
    } else {
      // Navigate to product modal instead of opening local modal
      const router = require('expo-router').useRouter();
      router.push({
        pathname: '/product',
        params: { productId: product.id }
      });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleBuyNowPress = () => {
    onBuyNow(product);
  };

  const formatRatingLabel = (rating: number): string => {
    const r = safeGetNumber(rating);
    if (!Number.isFinite(r) || r <= 0) return '0.0';
    return (Math.round(r * 10) / 10).toFixed(1);
  };

  /** Bordered pill: star + numeric rating (product card & PDP header). */
  const renderRatingBadge = (variant: 'card' | 'full') => {
    const label = formatRatingLabel(safeGetNumber(product.rating));
    const isCard = variant === 'card';
    return (
      <View
        style={isCard ? styles.cardRatingBadge : styles.ratingBadge}
        accessibilityLabel={`Rating ${label} out of 5`}
      >
        <Star
          size={isCard ? 11 : 13}
          color="#F59E0B"
          fill="#F59E0B"
        />
        <Text style={isCard ? styles.cardRatingBadgeText : styles.ratingBadgeText}>{label}</Text>
      </View>
    );
  };

  // Card view rendering functions
  const renderCardImageCarousel = () => {
    if (images.length === 0) {
      return (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons name="image-outline" size={40} color="#9CA3AF" />
        </View>
      );
    }

    if (images.length === 1) {
      return <Image source={{ uri: safeGetString(images[0]) }} style={styles.cardProductImage} />;
    }

    const currentImage = safeGetString(images[currentImageIndex] || images[0]);
    
    return (
      <View style={styles.cardCarouselContainer}>
        <Image 
          source={{ uri: currentImage }} 
          style={styles.cardProductImage} 
        />
      </View>
    );
  };

  const renderCardDiscountTag = () => {
    // Show offer badge if available
    const offerBadge = getOfferBadge();
    const hasActiveOffer = getHasActiveOffer();
    const originalPrice = getOriginalSellingPrice();
    const currentPrice = getSellingPrice();
    
    // Calculate discount display based on type
    let discountDisplay = t('product.labels.discount');
    if (product.discountType === 'fixed' && product.discountValue) {
      // Show fixed discount amount
      discountDisplay = `${formatCurrency(product.discountValue)} OFF`;
    } else {
      // Calculate percentage discount if we have both prices
      let discountPercentage = 0;
      if (originalPrice > 0 && currentPrice > 0 && currentPrice < originalPrice) {
        discountPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
      }
      if (discountPercentage > 0) {
        discountDisplay = `${discountPercentage}% OFF`;
      }
    }
    
    if (offerBadge && hasActiveOffer) {
      // Only show DISCOUNT badge here (top-left corner)
      // Promotion badge will be shown in the product info section
      if (offerBadge === 'Discount' || offerBadge === 'All Offers') {
        return (
          <View style={styles.cardDiscountTag}>
            <Text style={styles.cardDiscountTagText}>{discountDisplay}</Text>
          </View>
        );
      }
      // Don't show anything for Promotion-only here
      return null;
    }

    return null;
  };

  const renderCardPromoBadge = () => {
    // Check if product has active promotion offer
    const hasActiveOffer = getHasActiveOffer();
    const offerBadge = getOfferBadge();
    
    if (hasActiveOffer && (offerBadge === 'Promotion' || offerBadge === 'All Offers') && product?.promotionDetails) {
      // Show Buy X Get Y below price instead (info section).
      return null;
    }
    
    // Fallback to original badges logic for other promotions
    const badges = safeGetArray(product.badges);
    if (badges.length === 0) return null;
    
    return (
      <View style={styles.cardPromoBadge}>
        <Text style={styles.cardPromoBadgeText}>9.9</Text>
        <View style={styles.cardPromoTextContainer}>
          {badges.map((badge, index) => (
            <Text key={index} style={styles.cardPromoText}>
              {safeGetString(badge).toUpperCase()}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderCardPreferredTag = () => {
    if (!Boolean(product.isPreferred)) return null;
    
    return (
      <View style={styles.cardPreferredTag}>
        <Text style={styles.cardPreferredText}>{t('product.badges.preferred')}</Text>
      </View>
    );
  };

  const renderCardView = () => {
    const formatDeliveryTime = (): string | null => {
      // Some call sites provide a narrower `shipping` shape; guard via an unknown-safe shape.
      const shipping = product.shipping as unknown as { leadTimeMinDays?: unknown; leadTimeMaxDays?: unknown } | null | undefined;
      const min = safeGetNumber(shipping?.leadTimeMinDays);
      const max = safeGetNumber(shipping?.leadTimeMaxDays);
      if (min > 0 && max > 0) return min === max ? t('product.shipping.days', { count: min }) : t('product.shipping.daysRange', { min, max });
      if (min > 0) return t('product.shipping.daysPlus', { min });
      const infoDays = safeGetString(product.shippingInfo?.days, '').trim();
      return infoDays ? infoDays : null;
    };

    const deliveryTimeLabel = formatDeliveryTime();
    const deliveryTimeDisplay = deliveryTimeLabel || t('product.labels.notProvided');
    const basePriceLabel = formatBasePriceDisplay();
    const showBuyXGetY =
      getHasActiveOffer() &&
      (getOfferBadge() === 'Promotion' || getOfferBadge() === 'All Offers') &&
      Boolean(product?.promotionDetails);

    return (
      <>
        <TouchableOpacity
          style={[styles.card, { backgroundColor }]}
          onPress={handleCardPress}
          activeOpacity={0.8}
        >
            {/* Image Container */}
          <View style={styles.cardImageContainer}>
            {renderCardImageCarousel()}

            {/* Promo Badge */}
            {renderCardPromoBadge()}
            
            {/* Preferred Tag */}
            {renderCardPreferredTag()}
          </View>

          {/* Product Info */}
          <View style={styles.cardProductInfo}>
            {/* Product Name */}
            <Text
              style={[styles.cardProductName, { color: textColor }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {safeGetString(product.name, t('product.labels.unknownProduct'))}
            </Text>

            {basePriceLabel ? (
              <View style={styles.cardPriceContainer}>
                <Text style={[styles.cardPrice, styles.basePriceText]} numberOfLines={1}>
                  {basePriceLabel}
                </Text>
              </View>
            ) : null}

            {/* Promotion pill (Buy X Get Y) */}
            {showBuyXGetY && product?.promotionDetails ? (
              <View style={styles.cardPromotionInline}>
                <Gift size={10} color="#9333EA" />
                <Text style={styles.cardPromotionInlineText} numberOfLines={1} ellipsizeMode="tail">
                  {t('product.promo.buyXGetY', {
                    buy: product.promotionDetails.minQuantity,
                    free: product.promotionDetails.freeQuantity,
                  })}
                </Text>
              </View>
            ) : null}

            {/* Sold + rating (no stock status on card) */}
            <View style={styles.cardStockRow}>
              <View style={styles.cardRatingInline}>{renderRatingBadge('card')}</View>
              <Text style={styles.cardStockPipe}> • </Text>
              <Text style={styles.cardSoldInline}>
                {t('product.soldLabel', { count: safeGetString(product.soldCount, '0') })}
              </Text>
            </View>

            {/* Shipping Info */}
            <View style={styles.cardShippingInfo}>
              <Truck size={12} color={deliveryTimeLabel ? '#10b981' : '#9CA3AF'} />
              <Text style={[styles.cardShippingTime, !deliveryTimeLabel && styles.cardShippingNotProvided]}>
                {deliveryTimeDisplay}
              </Text>
              <Text style={styles.cardShippingDot}>•</Text>
              <MapPin size={12} color="#9CA3AF" />
              <Text style={[styles.cardShippingLocation, !safeGetString(product.shippingInfo?.location, '').trim() && styles.cardShippingNotProvided]}>
                {safeGetString(product.shippingInfo?.location, '').trim() || t('product.labels.notProvided')}
              </Text>
            </View>

          </View>
        </TouchableOpacity>

        {/* Product Marketplace Modal - Now handled by navigation */}
      </>
    );
  };

  const renderImageCarousel = () => {
    return (
      <View style={styles.imageContainer}>
        
        {/* Back Button Overlay - Only show if showBackButton is true */}
        {showBackButton && onBackPress && (
          <TouchableOpacity style={styles.backButtonOverlay} onPress={onBackPress}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
        )}
        
        {/* Action Buttons */}
          <View style={styles.imageActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleFavorite(product.id)}
          >
            <Heart
              fill={likedProducts.includes(safeGetString(product.id)) ? '#EF4444' : 'none'}
              size={24}
              color={likedProducts.includes(safeGetString(product.id)) ? '#EF4444' : '#374151'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onAddToCart(product, 1);
              router.push('/cart');
            }}
          >
            <View style={{ position: 'relative' }}>
              <ShoppingCart size={24} color="#374151" />
              <CartBadge size={16} color="#ffffff" backgroundColor="#EF4444" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={onShare}>
            <Share2 size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        
        {/* Product Image Carousel with ScrollView */}
        {images.length > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
            style={styles.imageScrollView}
          >
            {images.map((image, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.imageSlide}
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: safeGetString(image) }} style={styles.productImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity 
            style={styles.imageTouchArea}
            onPress={() => setShowImageModal(true)}
            activeOpacity={0.9}
          >
            {currentImage ? (
              <Image source={{ uri: currentImage }} style={styles.productImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImageIcon size={60} color="#9CA3AF" />
                <Text style={styles.noImageText}>{t('buyNow.labels.noImage')}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Image Counter - Show current/total */}
        {images.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1}/{images.length}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderProductInfo = () => (
    <View style={styles.section}>
      {/* Product Name & Badge */}
      <View style={styles.productHeader}>
        <Text style={[styles.productName, { color: textColor }]}>
          {safeGetString(product.name, t('product.labels.unknownProduct'))}
        </Text>
        <View style={styles.bestSellerBadge}>
          <Text style={styles.badgeText}>{t('product.badges.bestSeller')}</Text>
        </View>
      </View>

      {/* Rating badge */}
      <View style={styles.ratingContainer}>
        {renderRatingBadge('full')}
        <Text style={styles.reviewCount}>
          ({safeGetNumber(product.reviewCount)} {t('product.reviews.reviews')})
        </Text>
      </View>

      <View style={styles.pricingContainer}>
        {formatBasePriceDisplay() ? (
          <Text style={[styles.currentPrice, styles.basePriceText]}>{formatBasePriceDisplay()}</Text>
        ) : null}
        <Text style={styles.pricingConfirmedNote}>
          {t('product.pricingConfirmedBy', {
            distributor: safeGetString(product.seller?.name, t('product.labels.unknownCompany')),
          })}
        </Text>
        <Text style={styles.shippingNote}>{t('product.shipping.costNote')}</Text>
      </View>

      {/* Stock status + sold */}
      <View style={styles.stockContainer}>
        <Text style={styles.stockLabel}>{t('product.stockLabel')}</Text>
        <View style={styles.stockRightRow}>
          <Text
            style={[
              styles.stockStatus,
              { color: getStockStatusColor(safeGetString(product.stockStatus, 'In Stock')) },
            ]}
          >
            {(() => {
              const raw = safeGetString(product.stockStatus, 'In Stock');
              if (raw === 'Out of Stock') return t('product.stock.outOfStock');
              if (raw === 'Low Stock') return t('product.stock.lowStock');
              if (raw === 'In Stock') return t('product.stock.inStock');
              return raw;
            })()}
          </Text>
          <Text style={styles.stockPipe}> | </Text>
          <Text style={styles.stockSoldInline}>
            {t('product.soldLabel', { count: safeGetString(product.soldCount, '0') })}
          </Text>
        </View>
      </View>

    </View>
  );

  const renderSellerInfo = () => {
    const sellerCompany = 'company' in (product.seller || {}) ? (product.seller as { company?: { logo?: string } })?.company : undefined;
    const companyLogo = normalizeUrl(sellerCompany?.logo);
    const sellerId = (product as { userId?: number }).userId;
    const canOpenSellerInfo = typeof sellerId === 'number' && sellerId > 0;

    const content = (
      <>
        <Text style={[styles.sectionTitle, { color: textColor }]}>{t('product.sellerInformation')}</Text>
        <View style={styles.sellerHeader}>
          <View style={styles.sellerAvatar}>
            {companyLogo ? (
              <Image source={{ uri: companyLogo }} style={styles.sellerAvatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {safeGetString(product.seller?.name, 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.sellerInfo}>
            <View style={styles.sellerNameRow}>
              <Text style={[styles.sellerName, { color: textColor }]}>
                {safeGetString(product.seller?.name, t('product.labels.unknownCompany'))}
              </Text>
              {Boolean(product.seller?.isOfficial) && (
                <View style={styles.officialBadge}>
                  <Text style={styles.officialText}>{t('product.badges.officialStore')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </>
    );

    if (canOpenSellerInfo) {
      return (
        <TouchableOpacity
          style={[styles.section, styles.sellerSection]}
          onPress={() => {
            router.push({
              pathname: '/useraccounts/buyernetworks/distributor-information',
              params: { id: String(sellerId), name: safeGetString(product.seller?.name, 'Distributor') },
            });
          }}
          activeOpacity={0.8}
          accessibilityLabel={t('product.a11y.openDistributorProducts')}
          accessibilityRole="button"
        >
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.section, styles.sellerSection]}>
        {content}
      </View>
    );
  };

  const renderYouMayAlsoLike = () => {
    if (relatedProducts.length === 0) {
      return null; // Don't show section if no related products
    }

    return (
      <View style={[styles.section, styles.youMayAlsoLikeSection]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {t('product.youMayAlsoLike')}
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: '#6B7280' }]}>
          {t('product.moreInCategory', {
            category: (() => {
              const raw = safeGetString(product.category);
              return raw ? translateProductType(raw) : t('product.labels.general');
            })(),
          })}
        </Text>
        
        {/* Product Grid Layout like home.tsx */}
        <View style={styles.relatedProductsGrid}>
          <View style={styles.leftColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 0).map((relatedProduct) => (
              <View key={relatedProduct.id} style={styles.relatedProductItem}>
                <ProductMarketplace
                  product={relatedProduct}
                  onPress={() => {
                    // Navigate to the product modal
                    router.push({
                      pathname: '/product',
                      params: { productId: relatedProduct.id }
                    });
                  }}
                  onAddToCart={onAddToCart}
                  onBuyNow={onBuyNow}
                  onChatSeller={onChatSeller}
                  onShare={onShare}
                  onToggleFavorite={onToggleFavorite}
                  isFavorite={likedProducts.includes(relatedProduct.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
          <View style={styles.rightColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 1).map((relatedProduct) => (
              <View key={relatedProduct.id} style={styles.relatedProductItem}>
                <ProductMarketplace
                  product={relatedProduct}
                  onPress={() => {
                    // Navigate to the product modal
                    router.push({
                      pathname: '/product',
                      params: { productId: relatedProduct.id }
                    });
                  }}
                  onAddToCart={onAddToCart}
                  onBuyNow={onBuyNow}
                  onChatSeller={onChatSeller}
                  onShare={onShare}
                  onToggleFavorite={onToggleFavorite}
                  isFavorite={likedProducts.includes(relatedProduct.id)}
                  type="card"
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderProductDetails = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {t('product.details.title')}
      </Text>
      
      <View style={styles.detailsList}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('product.details.brand')}</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {safeGetString(product.brand, t('product.labels.unknown'))}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('product.details.type')}</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {(() => {
              const raw = safeGetString(product.category);
              return raw ? translateProductType(raw) : t('product.labels.general');
            })()}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('product.details.category')}</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {safeGetString(product.productCategory, t('product.labels.unknown'))}
          </Text>
        </View>
      </View>

      <View style={styles.descriptionContainer}>
        <Text style={[styles.descriptionTitle, { color: textColor }]}>
          {t('product.sections.description')}
        </Text>
        <Text style={[styles.description, { color: textColor }]}>
          {safeGetString(product.description, t('product.labels.noDescription'))}
        </Text>
      </View>
    </View>
  );

  const renderAssurance = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {t('product.sections.productAssurance')}
      </Text>
      
      <View style={styles.assuranceGrid}>
        {Boolean(product.assurance?.halalCertified) && (
          <View style={[styles.assuranceItem, styles.halalAssurance]}>
            <Ionicons name="checkmark-circle" size={16} color="#059c2d" />
            <Text style={styles.assuranceText}>{t('product.assurance.halalCertified')}</Text>
          </View>
        )}
        {Boolean(product.assurance?.bpomApproved) && (
          <View style={[styles.assuranceItem, styles.bpomAssurance]}>
            <Ionicons name="shield-checkmark" size={16} color="#3B82F6" />
            <Text style={styles.assuranceText}>{t('product.assurance.bpomApproved')}</Text>
          </View>
        )}
        <View style={[styles.assuranceItem, styles.returnAssurance]}>
          <Ionicons name="lock-closed" size={16} color="#8B5CF6" />
          <Text style={styles.assuranceText}>
            {t('product.assurance.returnDays', { count: safeGetNumber(product.assurance?.returnPolicyDays, 7) })}
          </Text>
        </View>
        {Boolean(product.assurance?.originalProduct) && (
          <View style={[styles.assuranceItem, styles.originalAssurance]}>
            <Ionicons name="cube" size={16} color="#F59E0B" />
            <Text style={styles.assuranceText}>{t('product.assurance.originalProduct')}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={styles.chatButton}
        onPress={onChatSeller}
      >
        <Ionicons name="chatbubble-outline" size={20} color="#111827" />
        <Text style={styles.chatText}>{t('product.actions.chatNow')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.addToCartButton, { backgroundColor: primaryColor }]}
        onPress={() => setShowAddToCartModal(true)}
      >
        <Ionicons name="cart-outline" size={20} color="white" />
        <Text style={styles.addToCartText}>{t('product.actions.addToCart')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.buyNowButton, { backgroundColor: '#059c2d' }]}
        onPress={handleBuyNowPress}
      >
        <Text style={styles.buyNowText}>
          {t('product.actions.buyNow')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Return card view if type is 'card'
  if (type === 'card') {
    return renderCardView();
  }

  // Return full view (default)
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView style={styles.scrollContent}>
        {renderImageCarousel()}
        {renderProductInfo()}
        {renderProductDetails()}
        {renderAssurance()}
        {renderSellerInfo()}
        {renderYouMayAlsoLike()}
      </ScrollView>
      
      {/* Sticky Action Buttons */}
      <View style={styles.stickyActionButtons}>
        {renderActionButtons()}
      </View>
      
      {/* Product Image Modal */}
      <ProductImageModal
        visible={showImageModal}
        images={images}
        onClose={() => setShowImageModal(false)}
        initialIndex={currentImageIndex}
      />
      
      {/* Add to Cart Modal */}
      <BuyNowModal
        visible={showAddToCartModal}
        product={product}
        onClose={() => setShowAddToCartModal(false)}
        onConfirm={(product, quantity) => {
          onAddToCart(product, quantity);
          setShowAddToCartModal(false);
        }}
        mode="cart"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Card view styles
  card: {
    width: cardWidth,
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardImageContainer: {
    position: 'relative',
    height: 140,
    backgroundColor: '#F9FAFB',
  },
  cardProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  cardCarouselContainer: {
    position: 'relative',
    width: '100%',
  },
  cardCarouselArrowLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: [{ translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCarouselArrowRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  cardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardMultiBadgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  cardDiscountTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  cardDiscountTagText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBrandTagText: {
    color: '#DC2626',
    fontSize: 8,
    fontWeight: '600',
  },
  cardFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPromoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#EF4444',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardPromoBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardPromoTextContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  cardPromoText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '600',
  },
  cardPreferredTag: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: [{ translateX: -25 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardPreferredText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  cardProductInfo: {
    padding: 8,
  },
  cardProductName: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 4,
  },
  cardRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardRatingInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    marginBottom: 4,
  },
  cardRatingBadgeText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  cardPriceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  basePriceText: {
    color: '#0a61d7',
  },
  cardOriginalPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cardStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  cardStockPipe: {
    fontSize: 12,
    color: '#D1D5DB',
    fontWeight: '400',
  },
  cardSoldInline: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardPromotionBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardPromotionBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    zIndex: 10,
  },
  cardPromotionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3E8FF',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  cardPromotionInlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9333EA',
    flexShrink: 1,
  },
  cardPromotionBadgeText: {
    color: '#9333EA',
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardShippingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  cardShippingLocation: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  cardShippingDot: {
    fontSize: 11,
    color: '#D1D5DB',
    fontWeight: '600',
  },
  cardShippingNotProvided: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  cardShippingTime: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  cardAddToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cardAddToCartText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Full view styles
  container: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flex: 1,
    marginBottom: 60, // Add padding to prevent content from being hidden behind sticky buttons
  },
  stickyActionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 8, // Reduced padding for safe area
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  imageContainer: {
    position: 'relative',
    height: 320,
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    height: 320,
  },
  productImage: {
    width: '100%',
    height: 320,
    resizeMode: 'cover',
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 4,
  },
  imageActions: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'column',
    zIndex: 3,
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  imageScrollView: {
    flex: 1,
    width: '100%',
  },
  imageSlide: {
    width: screenWidth,
    height: 250,
  },
  imageTouchArea: {
    flex: 1,
    width: '100%',
  },
  noImageText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  youMayAlsoLikeSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  sellerSection: {
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  bestSellerBadge: {
    backgroundColor: '#059c2d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  ratingBadgeText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  pricingContainer: {
    marginBottom: 12,
  },
  pricingConfirmedNote: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  priceColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  currentPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  originalPrice: {
    fontSize: 16,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: 'bold',
  },
  shippingNote: {
    fontSize: 12,
    color: '#6B7280',
  },
  stockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  stockLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  stockStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  stockPipe: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  stockSoldInline: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sellerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  officialBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  officialText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerRatingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  sellerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  shippingOptions: {
    gap: 8,
  },
  shippingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  standardShipping: {
    backgroundColor: '#ECFDF5',
  },
  expressShipping: {
    backgroundColor: '#EFF6FF',
  },
  sameDayShipping: {
    backgroundColor: '#F3E8FF',
  },
  shippingIcon: {
    marginRight: 8,
  },
  shippingName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  shippingPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailsList: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ratingBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  overallRating: {
    alignItems: 'center',
  },
  overallRatingNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  totalReviews: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  ratingBars: {
    flex: 1,
    gap: 4,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 24,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#FCD34D',
  },
  barCount: {
    fontSize: 12,
    color: '#6B7280',
    width: 24,
    textAlign: 'right',
  },
  sampleReview: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  reviewerAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerAvatarText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  reviewContent: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 12,
    color: '#6B7280',
  },
  reviewDate: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 18,
  },
  reviewImagesScroll: {
    marginTop: 8,
  },
  reviewImagesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  reviewImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  noReviewsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noReviewsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  submitReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitReviewText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  assuranceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  assuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    flex: 1,
    minWidth: '45%',
  },
  halalAssurance: {
    backgroundColor: '#ECFDF5',
  },
  bpomAssurance: {
    backgroundColor: '#EFF6FF',
  },
  returnAssurance: {
    backgroundColor: '#F3E8FF',
  },
  originalAssurance: {
    backgroundColor: '#FFFBEB',
  },
  assuranceText: {
    fontSize: 12,
    color: '#374151',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    backgroundColor: '#F3F4F6', // Gray background
    borderRadius: 8,
  },
  chatText: {
    color: '#111827', // Black text
    fontSize: 11,
    fontWeight: '600',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addToCartText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  buyNowButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 8,
  },
  buyNowText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  relatedProductsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  relatedProductItem: {
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40, // Same width as close button to center the title
  },
});
