import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MarketplaceProduct } from '../services/marketplace'
import { userActivityService, UserActivity } from '../services/userActivity'
import { useAuthStore } from './authStore'

interface UserActivityState {
  // User activity data
  likedProducts: string[] // Array of product IDs
  viewedProducts: string[] // Array of product IDs (most recent first)
  orderedProducts: string[] // Array of product IDs
  currentUserId: number | null
  lastViewedResetDate: string // Track when viewed products were last reset
  
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
  clearUserData: () => void
}

export const useUserActivityStore = create<UserActivityState>()(
  persist(
    (set, get) => ({
      // Initial state
      likedProducts: [],
      viewedProducts: [],
      orderedProducts: [],
      currentUserId: null,
      lastViewedResetDate: '',

      // Actions
      setCurrentUserId: (userId) => {
        set({ currentUserId: userId })
      },

      addLikedProduct: async (productId, productData) => {
        const pid = String(productId)
        const { currentUserId, likedProducts } = get()
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = currentUserId ?? authUserId
        if (!userId) return
        if (currentUserId !== userId) set({ currentUserId: userId })

        if (!likedProducts.some((id) => String(id) === pid)) {
          set({ likedProducts: [...likedProducts, pid] })
        }

        try {
          const token = useAuthStore.getState().token
          await userActivityService.addActivity(userId, pid, productData, 'favorite', undefined, token || undefined)
        } catch {
          set({ likedProducts: likedProducts.filter((id) => String(id) !== pid) })
        }
      },

      removeLikedProduct: async (productId) => {
        const pid = String(productId)
        const { currentUserId, likedProducts } = get()
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = currentUserId ?? authUserId
        if (!userId) return
        if (currentUserId !== userId) set({ currentUserId: userId })

        const newLikedProducts = likedProducts.filter((id) => String(id) !== pid)
        set({ likedProducts: newLikedProducts })

        try {
          const token = useAuthStore.getState().token
          await userActivityService.removeActivity(userId, pid, 'favorite', token || undefined)
        } catch {
          set({ likedProducts: [...newLikedProducts, pid] })
        }
      },

      toggleLikedProduct: async (productId, productData) => {
        const pid = String(productId)
        const { currentUserId, likedProducts } = get()
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = currentUserId ?? authUserId
        if (!userId) {
          return
        }
        if (currentUserId !== userId) {
          set({ currentUserId: userId })
        }

        // Use local state as source of truth for the API call. toggleFavorite() re-fetched
        // the server and toggled from *that* state — when persist/server diverged, like became
        // delete and unlike became add (inverted metrics on the dashboard).
        const wasLiked = likedProducts.some((id) => String(id) === pid)
        const previousLiked = likedProducts

        if (wasLiked) {
          set({ likedProducts: likedProducts.filter((id) => String(id) !== pid) })
        } else {
          set({ likedProducts: [...likedProducts, pid] })
        }

        try {
          const token = useAuthStore.getState().token
          if (wasLiked) {
            await userActivityService.removeActivity(userId, pid, 'favorite', token || undefined)
          } else {
            await userActivityService.addActivity(
              userId,
              pid,
              productData,
              'favorite',
              undefined,
              token || undefined
            )
          }
        } catch {
          set({ likedProducts: previousLiked })
        }
      },

      addViewedProduct: async (productId, productData) => {
        const { currentUserId, viewedProducts } = get()
        if (!currentUserId) return

        // Check if we need to reset viewed products for new day
        const today = new Date().toDateString()
        const lastResetDate = get().lastViewedResetDate || ''
        
        let newViewedProducts = viewedProducts
        
        // Reset viewed products if it's a new day
        if (lastResetDate !== today) {
          newViewedProducts = []
          set({ lastViewedResetDate: today })
        }

        // Optimistic update - update UI immediately
        const filtered = newViewedProducts.filter(id => id !== productId)
        const updatedViewedProducts = [productId, ...filtered].slice(0, 10)
        set({ viewedProducts: updatedViewedProducts })

        // API call in background
        try {
          const token = useAuthStore.getState().token
          await userActivityService.addViewed(currentUserId, productId, productData, token || undefined)
        } catch (error) {
          // Revert on error
          set({ viewedProducts: newViewedProducts })
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
          const token = useAuthStore.getState().token
          await userActivityService.addPurchased(currentUserId, productId, productData, undefined, token || undefined)
        } catch (error) {
          // Revert on error
          set({ orderedProducts: orderedProducts.filter(id => id !== productId) })
        }
      },

      isProductLiked: (productId) => {
        const { likedProducts } = get()
        const pid = String(productId)
        return likedProducts.some((id) => String(id) === pid)
      },

      getLikedProducts: (allProducts) => {
        const { likedProducts } = get()
        return allProducts.filter((product) =>
          likedProducts.some((id) => String(id) === String(product.id))
        )
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
        
        // Check if we need to reset viewed products for new day
        const today = new Date().toDateString()
        const lastResetDate = get().lastViewedResetDate || ''
        
        // Load activities in background without blocking UI
        try {
          const token = useAuthStore.getState().token
          const [favorites, viewed, purchased] = await Promise.all([
            userActivityService.getActivities(userId, 'favorite', token || undefined),
            userActivityService.getActivities(userId, 'viewed', token || undefined),
            userActivityService.getActivities(userId, 'purchased', token || undefined)
          ])

          // Reset viewed products if it's a new day
          const viewedProductIds = lastResetDate !== today ? [] : viewed.map(activity => activity.productId)

          set({
            likedProducts: favorites.map(activity => activity.productId),
            viewedProducts: viewedProductIds,
            orderedProducts: purchased.map(activity => activity.productId),
            currentUserId: userId,
            lastViewedResetDate: today
          })
        } catch (error) {
          // Keep existing data on error, don't clear it
        }
      },

      refreshUserActivities: async () => {
        const { currentUserId, lastViewedResetDate } = get()
        if (!currentUserId) return

        // Check if we need to reset viewed products for new day
        const today = new Date().toDateString()

        // Load activities in background without blocking UI
        try {
          const token = useAuthStore.getState().token
          const [favorites, viewed, purchased] = await Promise.all([
            userActivityService.getActivities(currentUserId, 'favorite', token || undefined),
            userActivityService.getActivities(currentUserId, 'viewed', token || undefined),
            userActivityService.getActivities(currentUserId, 'purchased', token || undefined)
          ])

          // Reset viewed products if it's a new day
          const viewedProductIds = lastViewedResetDate !== today ? [] : viewed.map(activity => activity.productId)

          set({
            likedProducts: favorites.map(activity => activity.productId),
            viewedProducts: viewedProductIds,
            orderedProducts: purchased.map(activity => activity.productId),
            lastViewedResetDate: today
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
          currentUserId: null,
          lastViewedResetDate: ''
        })
      },

      // Clear data when user logs out or switches
      clearUserData: () => {
        set({
          likedProducts: [],
          viewedProducts: [],
          orderedProducts: [],
          currentUserId: null,
          lastViewedResetDate: ''
        })
      }
    }),
    {
      name: 'laku-marketplace-user-activity',
      storage: createJSONStorage(() => AsyncStorage),
      // We'll handle user-specific storage manually in the store methods
    }
  )
)
