import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Link } from 'expo-router';
import { ArrowLeft, MessageSquareText, Minus, Plus, ShoppingBag, Package, Star, Truck, MapPin, ChevronDown, Trash2, User as UserIcon } from 'lucide-react-native';
import { Product } from '../data/sampleProducts';
import { MarketplaceProduct, marketplaceService } from '../services/marketplace';
import { formatCurrency } from '../utils/currencyUtils';
import ProductMarketplace from './components/productcatalog/ProductMarketplace';
import BuyNowModal from './components/productcatalog/BuyNowModal';
import { useCartStore, CartItem } from '../stores/cartStore';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';

const { width: screenWidth } = Dimensions.get('window');

type ProductType = Product | MarketplaceProduct;

export default function CartScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  
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
  const { removeItem, updateQuantity, toggleSelect, selectAll, getSelectedItems, getTotalPrice, getTotalSaved, getSelectedItemCount, clearCart, initializeCart } = cartStore;

  
  // Data store for products
  const { products } = useDataStore();
  
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<MarketplaceProduct[]>([]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Shopping Cart',
      headerStyle: { backgroundColor: '#ffffff' },
      headerTitleStyle: { color: '#111827' },
      headerTintColor: '#0a61d7',
      headerBackTitleVisible: false,
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              // Navigate to messages
              router.push('/messages');
            }}
          >
            <MessageSquareText size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, router]);

  // Clear any test data on mount
  useEffect(() => {
    // Initialize cart immediately on app start
    initializeCart();
    
    // Remove any test products that might be in the cart
    const testItems = cartItems.filter(item => 
      item.product.name === 'Test Product' || 
      item.product.id === 'test-1'
    );
    testItems.forEach(item => removeItem(item.id));
  }, []);

  // Load related products based on cart items or general recommendations
  useEffect(() => {
    const loadRelatedProducts = async () => {
      try {
        // If no products loaded yet, try to get some general products
        if (products.length === 0) {
          try {
            const response = await marketplaceService.getProducts({ limit: 8 });
            const generalProducts = response.products.slice(0, 4);
            setRelatedProducts(generalProducts);
            return;
          } catch (error) {
            setRelatedProducts([]);
            return;
          }
        }

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
          setRelatedProducts(anyProducts);
        } else {
          setRelatedProducts(filtered);
        }
      } catch (error) {
        setRelatedProducts([]);
      }
    };
    loadRelatedProducts();
  }, [cartItems, products]);

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

  const handleToggleFavorite = (productId: string) => {
    // TODO: Implement toggle favorite functionality
  };

  const selectedItems = getSelectedItems();
  const totalPrice = getTotalPrice();
  const totalSaved = getTotalSaved();
  const selectedItemCount = getSelectedItemCount();

  const renderLoginPrompt = () => (
    <View style={styles.loginPromptContainer}>
      <View style={styles.loginPromptIcon}>
        <UserIcon color="#0a61d7" size={28} />
      </View>
      <Text style={styles.loginPromptTitle}>
        Create an account to win first-order benefits!
      </Text>
      <View style={styles.loginPromptButtons}>
        <Link href="/useraccounts/loginsignup/loginmodal" asChild>
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </Link>
        <Link href="/useraccounts/loginsignup/signupmodal" asChild>
          <Pressable style={styles.signupButton}>
            <Text style={styles.signupButtonText}>Sign Up</Text>
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
      <Text style={styles.emptyCartTitle}>Oops, Your Shopping Cart is Empty</Text>
      <Text style={styles.emptyCartSubtitle}>Browse our awesome deals now!</Text>
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
          
          
          <View style={styles.priceQuantityRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, -1)}
              >
                <Minus size={16} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, 1)}
              >
                <Plus size={16} color="#111827" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={styles.price}>
                {formatCurrency(item.product.price * item.quantity * ((item.product as MarketplaceProduct).piecesPerPackage || 1))}
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
          <Text style={styles.sectionTitle}>You May Also Like</Text>
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
                  isFavorite={false}
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
                  isFavorite={false}
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
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {renderLoginPrompt()}
        </ScrollView>
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {renderEmptyCart()}
          {renderYouMayAlsoLike()}
        </ScrollView>
      </View>
    );
  }

  return (
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
            <Text style={styles.selectAllText}>All</Text>
          </TouchableOpacity>

          <View style={styles.totalContainer}>
            <Text style={styles.totalPrice}>{formatCurrency(totalPrice)}</Text>
            <Text style={styles.totalSaved}>Saved {formatCurrency(totalSaved)}</Text>
          </View>

          <TouchableOpacity 
            style={styles.checkoutButton}
            onPress={() => {
              if (selectedItemCount > 0) {
                router.push('/components/productcatalog/checkout');
              }
            }}
          >
            <Text style={styles.checkoutButtonText}>Check Out ({selectedItemCount})</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    marginVertical: 8,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  checkoutButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  loginPromptContainer: {
    backgroundColor: '#ffffff',
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
    borderWidth: 2,
    borderColor: '#e5e7eb',
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
    borderWidth: 1,
    borderColor: '#0a61d7',
    flex: 1,
  },
  signupButtonText: {
    color: '#0a61d7',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
