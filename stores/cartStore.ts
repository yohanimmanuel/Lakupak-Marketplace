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

const syncCartItemSelectionToDatabase = async (
  item: CartItem,
  selected: boolean,
  isOnline: boolean,
): Promise<void> => {
  if (!isOnline) return;

  const authState = useAuthStore.getState();
  const dbId = parseDbCartItemId(item.id);
  if (!dbId) return;

  await cartService.updateCartItem(dbId, undefined, selected, authState.token || undefined).catch(() => {
    // Silently handle errors
  });
};

// Helper function to sync cart item to database
const syncItemToDatabase = async (item: CartItem, userId: number, token?: string): Promise<void> => {
  try {
    await cartService.addToCart(
      userId,
      item.product.id,
      item.product as MarketplaceProduct,
      item.quantity,
      item.variant || 'Default',
      token
    );
  } catch (error) {
    // Silently handle network errors
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      return;
    }
  }
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
          syncItemToDatabase(updatedItem, currentUserId, token || undefined);
        }
      },

      removeItem: (itemId) => {
        const state = get();
        const authState = useAuthStore.getState();
        const currentUserId = authState.user?.id || null;
        
        // Remove from local state
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        }));

        // Remove from database if user is logged in
        if (currentUserId && state.isOnline) {
          // Extract database ID from item ID (format: db-{id} or {productId}-{variant}-{timestamp})
          const dbId = itemId.startsWith('db-') ? parseInt(itemId.replace('db-', ''), 10) : null;
          const token = authState.token;
          
          if (dbId && !isNaN(dbId)) {
            // Delete from database
            cartService.removeCartItem(dbId, token || undefined).catch(() => {
              // Silently handle errors
            });
          }
        }
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId)
          return
        }
        
        const state = get();
        const authState = useAuthStore.getState();
        const currentUserId = authState.user?.id || null;
        
        // Update local state
        set((state) => ({
          items: state.items.map(item =>
            item.id === itemId ? { ...item, quantity } : item
          )
        }));

        // Update database if user is logged in
        if (currentUserId && state.isOnline) {
          const dbId = itemId.startsWith('db-') ? parseInt(itemId.replace('db-', ''), 10) : null;
          const token = authState.token;
          
          if (dbId && !isNaN(dbId)) {
            cartService.updateCartItem(dbId, quantity, undefined, token || undefined).catch(() => {
              // Silently handle errors
            });
          }
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

        void syncCartItemSelectionToDatabase(item, selected, state.isOnline);
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
          void syncCartItemSelectionToDatabase(entry, selected, state.isOnline);
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
        
        // Clear local state immediately
        set({ items: [], userId: null })
        
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
        // Load cart from database when user logs in
        if (userId) {
          get().loadFromDatabase()
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
        const { items, isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        const token = authState.token
        
        if (!currentUserId || !isOnline) return

        set({ isLoading: true })
        try {
          // Sync all local items to database
          for (const item of items) {
            await syncItemToDatabase(item, currentUserId, token || undefined)
          }
        } catch (error) {
        } finally {
          set({ isLoading: false })
        }
      },

      loadFromDatabase: async () => {
        const { isOnline, items: previousItems } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        const token = authState.token
        
        if (!currentUserId || !isOnline) return

        const previousSelectionById = new Map(previousItems.map((item) => [item.id, item.selected]));
        const previousSelectionByKey = new Map(
          previousItems.map((item) => [
            `${item.product.id}::${item.variant ?? 'Default'}`,
            item.selected,
          ]),
        );

        set({ isLoading: true })
        try {
          const cartItems = await cartService.getCart(currentUserId, token || undefined)
          const convertedItems = cartItems.map(convertDatabaseToCartItem).map((item) => {
            if (previousSelectionById.has(item.id)) {
              return { ...item, selected: previousSelectionById.get(item.id)! };
            }

            const key = `${item.product.id}::${item.variant ?? 'Default'}`;
            if (previousSelectionByKey.has(key)) {
              return { ...item, selected: previousSelectionByKey.get(key)! };
            }

            return item;
          });
          set({ items: convertedItems })
        } catch (error) {
          // Silently handle errors
        } finally {
          set({ isLoading: false })
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
        
        // Update userId in store
        set({ userId: currentUserId })
        
        if (currentUserId) {
          // Load immediately and set loading state
          set({ isLoading: true })
          get().loadFromDatabase()
        } else {
          // No user - clear cart
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
    },
  )
)
