import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { MarketplaceProduct } from '../services/marketplace'
import { useAuthStore } from './authStore'
import { cartService } from '../services/cart'
import { resolveVariantPricing } from '../utils/variantRules'

type CartProductSnapshot = {
  id: string;
  name: string;
  images?: string[];
  category?: string;
  sellingPrice?: number;
  piecesPerPackage?: number;
  originalSellingPrice?: number | string;
  variantOptions?: Array<{
    id: number;
    sellingPrice?: number | string;
    originalSellingPrice?: number | string;
    moq?: number;
    attributes?: Record<string, string>;
  }>;
  variants?: Array<{
    variantName?: string | null;
    sellingPrice?: number | null;
    originalSellingPrice?: number | null;
  }>;
};

function compactProductForCart(product: Product | MarketplaceProduct | CartProductSnapshot): CartProductSnapshot {
  if (product && typeof product === 'object' && 'id' in product && 'name' in product) {
    // If it's already a compact snapshot (rehydrated from storage), keep it.
    if (!('description' in (product as Record<string, unknown>))) {
      return product as CartProductSnapshot;
    }
  }

  const p = product as MarketplaceProduct & {
    piecesPerPackage?: number;
    originalSellingPrice?: number | string;
    variantOptions?: CartProductSnapshot['variantOptions'];
    variants?: CartProductSnapshot['variants'];
  };

  return {
    id: p.id,
    name: p.name,
    images: Array.isArray(p.images) ? p.images.slice(0, 6) : [],
    category: (p as { category?: string }).category,
    sellingPrice: (p as { sellingPrice?: number }).sellingPrice,
    piecesPerPackage: p.piecesPerPackage,
    originalSellingPrice: p.originalSellingPrice,
    variantOptions: Array.isArray(p.variantOptions)
      ? p.variantOptions.slice(0, 40).map((o) => ({
          id: o.id,
          sellingPrice: o.sellingPrice,
          originalSellingPrice: o.originalSellingPrice,
          moq: o.moq,
          attributes: o.attributes,
        }))
      : undefined,
    variants: Array.isArray(p.variants)
      ? p.variants.slice(0, 40).map((v) => ({
          variantName: v.variantName,
          sellingPrice: v.sellingPrice,
          originalSellingPrice: v.originalSellingPrice,
        }))
      : undefined,
  };
}

function compactCartItemsForPersist(items: CartItem[]): CartItem[] {
  return items.slice(0, 50).map((it) => ({
    ...it,
    product: compactProductForCart(it.product),
  }));
}

