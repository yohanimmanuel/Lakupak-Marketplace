import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { MarketplaceProduct } from '../services/marketplace'
import { useAuthStore } from './authStore'
import { API_BASE_URL } from '../services/config'

// Database user activity interface (matches Prisma schema)
interface DatabaseUserActivity {
  id: number;
  userId: number;
  productId: string;
  productData: any; // Complete product data as JSON
  activityType: string; // 'cart', 'favorite', 'viewed', 'purchased'
  metadata: any; // Additional data (quantity, variant, etc.)
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
const convertDatabaseToCartItem = (dbItem: DatabaseUserActivity): CartItem => {
  // Use the stored product data directly
  return {
    id: `db-${dbItem.id}`,
    product: dbItem.productData as MarketplaceProduct,
    quantity: dbItem.metadata?.quantity || 1,
    selected: dbItem.metadata?.selected || true,
    variant: dbItem.metadata?.variant || 'Default',
    addedAt: new Date(dbItem.createdAt).getTime()
  };
};

// Helper function to sync cart item to database
const syncItemToDatabase = async (item: CartItem, userId: number): Promise<void> => {
  try {
    // Check if server is available first
    const response = await fetch(`${API_BASE_URL}/api/mobile/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        productId: item.product.id,
        productData: item.product, // Send complete product data
        quantity: item.quantity,
        variant: item.variant || 'Default'
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
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
          syncItemToDatabase(updatedItem, currentUserId);
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
          const dbId = itemId.startsWith('db-') ? itemId.replace('db-', '') : null;
          
          if (dbId) {
            // Delete from database
            fetch(`${API_BASE_URL}/api/mobile/cart?cartItemId=${dbId}`, {
              method: 'DELETE'
            }).catch(error => {
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
          const dbId = itemId.startsWith('db-') ? itemId.replace('db-', '') : null;
          
          if (dbId) {
            fetch(`${API_BASE_URL}/api/mobile/cart`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cartItemId: dbId, quantity })
            }).catch(error => {
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

      clearCart: () => {
        set({ items: [] })
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
        
        if (!currentUserId || !isOnline) return

        set({ isLoading: true })
        try {
          // Sync all local items to database
          for (const item of items) {
            await syncItemToDatabase(item, currentUserId)
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
        
        if (!currentUserId || !isOnline) return

        set({ isLoading: true })
        try {
          const response = await fetch(`${API_BASE_URL}/api/mobile/cart?userId=${currentUserId}`)
          if (response.ok) {
            const data = await response.json()
            const cartItems = data.cartItems.map(convertDatabaseToCartItem)
            set({ items: cartItems })
          }
        } catch (error) {
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
        
        if (currentUserId) {
          // Load immediately and set loading state
          set({ isLoading: true })
          get().loadFromDatabase()
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
          return total + (item.product.price * item.quantity)
        }, 0)
      },

      getTotalSaved: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().reduce((total, item) => {
          const originalPrice = (item.product as MarketplaceProduct).originalPrice || item.product.price
          return total + ((originalPrice - item.product.price) * item.quantity)
        }, 0)
      },

      getItemCount: () => {
        const { items } = get()
        return items.length
      },

      getSelectedItemCount: () => {
        const { getSelectedItems } = get()
        return getSelectedItems().reduce((total, item) => total + item.quantity, 0)
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
