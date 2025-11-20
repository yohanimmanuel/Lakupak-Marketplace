import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { marketplaceService, MarketplaceProduct } from '../services/marketplace'
import { getMe, MobileUser } from '../services/user'
import { websocketService } from '../services/websocket'

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
  
  // Polling state (fallback when WebSocket unavailable)
  pollingInterval: ReturnType<typeof setInterval> | null
  isPolling: boolean
  
  // WebSocket state
  isWebSocketConnected: boolean
  websocketUnsubscribe: (() => void) | null
  
  // Actions
  setUser: (user: MobileUser | null) => void
  setProducts: (products: MarketplaceProduct[]) => void
  loadUserData: (token: string) => Promise<void>
  loadProductsData: (forceRefresh?: boolean) => Promise<void>
  refreshAllData: (token?: string) => Promise<void>
  forceRefreshProducts: () => Promise<void>
  startAutoRefresh: (token?: string | null) => void
  stopAutoRefresh: () => void
  clearProductsCache: () => void
  clearCache: () => void
}

const CACHE_DURATION = 1 * 60 * 1000 // 1 minute
const AUTO_REFRESH_INTERVAL = 10 * 1000 // 10 seconds - refresh offers automatically

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
      isWebSocketConnected: false,
      websocketUnsubscribe: null,

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

      startAutoRefresh: (token?: string | null) => {
        const { pollingInterval, isPolling, websocketUnsubscribe } = get()
        
        // Clean up existing connections
        if (websocketUnsubscribe) {
          websocketUnsubscribe()
        }
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        
        // Try WebSocket first (real-time updates)
        try {
          websocketService.connect(token)
          
          // Subscribe to WebSocket messages
          const unsubscribe = websocketService.subscribe((message) => {
            const state = get()
            
            // Handle different message types
            if (message.type === 'offer_updated' || message.type === 'product_updated' || message.type === 'prices_updated') {
              // Refresh products when offers/products are updated
              if (!state.isProductsLoading) {
                state.forceRefreshProducts()
              }
            }
          })
          
          // Check WebSocket connection status
          const checkConnection = () => {
            const isConnected = websocketService.isConnected()
            const currentState = get()
            
            if (isConnected !== currentState.isWebSocketConnected) {
              set({ isWebSocketConnected: isConnected })
            }
            
            // If WebSocket is not connected, fallback to polling
            if (!isConnected && !currentState.isPolling) {
              // Start polling as fallback
              const interval = setInterval(() => {
                const state = get()
                // Only refresh if not currently loading and WebSocket still disconnected
                if (!state.isProductsLoading && !websocketService.isConnected()) {
                  state.forceRefreshProducts()
                } else if (websocketService.isConnected()) {
                  // WebSocket reconnected, stop polling
                  clearInterval(interval)
                  set({ pollingInterval: null, isPolling: false })
                }
              }, AUTO_REFRESH_INTERVAL)
              
              set({ 
                pollingInterval: interval, 
                isPolling: true 
              })
            } else if (isConnected && currentState.isPolling) {
              // WebSocket connected, stop polling
              if (currentState.pollingInterval) {
                clearInterval(currentState.pollingInterval)
              }
              set({ 
                pollingInterval: null, 
                isPolling: false 
              })
            }
          }
          
          // Check connection status periodically
          const connectionCheckInterval = setInterval(checkConnection, 2000)
          
          // Initial check
          checkConnection()
          
          set({ 
            websocketUnsubscribe: () => {
              unsubscribe()
              clearInterval(connectionCheckInterval)
            },
            isWebSocketConnected: websocketService.isConnected()
          })
        } catch (error) {
          // WebSocket failed, use polling fallback
          const interval = setInterval(() => {
            const state = get()
            if (!state.isProductsLoading) {
              state.forceRefreshProducts()
            }
          }, AUTO_REFRESH_INTERVAL)
          
          set({ 
            pollingInterval: interval, 
            isPolling: true,
            isWebSocketConnected: false,
            websocketUnsubscribe: null
          })
        }
      },

      stopAutoRefresh: () => {
        const { pollingInterval, websocketUnsubscribe } = get()
        
        // Disconnect WebSocket
        websocketService.disconnect()
        
        // Unsubscribe from WebSocket messages
        if (websocketUnsubscribe) {
          websocketUnsubscribe()
        }
        
        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        
        set({ 
          pollingInterval: null, 
          isPolling: false,
          isWebSocketConnected: false,
          websocketUnsubscribe: null
        })
      },

      clearProductsCache: () => {
        const { pollingInterval, websocketUnsubscribe } = get()
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        if (websocketUnsubscribe) {
          websocketUnsubscribe()
        }
        websocketService.disconnect()
        set({
          products: [],
          productsLastUpdated: null,
          isProductsLoading: false,
          pollingInterval: null,
          isPolling: false,
          isWebSocketConnected: false,
          websocketUnsubscribe: null,
        })
      },

      clearCache: () => {
        const { pollingInterval, websocketUnsubscribe } = get()
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        if (websocketUnsubscribe) {
          websocketUnsubscribe()
        }
        websocketService.disconnect()
        set({
          user: null,
          userLastUpdated: null,
          products: [],
          productsLastUpdated: null,
          isUserLoading: false,
          isProductsLoading: false,
          pollingInterval: null,
          isPolling: false,
          isWebSocketConnected: false,
          websocketUnsubscribe: null,
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