// Database user activity interface (matches Prisma schema)
interface DatabaseUserActivity {
  id: number;
  userId: number;
  productId: string;
  productData: Product | MarketplaceProduct; // Complete product data as JSON
  activityType: 'cart' | 'favorite' | 'viewed' | 'purchased';
  metadata: {
    quantity?: number;
    variant?: string;
    addedAt?: number;
    selected?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  product: Product | MarketplaceProduct | CartProductSnapshot;
  quantity: number;
  selected: boolean;
  variant?: string;
  addedAt: number;
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  userId: number | null
  isLoading: boolean
  isOnline: boolean
  
  // Actions
  addItem: (product: Product | MarketplaceProduct, quantity?: number, variant?: string) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  toggleSelect: (itemId: string) => void
  setItemSelected: (itemId: string, selected: boolean) => void
  setItemsSelected: (itemIds: string[], selected: boolean) => void
  selectAll: () => void
  deselectAll: () => void
  removeItems: (itemIds: string[]) => Promise<void>
  clearCart: (options?: { trackAbandonment?: boolean }) => Promise<void>
  clearCartLocal: () => void
  setCartOpen: (isOpen: boolean) => void
  setUserId: (userId: number | null) => void
  setOnlineStatus: (isOnline: boolean) => void
  syncWithDatabase: () => Promise<void>
  loadFromDatabase: () => Promise<void>
  initializeUser: (userId: number) => void
  loadCartOnStart: () => void
  checkAuthAndLoadCart: () => void
  initializeCart: () => void
  
  // Getters
  getSelectedItems: () => CartItem[]
  getTotalPrice: () => number
  getTotalSaved: () => number
  getItemCount: () => number
  getSelectedItemCount: () => number
}

// Helper function to convert database activity to cart item
const convertDatabaseToCartItem = (dbItem: DatabaseUserActivity | { id: number; userId: number; productId: string; productData: unknown; activityType: string; metadata?: Record<string, unknown>; createdAt: string; updatedAt: string }): CartItem => {
  // Handle both DatabaseUserActivity and service CartItem types
  const metadata = (dbItem.metadata as { quantity?: number; variant?: string; selected?: boolean; addedAt?: number }) || {};
  const productData = dbItem.productData as Product | MarketplaceProduct;
  
  return {
    id: `db-${dbItem.id}`,
    product: productData,
    quantity: metadata.quantity || 1,
    selected: metadata.selected !== undefined ? metadata.selected : true,
    variant: metadata.variant || 'Default',
    addedAt: metadata.addedAt || new Date(dbItem.createdAt).getTime()
  };
};

const parseDbCartItemId = (itemId: string): number | null => {
  if (!itemId.startsWith('db-')) return null;
  const dbId = parseInt(itemId.replace('db-', ''), 10);
  return Number.isNaN(dbId) ? null : dbId;
};

// Helper function to sync cart item to database; returns UserActivity row id when synced.
const syncItemToDatabase = async (
  item: CartItem,
  userId: number,
  token?: string,
): Promise<number | null> => {
  const key = cartItemKey(item.product.id, item.variant);
  if (pendingSyncKeys.has(key)) {
    return null;
  }

  pendingSyncKeys.add(key);
  try {
    const existingDbId = parseDbCartItemId(item.id);
    if (existingDbId != null) {
      await cartService.updateCartItem(existingDbId, item.quantity, item.selected, token);
      return existingDbId;
    }

    const serverRows = await cartService.getCart(userId, token).catch(() => []);
    const serverMatch = serverRows.find((row) => {
      const converted = convertDatabaseToCartItem(row);
      return cartItemKey(converted.product.id, converted.variant) === key;
    });
    if (serverMatch) {
      return serverMatch.id;
    }

    const cartItem = await cartService.addToCart(
      userId,
      item.product.id,
      item.product as MarketplaceProduct,
      item.quantity,
      item.variant || 'Default',
      token,
    );
    return cartItem.id;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      return null;
    }
    return null;
  } finally {
    pendingSyncKeys.delete(key);
  }
};

type CartStoreSet = (
  partial: Partial<CartState> | ((state: CartState) => Partial<CartState>),
) => void;
type CartStoreGet = () => CartState;

