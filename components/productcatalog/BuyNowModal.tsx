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
} from 'react-native';
import { Minus, Plus, Package } from 'lucide-react-native';
import { Product } from '../../data/sampleProducts';
import { MarketplaceProduct } from '../../services/marketplace';
import { formatCurrency } from '../../utils/currencyUtils';

const { height: screenHeight } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

interface BuyNowModalProps {
  visible: boolean;
  product: ProductType | null;
  onClose: () => void;
  onConfirm: (product: ProductType, quantity: number) => void;
}

export default function BuyNowModal({
  visible,
  product,
  onClose,
  onConfirm,
}: BuyNowModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [isClosing, setIsClosing] = useState(false);

  // Safe value getters
  const safeGetString = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  };

  const safeGetNumber = (value: any, fallback: number = 0): number => {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };

  const safeGetArray = (value: any, fallback: any[] = []): any[] => {
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
      // Then animate to 0 with smooth timing
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Pan responder for swipe down to close
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
    },
    onPanResponderGrant: () => {
      // Store the initial position
      slideAnim.setOffset((slideAnim as any)._value);
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
  const unitPrice = safeGetNumber(product.price); // Price per single item
  const piecesPerPackage = safeGetNumber(product.piecesPerPackage, 1);
  const pricePerPackage = unitPrice * piecesPerPackage; // Price per box/package
  const totalPrice = pricePerPackage * quantity; // Total price for all boxes
  const totalPieces = piecesPerPackage * quantity;
  const stock = safeGetNumber(product.stock);
  const packageType = safeGetString(product.packageType, 'Box');

  const isFormValid = quantity > 0 && quantity <= stock;

  const handleQuantityChange = (change: number) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= stock) {
      setQuantity(newQuantity);
    }
  };

  const handleConfirm = () => {
    if (isFormValid) {
      onConfirm(product, quantity);
      handleClose();
    }
  };

  return (
    <Modal
      key={product.id} // Force re-render when product changes
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
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
            <Text style={styles.headerTitle}>Buy Now</Text>
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
              !isFormValid && styles.buyNowButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isFormValid}
          >
            <Text style={[
              styles.buyNowText,
              !isFormValid && styles.buyNowTextDisabled,
            ]}>
              {isFormValid ? `Buy Now - ${formatCurrency(totalPrice)}` : 'Select Quantity'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 10, // Safe area padding
    maxHeight: screenHeight * 0.8,
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
    backgroundColor: '#0a61d7',
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
});
