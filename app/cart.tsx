import React, { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquareText, ShoppingBag, ChevronDown, Trash2, User as UserIcon, ChevronRight, Store } from 'lucide-react-native';
import { MarketplaceProduct } from '../services/marketplace';
import { calculateProductPromotion } from '../utils/promotionUtils';
import { useCartStore, CartItem } from '../stores/cartStore';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { websocketService } from '../services/websocket';
import { useTranslation } from 'react-i18next';
import { resolveVariantMoq, resolveVariantPricing } from '../utils/variantRules';
import { getDistributorDisplayName, resolveDistributorId } from '../utils/cartDistributor';
import QuantitySelector from './components/productcatalog/QuantitySelector';
import { formatCurrency } from '../utils/currencyUtils';

const KEYBOARD_BOTTOM_GAP = 5;
const CHECKOUT_BAR_HEIGHT = 72;

export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const primaryBlue = '#0a61d7';
  const routeParams = useLocalSearchParams<{ appendOrderId?: string }>();
  const routeAppendOrderId =
    typeof routeParams.appendOrderId === 'string' ? routeParams.appendOrderId.trim() : '';
  const editOrderId = useCartStore((state) => state.editOrderId);
  const appendOrderId = routeAppendOrderId || editOrderId;
  
  // Auth store
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrateFromStorage);
  
  const isAuthenticated = !!token && !!authUser;

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  
  // Cart store — selective subscriptions so qty typing does not re-render the whole screen
  const cartItems = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const toggleSelect = useCartStore((s) => s.toggleSelect);
  const setItemsSelected = useCartStore((s) => s.setItemsSelected);
  const selectAll = useCartStore((s) => s.selectAll);
  const getSelectedItems = useCartStore((s) => s.getSelectedItems);
  const getSelectedItemCount = useCartStore((s) => s.getSelectedItemCount);

  // Data store for products
  const { products } = useDataStore();
  
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Lift checkout bar above the keyboard while quantity is being edited
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const inset = event.endCoordinates.height + KEYBOARD_BOTTOM_GAP;
      setKeyboardInset(inset);
      Animated.timing(keyboardOffset, {
        toValue: inset,
        duration: Platform.OS === 'ios' ? event.duration ?? 250 : 250,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      setKeyboardInset(0);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? event.duration ?? 250 : 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // Remove legacy test products once on first mount (cart bootstrap lives in _layout)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const currentCartItems = useCartStore.getState().items;
    const testItems = currentCartItems.filter(item => 
      item.product.name === 'Test Product' || 
      item.product.id === 'test-1'
    );
    testItems.forEach(item => removeItem(item.id));
  }, []); // Empty deps - only run once on mount

  // Refresh cart on focus: upload any not-yet-synced local rows first, otherwise
  // just reload so unpublished/deleted products drop. Avoids loadFromDatabase
  // cancelling an in-progress syncWithDatabase started from setUserId.
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      const store = useCartStore.getState();
      const hasUnsyncedLocal = store.items.some(
        (item) => typeof item.id === 'string' && !item.id.startsWith('db-'),
      );
      if (hasUnsyncedLocal) {
        void store.syncWithDatabase();
      } else {
        void store.loadFromDatabase();
      }
    }, [isAuthenticated]),
  );

  // Subscribe to WebSocket for real-time cart updates
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Ensure WebSocket is connected
    websocketService.connect(token);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = websocketService.subscribe((message) => {
      // Refresh cart when products are updated (published/unpublished)
      if (message.type === 'product_updated' || message.type === 'prices_updated') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          // Reload cart from database to get filtered items (unpublished products removed)
          // Use store method directly to avoid stale closure issues
          useCartStore.getState().loadFromDatabase();
        }, 150);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [isAuthenticated, token]); // loadFromDatabase removed - using store method directly

  const getItemMOQ = (item: CartItem): number | null =>
    resolveVariantMoq(getItemProduct(item), item.variant);

  const getItemStockPieces = (item: CartItem): number => {
    const product = getItemProduct(item);
    const { option } = resolveVariantPricing(
      product,
      item.variant,
      product.sellingPrice || 0,
    );
    const variantStock = (option as { stockQuantity?: number } | null)?.stockQuantity;
    if (typeof variantStock === 'number' && variantStock >= 0) return variantStock;
    return 0;
  };

  const renderMoqWarning = (item: CartItem, piecesPerPackage: number) => {
    if (!item.selected) return null;

    const moq = getItemMOQ(item);
    if (moq === null) return null;

    const totalPieces = item.quantity * piecesPerPackage;
    if (totalPieces >= moq) return null;

    return (
      <View style={styles.moqWarningContainer}>
        <Text style={styles.moqWarningText}>
          {t('cart.moqWarning', { moq, have: totalPieces })}
        </Text>
      </View>
    );
  };

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

  const handleSelectItem = (itemId: string) => {
    toggleSelect(itemId);
  };

  const handleSelectAll = () => {
    selectAll();
  };

  const handleSelectDistributor = (items: CartItem[]) => {
    const allSelected = items.length > 0 && items.every((item) => item.selected);
    setItemsSelected(
      items.map((item) => item.id),
      !allSelected,
    );
  };

  const renderCheckbox = (selected: boolean, onPress: () => void, style?: object) => (
    <TouchableOpacity style={[styles.checkbox, style]} onPress={onPress} hitSlop={8}>
      <View style={[styles.checkboxInner, selected && styles.checkboxSelected]}>
        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const getDistributorUserId = (items: CartItem[]): number | null => {
    for (const item of items) {
      const userId = getItemProduct(item).userId;
      if (typeof userId === 'number' && userId > 0) return userId;
    }
    return null;
  };

  const openDistributorInformation = (items: CartItem[], name: string) => {
    const userId = getDistributorUserId(items);
    if (!userId) return;

    router.push({
      pathname: '/useraccounts/buyernetworks/distributor-information',
      params: { id: String(userId), name },
    });
  };

  const selectedItems = getSelectedItems();
  const selectedItemCount = getSelectedItemCount();

  const getItemProduct = useCallback(
    (item: CartItem): MarketplaceProduct => {
      const productId = item.product?.id;
      if (productId) {
        const fresh = products.find((p) => p.id === productId);
        if (fresh) return fresh as MarketplaceProduct;
      }
      return item.product as MarketplaceProduct;
    },
    [products],
  );

  // Catalog base price only; the distributor confirms the PO price after submit.
  const getItemBaseTotal = (item: CartItem): number => {
    const product = getItemProduct(item);
    const piecesPerPackage = product.piecesPerPackage || 1;
    const { unitPrice } = resolveVariantPricing(product, item.variant, product.sellingPrice || 0);
    const total = Number(unitPrice) * piecesPerPackage * item.quantity;
    return Number.isFinite(total) && total > 0 ? total : 0;
  };

  const selectedBaseTotal = selectedItems.reduce((sum, item) => sum + getItemBaseTotal(item), 0);

  const distributorGroups = useMemo(() => {
    const grouped = new Map<string, { name: string; items: CartItem[] }>();

    cartItems.forEach((item) => {
      const product = getItemProduct(item);
      const distributorId = resolveDistributorId(product);
      const distributorName = getDistributorDisplayName(
        product,
        t('tabsOrders.distributorFallback'),
      );

      const existing = grouped.get(distributorId);
      if (existing) {
        existing.items.push(item);
        return;
      }

      grouped.set(distributorId, { name: distributorName, items: [item] });
    });

    return Array.from(grouped.entries()).map(([id, group]) => ({
      id,
      name: group.name,
      items: group.items,
    }));
  }, [cartItems, getItemProduct, t]);
  
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

  const renderCartItem = (item: CartItem, distributorName: string) => {
    const marketplaceProduct = getItemProduct(item);
    const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
    const promotionGift = calculateProductPromotion(
      marketplaceProduct,
      item.quantity,
      item.variant,
    );

    return (
    <View key={`${item.product.id}-${item.variant}`} style={styles.cartItemWrapper}>
      <ReanimatedSwipeable
        friction={2}
        overshootRight={false}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-12, 12]}
        containerStyle={styles.swipeContainer}
        childrenContainerStyle={styles.swipeChild}
        renderRightActions={() => (
          <View style={styles.swipeDeleteBg}>
            <TouchableOpacity
              style={styles.swipeDeleteBtn}
              onPress={() => removeItem(item.id)}
              accessibilityRole="button"
              accessibilityLabel={t('cart.deleteA11y')}
            >
              <Trash2 size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      >
        <View style={styles.cartItem}>
          {renderCheckbox(item.selected, () => handleSelectItem(item.id), styles.itemCheckboxTopRight)}

          <View style={styles.cartItemMainRow}>
            <Image
              source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/150' }}
              style={styles.productImage}
            />

            <View style={styles.productDetails}>
              <TouchableOpacity
                style={styles.productDetailsTop}
                activeOpacity={0.85}
                onPress={() => {
                  router.push({
                    pathname: '/product',
                    params: {
                      productId: item.product.id,
                      ...(appendOrderId ? { appendOrderId } : {}),
                    },
                  });
                }}
              >
                <Text style={styles.productName} numberOfLines={2}>
                  {item.product.name}
                </Text>

                <View style={styles.variantContainer}>
                  <Text style={styles.variantText}>{item.variant}</Text>
                  <ChevronDown size={14} color="#6B7280" />
                </View>
              </TouchableOpacity>

              <View style={styles.priceQtyRow}>
                <TouchableOpacity
                  style={styles.priceBlock}
                  activeOpacity={0.85}
                  onPress={() => {
                    router.push({
                      pathname: '/product',
                      params: {
                        productId: item.product.id,
                        ...(appendOrderId ? { appendOrderId } : {}),
                      },
                    });
                  }}
                >
                  {getItemBaseTotal(item) > 0 ? (
                    <Text style={styles.price} numberOfLines={1}>
                      {formatCurrency(getItemBaseTotal(item))}
                    </Text>
                  ) : null}
                  {promotionGift?.freeQty ? (
                    <Text style={styles.promotionGiftText}>
                      +{promotionGift.freeQty} Free pieces
                    </Text>
                  ) : (
                    <Text style={styles.priceNote} numberOfLines={2}>
                      {t('cart.pricingNote', { distributor: distributorName || t('tabsOrders.distributorFallback') })}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.qtyPickerWrap}>
                  <QuantitySelector
                    size="compact"
                    packageQuantity={item.quantity}
                    piecesPerPackage={piecesPerPackage}
                    stockPieces={getItemStockPieces(item)}
                    moq={getItemMOQ(item)}
                    syncParentWhileEditing
                    onPackageQuantityChange={(packages) => {
                      // Live-sync emits 0 while the field is momentarily empty mid-typing;
                      // ignore it so the row isn't removed (updateQuantity(<=0) deletes the item).
                      // The final value is normalized to >= MOQ on blur/submit.
                      if (packages > 0) updateQuantity(item.id, packages);
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ReanimatedSwipeable>

      {renderMoqWarning(item, piecesPerPackage)}
    </View>
    );
  };

  const renderDistributorGroup = (group: { id: string; name: string; items: CartItem[] }) => {
    const allSelectedInGroup = group.items.length > 0 && group.items.every((item) => item.selected);
    const canOpenDistributorInfo = getDistributorUserId(group.items) !== null;

    return (
      <View key={group.id} style={styles.distributorGroup}>
        <View style={styles.distributorHeader}>
          {renderCheckbox(allSelectedInGroup, () => handleSelectDistributor(group.items))}
          <Store size={16} color="#111827" />
          <Text style={styles.distributorName} numberOfLines={1}>
            {group.name}
          </Text>
          <TouchableOpacity
            style={styles.distributorChevronBtn}
            onPress={() => openDistributorInformation(group.items, group.name)}
            disabled={!canOpenDistributorInfo}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={group.name}
          >
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        {group.items.map((item) => renderCartItem(item, group.name))}
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardInset > 0 && {
            paddingBottom: keyboardInset + CHECKOUT_BAR_HEIGHT,
          },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled
      >
        {appendOrderId ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, padding: 12, borderRadius: 8, backgroundColor: '#eff6ff' }}>
            <Text style={{ color: '#0a61d7', fontSize: 13, fontWeight: '600' }}>
              {t('ordersFlow.checkout.addingToOrder', { orderId: appendOrderId })}
            </Text>
          </View>
        ) : null}
        {distributorGroups.map(renderDistributorGroup)}
      </ScrollView>

      <Animated.View
        style={[
          styles.checkoutSection,
          {
            transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }],
          },
        ]}
      >
        <View style={styles.checkoutFooter}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={handleSelectAll}
          >
            {renderCheckbox(
              selectedItems.length === cartItems.length && cartItems.length > 0,
              handleSelectAll,
              styles.selectAllCheckbox,
            )}
            <Text style={styles.selectAllText}>{t('cart.selectAll')}</Text>
          </TouchableOpacity>

          <View style={styles.totalContainer}>
            {selectedBaseTotal > 0 ? (
              <>
                <Text style={styles.totalPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCurrency(selectedBaseTotal)}
                </Text>
                <Text style={styles.pricingNoteFooter} numberOfLines={2}>
                  {t('cart.basePriceNote')}
                </Text>
              </>
            ) : null}
          </View>

          <TouchableOpacity 
            style={[styles.checkoutButton, !canCheckout && styles.checkoutButtonDisabled]}
            onPress={() => {
              if (canCheckout) {
                router.push({
                  pathname: '/components/productcatalog/checkout',
                  params: {
                    checkoutSource: 'cart',
                    ...(appendOrderId ? { appendOrderId } : {}),
                  },
                });
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
            <Text
              style={[styles.checkoutButtonText, !canCheckout && styles.checkoutButtonTextDisabled]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {canCheckout 
                ? t('cart.checkout.cta', { count: selectedItemCount })
                : moqValidation.invalidItems.length > 0
                  ? t('cart.checkout.moqNotMet')
                  : t('cart.checkout.cta', { count: 0 })
              }
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
  scrollContent: {
    flexGrow: 0,
    paddingBottom: 8,
  },
  cartItemWrapper: {
    flexGrow: 0,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  distributorGroup: {
    flexGrow: 0,
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  distributorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  distributorChevronBtn: {
    padding: 4,
  },
  distributorName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  swipeContainer: {
    flexGrow: 0,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  swipeChild: {
    flexGrow: 0,
    backgroundColor: '#ffffff',
  },
  swipeDeleteBg: {
    width: 88,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  swipeDeleteBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
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
    position: 'relative',
    flexGrow: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemCheckboxTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  cartItemMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceQtyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 15,
    width: '100%',
  },
  qtyPickerWrap: {
    flexShrink: 0,
    marginLeft: 'auto',
  },
  checkbox: {
    marginRight: 0,
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
  productImage: {
    width: 88,
    height: 88,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  productDetails: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'flex-start',
  },
  productDetailsTop: {
    paddingRight: 28,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  variantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
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
  priceBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    paddingRight: 8,
  },
  originalLinePrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a61d7',
  },
  promotionGiftText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9333EA',
    marginTop: 4,
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
  checkoutSection: {
    // Align All checkbox with distributor-card checkboxes
    // (group marginHorizontal 12 + header paddingHorizontal 12)
    paddingLeft: 24,
    paddingRight: 22,
    paddingVertical: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#ffffff',
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
    alignItems: 'flex-start',
    flex: 1,
    paddingHorizontal: 8,
  },
  priceNote: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  pricingNoteFooter: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
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
    flexShrink: 1,
    maxWidth: '42%',
    backgroundColor: '#0a61d7',
    paddingHorizontal: 16,
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
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  moqWarningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
});
