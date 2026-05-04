import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from './authStore'

export type Conversation = {
  distributorId: number
  name: string
  phone: string | null
  logoUrl: string | null
  lastProductId?: string | null
  lastProductName?: string | null
  lastOpenedAt: number
}

type MessagesState = {
  currentUserId: number | null
  conversationsByUserId: Record<string, Conversation[]>

  setCurrentUserId: (userId: number) => void
  listConversations: (userId?: number | null) => Conversation[]
  upsertConversation: (c: Omit<Conversation, 'lastOpenedAt'> & { lastOpenedAt?: number }) => void
  clearUserData: () => void
}

function keyForUserId(userId: number) {
  return String(userId)
}

export const useMessagesStore = create<MessagesState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      conversationsByUserId: {},

      setCurrentUserId: (userId) => set({ currentUserId: userId }),

      listConversations: (userIdParam) => {
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = userIdParam ?? get().currentUserId ?? authUserId
        if (!userId) return []
        const list = get().conversationsByUserId[keyForUserId(userId)] ?? []
        return [...list].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      },

      upsertConversation: (c) => {
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = get().currentUserId ?? authUserId
        if (!userId) return
        if (get().currentUserId !== userId) set({ currentUserId: userId })

        const k = keyForUserId(userId)
        const prev = get().conversationsByUserId[k] ?? []
        const nextOpenedAt = typeof c.lastOpenedAt === 'number' ? c.lastOpenedAt : Date.now()

        const idx = prev.findIndex((x) => x.distributorId === c.distributorId)
        const nextItem: Conversation = {
          distributorId: c.distributorId,
          name: c.name,
          phone: c.phone ?? null,
          logoUrl: c.logoUrl ?? null,
          lastProductId: c.lastProductId ?? null,
          lastProductName: c.lastProductName ?? null,
          lastOpenedAt: nextOpenedAt,
        }

        const nextList =
          idx >= 0
            ? [nextItem, ...prev.filter((_, i) => i !== idx)]
            : [nextItem, ...prev]

        set({
          conversationsByUserId: {
            ...get().conversationsByUserId,
            [k]: nextList,
          },
        })
      },

      clearUserData: () => {
        const authUserId = useAuthStore.getState().user?.id ?? null
        const userId = get().currentUserId ?? authUserId
        if (!userId) {
          set({ conversationsByUserId: {}, currentUserId: null })
          return
        }
        const k = keyForUserId(userId)
        const { [k]: _, ...rest } = get().conversationsByUserId
        const shouldClearCurrent = get().currentUserId === userId
        set(shouldClearCurrent ? { conversationsByUserId: rest, currentUserId: null } : { conversationsByUserId: rest })
      },
    }),
    {
      name: 'messages-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        conversationsByUserId: state.conversationsByUserId,
      }),
    }
  )
)

