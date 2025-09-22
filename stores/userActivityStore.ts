import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MarketplaceProduct } from '../services/marketplace'
import { userActivityService, UserActivity } from '../services/userActivity'

interface UserActivityState {
  // User activity data
  likedProducts: string[] // Array of product IDs
  viewedProducts: string[] // Array of product IDs (most recent first)
  orderedProducts: string[] // Array of product IDs
  currentUserId: number | null
  
  // Actions
  setCurrentUserId: (userId: number) => void
  addLikedProduct: (productId: string, productData: MarketplaceProduct) => Promise<void>
  removeLikedProduct: (productId: string) => Promise<void>
  toggleLikedProduct: (productId: string, productData: MarketplaceProduct) => Promise<void>
  addViewedProduct: (productId: string, productData: MarketplaceProduct) => Promise<void>
  addOrderedProduct: (productId: string, productData: MarketplaceProduct) => Promise<void>
  isProductLiked: (productId: string) => boolean
  getLikedProducts: (allProducts: MarketplaceProduct[]) => MarketplaceProduct[]
  getViewedProducts: (allProducts: MarketplaceProduct[]) => MarketplaceProduct[]
  getOrderedProducts: (allProducts: MarketplaceProduct[]) => MarketplaceProduct[]
  loadUserActivities: (userId: number) => Promise<void>
  refreshUserActivities: () => Promise<void>
  clearAllActivity: () => void
}

export const useUserActivityStore = create<UserActivityState>()(
  persist(
    (set, get) => ({
      // Initial state
      likedProducts: [],
      viewedProducts: [],
      orderedProducts: [],
      currentUserId: null,

      // Actions
      setCurrentUserId: (userId) => {
        set({ currentUserId: userId })
      },

      addLikedProduct: async (productId, productData) => {
        const { currentUserId, likedProducts } = get()
        if (!currentUserId) return

        // Optimistic update - update UI immediately
        if (!likedProducts.includes(productId)) {
          set({ likedProducts: [...likedProducts, productId] })
        }

        // API call in background
        try {
          await userActivityService.addActivity(currentUserId, productId, productData, 'favorite')
        } catch (error) {
          // Revert on error
          set({ likedProducts: likedProducts.filter(id => id !== productId) })
        }
      },

      removeLikedProduct: async (productId) => {
        const { currentUserId, likedProducts } = get()
        if (!currentUserId) return

        // Optimistic update - update UI immediately
        const newLikedProducts = likedProducts.filter(id => id !== productId)
        set({ likedProducts: newLikedProducts })

        // API call in background
        try {
          await userActivityService.removeActivity(currentUserId, productId, 'favorite')
        } catch (error) {
          // Revert on error
          set({ likedProducts: [...newLikedProducts, productId] })
        }
      },

      toggleLikedProduct: async (productId, productData) => {
        const { currentUserId, likedProducts } = get()
        if (!currentUserId) {
          return
        }

        const isCurrentlyLiked = likedProducts.includes(productId)
        
        // Optimistic update - update UI immediately
        if (isCurrentlyLiked) {
          set({ likedProducts: likedProducts.filter(id => id !== productId) })
        } else {
          set({ likedProducts: [...likedProducts, productId] })
        }

        // API call in background
        try {
          const result = await userActivityService.toggleFavorite(currentUserId, productId, productData)
          // No need to update UI again since we already did optimistic update
        } catch (error) {
          // Revert on error
          if (isCurrentlyLiked) {
            set({ likedProducts: [...likedProducts, productId] })
          } else {
            set({ likedProducts: likedProducts.filter(id => id !== productId) })
          }
        }
      },

      addViewedProduct: async (productId, productData) => {
        const { currentUserId, viewedProducts } = get()
        if (!currentUserId) return

        // Optimistic update - update UI immediately
        const filtered = viewedProducts.filter(id => id !== productId)
        const newViewedProducts = [productId, ...filtered].slice(0, 10)
        set({ viewedProducts: newViewedProducts })

        // API call in background
        try {
          await userActivityService.addViewed(currentUserId, productId, productData)
        } catch (error) {
          // Revert on error
          set({ viewedProducts: viewedProducts })
        }
      },

      addOrderedProduct: async (productId, productData) => {
        const { currentUserId, orderedProducts } = get()
        if (!currentUserId) return

        // Optimistic update - update UI immediately
        if (!orderedProducts.includes(productId)) {
          set({ orderedProducts: [...orderedProducts, productId] })
        }

        // API call in background
        try {
          await userActivityService.addPurchased(currentUserId, productId, productData)
        } catch (error) {
          // Revert on error
          set({ orderedProducts: orderedProducts.filter(id => id !== productId) })
        }
      },

      isProductLiked: (productId) => {
        const { likedProducts } = get()
        return likedProducts.includes(productId)
      },

      getLikedProducts: (allProducts) => {
        const { likedProducts } = get()
        return allProducts.filter(product => likedProducts.includes(product.id))
      },

      getViewedProducts: (allProducts) => {
        const { viewedProducts } = get()
        return viewedProducts
          .map(productId => allProducts.find(product => product.id === productId))
          .filter((product): product is MarketplaceProduct => product !== undefined)
      },

      getOrderedProducts: (allProducts) => {
        const { orderedProducts } = get()
        return allProducts.filter(product => orderedProducts.includes(product.id))
      },

      loadUserActivities: async (userId) => {
        // Set user ID immediately
        set({ currentUserId: userId })
        
        // Load activities in background without blocking UI
        try {
          const [favorites, viewed, purchased] = await Promise.all([
            userActivityService.getActivities(userId, 'favorite'),
            userActivityService.getActivities(userId, 'viewed'),
            userActivityService.getActivities(userId, 'purchased')
          ])

          set({
            likedProducts: favorites.map(activity => activity.productId),
            viewedProducts: viewed.map(activity => activity.productId),
            orderedProducts: purchased.map(activity => activity.productId),
            currentUserId: userId
          })
        } catch (error) {
          // Keep existing data on error, don't clear it
        }
      },

      refreshUserActivities: async () => {
        const { currentUserId } = get()
        if (!currentUserId) return

        // Load activities in background without blocking UI
        try {
          const [favorites, viewed, purchased] = await Promise.all([
            userActivityService.getActivities(currentUserId, 'favorite'),
            userActivityService.getActivities(currentUserId, 'viewed'),
            userActivityService.getActivities(currentUserId, 'purchased')
          ])

          set({
            likedProducts: favorites.map(activity => activity.productId),
            viewedProducts: viewed.map(activity => activity.productId),
            orderedProducts: purchased.map(activity => activity.productId)
          })
        } catch (error) {
          // Keep existing data on error, don't clear it
        }
      },

      clearAllActivity: () => {
        set({
          likedProducts: [],
          viewedProducts: [],
          orderedProducts: [],
          currentUserId: null
        })
      }
    }),
    {
      name: 'laku-marketplace-user-activity',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
