import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { MarketplaceProduct } from '../services/marketplace'
import { useAuthStore } from './authStore'
import { cartService } from '../services/cart'

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
  product: Product | MarketplaceProduct;
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
  selectAll: () => void
  deselectAll: () => void
  clearCart: () => void
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
  // Temporarily disable AsyncStorage to fix disk full error
  // persist(
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
        const { items } = get()
        set({
          items: items.map(item =>
            item.id === itemId ? { ...item, selected: !item.selected } : item
          )
        })
      },

      selectAll: () => {
        const { items } = get()
        set({
          items: items.map(item => ({ ...item, selected: true }))
        })
      },

      deselectAll: () => {
        const { items } = get()
        set({
          items: items.map(item => ({ ...item, selected: false }))
        })
      },

      clearCart: async () => {
        const { items, isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        
        // Clear local state immediately
        set({ items: [], userId: null })
        
        // Clear from database if user is logged in and online
        if (currentUserId && isOnline) {
          try {
            const token = useAuthStore.getState().token;
            await cartService.clearCart(currentUserId, token || undefined);
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
        const { isOnline } = get()
        const authState = useAuthStore.getState()
        const currentUserId = authState.user?.id || null
        const token = authState.token
        
        if (!currentUserId || !isOnline) return

        set({ isLoading: true })
        try {
          const cartItems = await cartService.getCart(currentUserId, token || undefined)
          const convertedItems = cartItems.map(convertDatabaseToCartItem)
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
          // Get variant-specific pricing - use new variantOptions structure first
          const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
            id: number;
            sellingPrice: number;
            attributes: Record<string, string>;
          }> };
          let unitPrice = 0;
          let piecesPerPackage = 1;
          
          // Try new variantOptions structure first
          if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
            // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
            const variantAttributes: Record<string, string> = {};
            if (item.variant && item.variant !== 'Default') {
              item.variant.split(', ').forEach(part => {
                const [key, ...valueParts] = part.split(': ');
                if (key && valueParts.length > 0) {
                  variantAttributes[key.trim()] = valueParts.join(': ').trim();
                }
              });
            }
            
            // Find matching variantOption by attributes
            const matchingOption = marketplaceProduct.variantOptions.find(option => {
              if (!option.attributes) return false;
              return Object.entries(variantAttributes).every(([key, value]) => {
                return option.attributes?.[key] === value;
              });
            });
            
            if (matchingOption) {
              unitPrice = typeof matchingOption.sellingPrice === 'string' 
                ? parseFloat(matchingOption.sellingPrice) 
                : matchingOption.sellingPrice || 0;
            } else if (marketplaceProduct.variantOptions.length > 0) {
              // Fallback to first variantOption
              const firstOption = marketplaceProduct.variantOptions[0];
              unitPrice = typeof firstOption.sellingPrice === 'string' 
                ? parseFloat(firstOption.sellingPrice) 
                : firstOption.sellingPrice || 0;
            }
          } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
            // Legacy: Find the selected variant
            const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
            unitPrice = selectedVariant.sellingPrice || 0;
          } else {
            // Fallback to product-level pricing
            unitPrice = item.product.sellingPrice || 0;
          }
          
          // Get piecesPerPackage from product level (piece-based system)
          piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
          
          return total + (unitPrice * item.quantity * piecesPerPackage);
        }, 0)
      },

      getTotalSaved: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().reduce((total, item) => {
          // Get variant-specific pricing - use new variantOptions structure first
          const marketplaceProduct = item.product as MarketplaceProduct & { variantOptions?: Array<{
            id: number;
            sellingPrice: number;
            originalSellingPrice?: number | string;
            attributes: Record<string, string>;
          }> };
          let unitPrice = 0;
          let originalPrice = 0;
          let piecesPerPackage = 1;
          
          // Try new variantOptions structure first
          if (marketplaceProduct.variantOptions && Array.isArray(marketplaceProduct.variantOptions)) {
            // Parse variantName string (format: "Color: Red, Size: Large") to match attributes
            const variantAttributes: Record<string, string> = {};
            if (item.variant && item.variant !== 'Default') {
              item.variant.split(', ').forEach(part => {
                const [key, ...valueParts] = part.split(': ');
                if (key && valueParts.length > 0) {
                  variantAttributes[key.trim()] = valueParts.join(': ').trim();
                }
              });
            }
            
            // Find matching variantOption by attributes
            const matchingOption = marketplaceProduct.variantOptions.find(option => {
              if (!option.attributes) return false;
              return Object.entries(variantAttributes).every(([key, value]) => {
                return option.attributes?.[key] === value;
              });
            });
            
            if (matchingOption) {
              unitPrice = typeof matchingOption.sellingPrice === 'string' 
                ? parseFloat(matchingOption.sellingPrice) 
                : matchingOption.sellingPrice || 0;
              
              const origPrice = matchingOption.originalSellingPrice;
              originalPrice = origPrice 
                ? (typeof origPrice === 'string' ? parseFloat(origPrice) : origPrice)
                : unitPrice;
            } else if (marketplaceProduct.variantOptions.length > 0) {
              // Fallback to first variantOption
              const firstOption = marketplaceProduct.variantOptions[0];
              unitPrice = typeof firstOption.sellingPrice === 'string' 
                ? parseFloat(firstOption.sellingPrice) 
                : firstOption.sellingPrice || 0;
              
              const origPrice = firstOption.originalSellingPrice;
              originalPrice = origPrice 
                ? (typeof origPrice === 'string' ? parseFloat(origPrice) : origPrice)
                : unitPrice;
            }
          } else if (marketplaceProduct.variants && marketplaceProduct.variants.length > 0) {
            // Legacy: Find the selected variant
            const selectedVariant = marketplaceProduct.variants.find(v => v.variantName === item.variant) || marketplaceProduct.variants[0];
            unitPrice = selectedVariant.sellingPrice || 0;
            originalPrice = selectedVariant.originalSellingPrice || selectedVariant.sellingPrice || 0;
          } else {
            // Fallback to product-level pricing
            unitPrice = item.product.sellingPrice || 0;
            originalPrice = marketplaceProduct.originalSellingPrice || item.product.sellingPrice || 0;
          }
          
          // Get piecesPerPackage from product level (piece-based system)
          piecesPerPackage = marketplaceProduct.piecesPerPackage || 1;
          
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
    })
  // Temporarily disabled AsyncStorage persistence
  // }),
  // {
  //   name: 'laku-marketplace-cart',
  //   storage: createJSONStorage(() => AsyncStorage),
  //   partialize: (state) => ({
  //     items: state.items,
  //     userId: state.userId,
  //   }),
  // }
  // )
)
