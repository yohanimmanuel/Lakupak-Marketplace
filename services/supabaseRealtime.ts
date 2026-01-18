import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/authStore';
import { pushNotificationService } from './pushNotifications';

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

  // Subscribe to order changes for a specific buyer
  subscribeToOrders(marketplaceUserId: number): void {
    const client = this.getClient();
    if (!client) return;

    // Unsubscribe from existing channel
    this.unsubscribe();

    // Build the buyer ID pattern (mobile_user_{userId})
    const buyerIdPattern = `mobile_user_${marketplaceUserId}`;

    // Subscribe to Order table changes
    this.orderChannel = client
      .channel(`orders:${marketplaceUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Order',
          filter: `buyerId=eq.${buyerIdPattern}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;

          // Only trigger if orderStatus changed
          if (newRecord.orderStatus !== oldRecord.orderStatus) {
            const orderChange: OrderChange = {
              orderId: String(newRecord.orderId || ''),
              orderStatus: String(newRecord.orderStatus || ''),
              buyerId: newRecord.buyerId ? String(newRecord.buyerId) : null,
              storeName: newRecord.storeName ? String(newRecord.storeName) : null,
              totalAmount: Number(newRecord.totalAmount || 0),
              userId: newRecord.userId ? Number(newRecord.userId) : null,
            };

            // Notify all callbacks
            this.callbacks.forEach((callback) => {
              try {
                callback(orderChange);
              } catch (error) {
                console.error('Error in order change callback:', error);
              }
            });

            // Show push notification
            this.showOrderNotification(orderChange);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Order',
          filter: `buyerId=eq.${buyerIdPattern}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;

          const orderChange: OrderChange = {
            orderId: String(newRecord.orderId || ''),
            orderStatus: String(newRecord.orderStatus || 'Pending'),
            buyerId: newRecord.buyerId ? String(newRecord.buyerId) : null,
            storeName: newRecord.storeName ? String(newRecord.storeName) : null,
            totalAmount: Number(newRecord.totalAmount || 0),
            userId: newRecord.userId ? Number(newRecord.userId) : null,
          };

          // Notify all callbacks
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

    let title = 'Order Update';
    let body = `Your order #${orderId} status has been updated.`;

    switch (orderStatus) {
      case 'Confirmed':
        title = 'Order Confirmed';
        body = `Great news! Your order #${orderId} has been confirmed and is being processed.`;
        break;
      case 'Packed':
        title = 'Order Packed';
        body = `Your order #${orderId} has been packed and is ready for shipping.`;
        break;
      case 'Shipped':
        title = 'Order Shipped';
        body = `Your order #${orderId} is on its way! Track your delivery for updates.`;
        break;
      case 'Delivered':
        title = 'Order Delivered';
        body = `Your order #${orderId} has been delivered. Enjoy your purchase!`;
        break;
      case 'Cancelled':
        title = 'Order Cancelled';
        body = `Your order #${orderId} has been cancelled.`;
        break;
      case 'Returned':
        title = 'Order Returned';
        body = `Your order #${orderId} return has been processed.`;
        break;
    }

    // Show local notification
    await pushNotificationService.scheduleLocalNotification(title, body, {
      type: 'order',
      orderId,
      orderStatus,
    });
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
