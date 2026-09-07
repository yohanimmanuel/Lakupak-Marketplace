// WebSocket service for real-time updates (offers, products)
import { API_BASE_URL } from './config';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type PlatformAnnouncementWsPayload = {
  id: number;
  title: string;
  body: string;
  category: string;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

interface WebSocketMessage {
  type:
    | 'offer_updated'
    | 'product_updated'
    | 'prices_updated'
    | 'order_updated'
    | 'notification'
    | 'platform_announcement_published'
    | 'platform_announcement_unpublished'
    | 'home_offers_updated'
    | 'ping'
    | 'pong';
  data?: unknown;
  productIds?: string[];
  offerIds?: string[];
  orderIds?: string[];
  announcement?: PlatformAnnouncementWsPayload;
  announcementId?: number;
  notification?: {
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    targetUserId?: number;
  };
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private token: string | null = null;

  constructor() {
    if (process.env.EXPO_PUBLIC_WS_URL) {
      this.url = `${process.env.EXPO_PUBLIC_WS_URL.replace(/\/$/, '')}/api/marketplace/ws`;
      return;
    }

    const isSecure = API_BASE_URL.startsWith('https');
    const protocol = isSecure ? 'wss' : 'ws';

    // Extract hostname and optional port from API_BASE_URL
    const hostWithPort = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const [hostname, urlPort] = hostWithPort.split(':');

    // In production (https), WebSockets route through the standard 443 proxy (no custom port needed)
    // unless EXPO_PUBLIC_WS_PORT is explicitly specified as a non-standard port.
    // Local development port (3001) is automatically ignored on HTTPS.
    if (isSecure) {
      const explicitPort = process.env.EXPO_PUBLIC_WS_PORT;
      const portPart = explicitPort && explicitPort !== '443' && explicitPort !== 'none' && explicitPort !== '3001' ? `:${explicitPort}` : '';
      this.url = `${protocol}://${hostname}${portPart}/api/marketplace/ws`;
    } else {
      // In local development (http), default to 3001 or EXPO_PUBLIC_WS_PORT
      const devPort = process.env.EXPO_PUBLIC_WS_PORT || urlPort || '3001';
      const portPart = devPort && devPort !== 'none' ? `:${devPort}` : '';
      this.url = `${protocol}://${hostname}${portPart}/api/marketplace/ws`;
    }
  }

  connect(token?: string | null): void {
    // If already connected with the same token, don't reconnect
    if (this.ws?.readyState === WebSocket.OPEN && this.token === token) {
      return;
    }

    // If connecting, wait for it to finish
    if (this.status === 'connecting') {
      return;
    }

    // If connected but token changed, disconnect first
    if (this.ws?.readyState === WebSocket.OPEN && this.token !== token) {
      this.disconnect();
    }

    this.token = token || null;
    this.status = 'connecting';

    try {
      // Add token to WebSocket URL if available
      const wsUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.startPing();
        this.notifyHandlers({ type: 'pong' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          // Invalid message format, ignore
        }
      };

      this.ws.onerror = () => {
        this.status = 'error';
        this.scheduleReconnect();
      };

      this.ws.onclose = () => {
        this.status = 'disconnected';
        this.stopPing();
        this.scheduleReconnect();
      };
    } catch (error) {
      this.status = 'error';
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopPing();
    this.cancelReconnect();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
  }

  subscribe(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle ping/pong for keepalive
    if (message.type === 'ping') {
      this.send({ type: 'pong' });
      return;
    }

    // Notify all handlers
    this.notifyHandlers(message);
  }

  private notifyHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        // Ignore handler errors
      }
    });
  }

  private send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        // Send failed, will reconnect
      }
    }
  }

  private startPing(): void {
    this.stopPing();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.cancelReconnect();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return; // Max attempts reached
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.status !== 'connected') {
        this.connect(this.token);
      }
    }, this.reconnectDelay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

