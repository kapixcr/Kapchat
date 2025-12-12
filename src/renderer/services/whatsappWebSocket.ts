// Servicio WebSocket para comunicación en tiempo real con el servidor dedicado de WhatsApp

import { io, Socket } from 'socket.io-client';

class WhatsAppWebSocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor() {
    // Obtener URL del servidor desde variables de entorno o configuración
    this.serverUrl = 
      (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_WHATSAPP_SERVER_URL) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WHATSAPP_SERVER_URL) ||
      'http://localhost:3001';
  }

  connect(userId?: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    console.log('[WhatsApp WebSocket] Connecting to:', this.serverUrl);
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('[WhatsApp WebSocket] Connected');
      // Suscribirse a eventos del usuario
      if (userId) {
        this.socket?.emit('whatsapp:subscribe', userId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[WhatsApp WebSocket] Disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('[WhatsApp WebSocket] Error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onQR(callback: (qr: string) => void, userId?: string): void {
    if (!this.socket) {
      this.connect(userId);
    }
    const sessionId = userId || 'default';
    this.socket?.on(`whatsapp:qr:${sessionId}`, callback);
  }

  onReady(callback: (user?: any) => void, userId?: string): void {
    if (!this.socket) {
      this.connect(userId);
    }
    const sessionId = userId || 'default';
    this.socket?.on(`whatsapp:ready:${sessionId}`, callback);
  }

  onMessage(callback: (message: any) => void, userId?: string): void {
    if (!this.socket) {
      this.connect(userId);
    }
    const sessionId = userId || 'default';
    this.socket?.on(`whatsapp:message:${sessionId}`, callback);
  }

  onStateChange(callback: (state: string) => void, userId?: string): void {
    if (!this.socket) {
      this.connect(userId);
    }
    const sessionId = userId || 'default';
    this.socket?.on(`whatsapp:state:${sessionId}`, callback);
  }

  sendMessage(userId: string, to: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('WebSocket no conectado'));
        return;
      }

      this.socket.emit('whatsapp:send', { userId, to, message }, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }
}

export const whatsappWebSocketService = new WhatsAppWebSocketService();

