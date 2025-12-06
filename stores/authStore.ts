import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { getMe, type MobileUser } from '../services/user'

type User = MobileUser

type AuthState = {
  token: string | null
  user: User | null
  isLoading: boolean
  setToken: (t: string | null) => Promise<void>
  setUser: (u: User | null) => Promise<void>
  hydrateFromStorage: () => Promise<void>
  logout: () => Promise<void>
}

async function clearUserScopedStores() {
  await Promise.all([
    (async () => {
      try {
        const { useUserActivityStore } = await import('./userActivityStore')
        useUserActivityStore.getState().clearUserData()
      } catch {
        // Ignore errors if userActivityStore is unavailable
      }
    })(),
    (async () => {
      try {
        const { useDataStore } = await import('./dataStore')
        const dataState = useDataStore.getState()
        dataState.stopAutoRefresh?.()
        dataState.clearCache()
      } catch {
        // Ignore errors if dataStore is unavailable
      }
    })(),
    (async () => {
      try {
        const { useCartStore } = await import('./cartStore')
        const cartState = useCartStore.getState()
        // Clear cart items immediately (local only, no database call)
        cartState.clearCartLocal()
      } catch {
        // Ignore errors if cartStore is unavailable
      }
    })(),
  ])
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  setToken: async (t) => {
    if (t) {
      await SecureStore.setItemAsync('auth_token', t)
    } else {
      await SecureStore.deleteItemAsync('auth_token')
    }
    set({ token: t })
  },
  setUser: async (u) => {
    // If setting a new user (different from current), clear previous user's data
    const currentUser = get().user;
    if ((currentUser && u && currentUser.id !== u.id) || (!u && currentUser)) {
      // Clear all user-specific data BEFORE setting new user
      await clearUserScopedStores();
    }
    
    set({ user: u });
    
    // If setting a new user, load their cart
    if (u?.id) {
      try {
        const { useCartStore } = await import('./cartStore');
        const cartStore = useCartStore.getState();
        cartStore.setUserId(u.id);
      } catch {
        // Ignore errors if cartStore is unavailable
      }
    }
  },
  hydrateFromStorage: async () => {
    set({ isLoading: true })
    const t = await SecureStore.getItemAsync('auth_token')
    if (t) {
      set({ token: t })
      try {
        const me = await getMe(t)
        set({ user: me })
      } catch {
        // If we can't get user, clear token
        await SecureStore.deleteItemAsync('auth_token')
        set({ token: null })
      }
    }
    set({ isLoading: false })
  },
  logout: async () => {
    // Clear state immediately for instant UI response
    set({ token: null, user: null })
    
    await clearUserScopedStores();
    
    // Clean up storage in background
    SecureStore.deleteItemAsync('auth_token').catch(() => {})
  },
}))