const ensureCartItemDbId = async (
  item: CartItem,
  set: CartStoreSet,
  get: CartStoreGet,
): Promise<number | null> => {
  const existingDbId = parseDbCartItemId(item.id);
  if (existingDbId != null) return existingDbId;

  const authState = useAuthStore.getState();
  const userId = authState.user?.id;
  const { isOnline } = get();
  if (!userId || !isOnline) return null;

  const key = cartItemKey(item.product.id, item.variant);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const current = get().items.find(
      (entry) =>
        entry.product.id === item.product.id && entry.variant === item.variant,
    );
    if (!current) return null;

    const dbId = parseDbCartItemId(current.id);
    if (dbId != null) return dbId;

    if (!pendingSyncKeys.has(key)) {
      const syncedId = await syncItemToDatabase(current, userId, authState.token || undefined);
      if (syncedId != null) {
        applySyncedCartItemId(set, get, current.product.id, current.variant ?? 'Default', syncedId);
        return syncedId;
      }
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
};

const syncCartItemSelectionToDatabase = async (
  item: CartItem,
  selected: boolean,
  isOnline: boolean,
  set: CartStoreSet,
  get: CartStoreGet,
): Promise<void> => {
  if (!isOnline) return;

  const authState = useAuthStore.getState();
  const userId = authState.user?.id;
  if (!userId) return;

  const dbId = await ensureCartItemDbId(item, set, get);
  if (!dbId) return;

  await cartService
    .updateCartItem(dbId, undefined, selected, authState.token || undefined)
    .catch(() => undefined);
};

const applySyncedCartItemId = (
  set: (partial: Partial<CartState> | ((state: CartState) => Partial<CartState>)) => void,
  get: () => CartState,
  productId: string,
  variant: string,
  dbRowId: number,
) => {
  const dbItemId = `db-${dbRowId}`;
  set({
    items: get().items.map((item) =>
      item.product.id === productId && item.variant === variant ? { ...item, id: dbItemId } : item,
    ),
  });
};

const cartItemKey = (productId: string, variant?: string) =>
  `${productId}::${variant ?? 'Default'}`;

const pendingSyncKeys = new Set<string>();

let loadFromDatabaseRequestId = 0;

const applyLoadedCartItems = (
  set: (partial: Partial<CartState> | ((state: CartState) => Partial<CartState>)) => void,
  previousItems: CartItem[],
  convertedItems: CartItem[],
) => {
  const previousSelectionById = new Map(previousItems.map((item) => [item.id, item.selected]));
  const previousSelectionByKey = new Map(
    previousItems.map((item) => [cartItemKey(item.product.id, item.variant), item.selected]),
  );

  set({
    items: convertedItems.map((item) => {
      if (previousSelectionById.has(item.id)) {
        return { ...item, selected: previousSelectionById.get(item.id)! };
      }

      const key = cartItemKey(item.product.id, item.variant);
      if (previousSelectionByKey.has(key)) {
        return { ...item, selected: previousSelectionByKey.get(key)! };
      }

      return item;
    }),
  });
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      userId: null, // Will be set when user logs in
      isLoading: false,
      isOnline: true,

      addItem: (product, quantity = 1, variant = 'Default') => {
        const state = get();
        const authState = useAuthStore.getState();
        const currentUserId = authState.user?.id || null;
        
        const existingItem = state.items.find(item => 
          item.product.id === product.id && item.variant === variant
        )

        let updatedItem: CartItem;

        if (existingItem) {
          updatedItem = {
            ...existingItem,
            quantity: existingItem.quantity + quantity
          };
          set({
            items: state.items.map(item =>
              item.id === existingItem.id ? updatedItem : item
            )
          })
        } else {
          updatedItem = {
            id: `${product.id}-${variant}-${Date.now()}`,
            product,
            quantity,
            selected: true,
            variant,
            addedAt: Date.now()
          };
          set({ items: [...state.items, updatedItem] })
        }

        // Sync to database in background if user is logged in and online
        if (currentUserId && state.isOnline) {
          const token = authState.token;
          const productId = product.id;
          void syncItemToDatabase(updatedItem, currentUserId, token || undefined).then((dbRowId) => {
            if (dbRowId == null) return;
            applySyncedCartItemId(set, get, productId, variant, dbRowId);
          });
        }
      },

      removeItem: (itemId) => {
        const state = get();
        const item = state.items.find((entry) => entry.id === itemId);
        if (!item) return;

        const authState = useAuthStore.getState();
        const currentUserId = authState.user?.id || null;
        const itemSnapshot = { ...item };

        set({
          items: state.items.filter((entry) => entry.id !== itemId),
        });

        if (currentUserId && state.isOnline) {
          const token = authState.token;
          void (async () => {
            const dbId = await ensureCartItemDbId(itemSnapshot, set, get);
            if (dbId) {
              await cartService.removeCartItem(dbId, token || undefined).catch(() => undefined);
            }
          })();
        }
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        const state = get();
        const item = state.items.find((entry) => entry.id === itemId);
        if (!item) return;

        const authState = useAuthStore.getState();
        const currentUserId = authState.user?.id || null;
        const itemSnapshot = { ...item, quantity };

        set({
          items: state.items.map((entry) =>
            entry.id === itemId ? { ...entry, quantity } : entry,
          ),
        });

        if (currentUserId && state.isOnline) {
          const token = authState.token;
          void (async () => {
            const dbId = await ensureCartItemDbId(itemSnapshot, set, get);
            if (dbId) {
              await cartService
                .updateCartItem(dbId, quantity, undefined, token || undefined)
                .catch(() => undefined);
            }
          })();
        }
      },

      toggleSelect: (itemId) => {
        const state = get();
        const item = state.items.find((entry) => entry.id === itemId);
        if (!item) return;
        get().setItemSelected(itemId, !item.selected);
      },

      setItemSelected: (itemId, selected) => {
        const state = get();
        const item = state.items.find((entry) => entry.id === itemId);
        if (!item || item.selected === selected) return;

        set({
          items: state.items.map((entry) =>
            entry.id === itemId ? { ...entry, selected } : entry,
          ),
        });

        void syncCartItemSelectionToDatabase(item, selected, state.isOnline, set, get);
      },

      setItemsSelected: (itemIds, selected) => {
        const state = get();
        const idSet = new Set(itemIds);
        const changedItems = state.items.filter((entry) => idSet.has(entry.id) && entry.selected !== selected);

        if (changedItems.length === 0) return;

        set({
          items: state.items.map((entry) =>
            idSet.has(entry.id) ? { ...entry, selected } : entry,
          ),
        });

        changedItems.forEach((entry) => {
          void syncCartItemSelectionToDatabase(entry, selected, state.isOnline, set, get);
        });
      },

      selectAll: () => {
        const { items } = get();
        const allSelected = items.length > 0 && items.every((item) => item.selected);
        get().setItemsSelected(
          items.map((item) => item.id),
          !allSelected,
        );
      },

      deselectAll: () => {
        const { items } = get();
        get().setItemsSelected(
          items.map((item) => item.id),
          false,
        );
      },

      removeItems: async (itemIds) => {
        for (const itemId of itemIds) {
          get().removeItem(itemId);
        }
      },

      clearCart: async (options?: { trackAbandonment?: boolean }) => {
        const { isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        
        // Clear items only; keep userId aligned with authenticated user
        set({ items: [], userId: currentUserId })
        
        // Clear from database if user is logged in and online
        if (currentUserId && isOnline) {
          try {
            const token = useAuthStore.getState().token;
            await cartService.clearCart(
              currentUserId,
              token || undefined,
              options?.trackAbandonment
            );
          } catch (error) {
            // Silently handle errors
          }
        }
      },

      clearCartLocal: () => {
        // Clear local state only (for logout/user switch)
        set({ items: [], userId: null })
      },

      setCartOpen: (isOpen) => {
        set({ isOpen })
      },

      setUserId: (userId) => {
        set({ userId })
        if (userId) {
          // Preserve locally added (possibly offline / not-yet-synced) items across a
          // cold start: when local items exist, upload + merge them with the server
          // cart instead of overwriting with server-only rows. On a genuine user switch
          // the cart is emptied first (clearCartLocal), so there is nothing to mis-upload.
          if (get().items.length > 0) {
            get().syncWithDatabase()
          } else {
            get().loadFromDatabase()
          }
        }
      },

      setOnlineStatus: (isOnline) => {
        set({ isOnline })
        // Sync with database when coming back online
        if (isOnline && get().userId) {
          get().syncWithDatabase()
        }
      },

      syncWithDatabase: async () => {
        const { items: localItems, isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        const token = authState.token
        
        if (!currentUserId || !isOnline) return

        const requestId = ++loadFromDatabaseRequestId
        set({ isLoading: true })

        try {
          const serverRows = await cartService.getCart(currentUserId, token || undefined)
          if (requestId !== loadFromDatabaseRequestId) return

          const serverByKey = new Map<string, CartItem>()
          for (const row of serverRows) {
            const item = convertDatabaseToCartItem(row)
            serverByKey.set(cartItemKey(item.product.id, item.variant), item)
          }

          for (const item of localItems) {
            const key = cartItemKey(item.product.id, item.variant)
            if (pendingSyncKeys.has(key)) continue

            const serverItem = serverByKey.get(key)

            if (serverItem) {
              const dbId = parseDbCartItemId(serverItem.id)
              if (
                dbId &&
                (item.quantity !== serverItem.quantity || item.selected !== serverItem.selected)
              ) {
                await cartService
                  .updateCartItem(dbId, item.quantity, item.selected, token || undefined)
                  .catch(() => undefined)
              }
              continue
            }

            const dbRowId = await syncItemToDatabase(item, currentUserId, token || undefined)
            if (dbRowId != null && requestId === loadFromDatabaseRequestId) {
              applySyncedCartItemId(set, get, item.product.id, item.variant ?? 'Default', dbRowId)
            }
          }

          if (requestId !== loadFromDatabaseRequestId) return

          const freshRows = await cartService.getCart(currentUserId, token || undefined)
          if (requestId !== loadFromDatabaseRequestId) return

          const mergedLocalItems = get().items
          applyLoadedCartItems(
            set,
            mergedLocalItems.length > 0 ? mergedLocalItems : localItems,
            freshRows.map(convertDatabaseToCartItem),
          )
        } catch {
          // Silently handle errors
        } finally {
          if (requestId === loadFromDatabaseRequestId) {
            set({ isLoading: false })
          }
        }
      },

      loadFromDatabase: async () => {
        const { isOnline, items: previousItems } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        const token = authState.token
        
        if (!currentUserId || !isOnline) return

        const requestId = ++loadFromDatabaseRequestId
        set({ isLoading: true })
        try {
          const cartItems = await cartService.getCart(currentUserId, token || undefined)
          if (requestId !== loadFromDatabaseRequestId) return

          applyLoadedCartItems(
            set,
            previousItems,
            cartItems.map(convertDatabaseToCartItem),
          )
        } catch {
          // Silently handle errors
        } finally {
          if (requestId === loadFromDatabaseRequestId) {
            set({ isLoading: false })
          }
        }
      },

      initializeUser: (userId) => {
        set({ 
          userId, 
          isOnline: true 
        })
        // Load existing cart from database
        get().loadFromDatabase()
      },

      // Load cart from database on app start
      loadCartOnStart: () => {
        const { isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        
        if (currentUserId && isOnline) {
          get().loadFromDatabase()
        }
      },

      // Check auth state and load cart if user is logged in
      checkAuthAndLoadCart: () => {
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        
        if (currentUserId) {
          // Load cart from database in background
          get().loadFromDatabase()
        }
      },

      // Initialize cart on app start - load from database immediately
      initializeCart: () => {
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        
        set({ userId: currentUserId })
        
        if (currentUserId) {
          get().loadFromDatabase()
        } else {
          set({ items: [], isLoading: false })
        }
      },

      // Getters
      getSelectedItems: () => {
        const { items } = get()
        return items.filter(item => item.selected)
      },

      getTotalPrice: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().reduce((total, item) => {
          const marketplaceProduct = item.product as MarketplaceProduct;
          const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
          const { unitPrice } = resolveVariantPricing(
            marketplaceProduct,
            item.variant,
            item.product.sellingPrice || 0,
          );
          return total + (unitPrice * item.quantity * piecesPerPackage);
        }, 0)
      },

      getTotalSaved: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().reduce((total, item) => {
          const marketplaceProduct = item.product as MarketplaceProduct;
          const piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
          const { unitPrice, originalPrice } = resolveVariantPricing(
            marketplaceProduct,
            item.variant,
            item.product.sellingPrice || 0,
          );
          return total + ((originalPrice - unitPrice) * item.quantity * piecesPerPackage);
        }, 0)
      },

      getItemCount: () => {
        const { items } = get()
        return items.length
      },

      getSelectedItemCount: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().length
      },
    }),
    {
      name: 'laku-marketplace-cart-v2',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: compactCartItemsForPersist(state.items),
        userId: state.userId,
      }),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return { items: [], userId: null };
        if (version === 2) return persisted as never;
        return { items: [], userId: null };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Only reconcile ownership when the authenticated user is already known. On a
        // cold start the auth store hydrates asynchronously (getMe), so user?.id is
        // briefly null even for a returning session — wiping here would drop locally
        // added, still-unsynced items (the rehydration race). Ownership is instead
        // reconciled once auth resolves: authStore.setUser clears the cart on a genuine
        // user switch, and setUserId merges the same user's local + server carts.
        const authUserId = useAuthStore.getState().user?.id ?? null;
        if (state.userId != null && authUserId != null && state.userId !== authUserId) {
          state.items = [];
          state.userId = authUserId;
        }
      },
    },
  )
)
