import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { sampleProducts, Product } from '../data/sampleProducts'
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
  loadProductsData: () => Promise<void>
  refreshAllData: (token?: string) => Promise<void>
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

      loadProductsData: async () => {
        const { productsLastUpdated } = get()
        const now = Date.now()
        
        // Return cached data if still fresh
        if (productsLastUpdated && (now - productsLastUpdated) < CACHE_DURATION) {
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
          // Fallback to sample data
          set({ 
            products: sampleProducts as MarketplaceProduct[], 
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
        promises.push(get().loadProductsData())
        
        await Promise.all(promises)
      },

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
