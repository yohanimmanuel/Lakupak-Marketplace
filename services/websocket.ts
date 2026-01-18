// WebSocket service for real-time updates (offers, products)
import { API_BASE_URL } from './config';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: 'offer_updated' | 'product_updated' | 'prices_updated' | 'order_updated' | 'notification' | 'ping' | 'pong';
  data?: unknown;
  productIds?: string[];
  offerIds?: string[];
  orderIds?: string[];
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
    // WebSocket server runs on a separate port (default 3001)
    // Convert HTTP/HTTPS URL to WS/WSS and use WS_PORT if available
    const wsPort = process.env.EXPO_PUBLIC_WS_PORT || '3001';
    
    // Extract hostname from API_BASE_URL
    const host = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const hostname = host.split(':')[0]; // Remove port if present
    const protocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    
    // Construct WebSocket URL properly (no double slashes)
    this.url = `${protocol}://${hostname}:${wsPort}/api/marketplace/ws`;
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

