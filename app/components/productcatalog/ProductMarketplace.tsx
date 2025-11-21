import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Heart, ImageIcon, Share2, X, ArrowLeft, ShoppingCart, Gift } from 'lucide-react-native';
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
      const prices = product.variantOptions
        .map((vo: { sellingPrice: string | number }) => {
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
    
    // Fallback to product-level fields
    const osp = product.originalSellingPrice;
    const op = (product as EnrichedProduct).originalPrice;
    if (osp !== undefined && osp !== null) return safeGetNumber(osp);
    if (op !== undefined && op !== null) return safeGetNumber(op);
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

  // Track viewed product when component mounts (for full view only)
  useEffect(() => {
    if (type === 'full' && user?.id) {
      // Only track if it's a MarketplaceProduct (has all required fields)
      if ('originalPrice' in product && typeof product.originalPrice === 'number') {
        addViewedProduct(safeGetString(product.id), product as MarketplaceProduct);
      }
    }
  }, [product.id, type, addViewedProduct, product, user?.id]);

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
    // Track viewed product when user clicks on it
    if (user?.id && 'originalPrice' in product && typeof product.originalPrice === 'number') {
      addViewedProduct(safeGetString(product.id), product as MarketplaceProduct);
    }
    
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

  const renderStars = (rating: number, size: number = 16) => {
    const safeRating = safeGetNumber(rating);
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= safeRating ? 'star' : 'star-outline'}
          size={size}
          color="#FCD34D"
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
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
        
        {/* Dots indicator only - no navigation arrows */}
        <View style={styles.cardDotsContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.cardDot,
                { backgroundColor: index === currentImageIndex ? 'white' : 'rgba(255,255,255,0.5)' }
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderCardDiscountTag = () => {
    // Show offer badge if available, otherwise show percentage discount
    const offerBadge = getOfferBadge();
    const discount = safeGetNumber(product.discount);
    const hasActiveOffer = getHasActiveOffer();
    const originalPrice = getOriginalSellingPrice();
    const currentPrice = getSellingPrice();
    
    // Calculate discount display based on type
    let discountDisplay = 'Discount';
    if (product.discountType === 'fixed' && product.discountValue) {
      // Show fixed discount amount
      discountDisplay = `Rp${product.discountValue.toLocaleString()} OFF`;
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
          <View style={[styles.cardDiscountTag, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.cardDiscountTagText, { color: '#DC2626' }]}>
              {discountDisplay}
            </Text>
          </View>
        );
      }
      // Don't show anything for Promotion-only here
      return null;
    } else if (discount > 0) {
      // Fallback to percentage discount
      return (
        <View style={styles.cardDiscountTag}>
          <Text style={styles.cardDiscountTagText}>-{discount}%</Text>
          {safeGetString(product.brand) && (
            <Text style={styles.cardBrandTagText}>{safeGetString(product.brand)}</Text>
          )}
        </View>
      );
    }
    
    return null;
  };

  const renderCardPromoBadge = () => {
    // Check if product has active promotion offer
    const hasActiveOffer = getHasActiveOffer();
    const offerBadge = getOfferBadge();
    
    if (hasActiveOffer && (offerBadge === 'Promotion' || offerBadge === 'All Offers') && product?.promotionDetails) {
      return (
        <View style={[styles.cardPromotionBadge, styles.cardPromotionBadgeOverlay]}>
          <Gift size={10} color="#9333EA" />
          <Text style={styles.cardPromotionBadgeText}>
            Buy {product.promotionDetails.minQuantity} Get {product.promotionDetails.freeQuantity}
          </Text>
        </View>
      );
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
        <Text style={styles.cardPreferredText}>Preferred</Text>
      </View>
    );
  };

  const renderCardView = () => {
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
            
            {/* Discount Tag */}
            {renderCardDiscountTag()}
            
            {/* Favorite Button */}
            {onToggleFavorite && (
              <TouchableOpacity
                style={styles.cardFavoriteButton}
                onPress={() => onToggleFavorite(product.id)}
              >
                <Ionicons
                  name={likedProducts.includes(safeGetString(product.id)) ? 'heart' : 'heart-outline'}
                  size={16}
                  color={likedProducts.includes(safeGetString(product.id)) ? '#EF4444' : '#9CA3AF'}
                />
              </TouchableOpacity>
            )}
            
            {/* Promo Badge */}
            {renderCardPromoBadge()}
            
            {/* Preferred Tag */}
            {renderCardPreferredTag()}
          </View>

          {/* Product Info */}
          <View style={styles.cardProductInfo}>
            {/* Product Name */}
            <Text style={[styles.cardProductName, { color: textColor }]} numberOfLines={2}>
              {safeGetString(product.name, 'Unknown Product')}
            </Text>

            {/* Rating */}
            <View style={styles.cardRatingContainer}>
              {renderStars(safeGetNumber(product.rating), 12)}
              <Text style={styles.cardRatingText}>{safeGetNumber(product.rating)}</Text>
            </View>

            {/* Price */}
            <View style={styles.cardPriceContainer}>
              {/* Only show strikethrough if there's a DISCOUNT (not just promotion) */}
              {getHasActiveOffer() && getOriginalSellingPrice() > 0 && getOfferBadge() !== 'Promotion' && (
                <Text style={styles.cardOriginalPrice}>
                  {formatOriginalPriceDisplay()}
                </Text>
              )}
              <Text style={[styles.cardPrice, { color: primaryColor }]}>
                {formatPriceDisplay()}
              </Text>
            </View>

            {/* Sales Info */}
            <Text style={styles.cardSalesInfo}>{safeGetString(product.soldCount, '0')} sold</Text>

            {/* Stock Status */}
            <View style={styles.cardStockRow}>
              <Text
                style={[
                  styles.cardStockStatus,
                  { color: getStockStatusColor(safeGetString(product.stockStatus, 'In Stock')) },
                ]}
              >
                {safeGetString(product.stockStatus, 'In Stock')}
              </Text>
            </View>

            {/* Shipping Info */}
            {product.shippingInfo && (
              <View style={styles.cardShippingInfo}>
                <Text style={styles.cardShippingLocation}>{product.shippingInfo.location}</Text>
              </View>
            )}

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
                <Text style={styles.noImageText}>No Image Available</Text>
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
          {safeGetString(product.name, 'Unknown Product')}
        </Text>
        <View style={styles.bestSellerBadge}>
          <Text style={styles.badgeText}>BEST SELLER</Text>
        </View>
      </View>

      {/* Rating & Sales */}
      <View style={styles.ratingContainer}>
        <View style={styles.ratingInfo}>
          {renderStars(safeGetNumber(product.rating), 16)}
          <Text style={[styles.ratingText, { color: textColor }]}>
            {safeGetNumber(product.rating)}
          </Text>
        </View>
        <Text style={styles.reviewCount}>({safeGetNumber(product.reviewCount)} reviews)</Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.soldCount}>Sold {safeGetString(product.soldCount, '0')}</Text>
      </View>

      {/* Pricing */}
      <View style={styles.pricingContainer}>
        <View style={styles.priceRow}>
          <View style={styles.priceColumn}>
            {/* Only show strikethrough if there's a DISCOUNT (not just promotion) */}
            {getHasActiveOffer() && getOriginalSellingPrice() > 0 && getOfferBadge() !== 'Promotion' && (
              <Text style={styles.originalPrice}>
                {formatOriginalPriceDisplay()}
              </Text>
            )}
            <View style={styles.currentPriceRow}>
              <Text style={[styles.currentPrice, { color: primaryColor }]}>
                {formatPriceDisplay()}
              </Text>
              {/* Show offer badge - aligned with current price */}
              {getHasActiveOffer() && getOfferBadge() && (() => {
            const originalPrice = getOriginalSellingPrice();
            const currentPrice = getSellingPrice();
            
            // Calculate discount display based on type
            let discountDisplay = 'Discount';
            if (product.discountType === 'fixed' && product.discountValue) {
              // Show fixed discount amount
              discountDisplay = `Rp${product.discountValue.toLocaleString()} OFF`;
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
            
            if (getOfferBadge() === 'All Offers') {
              // Show both badges
              return (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={[styles.discountBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.discountText, { color: '#DC2626' }]}>
                      {discountDisplay}
                    </Text>
                  </View>
                  <View style={[styles.discountBadge, { backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Gift size={10} color="#9333EA" />
                    <Text style={[styles.discountText, { color: '#9333EA' }]}>
                      {product?.promotionDetails 
                        ? `Buy ${product.promotionDetails.minQuantity} Get ${product.promotionDetails.freeQuantity}`
                        : 'Promotion'}
                    </Text>
                  </View>
                </View>
              );
            }
            
            return (
              <View style={[styles.discountBadge, { 
                backgroundColor: getOfferBadge() === 'Discount' ? '#FEE2E2' :
                                getOfferBadge() === 'Promotion' ? '#F3E8FF' : '#DBEAFE',
                flexDirection: 'row',
                alignItems: 'center',
                gap: getOfferBadge() === 'Promotion' ? 4 : 0
              }]}>
                {getOfferBadge() === 'Promotion' && <Gift size={10} color="#9333EA" />}
                <Text style={[styles.discountText, { 
                  color: getOfferBadge() === 'Discount' ? '#DC2626' :
                         getOfferBadge() === 'Promotion' ? '#9333EA' : '#2563EB'
                }]}>
                  {getOfferBadge() === 'Discount' 
                    ? discountDisplay
                    : getOfferBadge() === 'Promotion' && product?.promotionDetails
                      ? `Buy ${product.promotionDetails.minQuantity} Get ${product.promotionDetails.freeQuantity}`
                      : getOfferBadge()}
                </Text>
              </View>
            );
          })()}
            </View>
          </View>
        </View>
        <Text style={styles.shippingNote}>
          Free shipping for orders above {formatCurrency(500000)}
        </Text>
      </View>

      {/* Stock Status */}
      <View style={styles.stockContainer}>
        <Text style={styles.stockLabel}>Stock status:</Text>
        <Text
          style={[
            styles.stockStatus,
            { color: getStockStatusColor(safeGetString(product.stockStatus, 'In Stock')) },
          ]}
        >
          {safeGetString(product.stockStatus, 'In Stock')}
        </Text>
      </View>

    </View>
  );

  const renderSellerInfo = () => {
    const sellerCompany = 'company' in (product.seller || {}) ? (product.seller as { company?: { logo?: string } })?.company : undefined;
    const companyLogo = normalizeUrl(sellerCompany?.logo);
    
    return (
      <View style={[styles.section, styles.sellerSection]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Seller Information
        </Text>
        
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
                {safeGetString(product.seller?.name, 'Unknown Company')}
              </Text>
              {Boolean(product.seller?.isOfficial) && (
                <View style={styles.officialBadge}>
                  <Text style={styles.officialText}>OFFICIAL STORE</Text>
                </View>
              )}
            </View>
            <View style={styles.sellerRating}>
              {renderStars(safeGetNumber(product.seller?.rating), 12)}
              <Text style={styles.sellerRatingText}>
                {safeGetNumber(product.seller?.rating)} ({safeGetNumber(product.seller?.reviewCount)}+ ratings)
              </Text>
            </View>
          </View>
        </View>
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
            You may also like
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: '#6B7280' }]}>
          More products in {safeGetString(product.category, 'General')}
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
        Product Details
      </Text>
      
      <View style={styles.detailsList}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Brand:</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {safeGetString(product.brand, 'Unknown')}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {safeGetString(product.category, 'General')}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Category:</Text>
          <Text style={[styles.detailValue, { color: textColor }]}>
            {safeGetString(product.productCategory, 'Piece')}
          </Text>
        </View>
      </View>

      <View style={styles.descriptionContainer}>
        <Text style={[styles.descriptionTitle, { color: textColor }]}>
          Description
        </Text>
        <Text style={[styles.description, { color: textColor }]}>
          {safeGetString(product.description, 'No description available')}
        </Text>
      </View>
    </View>
  );

  const renderReviews = () => (
    <View style={styles.section}>
      <View style={styles.reviewsHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Customer Reviews
        </Text>
        {safeGetNumber(product.reviews?.totalReviews) > 0 && (
          <TouchableOpacity>
            <Text style={[styles.viewAllText, { color: primaryColor }]}>
              View All ({safeGetNumber(product.reviews?.totalReviews)})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {safeGetNumber(product.reviews?.totalReviews) === 0 ? (
        <View style={styles.noReviewsContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
          <Text style={[styles.noReviewsTitle, { color: textColor }]}>
            No Reviews Yet
          </Text>
          <Text style={styles.noReviewsSubtitle}>
            Be the first to review this product!
          </Text>
          <TouchableOpacity style={[styles.submitReviewButton, { backgroundColor: primaryColor }]}>
            <Ionicons name="star-outline" size={16} color="white" />
            <Text style={styles.submitReviewText}>Submit Review</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.ratingBreakdown}>
            <View style={styles.overallRating}>
              <Text style={[styles.overallRatingNumber, { color: textColor }]}>
                {safeGetNumber(product.reviews?.overallRating)}
              </Text>
              {renderStars(safeGetNumber(product.reviews?.overallRating), 16)}
              <Text style={styles.totalReviews}>
                {safeGetNumber(product.reviews?.totalReviews)} reviews
              </Text>
            </View>
            
            <View style={styles.ratingBars}>
              {[5, 4, 3, 2, 1].map((rating) => (
                <View key={rating} style={styles.ratingBar}>
                  <Text style={styles.ratingLabel}>{rating}⭐</Text>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${safeGetNumber(product.reviews?.totalReviews) > 0 ? (safeGetNumber(product.reviews?.breakdown?.[rating]) / safeGetNumber(product.reviews?.totalReviews, 1)) * 100 : 0}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>
                    {safeGetNumber(product.reviews?.breakdown?.[rating])}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {product.reviews?.sampleReview && (
            <View style={styles.sampleReview}>
              <View style={styles.reviewerAvatar}>
                <Text style={styles.reviewerAvatarText}>
                  {safeGetString(product.reviews.sampleReview.user, 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.reviewContent}>
                <View style={styles.reviewHeader}>
                  {renderStars(safeGetNumber(product.reviews.sampleReview.rating), 12)}
                  <Text style={styles.reviewerName}>
                    {safeGetString(product.reviews.sampleReview.user, 'Anonymous')}
                  </Text>
                  <Text style={styles.reviewDate}>
                    {safeGetString(product.reviews.sampleReview.date, 'Recently')}
                  </Text>
                </View>
                <Text style={[styles.reviewComment, { color: textColor }]}>
                  "{safeGetString(product.reviews.sampleReview.comment, 'No comment')}"
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderAssurance = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Product Assurance
      </Text>
      
      <View style={styles.assuranceGrid}>
        {Boolean(product.assurance?.halalCertified) && (
          <View style={[styles.assuranceItem, styles.halalAssurance]}>
            <Ionicons name="checkmark-circle" size={16} color="#059c2d" />
            <Text style={styles.assuranceText}>Halal Certified</Text>
          </View>
        )}
        {Boolean(product.assurance?.bpomApproved) && (
          <View style={[styles.assuranceItem, styles.bpomAssurance]}>
            <Ionicons name="shield-checkmark" size={16} color="#3B82F6" />
            <Text style={styles.assuranceText}>BPOM Approved</Text>
          </View>
        )}
        <View style={[styles.assuranceItem, styles.returnAssurance]}>
          <Ionicons name="lock-closed" size={16} color="#8B5CF6" />
          <Text style={styles.assuranceText}>
            {safeGetNumber(product.assurance?.returnPolicyDays, 7)}-Day Return
          </Text>
        </View>
        {Boolean(product.assurance?.originalProduct) && (
          <View style={[styles.assuranceItem, styles.originalAssurance]}>
            <Ionicons name="cube" size={16} color="#F59E0B" />
            <Text style={styles.assuranceText}>Original Product</Text>
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
        <Text style={styles.chatText}>Chat Now</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.addToCartButton, { backgroundColor: primaryColor }]}
        onPress={() => setShowAddToCartModal(true)}
      >
        <Ionicons name="cart-outline" size={20} color="white" />
        <Text style={styles.addToCartText}>Add to Cart</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.buyNowButton, { backgroundColor: '#059c2d' }]}
        onPress={handleBuyNowPress}
      >
        <Text style={styles.buyNowText}>
          Buy Now
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
        {renderReviews()}
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
    borderRadius: 8,
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
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  cardDiscountTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBrandTagText: {
    color: 'white',
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
    gap: 4,
    marginBottom: 4,
  },
  cardRatingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardPriceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardOriginalPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cardSalesInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  cardStockStatus: {
    fontSize: 12,
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
  cardPromotionBadgeText: {
    color: '#9333EA',
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardShippingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardShippingLocation: {
    fontSize: 11,
    color: '#9CA3AF',
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
    gap: 8,
    marginBottom: 12,
  },
  ratingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  separator: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  soldCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  pricingContainer: {
    marginBottom: 12,
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
  },
  stockLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockStatus: {
    fontSize: 14,
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
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  noReviewsTitle: {
    fontSize: 18,
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
