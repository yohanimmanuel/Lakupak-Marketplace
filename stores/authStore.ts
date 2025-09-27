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
    if (currentUser && u && currentUser.id !== u.id) {
      try {
        const { useUserActivityStore } = await import('./userActivityStore');
        useUserActivityStore.getState().clearUserData();
      } catch (error) {
        // Ignore errors if userActivityStore is not available
      }
    }
    
    set({ user: u });
  },
  hydrateFromStorage: async () => {
    set({ isLoading: true })
    const t = await SecureStore.getItemAsync('auth_token')
    if (t) {
      set({ token: t })
      try {
        const me = await getMe(t)
        set({ user: me })
      } catch {}
    }
    set({ isLoading: false })
  },
  logout: async () => {
    // Clear state immediately for instant UI response
    set({ token: null, user: null })
    
    // Clear user activity data when logging out
    try {
      const { useUserActivityStore } = await import('./userActivityStore');
      useUserActivityStore.getState().clearUserData();
    } catch (error) {
      // Ignore errors if userActivityStore is not available
    }
    
    // Clean up storage in background
    SecureStore.deleteItemAsync('auth_token').catch(() => {})
  },
}))


