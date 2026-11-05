import { create } from 'zustand';

type AppendOrderState = {
  appendOrderId: string;
  setAppendOrderId: (orderId: string) => void;
  clearAppendOrderId: () => void;
};

/** Remembers the order being edited so a later cart checkout adds to that order. */
export const useAppendOrderStore = create<AppendOrderState>((set) => ({
  appendOrderId: '',
  setAppendOrderId: (orderId) => set({ appendOrderId: orderId.trim() }),
  clearAppendOrderId: () => set({ appendOrderId: '' }),
}));
