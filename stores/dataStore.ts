import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product } from '../data/sampleProducts'
import { marketplaceService, MarketplaceProduct, type MarketplaceHomeOfferPayload } from '../services/marketplace'
import { getMe, MobileUser } from '../services/user'
import { websocketService } from '../services/websocket'
import { ordersService } from '../services/orders'
import { AppState } from 'react-native'
import { useAuthStore } from './authStore'
import { pushNotificationService } from '../services/pushNotifications'
import { supabaseRealtimeService } from '../services/supabaseRealtime'
import { usePlatformAnnouncementsRealtimeStore } from './platformAnnouncementsRealtimeStore'

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
  returnRequests?: {
    id: number;
    orderId: string;
    marketplaceUserId: number;
    reason: string;
    reasonDetail?: string | null;
    imageUrls: string[];
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }[];
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

  /** Published special offers for home carousel and /offers list. */
  homeOffers: MarketplaceHomeOfferPayload[]
  
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
  loadHomeOffers: (token: string) => Promise<void>
  forceRefreshProducts: () => Promise<void>
  forceRefreshOrders: () => Promise<void>
  updateOrdersFromWebSocket: (orderIds: string[]) => Promise<void>
  startAutoRefresh: (token?: string | null) => void
  stopAutoRefresh: () => void
  clearProductsCache: () => void
  clearCache: () => void
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes - increased from 1min to reduce unnecessary requests
const AUTO_REFRESH_INTERVAL = 60 * 1000 // 60 seconds - reduced from 10s to prevent backend overload

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
      homeOffers: [],
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
        promises.push(get().loadHomeOffers(token))
        
        await Promise.all(promises)

        // Force refresh orders with current user validation
        await get().forceRefreshOrders()
      },

      loadHomeOffers: async (token) => {
        try {
          const offers = await marketplaceService.getHomeOffersList(token)
          set({ homeOffers: offers })
        } catch {
          set({ homeOffers: [] })
        }
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
        
        // Start Supabase Realtime for order notifications
        const authState = useAuthStore.getState()
        const userId = authState.user?.id
        if (userId) {
          // Subscribe to order changes via Supabase Realtime
          supabaseRealtimeService.subscribeToOrders(userId)
          
          // Add callback to refresh orders when they change
          supabaseRealtimeService.onOrderChange((orderChange) => {
            const state = get()
            // Refresh orders to get the latest data
            if (!state.isOrdersLoading) {
              state.forceRefreshOrders()
            }
          })
        }
        
        // Try WebSocket first (real-time updates) - for product/offer updates
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

            if (message.type === 'platform_announcement_published' && message.announcement) {
              const a = message.announcement
              usePlatformAnnouncementsRealtimeStore.getState().pushIncoming({
                id: a.id,
                title: a.title,
                body: a.body,
                category: a.category,
                imageUrl: a.imageUrl,
                linkUrl: a.linkUrl,
                publishedAt: a.publishedAt,
                createdAt: a.createdAt,
              })
              // Foreground: prefer remote push for announcement banners to avoid duplicates (push + WebSocket).
              // Background: WebSocket is typically disconnected anyway, but keep local as a best-effort fallback.
              if (AppState.currentState !== 'active') {
                const preview =
                  a.body && a.body.length > 120 ? `${a.body.slice(0, 117)}…` : (a.body ?? '')
                const cat = (a.category ?? '').trim().toLowerCase()
                const isPromotion = cat === 'promotion' || cat === 'promotions'
                void pushNotificationService.scheduleLocalNotification(
                  a.title,
                  preview || a.title || 'New update from Laku',
                  {
                    type: isPromotion ? 'promotion' : 'platform_announcement',
                    announcementId: String(a.id),
                  },
                  isPromotion ? 'promotions' : 'system',
                )
              }
            }

            if (message.type === 'platform_announcement_unpublished' && typeof message.announcementId === 'number') {
              usePlatformAnnouncementsRealtimeStore.getState().pushUnpublished(message.announcementId)
            }

            if (message.type === 'home_offers_updated') {
              const t = useAuthStore.getState().token
              if (t) {
                void get().loadHomeOffers(t)
              }
            }

            // Handle notification messages
            if (message.type === 'notification' && message.notification) {
              const { type, title, body, data, targetUserId } = message.notification
              // Ignore dashboard-only notifications: same WebSocket is used by Dashboard and Marketplace,
              // so dashboard_new (title "New notification") is for sellers only; do not show to buyers.
              if (type === 'dashboard_new') return

              const authState = useAuthStore.getState()
              const currentUserId = authState.user?.id

              if (!targetUserId || targetUserId === currentUserId) {
                if (type === 'order') {
                  const orderId = data?.orderId as string
                  const orderStatus = data?.orderStatus as string
                  if (orderId && orderStatus) {
                    pushNotificationService.showOrderNotificationInApp(orderId, orderStatus)
                  }
                } else {
                  const base =
                    data && typeof data === 'object' ? { ...(data as Record<string, unknown>) } : {};
                  const merged: Record<string, unknown> = {
                    ...base,
                    ...(typeof type === 'string' ? { type } : {}),
                  };
                  const channelId =
                    merged.type === 'promotion'
                      ? 'promotions'
                      : merged.type === 'platform_announcement' || merged.type === 'system'
                        ? 'system'
                        : 'orders';
                  void pushNotificationService.scheduleLocalNotification(title, body, merged, channelId)
                }
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
        
        // Disconnect Supabase Realtime
        supabaseRealtimeService.disconnect()
        
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
          homeOffers: [],
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
