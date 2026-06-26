import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Minus, Plus, Gift } from 'lucide-react-native';
import { Product } from '../../../data/sampleProducts';
import { MarketplaceProduct } from '../../../services/marketplace';
import { useCartStore } from '../../../stores/cartStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import { useTranslation } from 'react-i18next';
import { matchesVariantAttributes, parseVariantNameToAttributes } from '../../../utils/variantRules';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

interface BuyNowModalProps {
  visible: boolean;
  product: ProductType | null;
  onClose: () => void;
  onConfirm: (product: ProductType, quantity: number) => void;
  mode?: 'buy' | 'cart';
  initialQuantity?: number;
  initialVariantName?: string;
}

export default function BuyNowModal({
  visible,
  product,
  onClose,
  onConfirm,
  mode = 'buy',
  initialQuantity,
  initialVariantName,
}: BuyNowModalProps) {
  const { t } = useTranslation();
  const { addItem } = useCartStore();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [piecesInput, setPiecesInput] = useState('1');
  const [isEditingPieces, setIsEditingPieces] = useState(false);
  const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<string, string>>({});
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [isClosing, setIsClosing] = useState(false);
  
  // Refs for long-press functionality
  const longPressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous product ID to prevent unnecessary resets
  const previousProductId = useRef<string | null>(null);
  const previousVisible = useRef<boolean>(false);

  // Safe value getters - memoized to prevent re-creation
  const safeGetString = useCallback((value: unknown, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }, []);

  const safeGetNumber = useCallback((value: unknown, fallback: number = 0): number => {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }, []);

  const safeGetArray = useCallback((value: unknown, fallback: unknown[] = []): unknown[] => {
    if (!Array.isArray(value)) return fallback;
    return value;
  }, []);

  // Close handler with animation - memoized
  const handleClose = useCallback(() => {
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
  }, [isClosing, slideAnim, onClose]);

  // Animation handlers - only reset when product changes or modal first opens
  React.useEffect(() => {
    const currentProductId = product?.id || null;
    const productChanged = previousProductId.current !== currentProductId;
    const modalJustOpened = !previousVisible.current && visible;
    
    if (visible) {
      // Only reset if product changed or modal just opened
      if (productChanged || modalJustOpened) {
      setQuantity(Math.max(1, initialQuantity ?? 1));
      setIsClosing(false);
      slideAnim.setValue(screenHeight);

      const presetVariant = parseVariantNameToAttributes(initialVariantName);
      const hasPresetVariant = Object.keys(presetVariant).length > 0;

      if (hasPresetVariant) {
        setSelectedVariantOptions(presetVariant);
      } else if (product && 'variants' in product && 'variantOptions' in product) {
        const definitions = (product.variants || []) as unknown as Array<{
          id: number;
          variantType: string;
          options: string[] | Record<string, unknown>;
        }>;

        const initialSelection: Record<string, string> = {};
        definitions.forEach(def => {
          const options = Array.isArray(def.options) ? def.options : [];
          if (options.length > 0) {
            initialSelection[def.variantType] = String(options[0]);
          }
        });
        setSelectedVariantOptions(initialSelection);
      }
      }
      
      // Animate to 0 with smooth timing (only if modal just opened or product changed)
      if (productChanged || modalJustOpened) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    }
    
    // Update refs
    previousProductId.current = currentProductId;
    previousVisible.current = visible;
  }, [visible, slideAnim, product, initialQuantity, initialVariantName]);

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

  // Helper function to calculate price range from variant options
  const getPriceRange = (): { min: number; max: number; hasRange: boolean } => {
    if (!product) return { min: 0, max: 0, hasRange: false };
    
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

  // Format price display for header (single price or range)
  const formatHeaderPriceDisplay = (): string => {
    if (!product) return formatCurrency(0);
    
    const priceRange = getPriceRange();
    if (priceRange.hasRange) {
      return `${formatCurrency(priceRange.min)} – ${formatCurrency(priceRange.max)}`;
    }
    // If no range, show the current selected variant price
    if ('variantOptions' in product && product.variantOptions) {
      const options = product.variantOptions as Array<{
        id: number;
        sellingPrice: number;
        attributes: Record<string, string>;
      }>;
      
      const matchingOption = options.find((option) =>
        matchesVariantAttributes(option.attributes, selectedVariantOptions),
      );
      
      if (matchingOption) {
        return formatCurrency(matchingOption.sellingPrice);
      }
    }
    return formatCurrency(safeGetNumber((product as { price?: number }).price));
  };

  // Memoized computed values to prevent unnecessary recalculations
  const computedValues = useMemo(() => {
    if (!product) return null;

    const images = safeGetArray(product.images);
    const productImage = images.length > 0 ? safeGetString(images[0]) : null;
    
    // Get pricing and stock from current variant option (new structure)
    let unitPrice = safeGetNumber((product as { price?: number }).price);
    let stock = 0;
    let moq = null;
    let currentVariantOption = null;
    
    if ('variantOptions' in product && product.variantOptions) {
      const options = product.variantOptions as Array<{
        id: number;
        sku: string;
        purchasePrice: number;
        sellingPrice: number;
        originalSellingPrice?: number;
        moq: number;
        stockQuantity: number;
        lowStockThreshold: number;
        stockStatus: string;
        attributes: Record<string, string>;
        isDefault: boolean;
        isActive: boolean;
      }>;
      
      // Find matching variant option based on selected attributes
      const matchingOption = options.find((option) =>
        matchesVariantAttributes(option.attributes, selectedVariantOptions),
      );
      
      currentVariantOption = matchingOption || options.find(o => o.isDefault) || options[0];
      
      if (currentVariantOption) {
        unitPrice = currentVariantOption.sellingPrice;
        stock = currentVariantOption.stockQuantity;
        moq = currentVariantOption.moq;
      }
    }
    
    // Package info for display (from product level)
    const piecesPerPackage = safeGetNumber(product.piecesPerPackage, 1);
    const packageType = safeGetString(product.packageType, 'Piece');
    
    // Calculate prices
    const pricePerPackage = unitPrice * piecesPerPackage;
    const totalPrice = pricePerPackage * quantity;
    const totalPieces = piecesPerPackage * quantity;
    
    // MOQ validation (always in pieces)
    const meetsMOQ = !moq || totalPieces >= moq;
    const isFormValid = quantity > 0 && totalPieces <= stock && meetsMOQ;

    // Build variant display name from the actual matched variant option's attributes
    // This ensures consistency with what's stored in the database (handles spacing issues like 'Color ')
    let variantName = 'Default';
    if (currentVariantOption && currentVariantOption.attributes) {
      variantName = Object.entries(currentVariantOption.attributes)
      .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } else if (Object.keys(selectedVariantOptions).length > 0) {
      // Fallback to selected options if no variant option found
      variantName = Object.entries(selectedVariantOptions)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }

    return {
      productImage,
      currentVariantOption,
      unitPrice,
      piecesPerPackage,
      pricePerPackage,
      totalPrice,
      totalPieces,
      stock,
      packageType,
      variantName,
      moq,
      meetsMOQ,
      isFormValid
    };
  }, [product, selectedVariantOptions, quantity, safeGetArray, safeGetString, safeGetNumber]);

  // Parse variant definitions and options from product for new structure
  const variantData = useMemo(() => {
    if (!product) return { definitions: [], options: [] };

    // Check if product has new variant structure
    if ('variants' in product && 'variantOptions' in product) {
      const definitions = (product.variants || []) as unknown as Array<{
        id: number;
        variantType: string;
        options: string[] | Record<string, unknown>;
      }>;
      const options = (product.variantOptions || []) as Array<{
        id: number;
        sku: string;
        purchasePrice: number;
        sellingPrice: number;
        originalSellingPrice?: number;
        moq: number;
        stockQuantity: number;
        lowStockThreshold: number;
        stockStatus: string;
        attributes: Record<string, string>;
        isDefault: boolean;
        isActive: boolean;
      }>;

      // Parse options from JSON if needed
      const parsedDefinitions = definitions.map(def => ({
        ...def,
        options: typeof def.options === 'string'
          ? JSON.parse(def.options as string)
          : Array.isArray(def.options)
            ? def.options
            : []
      }));

      return { definitions: parsedDefinitions, options };
    }

    return { definitions: [], options: [] };
  }, [product]);

  // Quantity handlers with long-press support (must run unconditionally — hooks rules)
  const startLongPress = useCallback((increment: boolean) => {
    const pp = computedValues?.piecesPerPackage ?? 1;
    const st = computedValues?.stock ?? 0;
    const changeQuantity = () => {
      setQuantity((prev) => {
        const newQty = increment ? prev + 1 : Math.max(1, prev - 1);
        const newTotalPieces = newQty * pp;
        return newTotalPieces <= st ? newQty : prev;
      });
    };

    changeQuantity();

    longPressTimeout.current = setTimeout(() => {
      longPressInterval.current = setInterval(changeQuantity, 100);
    }, 500);
  }, [computedValues]);

  const stopLongPress = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (longPressInterval.current) {
      clearInterval(longPressInterval.current);
      longPressInterval.current = null;
    }
  }, []);

  const commitPiecesInput = useCallback(() => {
    setIsEditingPieces(false);
    if (!computedValues) return;

    const { piecesPerPackage, stock, moq, totalPieces } = computedValues;
    const pp = Math.max(1, piecesPerPackage);
    const minPackages = moq ? Math.ceil(moq / pp) : 1;
    const maxPackages = Math.max(1, Math.floor(stock / pp));
    const parsed = parseInt(piecesInput.replace(/\D/g, ''), 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPiecesInput(String(totalPieces));
      return;
    }

    const packages = Math.max(minPackages, Math.min(Math.ceil(parsed / pp), maxPackages));
    setQuantity(packages);
    setPiecesInput(String(packages * pp));
  }, [computedValues, piecesInput]);

  useEffect(() => {
    if (!isEditingPieces && computedValues) {
      setPiecesInput(String(computedValues.totalPieces));
    }
  }, [computedValues?.totalPieces, isEditingPieces, computedValues]);

  const promotionInfo = useMemo(() => {
    if (!product?.promotionDetails || !computedValues) return null;

    const { piecesPerPackage, moq } = computedValues;
    const totalPieces = quantity * piecesPerPackage;
    const moqValue = moq;

    const minQty = product.promotionDetails.minQuantity || 1;
    const freeQty = product.promotionDetails.freeQuantity || 0;

    if (!moqValue) {
      const completeSets = Math.floor(totalPieces / minQty);
      const totalFreeItems = completeSets * freeQty;
      return totalFreeItems > 0 ? totalFreeItems : null;
    }

    if (totalPieces < moqValue) return null;

    const quantityAboveMOQ = totalPieces - moqValue;
    const completeSets = Math.floor(quantityAboveMOQ / minQty);
    const totalFreeItems = completeSets * freeQty;

    return totalFreeItems > 0 ? totalFreeItems : null;
  }, [product, quantity, computedValues]);

  const handleConfirm = useCallback(() => {
    if (!product || !computedValues) return;
    const {
      isFormValid,
      productImage,
      currentVariantOption,
      unitPrice,
      packageType,
      piecesPerPackage,
      totalPrice,
      variantName,
      moq,
    } = computedValues;
    if (!isFormValid) return;

    if (mode === 'cart') {
      addItem(product, quantity, variantName);
      handleClose();
      return;
    }

    const checkoutParams: Record<string, string> = {
      productId: product.id,
      quantity: quantity.toString(),
      totalPrice: totalPrice.toString(),
      productName: safeGetString(product.name),
      productImage: productImage || '',
      unitPrice: unitPrice.toString(),
      packageType: packageType,
      piecesPerPackage: piecesPerPackage.toString(),
      variantId: currentVariantOption?.id?.toString() || '',
      variantName: variantName,
      moq: moq?.toString() || '',
    };

    const promotionDetails = product?.promotionDetails;
    if (promotionDetails) {
      checkoutParams.promotionDetails = JSON.stringify(promotionDetails);
    }

    router.push({
      pathname: '/components/productcatalog/checkout',
      params: checkoutParams
    });
    handleClose();
  }, [product, computedValues, mode, addItem, quantity, handleClose, safeGetString, router]);

  if (!product || !computedValues) return null;

  const {
    productImage,
    currentVariantOption,
    unitPrice,
    piecesPerPackage,
    pricePerPackage,
    totalPrice,
    totalPieces,
    stock,
    packageType,
    variantName,
    moq,
    meetsMOQ,
    isFormValid
  } = computedValues;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
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
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.productHeader}>
              {productImage ? (
                <Image
                  source={{ uri: productImage }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>{t('buyNow.labels.noImage')}</Text>
                </View>
              )}
              <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                  {safeGetString(product.name)}
              </Text>
                <Text style={styles.headerPrice}>
                  {formatHeaderPriceDisplay()}
              </Text>
                <View style={styles.stockContainer}>
                  <Text style={styles.stock}>
                    {t('buyNow.labels.stock')}: {stock}
                  </Text>
                  <Text style={[styles.stockStatus, { color: stock === 0 ? '#EF4444' : stock <= (currentVariantOption?.lowStockThreshold || 0) ? '#F59E0B' : '#10B981' }]}>
                    {stock === 0
                      ? t('product.stock.outOfStock')
                      : stock <= (currentVariantOption?.lowStockThreshold || 0)
                        ? t('product.stock.lowStock')
                        : t('product.stock.inStock')}
              </Text>
                </View>
              </View>
            </View>
          </View>

          {/* New Variant Structure - Multiple Variant Types */}
          {variantData.definitions.length > 0 && (
            <View style={styles.variantSection}>
              {variantData.definitions.map((definition) => {
                const options = Array.isArray(definition.options) ? definition.options : [];
                
                return (
                  <View key={definition.id} style={styles.variantTypeContainer}>
                    <Text style={styles.variantLabel}>{definition.variantType}</Text>
              <View style={styles.variantContainer}>
                      {options.map((option, index) => {
                        const optionStr = String(option);
                        const isSelected = selectedVariantOptions[definition.variantType] === optionStr;
                        
                        return (
                  <TouchableOpacity
                            key={`${definition.id}-${index}`}
                    style={[
                      styles.variantOption,
                              isSelected && styles.variantOptionSelected
                            ]}
                            onPress={() => {
                              setSelectedVariantOptions(prev => ({
                                ...prev,
                                [definition.variantType]: optionStr
                              }));
                            }}
                  >
                    <Text style={[
                      styles.variantText,
                              isSelected && styles.variantTextSelected
                    ]}>
                              {optionStr}
                    </Text>
                  </TouchableOpacity>
                        );
                      })}
              </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Quantity Selector */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>{t('buyNow.labels.quantity')}</Text>
              
              <View style={styles.quantityControlsGroup}>
                {/* Free items display - left side beside selector */}
                {promotionInfo && promotionInfo > 0 && (
                  <View style={styles.freeItemsContainer}>
                    <Gift size={14} color="#9333EA" />
                    <Text style={styles.freeItemsText}>{t('buyNow.labels.freeItems', { count: promotionInfo })}</Text>
                  </View>
                )}
                
                {/* Segmented Quantity Selector */}
                <View style={styles.quantitySelector}>
                  <TouchableOpacity
                    style={[
                      styles.quantityButtonLeft,
                      quantity <= 1 && styles.quantityButtonDisabled
                    ]}
                    onPressIn={() => startLongPress(false)}
                    onPressOut={stopLongPress}
                    disabled={quantity <= 1}
                  >
                    <Minus size={14} color={quantity <= 1 ? '#D1D5DB' : '#6B7280'} />
                  </TouchableOpacity>
                  
                  <View style={styles.quantitySeparator} />
                  
                  <View style={styles.quantityDisplay}>
                    <TextInput
                      style={styles.quantityInput}
                      value={piecesInput}
                      onChangeText={(text) => setPiecesInput(text.replace(/\D/g, ''))}
                      onFocus={() => setIsEditingPieces(true)}
                      onBlur={commitPiecesInput}
                      onSubmitEditing={commitPiecesInput}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      selectTextOnFocus
                      maxLength={6}
                    />
                  </View>
                  
                  <View style={styles.quantitySeparator} />
                  
                  <TouchableOpacity
                    style={[
                      styles.quantityButtonRight,
                      totalPieces >= stock && styles.quantityButtonDisabled
                    ]}
                    onPressIn={() => startLongPress(true)}
                    onPressOut={stopLongPress}
                    disabled={totalPieces >= stock}
                  >
                    <Plus size={14} color={totalPieces >= stock ? '#D1D5DB' : '#6B7280'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {/* MOQ Warning - below the selector row */}
            {moq && !meetsMOQ && (
              <View style={styles.moqWarning}>
                <Text style={styles.moqWarningText}>
                  {t('buyNow.labels.minimumOrder', { count: moq })}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
          <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>{t('buyNow.labels.total')}</Text>
              <Text style={styles.totalPrice}>{formatCurrency(totalPrice)}</Text>
            </View>
          <TouchableOpacity
              style={[styles.confirmButton, !isFormValid && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!isFormValid}
          >
              <Text style={styles.confirmButtonText}>
                {mode === 'cart' ? t('buyNow.cta.addToCart') : t('buyNow.cta.buyNow')}
            </Text>
          </TouchableOpacity>
          </View>
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
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.85,
    paddingBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  placeholderImage: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a61d7',
    marginBottom: 6,
  },
  headerPrice: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0a61d7',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stock: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  variantSection: {
    paddingHorizontal: 15,
    marginBottom: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  variantTypeContainer: {
    marginBottom: 16,
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
    minWidth: 60,
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
  quantitySection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantityControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  quantityButtonLeft: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonRight: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  quantitySeparator: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  quantityDisplay: {
    minWidth: 48,
    height: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  quantityInput: {
    minWidth: 36,
    fontSize: 14,
    fontWeight: '600',
    color: '#0a61d7',
    textAlign: 'center',
    padding: 0,
  },
  moqWarning: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 8,
  },
  moqWarningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  freeItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freeItemsText: {
    fontSize: 12,
    color: '#9333EA',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0a61d7',
  },
  confirmButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});