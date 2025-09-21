import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { MarketplaceProduct } from '../services/marketplace'

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
  
  // Actions
  addItem: (product: Product | MarketplaceProduct, quantity?: number, variant?: string) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  toggleSelect: (itemId: string) => void
  selectAll: () => void
  deselectAll: () => void
  clearCart: () => void
  clearStorage: () => void
  setCartOpen: (isOpen: boolean) => void
  
  // Getters
  getSelectedItems: () => CartItem[]
  getTotalPrice: () => number
  getTotalSaved: () => number
  getItemCount: () => number
  getSelectedItemCount: () => number
}

export const useCartStore = create<CartState>()(
  // Temporarily disable persistence to fix AsyncStorage full error
  // persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, quantity = 1, variant = 'Default') => {
        const state = get();
        const existingItem = state.items.find(item => 
          item.product.id === product.id && item.variant === variant
        )

        if (existingItem) {
          set({
            items: state.items.map(item =>
              item.id === existingItem.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          })
        } else {
          const newItem: CartItem = {
            id: `${product.id}-${variant}-${Date.now()}`,
            product,
            quantity,
            selected: true,
            variant,
            addedAt: Date.now()
          }
          set({ items: [...state.items, newItem] })
        }
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        }))
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId)
          return
        }
        
        set((state) => ({
          items: state.items.map(item =>
            item.id === itemId ? { ...item, quantity } : item
          )
        }))
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

      clearStorage: () => {
        // Clear AsyncStorage to free up space
        AsyncStorage.clear().catch(console.error);
        set({ items: [] });
      },

      setCartOpen: (isOpen) => {
        set({ isOpen })
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
  // Temporarily disabled persistence to fix AsyncStorage full error
  // }),
  // {
  //   name: 'laku-marketplace-cart',
  //   storage: createJSONStorage(() => AsyncStorage),
  //   partialize: (state) => ({
  //     items: state.items,
  //   }),
  // }
  // )
)
