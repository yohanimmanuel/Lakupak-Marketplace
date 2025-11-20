import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { marketplaceService, MarketplaceProduct } from '../services/marketplace'
import { getMe, MobileUser } from '../services/user'

interface DataState {
  // User data
  user: MobileUser | null
  userLastUpdated: number | null
  
  // Products data
  products: MarketplaceProduct[]
  productsLastUpdated: number | null
  
  // Loading states
  isUserLoading: boolean
  isProductsLoading: boolean
  
  // Polling state
  pollingInterval: ReturnType<typeof setInterval> | null
  isPolling: boolean
  
  // Actions
  setUser: (user: MobileUser | null) => void
  setProducts: (products: MarketplaceProduct[]) => void
  loadUserData: (token: string) => Promise<void>
  loadProductsData: (forceRefresh?: boolean) => Promise<void>
  refreshAllData: (token?: string) => Promise<void>
  forceRefreshProducts: () => Promise<void>
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
  clearProductsCache: () => void
  clearCache: () => void
}

const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes
const AUTO_REFRESH_INTERVAL = 3 * 1000 // 3 seconds - refresh offers automatically

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      userLastUpdated: null,
      products: [],
      productsLastUpdated: null,
      isUserLoading: false,
      isProductsLoading: false,
      pollingInterval: null,
      isPolling: false,

      // Actions
      setUser: (user) => set({ user, userLastUpdated: Date.now() }),
      
      setProducts: (products) => set({ products, productsLastUpdated: Date.now() }),

      loadUserData: async (token) => {
        const { userLastUpdated } = get()
        const now = Date.now()
        
        // Return cached data if still fresh
        if (userLastUpdated && (now - userLastUpdated) < CACHE_DURATION) {
          return
        }

        set({ isUserLoading: true })
        try {
          const user = await getMe(token)
          set({ user, userLastUpdated: now, isUserLoading: false })
        } catch (error) {
          set({ isUserLoading: false })
          // Keep existing user data on error
        }
      },

      loadProductsData: async (forceRefresh = false) => {
        const { productsLastUpdated } = get()
        const now = Date.now()
        
        // Return cached data if still fresh and not forcing refresh
        if (!forceRefresh && productsLastUpdated && (now - productsLastUpdated) < CACHE_DURATION) {
          return
        }

        set({ isProductsLoading: true })
        try {
          const response = await marketplaceService.getProducts({ limit: 20 })
          set({ 
            products: response.products, 
            productsLastUpdated: now, 
            isProductsLoading: false 
          })
        } catch (error) {
          // No fallback to mock data - show empty state instead
          set({ 
            products: [], 
            productsLastUpdated: now, 
            isProductsLoading: false 
          })
        }
      },

      refreshAllData: async (token) => {
        const promises = []
        
        if (token) {
          promises.push(get().loadUserData(token))
        }
        // Force refresh products (bypass cache) when manually refreshing
        promises.push(get().forceRefreshProducts())
        
        await Promise.all(promises)
      },

      forceRefreshProducts: async () => {
        set({ isProductsLoading: true })
        try {
          const response = await marketplaceService.getProducts({ limit: 20 })
          set({ 
            products: response.products, 
            productsLastUpdated: Date.now(), 
            isProductsLoading: false 
          })
        } catch (error) {
          // No fallback to mock data - show empty state instead
          set({ 
            products: [], 
            productsLastUpdated: Date.now(), 
            isProductsLoading: false 
          })
        }
      },

      startAutoRefresh: () => {
        const { pollingInterval, isPolling } = get()
        
        // Don't start if already polling
        if (isPolling && pollingInterval) {
          return
        }
        
        // Clear any existing interval
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        
        // Start polling
        const interval = setInterval(() => {
          const state = get()
          // Only refresh if not currently loading to avoid overlapping requests
          if (!state.isProductsLoading) {
            state.forceRefreshProducts()
          }
        }, AUTO_REFRESH_INTERVAL)
        
        set({ 
          pollingInterval: interval, 
          isPolling: true 
        })
      },

      stopAutoRefresh: () => {
        const { pollingInterval } = get()
        if (pollingInterval) {
          clearInterval(pollingInterval)
          set({ 
            pollingInterval: null, 
            isPolling: false 
          })
        }
      },

      clearProductsCache: () => {
        const { pollingInterval } = get()
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        set({
          products: [],
          productsLastUpdated: null,
          isProductsLoading: false,
          pollingInterval: null,
          isPolling: false,
        })
      },

      clearCache: () => {
        const { pollingInterval } = get()
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        set({
          user: null,
          userLastUpdated: null,
          products: [],
          productsLastUpdated: null,
          isUserLoading: false,
          isProductsLoading: false,
          pollingInterval: null,
          isPolling: false,
        })
      },
    }),
    {
      name: 'laku-marketplace-data',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        userLastUpdated: state.userLastUpdated,
        products: state.products,
        productsLastUpdated: state.productsLastUpdated,
      }),
    }
  )
)
