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
  
  // Actions
  setUser: (user: MobileUser | null) => void
  setProducts: (products: MarketplaceProduct[]) => void
  loadUserData: (token: string) => Promise<void>
  loadProductsData: (forceRefresh?: boolean) => Promise<void>
  refreshAllData: (token?: string) => Promise<void>
  forceRefreshProducts: () => Promise<void>
  clearProductsCache: () => void
  clearCache: () => void
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

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

      clearProductsCache: () => set({
        products: [],
        productsLastUpdated: null,
        isProductsLoading: false,
      }),

      clearCache: () => set({
        user: null,
        userLastUpdated: null,
        products: [],
        productsLastUpdated: null,
        isUserLoading: false,
        isProductsLoading: false,
      }),
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
