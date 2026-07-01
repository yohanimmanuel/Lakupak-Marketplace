import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquareText, Minus, Plus, ShoppingBag, Package, Star, Truck, MapPin, ChevronDown, Trash2, User as UserIcon } from 'lucide-react-native';
import { Product } from '../data/sampleProducts';
import { MarketplaceProduct, marketplaceService } from '../services/marketplace';
import { formatCurrency } from '../utils/currencyUtils';
import { calculateProductPromotion } from '../utils/promotionUtils';
import ProductMarketplace from './components/productcatalog/ProductMarketplace';
import BuyNowModal from './components/productcatalog/BuyNowModal';
import { useCartStore, CartItem } from '../stores/cartStore';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { useUserActivityStore } from '../stores/userActivityStore';
import { websocketService } from '../services/websocket';
import { useTranslation } from 'react-i18next';
import { resolveVariantMoq, resolveVariantPricing } from '../utils/variantRules';

const { width: screenWidth } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  
  // Auth store
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  
  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  
  // Cart store - use single subscription to ensure re-renders
  const cartStore = useCartStore();
  const cartItems = cartStore.items;
  const { removeItem, updateQuantity, toggleSelect, selectAll, getSelectedItems, getTotalPrice, getTotalSaved, getSelectedItemCount, clearCart, initializeCart, loadFromDatabase } = cartStore;

  
  // Data store for products
  const { products } = useDataStore();
  
  // User activity store for favorites
  const { toggleLikedProduct } = useUserActivityStore();
  const likedProducts = useUserActivityStore(state => state.likedProducts);
  
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);

  // Clear any test data on mount - use useRef to track if already initialized
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Initialize cart immediately on app start
    initializeCart();
    
    // Remove any test products that might be in the cart
    // Use current cartItems snapshot to avoid stale closures
    const currentCartItems = cartStore.items;
    const testItems = currentCartItems.filter(item => 
      item.product.name === 'Test Product' || 
      item.product.id === 'test-1'
    );
    testItems.forEach(item => removeItem(item.id));
  }, []); // Empty deps - only run once on mount

  // Subscribe to WebSocket for real-time cart updates
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Ensure WebSocket is connected
    websocketService.connect(token);

    const unsubscribe = websocketService.subscribe((message) => {
      // Refresh cart when products are updated (published/unpublished)
      if (message.type === 'product_updated' || message.type === 'prices_updated') {
        // Reload cart from database to get filtered items (unpublished products removed)
        // Use store method directly to avoid stale closure issues
        useCartStore.getState().loadFromDatabase();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, token]); // loadFromDatabase removed - using store method directly

  // Get related products from websocket-enabled products store
  const relatedProducts = React.useMemo(() => {
    if (products.length === 0) return [];

    // Get categories from cart items, or use a default category
    const categories = cartItems.length > 0 
      ? [...new Set(cartItems.map(item => item.product.category).filter(Boolean))]
      : ['Fashion']; // Default category if no cart items
    
    // Filter products by category and exclude cart items
    const cartProductIds = cartItems.map(item => item.product.id);
    const filtered = products
      .filter(p => p.category === (categories[0] || 'Fashion'))
      .filter(p => !cartProductIds.includes(p.id))
      .slice(0, 4);
    
    // If no products in the same category, show any available products
    if (filtered.length === 0) {
      const anyProducts = products
        .filter(p => !cartProductIds.includes(p.id))
        .slice(0, 4);
      return anyProducts;
    }
    return filtered;
  }, [cartItems, products]);

  const getItemMOQ = (item: CartItem): number | null =>
    resolveVariantMoq(item.product as MarketplaceProduct, item.variant);

  // Check if all selected items meet MOQ requirements
  const validateMOQ = (): { isValid: boolean; invalidItems: Array<{ item: CartItem; moq: number; currentPieces: number }> } => {
    const invalidItems: Array<{ item: CartItem; moq: number; currentPieces: number }> = [];
    
    selectedItems.forEach(item => {
      const moq = getItemMOQ(item);
      if (moq !== null) {
        const piecesPerPackage = (item.product as MarketplaceProduct).piecesPerPackage || 1;
        const totalPieces = item.quantity * piecesPerPackage;
        
        if (totalPieces < moq) {
          invalidItems.push({ item, moq, currentPieces: totalPieces });
        }
      }
    });
    
    return {
      isValid: invalidItems.length === 0,
      invalidItems
    };
  };

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = cartItems.find(item => item.id === itemId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + change);
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleSelectItem = (itemId: string) => {
    toggleSelect(itemId);
  };

  const handleSelectAll = () => {
    selectAll();
  };

  const handleAddToCart = (product: ProductType, quantity: number = 1) => {
    useCartStore.getState().addItem(product, quantity);
  };

  const handleBuyNow = (product: ProductType, quantity?: number) => {
    // Add product to cart using cart store
    useCartStore.getState().addItem(product, quantity || 1, 'Default');
  };

  const handleChatSeller = () => {
    // TODO: Implement chat seller functionality
  };

  const handleShare = () => {
    // TODO: Implement share functionality
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!authUser?.id) {
      return;
    }
    const product = relatedProducts.find(p => p.id === productId) || products.find(p => p.id === productId);
    if (product) {
      await toggleLikedProduct(productId, product);
    }
  };

  const selectedItems = getSelectedItems();
  const totalPrice = getTotalPrice();
  const totalSaved = getTotalSaved();
  const selectedItemCount = getSelectedItemCount();
  
  // Validate MOQ for selected items
  const moqValidation = validateMOQ();
  const canCheckout = selectedItemCount > 0 && moqValidation.isValid;

  const renderLoginPrompt = () => (
    <View style={styles.loginPromptContainer}>
      <View style={styles.loginPromptIcon}>
        <UserIcon color="#0a61d7" size={28} />
      </View>
      <Text style={styles.loginPromptTitle}>
        {t('cart.loginPrompt.title')}
      </Text>
      <View style={styles.loginPromptButtons}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>{t('cart.loginPrompt.login')}</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={styles.signupButton}>
            <Text style={styles.signupButtonText}>{t('cart.loginPrompt.signup')}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyCartContainer}>
      <View style={styles.emptyCartIcon}>
        <ShoppingBag size={60} color="#0a61d7" />
      </View>
      <Text style={styles.emptyCartTitle}>{t('cart.empty.title')}</Text>
      <Text style={styles.emptyCartSubtitle}>{t('cart.empty.subtitle')}</Text>
    </View>
  );

  const renderCartItem = (item: CartItem) => (
    <View key={item.id} style={styles.cartItem}>
      <View style={styles.cartItemHeader}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => handleSelectItem(item.id)}
        >
          <View style={[styles.checkboxInner, item.selected && styles.checkboxSelected]}>
            {item.selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeItem(item.id)}
        >
          <Trash2 size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.productInfo}
        onPress={() => {
          router.push({
            pathname: '/product',
            params: { productId: item.product.id }
          });
        }}
      >
        <Image
          source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
        
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.product.name}
          </Text>
          
          <View style={styles.variantContainer}>
            <Text style={styles.variantText}>{item.variant}</Text>
            <ChevronDown size={16} color="#6B7280" />
          </View>
          
          {/* MOQ Warning for selected items */}
          {item.selected && (() => {
            const moq = getItemMOQ(item);
            if (moq !== null) {
              const piecesPerPackage = (item.product as MarketplaceProduct).piecesPerPackage || 1;
              const totalPieces = item.quantity * piecesPerPackage;
              if (totalPieces < moq) {
                return (
                  <View style={styles.moqWarningContainer}>
                    <Text style={styles.moqWarningText}>
                      Minimum order: {moq} pieces (you have {totalPieces})
                    </Text>
                  </View>
                );
              }
            }
            return null;
          })()}
          
          <View style={styles.priceQuantityRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, -1)}
              >
                <Minus size={16} color="#111827" />
              </TouchableOpacity>
              <View style={{alignItems: 'center'}}>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                {(() => {
                  const promotionGift = calculateProductPromotion(
                    item.product as MarketplaceProduct,
                    item.quantity,
                    item.variant,
                  );

                  if (!promotionGift?.freeQty) return null;

                  return (
                    <Text style={styles.promotionGiftText}>
                      +{promotionGift.freeQty} Free pieces
                    </Text>
                  );
                })()}
              </View>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, 1)}
              >
                <Plus size={16} color="#111827" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={styles.price}>
                {(() => {
                  const marketplaceProduct = item.product as MarketplaceProduct;
                  const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
                  const { unitPrice } = resolveVariantPricing(
                    marketplaceProduct,
                    item.variant,
                    (item.product as { price?: number }).price || item.product.sellingPrice || 0,
                  );

                  return formatCurrency(unitPrice * item.quantity * piecesPerPackage);
                })()}
              </Text>
            </View>
            </View>
          </View>
        </TouchableOpacity>

    </View>
  );

  const renderYouMayAlsoLike = () => {
    // Don't show section if no related products
    if (relatedProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.youMayAlsoLikeSection}>
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.sectionTitle}>{t('product.youMayAlsoLike')}</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <View style={styles.relatedProductsGrid}>
          <View style={styles.leftColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 0).map((product) => (
              <View key={product.id} style={styles.relatedProductItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={likedProducts.includes(String(product.id))}
                  type="card"
                />
              </View>
            ))}
          </View>
          <View style={styles.rightColumn}>
            {relatedProducts.filter((_, index) => index % 2 === 1).map((product) => (
              <View key={product.id} style={styles.relatedProductItem}>
                <ProductMarketplace
                  product={product}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: { productId: product.id }
                    });
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  onChatSeller={handleChatSeller}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={likedProducts.includes(String(product.id))}
                  type="card"
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };


  // Show login prompt when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen
          options={{
            presentation: 'modal',
            header: () => (
              <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 4, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14}}>
                  <Pressable onPress={() => router.back()} hitSlop={10}>
                    <ArrowLeft color={primaryBlue} size={24} />
                  </Pressable>
                  <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('cart.title')}</Text>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      router.push('/messages');
                    }}
                  >
                    <MessageSquareText size={22} color={primaryBlue} hitSlop={10} />
                  </TouchableOpacity>
                </View>
              </View>
            ),
          }}
        />
        <View style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {renderLoginPrompt()}
          </ScrollView>
        </View>
      </>
    );
  }

  if (cartItems.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            presentation: 'modal',
            header: () => (
              <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 4, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 }}>
                  <Pressable onPress={() => router.back()} hitSlop={10}>
                    <ArrowLeft color={primaryBlue} size={24} />
                  </Pressable>
                  <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('cart.title')}</Text>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      router.push('/messages');
                    }}
                  >
                    <MessageSquareText size={22} color={primaryBlue} hitSlop={12} />
                  </TouchableOpacity>
                </View>
              </View>
            ),
          }}
        />
        <View style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {renderEmptyCart()}
            {renderYouMayAlsoLike()}
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          header: () => (
            <View style={{ backgroundColor: '#ffffff', paddingTop: Math.max(insets.top, 44) + 4, borderBottomColor: '#e5e7eb', borderBottomWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 }}>
                <Pressable onPress={() => router.back()} hitSlop={10}>
                  <ArrowLeft color={primaryBlue} size={24} />
                </Pressable>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '500', marginLeft: 35, flex: 1 }}>{t('cart.title')}</Text>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    router.push('/messages');
                  }}
                >
                  <MessageSquareText size={22} color={primaryBlue} />
                </TouchableOpacity>
              </View>
            </View>
          ),
        }}
      />
      <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {cartItems.map(renderCartItem)}
        {renderYouMayAlsoLike()}
      </ScrollView>

      {/* Bottom Checkout Section */}
      <View style={styles.checkoutSection}>
        <View style={styles.checkoutFooter}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={handleSelectAll}
          >
            <View style={[styles.checkbox, styles.selectAllCheckbox]}>
              <View style={[styles.checkboxInner, selectedItems.length === cartItems.length && cartItems.length > 0 && styles.checkboxSelected]}>
                {selectedItems.length === cartItems.length && cartItems.length > 0 && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
            <Text style={styles.selectAllText}>{t('cart.selectAll')}</Text>
          </TouchableOpacity>

          <View style={styles.totalContainer}>
            <Text style={styles.totalPrice}>{formatCurrency(totalPrice)}</Text>
            <Text style={styles.totalSaved}>{t('cart.saved', { amount: formatCurrency(totalSaved) })}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.checkoutButton, !canCheckout && styles.checkoutButtonDisabled]}
            onPress={() => {
              if (canCheckout) {
                router.push('/components/productcatalog/checkout');
              } else if (moqValidation.invalidItems.length > 0) {
                // Show alert with MOQ requirements
                const itemNames = moqValidation.invalidItems
                  .map(({ item, moq, currentPieces }) => 
                    t('cart.alerts.moqItem', { name: item.product.name, moq, have: currentPieces })
                  )
                  .join('\n');
                
                Alert.alert(
                  t('cart.alerts.moqTitle'),
                  t('cart.alerts.moqBody', { items: itemNames }),
                  [{ text: t('cart.alerts.ok') }]
                );
              }
            }}
            disabled={!canCheckout}
          >
            <Text style={[styles.checkoutButtonText, !canCheckout && styles.checkoutButtonTextDisabled]}>
              {canCheckout 
                ? t('cart.checkout.cta', { count: selectedItemCount })
                : moqValidation.invalidItems.length > 0
                  ? t('cart.checkout.moqNotMet')
                  : t('cart.checkout.cta', { count: 0 })
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buy Now Modal */}
      <BuyNowModal
        visible={showBuyNowModal}
        product={selectedProduct}
        onClose={() => setShowBuyNowModal(false)}
        onConfirm={handleBuyNow}
        mode="cart"
      />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  emptyCartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 50,
    paddingBottom: 50,
    backgroundColor: '#f9fafb',
  },
  emptyCartIcon: {
    marginBottom: 24,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  cartItem: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#0a61d7',
    borderColor: '#0a61d7',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectAllCheckbox: {
    marginRight: 8,
  },
  sellerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginRight: 8,
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  savingsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  savingsText: {
    fontSize: 12,
    color: '#0a61d7',
    marginLeft: 4,
    fontWeight: '500',
  },
  productInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 18,
  },
  variantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 4,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    color: '#0a61d7',
    fontWeight: '600',
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 12,
  },
  promotionGiftText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9333EA',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  deleteButton: {
    padding: 8,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  priceAfterVoucher: {
    fontSize: 10,
    color: '#6B7280',
  },
  voucherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  voucherText: {
    fontSize: 12,
    color: '#D97706',
    marginLeft: 8,
    fontWeight: '500',
  },
  youMayAlsoLikeSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 16,
  },
  relatedProductsGrid: {
    flexDirection: 'row',
    gap: 8, // Narrower gap between columns
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  relatedProductItem: {
    marginBottom: 4, // Narrower gap between items
  },
  checkoutSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkoutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  totalContainer: {
    alignItems: 'center',
    flex: 1,
    marginBottom: 12,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalSaved: {
    fontSize: 12,
    color: '#6B7280',
  },
  checkoutButton: {
    backgroundColor: '#0a61d7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  checkoutButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  checkoutButtonTextDisabled: {
    color: '#9CA3AF',
  },
  loginPromptContainer: {
    backgroundColor: '#f9fafb',
    padding: 26,
    marginTop: 8,
    alignItems: 'center',
  },
  loginPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    backgroundColor: '#0a61d7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  signupButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  signupButtonText: {
    color: '#0a61d7',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  moqWarningContainer: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  moqWarningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
});
