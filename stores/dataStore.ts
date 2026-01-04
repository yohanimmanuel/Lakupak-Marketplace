import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { marketplaceService, MarketplaceProduct } from '../services/marketplace'
import { getMe, MobileUser } from '../services/user'
import { websocketService } from '../services/websocket'
import { ordersService } from '../services/orders'
import { useAuthStore } from './authStore'

export interface MarketplaceOrderItem {
  productId?: string | null
  productName?: string
  productType?: string
  brand?: string
  description?: string
  images?: string[]
  subtotal?: number
  packageType?: string
  piecesPerPackage?: number
  packageQuantity?: number
  pricePerPackage?: number
  offerApplied?: boolean
  offerBadgeSnapshot?: string | null
  offerNameSnapshot?: string | null
  originalPriceSnapshot?: number | null
  discountPercentage?: number | null
  discountAmount?: number | null
  promotionDetailsSnapshot?: string | null
  variantNameSnapshot?: string | null
  productDeleted?: boolean
  product?: {
    userId?: number | null
    name?: string
  } | null
}

export interface MarketplaceOrder {
  id?: number
  orderId: string
  buyerId?: string | null
  userId?: number | null
  storeName?: string
  orderStatus: string
  paymentStatus?: string
  deliveryMethod?: string
  deliveryOption?: string | null
  subtotal?: number
  shippingFee?: number
  discounts?: number
  totalAmount?: number
  totalOrders?: number
  contactPerson?: string
  contactPhone?: string
  deliveryAddress?: string
  orderDate?: string
  createdAt?: string
  updatedAt?: string
  cancelledAt?: string | null
  cancelledBy?: string | null
  cancellationReason?: string | null
  isDeleted?: boolean
  deletedAt?: string | null
  orderItems?: MarketplaceOrderItem[]
  user?: {
    id?: number
    name?: string
    username?: string
    email?: string
    phone?: string
    chosenAddress?: string
    storeName?: string
    company?: {
      name?: string
      logo?: string
      bannerImage?: string
      businessAddress?: string
      businessPhone?: string
      businessEmail?: string
      businessDescription?: string
      industryType?: string
      yearsInOperation?: string
    }
  }
}


interface DataState {
  // User data
  user: MobileUser | null
  userLastUpdated: number | null
  
  // Products data
  products: MarketplaceProduct[]
  productsLastUpdated: number | null

  // Orders data
  orders: MarketplaceOrder[]
  ordersLastUpdated: number | null
  
  // Loading states
  isUserLoading: boolean
  isProductsLoading: boolean
  isOrdersLoading: boolean
  
  // Polling state (fallback when WebSocket unavailable)
  pollingInterval: ReturnType<typeof setInterval> | null
  isPolling: boolean
  
  // WebSocket state
  isWebSocketConnected: boolean
  websocketUnsubscribe: (() => void) | null
  
  // Actions
  setUser: (user: MobileUser | null) => void
  setProducts: (products: MarketplaceProduct[]) => void
  setOrders: (orders: MarketplaceOrder[]) => void
  loadUserData: (token: string) => Promise<void>
  loadProductsData: (forceRefresh?: boolean) => Promise<void>
  loadOrdersData: (forceRefresh?: boolean) => Promise<void>
  refreshAllData: (token?: string) => Promise<void>
  forceRefreshProducts: () => Promise<void>
  forceRefreshOrders: () => Promise<void>
  updateOrdersFromWebSocket: (orderIds: string[]) => Promise<void>
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
      orders: [],
      ordersLastUpdated: null,
      isUserLoading: false,
      isProductsLoading: false,
      isOrdersLoading: false,
      pollingInterval: null,
      isPolling: false,
      isWebSocketConnected: false,
      websocketUnsubscribe: null,

      // Actions
      setUser: (user) => set({ user, userLastUpdated: Date.now() }),
      
      setProducts: (products) => set({ products, productsLastUpdated: Date.now() }),

      setOrders: (orders) => set({ orders, ordersLastUpdated: Date.now() }),

