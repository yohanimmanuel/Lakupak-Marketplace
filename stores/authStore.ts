import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { getMe, type MobileUser } from '../services/user'

type User = MobileUser

type AuthState = {
  token: string | null
  user: User | null
  isLoading: boolean
  hasHydrated: boolean
  suspension: { active: boolean; reason?: string | null; startedAt?: number | null }
  blockSuspensionUntilNextToken: boolean
  setToken: (t: string | null) => Promise<void>
  setUser: (u: User | null) => Promise<void>
  setSuspension: (active: boolean, reason?: string | null) => void
  hydrateFromStorage: () => Promise<void>
  logout: () => Promise<void>
}

function isSuspensionError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code
    if (code === 'ACCOUNT_SUSPENDED') return true
    if (error.message.includes('ACCOUNT_SUSPENDED')) return true
  }
  if (typeof error === 'object') {
    const maybe = error as { code?: unknown; message?: unknown }
    if (maybe.code === 'ACCOUNT_SUSPENDED') return true
    if (typeof maybe.message === 'string' && maybe.message.includes('ACCOUNT_SUSPENDED')) return true
  }
  return false
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
  hasHydrated: false,
  suspension: { active: false, reason: null, startedAt: null },
  blockSuspensionUntilNextToken: false,
  setToken: async (t) => {
    if (t) {
      await SecureStore.setItemAsync('auth_token', t)
    } else {
      await SecureStore.deleteItemAsync('auth_token')
    }
    // Once a new token is set, allow suspension UI again.
    set({ token: t, blockSuspensionUntilNextToken: t ? false : get().blockSuspensionUntilNextToken })
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
  setSuspension: (active, reason) => {
    if (!active) {
      set({ suspension: { active: false, reason: null, startedAt: null } })
      return
    }
    // If logout/navigation has started, ignore late ACCOUNT_SUSPENDED responses from in-flight requests.
    if (get().blockSuspensionUntilNextToken) return
    set({ suspension: { active: true, reason: reason ?? null, startedAt: Date.now() } })
  },
  hydrateFromStorage: async () => {
    // Only block UI on the very first hydration.
    if (!get().hasHydrated) {
      set({ isLoading: true })
    }
    const t = await SecureStore.getItemAsync('auth_token')
    if (t) {
      set({ token: t })
      try {
        const me = await getMe(t)
        set({ user: me })
      } catch (error) {
        // If we can't get user, clear token unless the error is a suspension error.
        // (Suspension is handled by a blocking modal + countdown.)
        const suspensionActive = get().suspension.active
        const preserveToken = isSuspensionError(error) || suspensionActive
        if (!preserveToken) {
          await SecureStore.deleteItemAsync('auth_token')
          set({ token: null })
        }
      }
    }
    set({ isLoading: false, hasHydrated: true })
  },
  logout: async () => {
    // Clear state immediately for instant UI response
    set({
      token: null,
      user: null,
      suspension: { active: false, reason: null, startedAt: null },
      blockSuspensionUntilNextToken: true,
    })
    
    await clearUserScopedStores();
    
    // Clean up storage in background
    SecureStore.deleteItemAsync('auth_token').catch(() => {})
  },
}))


