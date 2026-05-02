import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { pushNotificationService } from './pushNotifications';
import { NotificationService } from './notificationService';
import { useAuthStore } from '../stores/authStore';
import { getBuyerOrderNotificationStrings } from '../utils/orderNotificationI18n';

// Supabase configuration
// You need to add these to your .env file:
// EXPO_PUBLIC_SUPABASE_URL=https://qlvcoktigllxfyxmzhmd.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qlvcoktigllxfyxmzhmd.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Order status type
interface OrderChange {
  orderId: string;
  orderStatus: string;
  paymentStatus?: string | null;
  buyerId: string | null;
  storeName: string | null;
  totalAmount: number;
  userId: number | null;
}

type OrderChangeCallback = (order: OrderChange) => void;

class SupabaseRealtimeService {
  private supabase: SupabaseClient | null = null;
  private orderChannel: RealtimeChannel | null = null;
  private callbacks: Set<OrderChangeCallback> = new Set();
  private isConnected: boolean = false;

  // Initialize Supabase client
  private getClient(): SupabaseClient | null {
    if (!SUPABASE_ANON_KEY) return null;

    if (!this.supabase) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    }
    return this.supabase;
  }

  // Match buyerId to this marketplace user: mobile_user_X, LKB-<padded>, or LKB-<padded>-*
  private matchesBuyer(buyerId: string | null | undefined, marketplaceUserId: number): boolean {
    if (!buyerId) return false;
    if (buyerId === `mobile_user_${marketplaceUserId}`) return true;
    const padded = marketplaceUserId.toString().padStart(8, '0');
    if (buyerId === `LKB-${padded}`) return true;
    if (buyerId.startsWith(`LKB-${padded}-`)) return true;
    return false;
  }

  // Subscribe to order changes for a specific buyer
  subscribeToOrders(marketplaceUserId: number): void {
    const client = this.getClient();
    if (!client) return;

    // Unsubscribe from existing channel
    this.unsubscribe();

    // Subscribe to Order table changes. No server filter: Realtime doesn't support like,
    // and LKB-<id>-<distributor> has many values. We filter in the callback.
    this.orderChannel = client
      .channel(`orders:${marketplaceUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Order',
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;
          const buyerId = newRecord.buyerId ? String(newRecord.buyerId) : null;
          if (!this.matchesBuyer(buyerId, marketplaceUserId)) return;

          // Only trigger if orderStatus changed
          if (newRecord.orderStatus !== oldRecord.orderStatus) {
            const orderChange: OrderChange = {
              orderId: String(newRecord.orderId || ''),
              orderStatus: String(newRecord.orderStatus || ''),
              paymentStatus: newRecord.paymentStatus ? String(newRecord.paymentStatus) : null,
              buyerId,
              storeName: newRecord.storeName ? String(newRecord.storeName) : null,
              totalAmount: Number(newRecord.totalAmount || 0),
              userId: newRecord.userId ? Number(newRecord.userId) : null,
            };

            this.callbacks.forEach((callback) => {
              try {
                callback(orderChange);
              } catch (error) {
                console.error('Error in order change callback:', error);
              }
            });

            // If only paymentStatus changed upstream (common when distributors manage payments),
            // do NOT emit "Order Update" local notifications from Supabase realtime.
            // Payment notifications are handled via push/WebSocket 'payment' notifications.
            const oldPayment = oldRecord.paymentStatus ? String(oldRecord.paymentStatus) : null;
            const newPayment = newRecord.paymentStatus ? String(newRecord.paymentStatus) : null;
            if (oldPayment !== newPayment) {
              return;
            }

            // Show phone notification AND add to in-app notification list
            this.showOrderNotification(orderChange).catch((err) =>
              console.error('Failed to show push notification:', err)
            );
            this.addToNotificationList(orderChange).catch((err) =>
              console.error('Failed to add in-app notification:', err)
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Order',
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const buyerId = newRecord.buyerId ? String(newRecord.buyerId) : null;
          if (!this.matchesBuyer(buyerId, marketplaceUserId)) return;

          const orderChange: OrderChange = {
            orderId: String(newRecord.orderId || ''),
            orderStatus: String(newRecord.orderStatus || 'Pending'),
            buyerId,
            storeName: newRecord.storeName ? String(newRecord.storeName) : null,
            totalAmount: Number(newRecord.totalAmount || 0),
            userId: newRecord.userId ? Number(newRecord.userId) : null,
          };

          this.callbacks.forEach((callback) => {
            try {
              callback(orderChange);
            } catch (error) {
              console.error('Error in order change callback:', error);
            }
          });
        }
      )
      .subscribe((status) => {
        this.isConnected = status === 'SUBSCRIBED';
      });
  }

  // Show notification for order status change
  private async showOrderNotification(order: OrderChange): Promise<void> {
    const { orderId, orderStatus } = order;
    await pushNotificationService.showOrderNotification(orderId, orderStatus);
  }

  // Add to in-app notification list (NotificationService stores in AsyncStorage)
  private async addToNotificationList(order: OrderChange): Promise<void> {
    const { orderId, orderStatus } = order;
    const { title, body } = getBuyerOrderNotificationStrings(orderId, orderStatus);

    const authState = useAuthStore.getState();
    const userId = authState.user?.id ?? null;

    await NotificationService.createOrderNotifications(orderId, 1, undefined, userId, title, body);
  }

  // Add callback for order changes
  onOrderChange(callback: OrderChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  // Unsubscribe from all channels
  unsubscribe(): void {
    if (this.orderChannel) {
      this.orderChannel.unsubscribe();
      this.orderChannel = null;
    }
    this.isConnected = false;
  }

  // Check connection status
  getIsConnected(): boolean {
    return this.isConnected;
  }

  // Disconnect completely
  disconnect(): void {
    this.unsubscribe();
    this.callbacks.clear();
    if (this.supabase) {
      this.supabase.removeAllChannels();
    }
  }
}

export const supabaseRealtimeService = new SupabaseRealtimeService();