      loadUserData: async (token) => {
        const { userLastUpdated } = get()
        const now = Date.now()
        
        // Return cached data if still fresh
        if (userLastUpdated && (now - userLastUpdated) < CACHE_DURATION) {
          return
        }

        set({ isUserLoading: true })
        try {
          // Try to get userId from authStore first, fallback to token decoding
          const authState = useAuthStore.getState()
          const userId = authState.user?.id
          const user = await getMe(token, userId)
          
          // Update both dataStore and authStore to keep them in sync
          set({ user, userLastUpdated: now, isUserLoading: false })
          
          // Also update authStore so home page and other components see the updated user immediately
          const { setUser: setAuthUser } = useAuthStore.getState()
          await setAuthUser(user)
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

      loadOrdersData: async (forceRefresh = false) => {
        const { ordersLastUpdated } = get()
        const now = Date.now()

        const authState = useAuthStore.getState()
        const token = authState.token
        // CRITICAL: Only use userId from authStore, never from cached user data
        // This prevents loading orders for wrong user
        const userId = authState.user?.id

        if (!token || !userId) {
          // Clear orders if no valid user/token
          set({ orders: [], ordersLastUpdated: null, isOrdersLoading: false })
          return
        }

        // Validate that cached orders belong to current user
        const currentOrders = get().orders
        const cachedUserId = get().user?.id
        if (currentOrders.length > 0 && cachedUserId !== userId) {
          // User changed - clear old orders immediately
          set({ orders: [], ordersLastUpdated: null })
        }

        if (!forceRefresh && ordersLastUpdated && (now - ordersLastUpdated) < CACHE_DURATION) {
          // Double-check cached orders belong to current user
          if (cachedUserId === userId) {
          return
          }
          // If user mismatch, force refresh
        }

        set({ isOrdersLoading: true })
        try {
          const result = await ordersService.getOrders(userId, 1, 100, token || undefined)
          const orders: MarketplaceOrder[] = result.orders as MarketplaceOrder[]
          
          // Final validation: ensure orders belong to current user
          const currentAuthState = useAuthStore.getState()
          const currentUserId = currentAuthState.user?.id
          
          if (currentUserId === userId) {
          set({
            orders,
            ordersLastUpdated: now,
            isOrdersLoading: false
          })
          } else {
            // User changed during load - don't set orders
            set({ orders: [], ordersLastUpdated: null, isOrdersLoading: false })
          }
        } catch (error) {
          set({ isOrdersLoading: false })
        }
      },

      refreshAllData: async (token) => {
        const authState = useAuthStore.getState()
        const userId = authState.user?.id
        
        // Only refresh if we have a valid user
        if (!userId || !token) {
          return
        }
        
        const promises = []
        
        if (token) {
          promises.push(get().loadUserData(token))
        }
        // Force refresh products (bypass cache) when manually refreshing
        promises.push(get().forceRefreshProducts())
        
        await Promise.all(promises)

        // Force refresh orders with current user validation
        await get().forceRefreshOrders()
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

      forceRefreshOrders: async () => {
        await get().loadOrdersData(true)
      },

      updateOrdersFromWebSocket: async (orderIds: string[]) => {
        if (orderIds.length === 0) return

        const authState = useAuthStore.getState()
        const token = authState.token
        const userId = authState.user?.id || get().user?.id

        if (!token || !userId) return

        try {
          // Fetch all orders to get the updated ones
          const result = await ordersService.getOrders(userId, 1, 100, token || undefined)
          const updatedOrders: MarketplaceOrder[] = result.orders as MarketplaceOrder[]
          
          // Filter to only the orders that were updated
          const relevantOrders = updatedOrders.filter(order => orderIds.includes(order.orderId))
          
          if (relevantOrders.length === 0) return

          // Merge with existing orders - update existing or add new
          const state = get()
          const existingOrdersMap = new Map(state.orders.map(order => [order.orderId, order]))
          
          relevantOrders.forEach(updatedOrder => {
            existingOrdersMap.set(updatedOrder.orderId, updatedOrder)
          })

          const mergedOrders = Array.from(existingOrdersMap.values())
          
          set({
            orders: mergedOrders,
            ordersLastUpdated: Date.now()
          })
        } catch (error) {
          // Silently fail - WebSocket updates are best effort
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

            if (message.type === 'order_updated' && message.orderIds && message.orderIds.length > 0) {
              // Update only the specific orders that changed via WebSocket
              state.updateOrdersFromWebSocket(message.orderIds)
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
                if (!websocketService.isConnected()) {
                  if (!state.isProductsLoading) {
                    state.forceRefreshProducts()
                  }
                  // Polling fallback - only refresh if WebSocket is disconnected
                  if (!state.isOrdersLoading) {
                    state.loadOrdersData(false) // Use cached if available
                  }
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
            // Polling fallback - only refresh if WebSocket is disconnected
            if (!state.isOrdersLoading) {
              state.loadOrdersData(false) // Use cached if available
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
          orders: [],
          ordersLastUpdated: null,
          isOrdersLoading: false,
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
        // Clear all user-specific data immediately
        set({
          user: null,
          userLastUpdated: null,
          products: [],
          productsLastUpdated: null,
          orders: [], // CRITICAL: Clear orders immediately on logout
           ordersLastUpdated: null,
          isUserLoading: false,
          isProductsLoading: false,
           isOrdersLoading: false,
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
        orders: state.orders,
        ordersLastUpdated: state.ordersLastUpdated,
      }),
      onRehydrateStorage: () => (state) => {
        // Validate that rehydrated orders belong to current user
        if (state) {
          const authState = useAuthStore.getState()
          const currentUserId = authState.user?.id
          const cachedUserId = state.user?.id
          
          // If user mismatch, clear orders immediately
          if (currentUserId && cachedUserId && currentUserId !== cachedUserId) {
            state.orders = []
            state.ordersLastUpdated = null
          }
          
          // If no current user, clear orders
          if (!currentUserId) {
            state.orders = []
            state.ordersLastUpdated = null
          }
        }
      },
    }
  )
)
