import AsyncStorage from '@react-native-async-storage/async-storage';

export type EditCheckoutDraft = {
  orderId: string;
  paymentMethod: 'bank_transfer' | 'cod';
  shipping: string;
  sellerDeliveryMode?: string;
  buyerCourierMode?: string;
  shippingByDistributor?: Record<string, string>;
  sellerDeliveryModeByDist?: Record<string, string>;
  buyerCourierModeByDist?: Record<string, string>;
};

const STORAGE_KEY = 'lakuEditCheckoutDraft';

/** In-memory cache so remounts within the same session can read sync before AsyncStorage resolves. */
let memoryDraft: EditCheckoutDraft | null = null;

export function peekEditCheckoutDraft(orderId?: string | null): EditCheckoutDraft | null {
  if (!memoryDraft) return null;
  if (orderId && memoryDraft.orderId !== orderId) return null;
  return memoryDraft;
}

export async function readEditCheckoutDraft(orderId?: string | null): Promise<EditCheckoutDraft | null> {
  // Prefer memory — AsyncStorage may still be writing after a fast navigate.
  if (memoryDraft && (!orderId || memoryDraft.orderId === orderId)) {
    return memoryDraft;
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditCheckoutDraft>;
    if (!parsed.orderId || typeof parsed.paymentMethod !== 'string') return null;
    const draft: EditCheckoutDraft = {
      orderId: parsed.orderId,
      paymentMethod: parsed.paymentMethod === 'cod' ? 'cod' : 'bank_transfer',
      shipping: typeof parsed.shipping === 'string' ? parsed.shipping : '',
      sellerDeliveryMode: parsed.sellerDeliveryMode,
      buyerCourierMode: parsed.buyerCourierMode,
      shippingByDistributor: parsed.shippingByDistributor,
      sellerDeliveryModeByDist: parsed.sellerDeliveryModeByDist,
      buyerCourierModeByDist: parsed.buyerCourierModeByDist,
    };
    memoryDraft = draft;
    if (orderId && draft.orderId !== orderId) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function writeEditCheckoutDraft(draft: EditCheckoutDraft): Promise<void> {
  memoryDraft = draft;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export async function clearEditCheckoutDraft(): Promise<void> {
  memoryDraft = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
