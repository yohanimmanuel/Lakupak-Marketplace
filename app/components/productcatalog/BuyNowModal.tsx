import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Minus, Plus, Package } from 'lucide-react-native';
import { Product } from '../../../data/sampleProducts';
import { MarketplaceProduct } from '../../../services/marketplace';
import { useCartStore } from '../../../stores/cartStore';
import { formatCurrency } from '../../../utils/currencyUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

interface BuyNowModalProps {
  visible: boolean;
  product: ProductType | null;
  onClose: () => void;
  onConfirm: (product: ProductType, quantity: number) => void;
  mode?: 'buy' | 'cart';
}

export default function BuyNowModal({
  visible,
  product,
  onClose,
  onConfirm,
  mode = 'buy',
}: BuyNowModalProps) {
  const { addItem } = useCartStore();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [isClosing, setIsClosing] = useState(false);

  // Safe value getters
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

  // Close handler with animation
  const handleClose = () => {
    if (isClosing) return; // Prevent multiple close calls
    
    setIsClosing(true);
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsClosing(false);
      onClose();
    });
  };

  // Animation handlers
  React.useEffect(() => {
    if (visible) {
      // Reset quantity and animation value
      setQuantity(1);
      setIsClosing(false);
      slideAnim.setValue(screenHeight);
      
      // Set default variant if available
      if (product && 'variants' in product && product.variants && product.variants.length > 0) {
        const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0];
        setSelectedVariant(defaultVariant.id);
      }
      
      // Then animate to 0 with smooth timing
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, product]);

  // Pan responder for swipe down to close
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
    },
    onPanResponderGrant: () => {
      // Store the initial position
      slideAnim.setOffset((slideAnim as Animated.Value & { _value: number })._value);
      slideAnim.setValue(0);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        slideAnim.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      slideAnim.flattenOffset();
      
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        handleClose();
      } else {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  if (!product) return null;

  const images = safeGetArray(product.images);
  const productImage = images.length > 0 ? safeGetString(images[0]) : null;
  
  // Get selected variant or fallback to first variant
  const currentVariant = selectedVariant && product && 'variants' in product && product.variants 
    ? product.variants.find((v) => v.id === selectedVariant) || product.variants[0]
    : product && 'variants' in product ? product.variants?.[0] : null;
  
  // Fallback to product-level data if no variants
  const unitPrice = currentVariant?.sellingPrice || safeGetNumber((product as { price?: number }).price);
  const piecesPerPackage = currentVariant?.piecesPerPackage || safeGetNumber(product.piecesPerPackage, 1);
  const pricePerPackage = unitPrice * piecesPerPackage; // Price per box/package
  const totalPrice = pricePerPackage * quantity; // Total price for all boxes
  const totalPieces = piecesPerPackage * quantity;
  const stock = currentVariant?.stockQuantity || safeGetNumber(product.stock);
  const packageType = currentVariant?.packageType || safeGetString(product.packageType, 'Box');
  const variantName = currentVariant?.variantName || 'Single Piece';
  
  // MOQ validation for ALL variants
  const moq = currentVariant?.moq;
  const isSinglePieceVariant = (currentVariant?.piecesPerPackage || 1) === 1;
  
  // For single piece variants, check against total pieces
  // For package variants, check against package quantity (not total pieces)
  const quantityToCheck = isSinglePieceVariant ? totalPieces : quantity;
  const meetsMOQ = !moq || quantityToCheck >= moq;
  
  
  const isFormValid = quantity > 0 && quantity <= stock && meetsMOQ;

  const handleQuantityChange = (change: number) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= stock) {
      setQuantity(newQuantity);
    }
  };

  // Calculate promotion free items
  const calculatePromotionGift = () => {
    const promotionDetails = product?.promotionDetails;
    if (!promotionDetails) return null;
    
    const minQty = promotionDetails.minQuantity || 1;
    const freeQty = promotionDetails.freeQuantity || 0;
    
    // Calculate how many free items they get
    const qualifyingSets = Math.floor(quantity / minQty);
    const totalFreeItems = qualifyingSets * freeQty;
    
    if (totalFreeItems > 0) {
      return {
        freeQty: totalFreeItems,
        totalReceived: quantity + totalFreeItems
      };
    }
    
    return null;
  };

  const handleConfirm = () => {
    if (isFormValid && product) {
      if (mode === 'cart') {
        // Add to cart logic - directly call cart store with variant information
        addItem(product, quantity, variantName);
        handleClose();
      } else {
        // Navigate to checkout with product details
        const checkoutParams: Record<string, string> = {
          productId: product.id,
          quantity: quantity.toString(),
          totalPrice: totalPrice.toString(),
          productName: safeGetString(product.name, 'Unknown Product'),
          productImage: safeGetString(product.images?.[0], ''),
          unitPrice: unitPrice.toString(),
          packageType: packageType,
          piecesPerPackage: piecesPerPackage.toString(),
          variantId: selectedVariant?.toString() || '',
          variantName: variantName,
        };
        
        // Add promotion details if available
        const promotionDetails = product?.promotionDetails;
        if (promotionDetails) {
          checkoutParams.promotionDetails = JSON.stringify(promotionDetails);
        }
        
        router.push({
          pathname: '/components/productcatalog/checkout',
          params: checkoutParams,
        });
        
        handleClose();
      }
    }
  };

  return (
    <Modal
      key={product.id} // Force re-render when product changes
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modal,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} {...panResponder.panHandlers}>
            <View style={styles.handleBarIndicator} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{mode === 'cart' ? 'Add to Cart' : 'Buy Now'}</Text>
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.productImageContainer}>
              {productImage ? (
                <Image source={{ uri: productImage }} style={styles.productImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Package size={32} color="#9CA3AF" />
                </View>
              )}
            </View>
            
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>
                {safeGetString(product.name, 'Unknown Product')}
              </Text>
              <Text style={styles.productBrand}>
                {safeGetString(product.brand, 'Unknown Brand')}
              </Text>
              <Text style={styles.packageInfo}>
                {piecesPerPackage} pieces per {packageType}
              </Text>
            </View>
          </View>

          {/* Variant Selection */}
          {product && 'variants' in product && product.variants && product.variants.length > 1 && (
            <View style={styles.variantSection}>
              <Text style={styles.variantLabel}>Variant:</Text>
              <View style={styles.variantContainer}>
                {product.variants.map((variant) => (
                  <TouchableOpacity
                    key={variant.id}
                    style={[
                      styles.variantOption,
                      selectedVariant === variant.id && styles.variantOptionSelected
                    ]}
                    onPress={() => setSelectedVariant(variant.id)}
                  >
                    <Text style={[
                      styles.variantText,
                      selectedVariant === variant.id && styles.variantTextSelected
                    ]}>
                      {variant.variantName}
                    </Text>
                    <Text style={[
                      styles.variantDetails,
                      selectedVariant === variant.id && styles.variantDetailsSelected
                    ]}>
                      {variant.piecesPerPackage} pieces per {variant.packageType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Price Section */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Unit Price:</Text>
              <Text style={styles.priceValue}>
                {formatCurrency(unitPrice)} per piece
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price per {packageType}:</Text>
              <Text style={[styles.priceValue, styles.highlightedPrice]}>
                {formatCurrency(pricePerPackage)}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total Pieces:</Text>
              <Text style={styles.priceValue}>{totalPieces} pieces</Text>
            </View>
            
            {/* MOQ Warning for ALL variants */}
            {moq && !meetsMOQ && (
              <View style={styles.moqWarning}>
                <Text style={styles.moqWarningText}>
                  Minimum order quantity for {variantName} is {moq} {isSinglePieceVariant ? 'pieces' : variantName.toLowerCase() + 's'}. You need {moq - quantityToCheck} more {isSinglePieceVariant ? 'pieces' : variantName.toLowerCase() + 's'}.
                </Text>
              </View>
            )}
          </View>

          {/* Quantity Section */}
          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>Quantity ({packageType}s):</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  quantity <= 1 && styles.quantityButtonDisabled,
                ]}
                onPress={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Minus size={20} color={quantity <= 1 ? '#9CA3AF' : '#111827'} />
              </TouchableOpacity>
              
              <View style={styles.quantityDisplay}>
                <Text style={styles.quantityText}>{quantity}</Text>
                {calculatePromotionGift() && (
                  <Text style={styles.promotionGiftText}>
                    +{calculatePromotionGift()!.freeQty} Free
                  </Text>
                )}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  quantity >= stock && styles.quantityButtonDisabled,
                ]}
                onPress={() => handleQuantityChange(1)}
                disabled={quantity >= stock}
              >
                <Plus size={20} color={quantity >= stock ? '#9CA3AF' : '#111827'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stock Info */}
          <View style={styles.stockInfo}>
            <Text style={styles.stockLabel}>Available Stock:</Text>
            <Text style={styles.stockValue}>{stock} {packageType}s</Text>
          </View>

          {/* Total Price */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Price:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totalPrice)}
              </Text>
            </View>
            <Text style={styles.totalSubtext}>
              {quantity} {packageType}(s) × {formatCurrency(pricePerPackage)} per {packageType}
            </Text>
          </View>

          {/* Buy Now Button */}
          <TouchableOpacity
            style={[
              styles.buyNowButton,
              { backgroundColor: mode === 'cart' ? '#0a61d7' : '#059c2d' },
              !isFormValid && styles.buyNowButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isFormValid}
          >
            <Text style={[
              styles.buyNowText,
              !isFormValid && styles.buyNowTextDisabled,
            ]}>
              {isFormValid 
                ? (mode === 'cart' 
                  ? 'Add to Cart' 
                  : `Buy Now - ${formatCurrency(totalPrice)}`)
                : 'Select Quantity'
              }
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999, // Ensure modal appears on top
  },
  backdrop: {
    flex: 1,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 18, // Safe area padding
    maxHeight: screenHeight * 0.8,
    zIndex: 10000, // Higher than overlay
  },
  handleBar: {
    alignSelf: 'center',
    marginTop: 2,
    paddingVertical: 12, // Increase touch area
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBarIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  productInfo: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 16,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 20,
  },
  productBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  packageInfo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  priceSection: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  highlightedPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a61d7',
  },
  quantitySection: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  quantityDisplay: {
    minWidth: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  promotionGiftText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9333EA',
    marginTop: 2,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  stockLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#059c2d',
  },
  totalSection: {
    paddingHorizontal: 15,
    marginBottom: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0a61d7',
  },
  totalSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  buyNowButton: {
    marginHorizontal: 10,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyNowButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buyNowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buyNowTextDisabled: {
    color: '#9CA3AF',
  },
  // Variant selection styles
  variantSection: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  variantLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  variantContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
    alignItems: 'center',
    position: 'relative',
  },
  variantOptionSelected: {
    borderColor: '#0a61d7',
    backgroundColor: '#EBF4FF',
  },
  variantText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
  },
  variantTextSelected: {
    color: '#0a61d7',
  },
  variantDetails: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  variantDetailsSelected: {
    color: '#0a61d7',
  },
  // MOQ warning styles
  moqWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  moqWarningText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
    textAlign: 'center',
  },
});
